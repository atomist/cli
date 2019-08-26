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
    QueryNoCacheOptions,
    toStringArray,
} from "@atomist/automation-client";
import {
    defaultConfiguration,
    mergeConfigs,
    userConfigPath,
    writeUserConfig,
} from "@atomist/automation-client/lib/configuration";
import { ApolloGraphClient } from "@atomist/automation-client/lib/graph/ApolloGraphClient";
import { Deferred } from "@atomist/automation-client/lib/internal/util/Deferred";
import { scanFreePort } from "@atomist/automation-client/lib/util/port";
// tslint:disable-next-line:import-blacklist
import axios from "axios";
import chalk from "chalk";
import * as express from "express";
import * as inquirer from "inquirer";
import { sha256 } from "js-sha256";
import * as _ from "lodash";
import opn = require("open");
import * as os from "os";
import { resolveUserConfig } from "./cliConfig";
import * as print from "./print";

/**
 * Command-line options and arguments for config
 */
export interface ConfigOptions {

    /** Atomist API key */
    apiKey?: string;

    /** Atomist workspace ID */
    workspaceId?: string;

    /** Create new API key regardless of a configured one */
    createApiKey?: boolean;
}

const UserQuery = `query User {
  user {
    principal {
      sub
      pid
    }
  }
}`;

interface User {
    user: {
        person: Array<{ email: string }>;
    };
}

const PersonByIdentityQuery = `query PersonByIdentity {
  personByIdentity {
    team {
      id
      name
    }
  }
}`;

interface PersonByIdentity {
    personByIdentity: Array<{
        email: string,
        team: {
            id: string,
            name: string,
        },
        user: {
            principal: {
                pid: string,
                sub: string,
            },
        },
    }>;
}

const CreateApiKeyMutation = `mutation createKey($description: String!){
  createApiKey(description: $description) {
    id
    key
    description
    createdAt
    lastUsed
    owner {
      id
    }
  }
}`;

interface CreateApiKeyVariables {
    description: string;
}

interface CreateApiKey {
    createApiKey: {
        key: string;
    };
}

/**
 * Set up local configuration with Atomist api key and workspaces
 * @param opts
 */
export async function config(opts: ConfigOptions): Promise<number> {
    const cfgPath = userConfigPath();
    const userCfg = resolveUserConfig();
    const defaultCfg = defaultConfiguration();
    const cfg = mergeConfigs(defaultCfg, userCfg);

    let apiKey = opts.createApiKey !== true ? (opts.apiKey || cfg.apiKey) : undefined;

    // No api key; config and create a new key
    if (!apiKey) {
        try {
            apiKey = await createApiKey(cfg);
        } catch (e) {
            print.error(`Failed to create API key: ${e.message}`);
            return 1;
        }
    }

    try {
        // Validate api key
        await validateApiKey(apiKey, cfg);
    } catch (e) {
        print.error(`Failed to validate API key: ${e.message}`);
        return 1;
    }

    userCfg.apiKey = apiKey;
    await writeUserConfig(userCfg);

    let workspaceIds;
    if (!opts.workspaceId) {
        try {
            // Retrieve list and config workspaces
            workspaceIds = await configureWorkspaces(apiKey, cfg);
        } catch (e) {
            print.error(`Failed to configure workspaces: ${e.message}`);
            return 1;
        }
    } else {
        workspaceIds = opts.workspaceId.split(/\s+/);
    }

    userCfg.workspaceIds = workspaceIds;
    await writeUserConfig(userCfg);

    print.log(`Successfully wrote configuration ${chalk.green(cfgPath)}`);
    print.log(`You are ready to connect a software delivery machine.
To create one, try 'atomist create sdm'.
More info: https://docs.atomist.com/quick-start/#create-a-software-delivery-machine`);
    return 0;
}

/**
 * Initiate a login flow using a selected auth provider to create a new api key
 * @param cfg
 */
async function createApiKey(cfg: Configuration): Promise<string> {

    let questions: inquirer.QuestionCollection = [
        {
            type: "input",
            name: "apiKey",
            transformer: maskString,
            message: `Enter your ${chalk.cyan("api key")} from ${chalk.yellow("https://app.atomist.com/apikeys")}
    or hit ${chalk.cyan("<ENTER>")} to login with Atomist:`,
        },
    ];

    let answers = await inquirer.prompt(questions);
    if (!answers.apiKey) {
        const providers = await axios.get(`${cfg.endpoints.auth}/providers`);

        let authUrl;
        if (providers.data.length > 1) {
            print.log(`Select one of the following authentication providers\navailable to login with Atomist:`);

            questions = [
                {
                    type: "list",
                    name: "provider",
                    message: "Authentication Provider",
                    choices: providers.data.map((p: any) => ({
                        name: p.display_name,
                        value: p.login_url,
                    })),
                },
            ];

            answers = await inquirer.prompt(questions);
            authUrl = answers.provider;
        } else {
            authUrl = providers.data[0].login_url;
        }

        let spinner = createSpinner(`Waiting for login flow to finish in your browser`);

        const state = nonce(20);
        const verifier = nonce();
        const code = sha256(verifier);
        const port = await scanFreePort();
        const url = `${authUrl}?state=${state}&redirect-uri=http://127.0.0.1:${port}/callback&code-challenge=${code}`;

        await opn(url, { wait: false });

        const app = express();
        const callback = new Deferred<{ jwt: string }>();
        app.get("/callback", async (req, res) => {
            if (state !== req.query.state) {
                callback.reject("State parameter not correct after authentication. Abort!");
                // res.status(500).json({ message: "State parameter not correct after authentication" });
                res.redirect("https://atomist.com/error-oauth.html");
                return;
            }
            try {
                const token = await axios.post(`${cfg.endpoints.auth}/token`, {
                    code: req.query.code,
                    verifier,
                    grant_type: "pkce",
                });
                callback.resolve({ jwt: token.data.access_token });
                res.redirect("https://atomist.com/success-oauth.html");
            } catch (e) {
                callback.reject(new Error(`Authentication failed: ${e.message}`));
                // res.status(500).json({ message: e.message });
                res.redirect("https://atomist.com/error-oauth.html");
            }
        });

        const server = app.listen(port);
        let jwt;
        try {
            jwt = (await callback.promise).jwt;
        } finally {
            server.close();
            spinner.stop(true);
        }

        const graphClient = new ApolloGraphClient(
            cfg.endpoints.graphql.replace("/team", ""),
            { Authorization: `Bearer ${jwt}` });

        spinner = createSpinner(`Creating new API key`);

        const result = await graphClient.mutate<CreateApiKey, CreateApiKeyVariables>({
            mutation: CreateApiKeyMutation,
            variables: {
                description: `Generated by Atomist CLI on ${os.hostname()} by ${os.userInfo().username}`,
            },
        });

        spinner.stop(true);
        return result.createApiKey.key;
    } else {
        return answers.apiKey;
    }
}

