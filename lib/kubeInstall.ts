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
import { execPromise } from "@atomist/sdm";
import {
    K8sObject,
    K8sObjectApi,
} from "@atomist/sdm-pack-k8s/lib/kubernetes/api";
import { loadKubeConfig } from "@atomist/sdm-pack-k8s/lib/kubernetes/config";
import chalk from "chalk";
import { highlight } from "cli-highlight";
import * as fs from "fs-extra";
import * as inquirer from "inquirer";
import * as yaml from "js-yaml";
import * as stringify from "json-stringify-safe";
import * as os from "os";
import * as path from "path";
import * as request from "request";
import { resolveCliConfig } from "./cliConfig";
import * as print from "./print";

/**
 * Command-line options and arguments for kube.
 */
export interface KubeInstallOptions {
    /** Name of Kubernetes cluster */
    env?: string;
    /** Namespace to deploy Atomist Kubernetes utilities into */
    ns?: string;
    /** Only dry-run the command */
    dryRun?: boolean;
    /** Confirm all questions */
    yes?: boolean;
    /** URL of the public ingress */
    url?: string;
}

/**
 * Deploy Atomist Kubernetes utilities into a Kubernetes cluster.
 *
 * @param opts see [[KubeInstallOptions]]
 * @return integer return value, 0 if successful, non-zero otherwise
 */
// tslint:disable-next-line:cyclomatic-complexity
export async function kubeInstall(opts: KubeInstallOptions): Promise<number> {
    const ns: string = opts.ns;
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

    let context: string;
    try {
        const kubeConfigPath = path.join(os.homedir(), ".kube", "config");
        const kubeConfigString = await fs.readFile(kubeConfigPath, "utf8");
        const kubeConfig = yaml.safeLoad(kubeConfigString);
        context = kubeConfig["current-context"];
    } catch (e) {
        print.warn(`Failed to get current context from Kubernetes config: ${e.message}`);
    }

    let url = opts.url;
    if (context === "minikube" && !url) {
        try {
            const ipResult = await execPromise("minikube", ["ip"]);
            url = `http://${ipResult.stdout.trim()}`;
        } catch (e) {
            print.warn(`Failed to get minikube IP address, not setting URL: ${e.message}`);
        }
    }

    const environment = opts.env || context || "kubernetes";

    if (dryRun === undefined && yes === undefined) {
        const target = context ? `context ${chalk.cyan(context)}` : `cluster ${chalk.cyan(environment)}`;
        const questions: inquirer.QuestionCollection = [
            {
                type: "list",
                name: "dryRun",
                message: `Deploy Atomist Kubernetes utilities to ${target}:`,
                default: "yes",
                choices: [
                    {
                        name: "Yes",
                        value: "yes",
                        short: "Yes",
                    },
                    {
                        name: "Dry-run (print Kubernetes specs but do not apply them)",
                        value: "dry-run",
                        short: "Dry-run",
                    },
                    {
                        name: "No (exits immediately)",
                        value: "no",
                        short: "No",
                    },
                ],
            },
        ];
        const answers = await inquirer.prompt(questions);
        if (answers.dryRun === "no") {
            return 0;
        } else if (answers.dryRun === "dry-run") {
            dryRun = true;
        } else {
            dryRun = false;
        }
    }

    let specs: K8sObject[];
    try {
        specs = await fetchSpecs(ns);
    } catch (e) {
        print.error(e.message);
        return 1;
    }

    const webhooks = kubeWebhookUrls(workspaceIds);
    const k8sConfig = k8sSdmConfig({ apiKey, environment, url, workspaceIds });
    specs.push(encodeSecret("k8vent", ns || "k8vent", { environment, webhooks }));
    specs.push(encodeSecret("k8s-sdm", ns || "sdm", { "client.config.json": stringify(k8sConfig) }));

    if (dryRun) {
        specs.forEach(spec => {
            print.log("---");
            print.log(highlight(yaml.safeDump(spec), { language: "yaml" }).replace(/\n$/, ""));
        });
        return 0;
    }

    let client: K8sObjectApi;
    try {
        const kc = loadKubeConfig();
        client = kc.makeApiClient(K8sObjectApi);
    } catch (e) {
        print.error(`Failed to create Kubernetes client: ${errMsg(e)}`);
        return 2;
    }
    for (const spec of specs) {
        try {
            await applySpec(client, spec);
        } catch (e) {
            print.error(`Failed to apply ${specSlug(spec)} spec: ${errMsg(e)}`);
            return 3;
        }
    }

    print.log("");
    print.log(`Successfully installed Atomist Kubernetes utilities into your cluster`);
    print.log(`Please confirm correct startup of k8s-sdm by running:`);
    print.log(`  $ ${chalk.yellow("kubectl get pod -n " + (ns || "sdm"))}`);
    return 0;
}

