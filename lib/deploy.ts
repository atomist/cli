/*
 * Copyright © 2019 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Configuration } from "@atomist/automation-client";
import { defaultConfiguration } from "@atomist/automation-client/lib/configuration";
import { execPromise } from "@atomist/automation-client/lib/util/child_process";
import axios from "axios";
import chalk from "chalk";
import * as fs from "fs-extra";
import * as inquirer from "inquirer";
import * as stringify from "json-stringify-safe";
import * as tmp from "tmp-promise";
import { resolveCliConfig } from "./cliConfig";
import * as print from "./print";
import {
    cleanCommandString,
    spawnPromise,
} from "./spawn";
import gitUrlParse = require("git-url-parse");
import yaml = require("js-yaml");

export interface DeployOptions {
    cloneUrl: string;
    index?: string;
    /** Namespace to deploy Atomist Kubernetes utilities into */
    ns?: string;
    /** Only dry-run the command */
    dryRun?: boolean;
    /** Confirm all questions */
    yes?: boolean;
}

// tslint:disable-next-line:cyclomatic-complexity
export async function deploy(opts: DeployOptions): Promise<number> {
    const ns: string = opts.ns || "sdm";
    const yes = opts.yes;
    let dryRun = opts.dryRun;

    const cliConfig = resolveCliConfig();
    const apiKey = cliConfig.apiKey;
    if (!apiKey) {
        print.error(`No API key set in user configuration, run 'atomist config' first`);
        return Promise.resolve(1);
    }
    const workspaceIds = cliConfig.workspaceIds;
    if (!workspaceIds || workspaceIds.length < 1) {
        print.error(`No workspace IDs set in user configuration, run 'atomist config' first`);
        return Promise.resolve(1);
    }

    const gitUrl = gitUrlParse(opts.cloneUrl);
    const name = `${gitUrl.name}${!gitUrl.name.endsWith("-sdm") ? "-sdm" : ""}`;

    if (dryRun === undefined && yes === undefined) {

        const questions: inquirer.Question[] = [
            {
                type: "list",
                name: "dryRun",
                message: `Ready to deploy SDM ${chalk.yellow(name)}:`,
                choices: [
                    {
                        name: "Yes",
                        value: "yes",
                        short: "Yes",
                    } as any, {
                        name: "Dry-run (prints Kubernetes specs)",
                        value: "dry-run",
                        short: "Dry-run",
                        checked: dryRun,
                    } as any],
            },
        ];

        const answers = await inquirer.prompt(questions);
        if (answers.dryRun === "no") {
            return 0;
        } else if (answers.dryRun === "dry-run") {
            dryRun = true;
        }
    }

    const k8Config: Configuration = {
        workspaceIds,
        apiKey,
        logging: { level: "debug" },
    };

    // For testing purpose, we add the staging endpoints into the config
    if (process.env.ATOMIST_ENDPOINTS === "staging") {
        k8Config.endpoints = defaultConfiguration().endpoints;
    }

    const k8sSdmSecret = encodeSecret(name, { "client.config.json": stringify(k8Config) });

    let cliSecretTmp: tmp.FileResult;
    try {
        cliSecretTmp = await tmp.file();
        await fs.write(cliSecretTmp.fd, stringify(k8sSdmSecret, null, 2), 0, "utf8");
    } catch (e) {
        print.error(`Failed to create temporary file: ${e.message}`);
        return 10;
    }

    const cliSdmUrl = ghRawUrl("cli");
    let cliSdmTmp: tmp.FileResult;
    try {
        cliSdmTmp = await tmp.file();
        const cliSdmContent = (await axios.get<string>(`${cliSdmUrl}/assets/kubectl/cli.yaml`)).data.replace(/ cli/g, ` ${name}`);
        const docs = yaml.safeLoadAll(cliSdmContent);
        const args = [
            `start`,
            `--repository-url=${opts.cloneUrl}`,
        ];
        if (!!opts.index) {
            args.push(`--index=${opts.index}`);
        }
        docs[4].spec.template.spec.containers[0].args = args;
        docs[4].spec.template.spec.containers[0].env = [
            ...(docs[4].spec.template.spec.containers[0].env || []),
            {
                name: "ATOMIST_GOAL_SCHEDULER",
                value: "kubernetes",
            }
        ];
        const sdocs = docs.map(sdoc => yaml.safeDump(sdoc)).join("---\n")
        await fs.write(cliSdmTmp.fd, sdocs, 0, "utf8");
    } catch (e) {
        print.error(`Failed to create temporary file: ${e.message}`);
        return 10;
    }

    const kubectlArgs: string[][] = [];
    kubectlArgs.push(
        ["apply", `--namespace=${ns}`, `--filename=${cliSecretTmp.path}`],
        ["apply", `--namespace=${ns}`, `--filename=${cliSdmTmp.path}`],
    );

    for (const args of kubectlArgs) {
        print.log("---");
        const spawnOpts = {
            command: "kubectl",
            args,
        };
        if (dryRun) {
            try {
                const cmdString = cleanCommandString(spawnOpts.command, spawnOpts.args);
                print.info(`Running "${cmdString}" in '${process.cwd()}'`);
                spawnOpts.args.push("--dry-run=true", "--output=json");
                const kubectlResult = await execPromise(spawnOpts.command, spawnOpts.args);
                const highlight = require("cli-highlight").highlight;
                print.log(highlight(kubectlResult.stdout.trim(), { language: "json" }));
            } catch (e) {
                print.error(`Failed to run 'kubectl apply --dry-run': ${e.message}`);
                return 30;
            }
        } else {
            const status = await spawnPromise(spawnOpts);
            if (status !== 0) {
                cliSdmTmp.cleanup();
                return status;
            }
        }
    }
    print.log("---");

    cliSecretTmp.cleanup();
    cliSdmTmp.cleanup();

    if (!dryRun) {
        print.log("");
        print.log(`Successfully installed Atomist k8s utilities into your cluster`);
        print.log(`Please confirm correct startup of k8s-sdm by running: ${chalk.yellow("kubectl get pod -n sdm")}`);
    }

    return 0;
}

/**
 * Return raw content GitHub.com URL for atomist repos.
 */
function ghRawUrl(repo: string): string {
    return `https://raw.githubusercontent.com/atomist/${repo}/master`;
}

/**
 * Simple Kubernetes v1.Secret interface.
 */
export interface KubeSecret {
    apiVersion: "v1";
    kind: "Secret";
    type: "Opaque";
    metadata: {
        name: string;
        namespace?: string;
    };
    data: {
        [key: string]: string;
    };
}

/**
 * Create encoded secret object from key-value pairs.
 *
 * @param secrets key-value pairs of secrets, the values are base64 encoded
 * @return Kubernetes secret object
 */
export function encodeSecret(name: string, secrets: { [key: string]: string }): KubeSecret {
    const kubeSecret: KubeSecret = {
        apiVersion: "v1",
        kind: "Secret",
        type: "Opaque",
        metadata: {
            name,
        },
        data: {},
    };
    for (const secret in secrets) {
        if (secrets.hasOwnProperty(secret)) {
            kubeSecret.data[secret] = Buffer.from(secrets[secret]).toString("base64");
        }
    }
    return kubeSecret;
}