/**
 * Validate a given api key by making a backend call to the GraphQL endpoint
 * @param apiKey
 * @param cfg
 */
export async function validateApiKey(apiKey: string, cfg: Configuration): Promise<void> {
    const spinner = createSpinner("Validating API key");
    const graphClient = new ApolloGraphClient(
        cfg.endpoints.graphql.replace("/team", ""),
        { Authorization: `Bearer ${apiKey}` });
    try {
        const providers = await axios.get(`${cfg.endpoints.auth}/providers`);
        const result = await graphClient.query<User, void>({
            query: UserQuery,
        });
        spinner.stop(true);

        // If there is no workspace yet, there is also no record returned
        const sub = _.get(result, "user.principal.sub");
        const pid = _.get(result, "user.principal.pid");
        const provider = providers.data.find((p: any) => p.id === pid);
        if (!!sub && !!pid) {
            print.log(`Logged in as ${chalk.green(sub)} using ${
                chalk.green(_.get(provider, "display_name", "n/a"))}`);
        } else {
            print.log(`Logged in`);
        }
    } catch (e) {
        if (!!e.networkError && e.networkError.statusCode === 401) {
            print.log(`
API key is invalid. Run ${chalk.cyan("atomist config --create-api-key")} to obtain a new API key.
`);
        }
        throw e;
    } finally {
        spinner.stop(true);
    }
}

/**
 * Read the list of workspaces and let the user choose to which workspaces to connect to
 * @param apiKey
 * @param cfg
 */
export async function configureWorkspaces(apiKey: string, cfg: Configuration, multiple: boolean = true): Promise<string[]> {
    const graphClient = new ApolloGraphClient(
        cfg.endpoints.graphql.replace("/team", ""),
        { Authorization: `Bearer ${apiKey}` });
    const result = await graphClient.query<PersonByIdentity, void>({
        query: PersonByIdentityQuery,
        options: QueryNoCacheOptions,
    });
    const workspaces = _.get(result, "personByIdentity") || [];

    if (workspaces.length === 0) {
        print.log(`No workspaces available. Run ${chalk.cyan("atomist workspace create")}`);
        return [];
    }

    if (multiple) {
        print.log(`Select one or more workspaces:`);
    } else {
        print.log(`Select a workspace:`);
    }

    const questions = [
        {
            type: multiple ? "checkbox" : "list",
            name: "workspaceIds",
            message: "Workspaces",
            choices: workspaces.sort((p1, p2) => p1.team.name.localeCompare(p2.team.name))
                .map(p => ({
                    name: `${p.team.id} - ${p.team.name}`,
                    value: p.team.id,
                    checked: cfg.workspaceIds.includes(p.team.id),
                    short: p.team.id,
                })),
            validate: (value: any) => {
                if (value.length < 1) {
                    return chalk.red(multiple ? "Please select at least one workspace" : "Please select one workspace");
                }
                return true;
            },
        },
    ];

    const answers: any = await inquirer.prompt(questions);
    return toStringArray(answers.workspaceIds) || [];
}

export function createSpinner(text: string): any {
    const Spinner = require("cli-spinner").Spinner;
    const spinner = new Spinner(`${text} ${chalk.yellow("%s")} `);
    spinner.setSpinnerDelay(100);
    spinner.setSpinnerString("⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏");
    spinner.start();
    return spinner;
}

export function nonce(length: number = 40): string {
    const crypto = require("crypto");
    return crypto
        .randomBytes(Math.ceil((length * 3) / 4))
        .toString("base64") // convert to base64 format
        .slice(0, length) // return required number of characters
        .replace(/\+/g, "0") // replace '+' with '0'
        .replace(/\//g, "0"); // replace '/' with '0'
}

/**
 * Mask secret string.
 * @param secret string to mask
 * @return masked string
 */
export function maskString(s: string): string {
    if (s.length > 10) {
        return s.charAt(0) + "*".repeat(s.length - 2) + s.charAt(s.length - 1);
    }
    return "*".repeat(s.length);
}
