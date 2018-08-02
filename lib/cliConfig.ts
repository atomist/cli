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
    getUserConfig,
    resolveWorkspaceIds,
    UserConfig,
} from "@atomist/automation-client";

import * as print from "./print";

export type CliConfig = Pick<Configuration, "apiKey" | "workspaceIds">;

/**
 * Read user config and resolve workspace IDs then simplify config
 * down to a CliConfig.
 *
 * @return CliConfig populated from user config
 */
export function resolveUserConfig(): UserConfig {
    let userConfig: UserConfig;
    try {
        userConfig = getUserConfig() || {};
    } catch (e) {
        print.warn(`Failed to load user configuration, ignoring: ${e.message}`);
        userConfig = {};
    }
    resolveWorkspaceIds(userConfig);
    if (!userConfig.workspaceIds) {
        userConfig.workspaceIds = [];
    }
    if (userConfig.teamIds) {
        delete userConfig.teamIds;
    }
    return userConfig;
}

/**
 * Read user config and simplify it down to a CliConfig.
 *
 * @return CliConfig populated from user config
 */
export function resolveCliConfig(): CliConfig {
    const userConfig = resolveUserConfig();
    return {
        apiKey: userConfig.apiKey,
        workspaceIds: userConfig.workspaceIds,
    };
}
