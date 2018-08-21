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
    CommandInvocation,
} from "@atomist/automation-client";
import * as stringify from "json-stringify-safe";

import { extractArgs } from "./command";
import { spawnBinary } from "./spawn";

/**
 * Command-line options and arguments for execute.
 */
export interface ExecuteOptions {
    /** Name of command to run */
    name: string;
    /** Directory to run command in, must be an automation client directory */
    cwd?: string;
    /** If true, run `npm run compile` before running command */
    compile?: boolean;
    /** If true or no node_modules directory exists, run "npm install" before running command */
    install?: boolean;
    /** Unprocessed command-line arguments, typically provided by yargs._ */
    args: string[];
}

/**
 * Execute a command handler.
 *
 * @param opts see ExecuteOptions
 * @return integer return value
 */
export async function execute(opts: ExecuteOptions): Promise<number> {
    const args = extractArgs(opts.args);
    const ci: CommandInvocation = {
        name: opts.name,
        args,
    };
    const spawnOpts = {
        ...opts,
        command: "atm-command",
        args: [stringify(ci)],
    };
    return spawnBinary(spawnOpts);
}
