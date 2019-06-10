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
    ApolloGraphClient,
    Configuration,
    QueryNoCacheOptions,
} from "@atomist/automation-client";
import chalk from "chalk";
import * as inquirer from "inquirer";
import { createSpinner } from "../config";
import * as print from "../print";
import {
    configureCredentialsForResourceProvider,
    CreateBinaryRepositoryProviderMutation,
} from "./util";

const BinaryProviderQuery = `query BinaryRepositoryProviderQuery {
  BinaryRepositoryProvider {
    id
    type
    providerId
    authProviderId
    state {
      error
      name
    }
    url
    credential {
      id
    }
  }
}`;

interface BinaryProvider {
    BinaryRepositoryProvider: Array<{
        id: string;
        type: string;
        state: {
            error: string;
            name: string;
        }
    }>;
}

export async function createMaven(workspaceId: string,
                                  apiKey: string,
                                  cfg: Configuration): Promise<{ code: number }> {
    return createBinaryRegistry("maven2", workspaceId, apiKey, cfg);
}

export async function createNpm(workspaceId: string,
                                apiKey: string,
                                cfg: Configuration): Promise<{ code: number }> {
    return createBinaryRegistry("npm", workspaceId, apiKey, cfg);
}

export async function createBinaryRegistry(type: "maven2" | "npm",
                                           workspaceId: string,
                                           apiKey: string,
                                           cfg: Configuration): Promise<{ code: number }> {
    let providerId: string;

    const graphClient = new ApolloGraphClient(`${cfg.endpoints.graphql}/${workspaceId}`,
        { Authorization: `Bearer ${apiKey}` });

    let spinner = createSpinner(`Verifying Docker provider`);
    const providerResult = await graphClient.query<BinaryProvider, {}>({
        query: BinaryProviderQuery,
        options: QueryNoCacheOptions,
    });
    spinner.stop(true);

    if (!!providerResult && !!providerResult.BinaryRepositoryProvider && providerResult.BinaryRepositoryProvider.length > 0) {
        const provider = providerResult.BinaryRepositoryProvider.find(p => p.type === type);
        if (!!provider.state && !!provider.state.error) {
            print.log(`Binary provider is in state ${chalk.cyan(provider.state.name)} with:
${chalk.red(provider.state.error)}`);
        } else if (!!provider.state) {
            print.log(`Binary provider is in state ${chalk.cyan(provider.state.name)}`);
        }
    } else {
        spinner = createSpinner(`Creating new binary registry provider`);

        print.log("");
        const questions: inquirer.Question[] = [{
            type: "input",
            name: "name",
            message: "Name",
        }, {
            type: "input",
            name: "url",
            message: "URL",
        }, {
            type: "list",
            name: "secured",
            message: "Has credentials",
            choices:  [{
                name: "Yes",
                value: "yes",
            }, {
                name: "No",
                value: "no",
            }],
        }, {
            type: "input",
            name: "username",
            message: "User name",
            when: a => a.secured === "yes",
        }, {
            type: "input",
            name: "password",
            message: "Password",
            when: a => a.secured === "yes",
        }];
        const answers = await inquirer.prompt(questions);

        const result = await graphClient.mutate<{ createBinaryRegistryProvider: { id: string } }, {}>({
            mutation: CreateBinaryRepositoryProviderMutation,
            variables: {
                type,
                name: answers.name,
                url: answers.url,
            },
        });
        providerId = result.createBinaryRegistryProvider.id;

        if (answers.secured === "yes") {
            await configureCredentialsForResourceProvider(providerId, answers.username, answers.password, workspaceId, apiKey, cfg);
        }
        spinner.stop(true);
    }
    return {code: 0};
}
