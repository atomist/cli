/*
 * Copyright © 2018 Atomist, Inc.
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

import { execFileSync } from "child_process";
import * as stringify from "json-stringify-safe";

import { webhookBaseUrl } from "@atomist/automation-client/atomistWebhook";
import {
    Configuration,
    getUserConfig,
    resolveTeamIds,
    resolveToken,
} from "@atomist/automation-client/configuration";

function ghRawUrl(repo: string): string {
    return `https://raw.githubusercontent.com/atomist/${repo}/master`;
}

/**
 * Install the Atomist Kubernetes utilities in a Kubernetes cluster
 * using kubectl.
 *
 * @param argv yargs processed command-line arguments
 * @return 0 if successful, non-zero otherwise
 */
export async function cliAtomistKube(argv: any): Promise<number> {

    const ns: string = argv.namespace;
    const environment: string = (argv.environment) ? argv.environment : "kubernetes";

    const userConfig = getUserConfig();
    const token = resolveToken(userConfig);
    if (!token) {
        console.error(`No token set, try running 'atomist config' first`);
        return Promise.resolve(1);
    }
    const teamIds = resolveTeamIds(userConfig);
    if (!teamIds || teamIds.length < 1) {
        console.error(`No Atomist workspace/team IDs set, try running 'atomist config' first`);
        return Promise.resolve(1);
    }

    const k8hookBase = `${webhookBaseUrl()}/atomist/kube/teams`;
    const webhooks = `${k8hookBase}/` + teamIds.join(`,${k8hookBase}/`);
    const k8Config: Configuration = { teamIds, token, environment };
    const kubectlArgs: string[][] = [];
    if (ns) {
        k8Config.kubernetes = {
            mode: "namespace",
        };
        kubectlArgs.push(
            ["create", "secret", `--namespace=${ns}`, "generic", "k8vent", `--from-literal=environment=${environment}`,
                `--from-literal=webhooks=${webhooks}`],
            ["apply", `--namespace=${ns}`, `--filename=${ghRawUrl("k8vent")}/kube/kubectl/namespace-scoped.yaml`],
            ["create", "secret", `--namespace=${ns}`, "generic", "automation",
                `--from-literal=config=${stringify(k8Config)}`],
            ["apply", `--namespace=${ns}`,
                `--filename=${ghRawUrl("k8-automation")}/assets/kubectl/namespace-scoped.yaml`],
        );
    } else {
        kubectlArgs.push(
            ["apply", `--filename=${ghRawUrl("k8vent")}/kube/kubectl/cluster-wide.yaml`],
            ["create", "secret", "--namespace=k8vent", "generic", "k8vent", `--from-literal=environment=${environment}`,
                `--from-literal=webhooks=${webhooks}`],
            ["apply", `--filename=${ghRawUrl("k8-automation")}/assets/kubectl/cluster-wide.yaml`],
            ["create", "secret", "--namespace=k8-automation", "generic", "automation",
                `--from-literal=config=${stringify(k8Config)}`],
        );
    }

    for (const args of kubectlArgs) {
        try {
            execFileSync("kubectl", args, { stdio: "inherit", env: process.env });
        } catch (e) {
            console.error(`Command 'kubectl ${args.join(" ")}' failed: ${e.message}`);
            return Promise.resolve(e.status as number);
        }
    }

    return Promise.resolve(0);
}
