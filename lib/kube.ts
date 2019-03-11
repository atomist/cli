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
import * as fs from "fs-extra";
import * as stringify from "json-stringify-safe";
import * as tmp from "tmp-promise";
import { resolveCliConfig } from "./cliConfig";
import * as print from "./print";
import { spawnPromise } from "./spawn";

/**
 * Command-line options and arguments for kube.
 */
export interface KubeOptions {
    /** Name of Kubernetes cluster */
    env?: string;
    /** Namespace to deploy Atomist Kubernetes utilities into */
    ns?: string;
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

    const k8ventUrl = ghRawUrl("k8vent");
    const k8sSdmUrl = ghRawUrl("k8s-sdm");

    const webhooks = kubeWebhookUrls(workspaceIds);
    const k8Config: Configuration = {
        workspaceIds,
        apiKey,
        environment,
        name: `@atomist/k8s-sdm_${environment}`,
    };
    if (ns) {
        k8Config.kubernetes = { mode: "namespace" };
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
        const spawnOpts = {
            command: "kubectl",
            args,
        };
        const status = await spawnPromise(spawnOpts);
        if (status !== 0) {
            k8ventTmp.cleanup();
            k8sSdmTmp.cleanup();
            return status;
        }
    }

    k8ventTmp.cleanup();
    k8sSdmTmp.cleanup();

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