/**
 * Fetch the appropriate Kubernetes specs from GitHub and parse them.
 *
 * @param ns Namespace resources are to be deployed to, if not cluster-wide
 * @return Resource specs that need to be upserted
 */
export async function fetchSpecs(ns?: string): Promise<K8sObject[]> {
    const specTails: Record<string, { ns: string, cluster: string }> = {
        "k8s-sdm": {
            ns: "/assets/kubectl/namespace-scoped.yaml",
            cluster: "/assets/kubectl/cluster-wide.yaml",
        },
        "k8vent": {
            ns: "/kube/kubectl/namespace-scoped.yaml",
            cluster: "/kube/kubectl/cluster-wide.yaml",
        },
    };
    const specs: K8sObject[] = [];
    for (const specSrc of Object.keys(specTails)) {
        const specBaseUrl = ghBaseRawUrl(specSrc);
        const specUrl = specBaseUrl + ((ns) ? specTails[specSrc].ns : specTails[specSrc].cluster);
        try {
            print.log(`Fetching ${chalk.cyan(specSrc)} specs: ${specUrl}`);
            const result = await requestPromise(specUrl);
            specs.push(...processSpecs(result.body, ns));
        } catch (e) {
            e.message = `Failed to download and parse spec '${specUrl}': ${errMsg(e)}`;
            throw e;
        }
    }
    return specs;
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
 * Return base raw content GitHub.com URL for atomist repos.
 */
function ghBaseRawUrl(repo: string): string {
    return `https://raw.githubusercontent.com/atomist/${repo}/master`;
}

/** Options informing the k8s-sdm configuration. */
export interface K8sSdmConfigOptions {
    apiKey: string;
    environment: string;
    workspaceIds: string[];
    url?: string;
}

/**
 * Create appropriate configuration for a k8s-sdm.
 */
export function k8sSdmConfig(opts: K8sSdmConfigOptions): Configuration {
    const cfg: Configuration = {
        apiKey: opts.apiKey,
        environment: opts.environment,
        logging: { level: "debug" },
        name: `@atomist/k8s-sdm_${opts.environment}`,
        sdm: {
            k8s: {
                options: {
                    addCommands: true,
                    registerCluster: true,
                },
            },
            kubernetes: {
                provider: {
                    url: opts.url,
                },
            },
        },
        workspaceIds: opts.workspaceIds,
    };
    return cfg;
}

function requestPromise(uri: string): Promise<{ body: any, response: request.Response }> {
    return new Promise((resolve, reject) => {
        request(uri, (error, response, body) => {
            if (error) {
                reject(error);
            } else {
                if (response.statusCode >= 200 && response.statusCode <= 299) {
                    resolve({ response, body });
                } else {
                    reject({ response, body });
                }
            }
        });
    });
}

function errMsg(e: any): string {
    if (e.message) {
        return e.message;
    } else if (e.body && e.body.message) {
        return e.body.message;
    } else if (e.response && e.response.body && e.response.body.message) {
        return e.response.body.message;
    } else if (e.response && e.response.statusMessage) {
        return e.response.body.message;
    } else {
        return stringify(e);
    }
}

export function processSpecs(raw: string, ns?: string): K8sObject[] {
    const specs: K8sObject[] = yaml.safeLoadAll(raw);
    if (ns) {
        specs.forEach(s => s.metadata.namespace = ns);
    }
    return specs;
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
export function encodeSecret(name: string, ns: string, secrets: { [key: string]: string }): KubeSecret {
    const kubeSecret: KubeSecret = {
        apiVersion: "v1",
        kind: "Secret",
        type: "Opaque",
        metadata: {
            name,
            namespace: ns,
        },
        data: {},
    };
    for (const secret of Object.keys(secrets)) {
        kubeSecret.data[secret] = Buffer.from(secrets[secret]).toString("base64");
    }
    return kubeSecret;
}

/**
 * Return informative string for spec.
 */
export function specSlug(spec: K8sObject): string {
    return [spec.kind, spec.metadata.namespace, spec.metadata.name].join("/").replace("//", "/");
}

/**
 * Create or update Kubernetes resource.
 */
export async function applySpec(client: K8sObjectApi, spec: K8sObject): Promise<void> {
    const slug = specSlug(spec);
    try {
        await client.read(spec);
    } catch (e) {
        print.log(`Creating ${slug}`);
        await client.create(spec);
        return;
    }
    print.log(`Updating ${slug}`);
    await client.patch(spec);
    return;
}
