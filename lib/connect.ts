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

import {
    Configuration,
    QueryNoCacheOptions,
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
import axios from "axios";
import chalk from "chalk";
import * as express from "express";
import * as inquirer from "inquirer";
import { sha256 } from "js-sha256";
import * as _ from "lodash";
import opn = require("opn");
import * as os from "os";
import { resolveUserConfig } from "./cliConfig";
import * as print from "./print";

/**
 * Command-line options and arguments for connect
 */
export interface ConfigOptions {
    /** Atomist API key */
    apiKey?: string;
    /** Atomist workspace/team ID */
    workspaceIds?: string;
}

const PersonByIdentityQuery = `query PersonByIdentity {
  personByIdentity {
    email
    team {
      id
      name
    }
    user {
      principal {
        pid
        sub
      }
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

export async function connect(opts: ConfigOptions): Promise<number> {
    const cfgPath = userConfigPath();
    const userCfg = resolveUserConfig();
    const defaultCfg = defaultConfiguration();
    const cfg = mergeConfigs(defaultCfg, userCfg);

    // No api key; connect and create a new key
    if (!opts.apiKey && !cfg.apiKey) {
        try {
            await createApiKey(cfg, userCfg);
        } catch (e) {
            print.error(`Failed to create API key: ${e.message}`);
            return 1;
        }
    }

    const apiKey = opts.apiKey || (cfg.apiKey);

    try {
        // Validate api key
        await validateApiKey(apiKey, cfg);
    } catch (e) {
        print.error(`Failed to validate API key: ${e.message}`);
        return 1;
    }

    if (!opts.workspaceIds || opts.workspaceIds.length === 0) {
        try {
            // Retrieve list and configure workspaces
            await configureWorkspaces(apiKey, cfg, userCfg);
        } catch (e) {
            print.error(`Failed to configure workspaces: ${e.message}`);
            return 1;
        }
    } else {
        userCfg.workspaceIds = opts.workspaceIds.split(/\s+/);
        await writeUserConfig(userCfg);
    }

    print.log(`Successfully wrote configuration: ${chalk.green(cfgPath)}`);
    return 0;
}

async function createApiKey(cfg: Configuration, userCfg: Configuration): Promise<void> {
    const providers = await axios.get(`${cfg.endpoints.auth}/providers`);

    let questions: inquirer.Question[] = [
        {
            type: "input",
            name: "apiKey",
            transformer: maskString,
            message: `Enter your ${chalk.cyan("api key")} from ${chalk.blue("https://app.atomist.com/apikeys")}
    or hit ${chalk.cyan("<ENTER>")} to select an authentication provider to login with Atomist`,
        },
    ];

    let answers = await inquirer.prompt(questions);
    if (!answers.apiKey) {

        print.log(`Select one of the following authentication providers available to login with Atomist:`);

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

        let authUrl;
        answers = await inquirer.prompt(questions);
        if (answers.provider) {
            authUrl = answers.provider;
        } else {
            process.exit(1);
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
                // Do something with this error
            }
            try {
                const token = await axios.post(`${cfg.endpoints.auth}/token`, {
                    code: req.query.code,
                    verifier,
                    grant_type: "pkce",
                });
                callback.resolve({ jwt: token.data.access_token });
                // TODO this page should change
                res.redirect("https://atomist.com/success-github.html");
            } catch (e) {
                res.status(500).json(e);
            }
        });

        const server = app.listen(port);
        const jwt = (await callback.promise).jwt;
        server.close();
        spinner.stop(true);

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

        userCfg.apiKey = result.createApiKey.key;
        cfg.apiKey = result.createApiKey.key;
        await writeUserConfig(userCfg);
        spinner.stop(true);
    }
}

async function validateApiKey(apiKey: string, cfg: Configuration): Promise<void> {
    const spinner = createSpinner("Validating API key");
    const graphClient = new ApolloGraphClient(
        cfg.endpoints.graphql.replace("/team", ""),
        { Authorization: `Bearer ${apiKey}` });
    try {
        const result = await graphClient.query<PersonByIdentity, void>({
            query: PersonByIdentityQuery,
        });
        spinner.stop(true);
        if (result && result.personByIdentity && result.personByIdentity.length > 0) {
            print.log(`Logged in as ${chalk.green(result.personByIdentity[0].email)}`);
        } else {
            print.log(`Logged in`);
        }
    } catch (err) {
        spinner.stop(true);
        print.error(`Provided API key is not valid: ${err.message}`);
        process.exit(1);
    }
}

async function configureWorkspaces(apiKey: string, cfg: Configuration, userCfg: Configuration): Promise<void> {
    const graphClient = new ApolloGraphClient(
        cfg.endpoints.graphql.replace("/team", ""),
        { Authorization: `Bearer ${apiKey}` });
    const result = await graphClient.query<PersonByIdentity, void>({
        query: PersonByIdentityQuery,
        options: QueryNoCacheOptions,
    });
    const teams = _.get(result, "personByIdentity") || [];

    if (teams.length === 0) {
        print.log(`No workspaces available. Run ${chalk.cyan("atomist workspace create")}`);
        return;
    }

    print.log(`Select one or more workspaces to connect to:`);

    const questions: inquirer.Question[] = [
        {
            type: "checkbox",
            name: "workspaceIds",
            message: "Workspace IDs",
            choices: teams.sort((p1, p2) => p1.team.name.localeCompare(p2.team.name))
                .map(p => ({
                    name: `${p.team.id} - ${p.team.name}`,
                    value: p.team.id,
                    checked: cfg.workspaceIds.includes(p.team.id),
                })),
        },
    ];

    const answers: any = await inquirer.prompt(questions);
    if (answers.workspaceIds) {
        userCfg.workspaceIds = answers.workspaceIds;
        await writeUserConfig(userCfg);
    }
}

function createSpinner(text: string): any {
    const Spinner = require("cli-spinner").Spinner;
    const spinner = new Spinner(`${text} ${chalk.yellow("%s")} `);
    spinner.setSpinnerDelay(100);
    spinner.setSpinnerString("⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏");
    spinner.start();
    return spinner;
}

function nonce(length: number = 40): string {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
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
