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

import { Arg } from "@atomist/automation-client/internal/invoker/Payload";

import * as print from "./print";

/**
 * Call the provided function with the provided arguments and capture
 * any errors.  When the function is complete, `process.exit` will be
 * called with the appropriate, i.e., this function will never return.
 *
 * @param fn function providing the desired command and returning a
 *           Promise of an integer exit value.
 * @param argv command-line arguments
 */
export async function cliCommand(fn: () => Promise<number>): Promise<void> {
    try {
        const status = await fn();
        process.exit(status);
    } catch (e) {
        print.error(`Unhandled Error: ${e.message}`);
        process.exit(101);
    }
}

/**
 * Parse positional parameters into parameter name/value pairs.  The
 * positional parameters should be of the form NAME[=VALUE].  If
 * =VALUE is omitted, the value is set to `undefined`.  If the VALUE
 * is empty, i.e., NAME=, then the value is the empty string.
 *
 * @param args typically argv._ from yargs
 * @return array of CommandInvocation Arg
 */
export function extractArgs(args: string[]): Arg[] {
    return args.map(arg => {
        const split = arg.indexOf("=");
        if (split < 0) {
            return { name: arg, value: undefined };
        }
        const name = arg.slice(0, split);
        const value = arg.slice(split + 1);
        return { name, value };
    });
}
