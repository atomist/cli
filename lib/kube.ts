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

import {
    Configuration,
    webhookBaseUrl,
} from "@atomist/automation-client";
import { defaultConfiguration } from "@atomist/automation-client/lib/configuration";
import { execPromise } from "@atomist/automation-client/lib/util/child_process";
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

/**
 * Command-line options and arguments for kube.
 */
export interface KubeOptions {
    /** Name of Kubernetes cluster */
    env?: string;
    /** Namespace to deploy Atomist Kubernetes utilities into */
    ns?: string;
    /** Only dry-run the command */
    dryRun?: boolean;
    /** Confirm all questions */
    yes?: boolean;
}

/**
 * Deploy Atomist Kubernetes utilities into a Kubernetes cluster using
 * `kubectl`.
 *
 * @param opts see KubeOptions
 * @return integer return value, 0 if successful, non-zero otherwise
 */
export async function kube(opts: KubeOptions): Promise<number> {
    const ns: string = opts.ns;
    const environment: string = (opts.env) ? opts.env : "kubernetes";
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

    let context;
    try {
        const contextResult = await execPromise("kubectl", ["config", "current-context"]);
        context = contextResult.stdout.trim();
    } catch (e) {
        print.error(`Failed to obtain current kubectl context: ${e.message}`);
        return 10;
    }

    let url;
    if (context === "minikube") {
        try {
            const ipResult = await execPromise("minikube", ["ip"]);
            url = `http://${ipResult.stdout.trim()}`;
        } catch (e) {
            print.error(`Failed to obtain minikube ip: ${e.message}`);
            return 15;
        }
    }

    if (dryRun === undefined && yes === undefined) {


        const questions: inquirer.Question[] = [
            {
                type: "list",
                name: "dryRun",
                message: `Ready to deploy Atomist k8s utilities into context ${chalk.cyan(context)}:`,
                choices: [
                    {
                        name: "Yes",
                        value: "yes",
                        short: "Yes",
                    } as any, {
                        name: "Dry-run (prints k8s specs)",
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

    const k8ventUrl = ghRawUrl("k8vent");
    const k8sSdmUrl = ghRawUrl("k8s-sdm");

    const webhooks = kubeWebhookUrls(workspaceIds);
    const k8Config: Configuration = {
        workspaceIds,
        apiKey,
        environment,
        name: `@atomist/k8s-sdm_${environment}`,
        logging: { level: "debug" },
        sdm: {
            kubernetes: {
                provider: {
                    url,
                },
            },
        },
    };

    // For testing purpose, we add the staging endpoints into the config
    if (process.env.ATOMIST_ENDPOINTS === "staging") {
        k8Config.endpoints = defaultConfiguration().endpoints;
    }

    const k8ventSecret = encodeSecret("k8vent", { environment, webhooks });
    const k8sSdmSecret = encodeSecret("k8s-sdm", { "client.config.json": stringify(k8Config) });

    let k8ventTmp: tmp.FileResult;
    let k8sSdmTmp: tmp.FileResult;
    try {
        k8ventTmp = await tmp.file();
        await fs.write(k8ventTmp.fd, stringify(k8ventSecret), 0, "utf8");
        k8sSdmTmp = await tmp.file();
        await fs.write(k8sSdmTmp.fd, stringify(k8sSdmSecret), 0, "utf8");
    } catch (e) {
        print.error(`Failed to create temporary file: ${e.message}`);
        return 10;
    }

    const kubectlArgs: string[][] = [];
    if (ns) {
        k8Config.kubernetes = {
            mode: "namespace",
        };
        kubectlArgs.push(
            ["apply", `--namespace=${ns}`, `--filename=${k8ventTmp.path}`],
            ["apply", `--namespace=${ns}`, `--filename=${k8ventUrl}/kube/kubectl/namespace-scoped.yaml`],
            ["apply", `--namespace=${ns}`, `--filename=${k8sSdmTmp.path}`],
            ["apply", `--namespace=${ns}`, `--filename=${k8sSdmUrl}/assets/kubectl/namespace-scoped.yaml`],
        );
    } else {
        kubectlArgs.push(
            ["apply", `--filename=${k8ventUrl}/kube/kubectl/cluster-wide.yaml`],
            ["apply", "--namespace=k8vent", `--filename=${k8ventTmp.path}`],
            ["apply", `--filename=${k8sSdmUrl}/assets/kubectl/cluster-wide.yaml`],
            ["apply", "--namespace=sdm", `--filename=${k8sSdmTmp.path}`],
        );
    }

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
                k8ventTmp.cleanup();
                k8sSdmTmp.cleanup();
                return status;
            }
        }
    }
    print.log("---");

    k8ventTmp.cleanup();
    k8sSdmTmp.cleanup();

    if (!dryRun) {
        print.log("");
        print.log(`Successfully installed Atomist k8s utilities into your cluster`);
        print.log(`Please confirm correct startup of k8s-sdm by running: ${chalk.yellow("kubectl get pod -n sdm")}`);
    }

    return 0;
}

/**
 * Convert workspace IDs to Atomist Kubernetes webhook URLs.
 *
 * @param workspaceIds array of Atomist workspace/team IDs
 * @return comma-delimited list of webhook URLs
 */
export function kubeWebhookUrls(workspaceIds: string[]): string {
    const base = `${webhookBaseUrl()}/atomist/kube/teams`;
    return workspaceIds.map(id => `${base}/${id}`).join(",");
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
