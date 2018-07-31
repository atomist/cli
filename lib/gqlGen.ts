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
import * as glob from "glob";
import * as path from "path";
import * as util from "util";

import * as print from "./print";
import { spawnBinary } from "./spawn";

/**
 * Command-line options for gql-gen.
 */
export interface GqlGenOptions {
    /** Glob pattern for locating GraphQL files */
    glob: string;
    /** Directory to run command in, must be an automation client directory */
    cwd?: string;
    /** If true or no node_modules directory exists, run "npm install" before running command */
    install?: boolean;
}

/**
 * Generate TypeScript typings for GraphQL schema entities.
 *
 * @param opts see GqlGenOptions
 * @return integer return value
 */
export async function gqlGen(opts: GqlGenOptions): Promise<number> {
    // check if the project has a custom schema
    const schema = (fs.existsSync(path.join(opts.cwd, "src", "graphql", "schema.json"))) ?
        "node_modules/@atomist/automation-client/graph/schema.cortex.json" :
        "./src/graphql/schema.json";

    const spawnOpts = {
        command: "gql-gen",
        args: [
            "--file", schema,
            "--template", "typescript",
            "--no-schema",
            "--out", "src/typings/types.ts",
        ],
        cwd: opts.cwd,
        install: opts.install,
        compile: false,
    };
    const pGlob = util.promisify(glob);
    try {
        const graphqlFiles = await pGlob(opts.glob);
        if (graphqlFiles.length > 0) {
            spawnOpts.args.push(opts.glob);
        }
    } catch (e) {
        print.error(`GraphQL file glob pattern '${opts.glob}' failed, continuing: ${e.message}`);
    }
    return spawnBinary(spawnOpts);
}
