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
    userConfigPath,
    writeUserConfig,
} from "@atomist/automation-client/lib/configuration";
import * as inquirer from "inquirer";
import { resolveUserConfig } from "./cliConfig";
import * as print from "./print";

/**
 * Command-line options and arguments for config.
 */
export interface ConfigOptions {
    /** Atomist API key */
    apiKey?: string;
    /** Atomist workspace/team ID */
    workspaceId?: string;
}

/**
 * Generate Atomist user configuration file, potentially merging with
 * existing user configuration.
 *
 * @param opts see ConfigOptions
 * @return integer return value
 */
// tslint:disable:cyclomatic-complexity
export async function config(opts: ConfigOptions): Promise<number> {
    const userConfig = resolveUserConfig();
    if (opts.workspaceId && !userConfig.workspaceIds.includes(opts.workspaceId)) {
        userConfig.workspaceIds.push(opts.workspaceId);
    }
    if (opts.apiKey) {
        if (userConfig.apiKey && userConfig.apiKey !== opts.apiKey) {
            print.warn(`Overwriting current API key with value from command line.`);
        }
        userConfig.apiKey = opts.apiKey;
    }
    const configPath = userConfigPath();

    let safeKey: string;
    if (userConfig.apiKey) {
        safeKey = maskString(userConfig.apiKey);
    } else {
        print.log(`
As part of the Atomist configuration, you need an Atomist API key.
You can generate an Atomist API key in the Atomist web application:
https://app.atomist.com/apiKeys
`);
    }

    const questions: inquirer.Question[] = [
        {
            type: "input",
            name: "workspaceIds",
            message: "Atomist Workspace IDs (space delimited)",
            validate: value => {
                if (!/\S/.test(value) && userConfig.workspaceIds.length < 1) {
                    return `The list of team IDs you entered is empty`;
                }
                return true;
            },
            default: (userConfig.workspaceIds.length > 0) ? userConfig.workspaceIds.join(" ") : undefined,
        },
        {
            type: "input",
            name: "apiKey",
            message: "API Key",
            transformer: maskString,
            validate: value => {
                if (value.length < 1) {
                    return `The API key you entered is empty`;
                }
                return true;
            },
            default: (safeKey) ? safeKey : undefined,
        },
    ];

    try {
        const answers = await inquirer.prompt(questions);
        if (answers.workspaceIds) {
            userConfig.workspaceIds = (answers.workspaceIds as string).split(/\s+/);
        }

        if (answers.apiKey && answers.apiKey !== safeKey) {
            userConfig.apiKey = answers.apiKey;
        }

        await writeUserConfig(userConfig);
    } catch (e) {
        print.error(`Failed to create client configuration '${configPath}': ${e.message}`);
        return 1;
    }
    print.info(`Successfully created Atomist client configuration: ${configPath}`);
    return 0;
}

/**
 * Mask secret string.
 *
 * @param secret string to mask
 * @return masked string
 */
export function maskString(s: string): string {
    if (s.length > 10) {
        return s.charAt(0) + "*".repeat(s.length - 2) + s.charAt(s.length - 1);
    }
    return "*".repeat(s.length);
}
