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

import * as fs from "fs-extra";
import * as path from "path";

import {
    resolveCliConfig,
} from "./cliConfig";
import { spawnBinary } from "./spawn";

/**
 * Command-line options and arguments for gql-fetch.
 */
export interface GqlFetchOptions {
    /** Atomist token, currently a GitHub personal access token with read:org scope */
    token: string;
    /** Atomist workspace/team ID */
    workspaceId: string;
    /** Directory to run command in, must be an automation client directory */
    cwd?: string;
    /** If true or no node_modules directory exists, run "npm install" before running command */
    install?: boolean;
}

/**
 * Fetch the GraphQL schema for an Atomist workspace.
 *
 * @param opts see GqlFetchOptions
 * @return integer return value
 */
export async function gqlFetch(opts: GqlFetchOptions): Promise<number> {
    if (!opts.token || !opts.workspaceId) {
        const cliConfig = resolveCliConfig();
        opts.token = (opts.token) ? opts.token : cliConfig.token;
        let teamId: string;
        if (cliConfig.teamIds) {
            if (typeof cliConfig.teamIds === "string") {
                teamId = cliConfig.teamIds;
            } else if (Array.isArray(cliConfig.teamIds)) {
                if (cliConfig.teamIds.length > 0) {
                    teamId = cliConfig.teamIds[0];
                }
            }
        }
        opts.workspaceId = (opts.workspaceId) ? opts.workspaceId : teamId;
    }
    const outDir = path.join(opts.cwd, "src", "graphql");
    const outSchema = path.join(outDir, "schema.json");
    await fs.ensureDir(outDir);
    const spawnOpts = {
        command: "apollo-codegen",
        args: [
            "introspect-schema",
            `https://automation.atomist.com/graphql/team/${opts.workspaceId}`,
            "--output", outSchema,
            "--header", `Authorization: token ${opts.token}`,
        ],
        cwd: opts.cwd,
        install: opts.install,
        compile: false,
    };
    return spawnBinary(spawnOpts);
}
