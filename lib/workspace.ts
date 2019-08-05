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
    defaultConfiguration,
    mergeConfigs,
    writeUserConfig,
} from "@atomist/automation-client/lib/configuration";
import { ApolloGraphClient } from "@atomist/automation-client/lib/graph/ApolloGraphClient";
import chalk from "chalk";
import * as inquirer from "inquirer";
import { resolveUserConfig } from "./cliConfig";
import {
    createSpinner,
    validateApiKey,
} from "./config";
import * as print from "./print";

const CreateTeamMutation = `
mutation CreateTeam($name: String!) {
  createTeam(teamName: $name) {
    id
  }
}
`;

interface CreateTeamVariables {
    name: string;
}

interface CreateTeam {
    createTeam: {
        id: string;
        name: string;
    };
}

/**
 * Command-line options and arguments for workspace create
 */
export interface CreateOptions {
    /** Atomist API key */
    apiKey?: string;

    /** Atomist workspace name */
    workspaceName?: string;
}

/**
 * Create a new Atomist workspace
 * @param opts
 */
export async function create(opts: CreateOptions): Promise<number> {
    const userCfg = resolveUserConfig();
    const defaultCfg = defaultConfiguration();
    const cfg = mergeConfigs(defaultCfg, userCfg);

    const apiKey = opts.apiKey || cfg.apiKey;

    if (!apiKey) {
        print.error(`No API key found. Run ${chalk.cyan("atomist config")} to obtain a key`);
        return 1;
    }

    try {
        // Validate api key
        await validateApiKey(apiKey, cfg);
    } catch (e) {
        print.error(`Failed to validate API key: ${e.message}`);
        return 1;
    }

    let workspaceId;
    try {
        workspaceId = await createWorkspace(opts.workspaceName, apiKey, cfg);
    } catch (e) {
        print.error(`Failed to create workspace: ${e.message}`);
        return 1;
    }

    userCfg.workspaceIds.push(workspaceId);
    await writeUserConfig(userCfg);

    return 0;
}

/**
 * Call the createTeam mutation after providing a workspace name
 * @param workspaceName
 * @param apiKey
 * @param cfg
 */
async function createWorkspace(name: string, apiKey: string, cfg: Configuration): Promise<string> {
    let workspaceName = name;

    print.log(`Create a new workspace:`);
    if (!workspaceName) {

        const questions: inquirer.Question[] = [
            {
                type: "input",
                name: "workspaceName",
                message: "Workspace Name",
                validate: value => {
                    return value && value.length > 3;
                },
            },
        ];

        const answers = await inquirer.prompt(questions);
        workspaceName = answers.workspaceName;
    }

    const graphClient = new ApolloGraphClient(
        cfg.endpoints.graphql.replace("/team", ""),
        { Authorization: `Bearer ${apiKey}` });

    const spinner = createSpinner(`Creating new workspace ${chalk.cyan(workspaceName)}`);

    const result = await graphClient.mutate<CreateTeam, CreateTeamVariables>({
        mutation: CreateTeamMutation,
        variables: {
            name: workspaceName,
        },
    });

    spinner.stop(true);
    print.log(
        `Successfully created new workspace ${chalk.cyan(workspaceName)} with id ${chalk.cyan(result.createTeam.id)}`);
    return result.createTeam.id;
}
