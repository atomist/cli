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

import { Configuration } from "@atomist/automation-client";
import {
    defaultConfiguration,
    mergeConfigs,
    writeUserConfig,
} from "@atomist/automation-client/lib/configuration";
import chalk from "chalk";
import * as inquirer from "inquirer";
import * as _ from "lodash";
import { resolveUserConfig } from "./cliConfig";
import {
    configureWorkspaces,
    validateApiKey,
} from "./config";
import * as print from "./print";
import { createGitHubCom } from "./provider/github";

interface ProviderTypes {
    [key: string]: {
        label: string;
        create: (workspaceId: string,
                 apiKey: string,
                 cfg: Configuration) => Promise<{ code: number, configuration: Partial<Configuration> }>;
    };
}

/*const UnsupportedProvider = async (workspaceId: string,
                                   apiKey: string,
                                   cfg: Configuration) => {
    print.error("SCM provider not supported yet!");
    return {
        code: 1,
        configuration: cfg,
    };
};*/

const Providers: ProviderTypes = {
    github_com: {
        label: "GitHub.com",
        create: createGitHubCom,
    },
    /*ghe: {
        label: "GitHub Enterprise",
        create: UnsupportedProvider,
    },
    gitlab: {
        label: "GitLab",
        create: UnsupportedProvider,
    },
    gitlab_com: {
        label: "GitLab.com",
        create: UnsupportedProvider,
    },
    bitbucket: {
        label: "BitBucket",
        create: UnsupportedProvider,
    },*/
};

/**
 * Command-line options and arguments for provider create
 */
export interface CreateOptions {
    /** Atomist API key */
    apiKey?: string;

    /** Atomist workspace id */
    workspaceId?: string;
}

/**
 * Create a new SCM provider
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

    let workspaceId = opts.workspaceId;

    try {
        if (!workspaceId) {
            workspaceId = (await configureWorkspaces(apiKey, cfg, false))[0];
        }
    } catch (e) {
        print.error(`Failed to load list of workspaces: ${e.message}`);
        return 1;
    }

    print.log("Select an SCM provider to add to your workspace:");
    const questions: inquirer.Question[] = [
        {
            type: "list",
            name: "provider",
            message: "SCM provider",
            choices: _.map(Providers, (v, k) => ({ name: v.label, value: k })),
        },
    ];

    const answers = await inquirer.prompt(questions);
    try {
        const result = await Providers[answers.provider].create(workspaceId, apiKey, cfg);
        const newCfg = {
            ...userCfg,
            ...result.configuration,
        };
        await writeUserConfig(newCfg);
        print.log(`Successfully created SCM provider ${chalk.cyan(Providers[answers.provider].label)}`);
        return result.code;
    } catch (e) {
        print.error(`Failed to create SCM provider: ${e.message}`);
        return 1;
    }

    return 0;
}
