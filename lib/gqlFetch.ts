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

import * as fs from "fs-extra";
import * as path from "path";

import { resolveCliConfig } from "./cliConfig";
import { graphqlDir } from "./gql";
import * as print from "./print";
import { spawnBinary } from "./spawn";

/**
 * Command-line options and arguments for gql-fetch.
 */
export interface GqlFetchOptions {
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
    const cliConfig = resolveCliConfig();
    if (!cliConfig.apiKey) {
        print.error(`No API key set in user configuration, run 'atomist config' first`);
        return Promise.resolve(1);
    }
    if (!cliConfig.workspaceIds || cliConfig.workspaceIds.length < 1) {
        print.error(`No workspace IDs set in use configuration, run 'atomist config' first`);
        return Promise.resolve(1);
    } else if (cliConfig.workspaceIds.length > 1) {
        print.warn(`More than one workspace ID in user configuration, using first: ${cliConfig.workspaceIds[0]}`);
    }
    const workspaceId = cliConfig.workspaceIds[0];
    const graphQL = cliConfig.endpoints && cliConfig.endpoints.graphql
        ? cliConfig.endpoints.graphql : "https://automation.atomist.com/graphql/team";

    const outDir = graphqlDir(opts.cwd);
    const outSchema = path.join(outDir, "schema.json");
    await fs.ensureDir(outDir);
    const spawnOpts = {
        command: "apollo",
        args: [
            "schema:download",
            outSchema,
            "--endpoint", `${graphQL}/${workspaceId}`,
            "--header", `Authorization: Bearer ${cliConfig.apiKey}`,
        ],
        cwd: opts.cwd,
        install: opts.install,
        compile: false,
    };
    return spawnBinary(spawnOpts);
}
