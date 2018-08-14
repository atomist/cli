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
    Arg,
} from "@atomist/automation-client";

import * as print from "./print";

/**
 * Determine whether sdm-local commands should be loaded.  To improve
 * startup times and eliminate client startup when unnecessary, we do
 * not load the sdm-local commands if we are just running a native CLI
 * command.
 *
 * @param args command-line arguments, typically process.argv
 * @return true if the SDM local commands should be loaded
 */
export function shouldAddLocalSdmCommands(args: string[]): boolean {
    if (args.includes("--help") || args.includes("--h") || args.includes("-h") || args.includes("-?")) {
        return true;
    }
    const command = args.slice(2).filter(a => !/^-/.test(a)).shift();
    if (!command) {
        return false;
    }
    const reservedCommands = [
        "config",
        "execute",
        "git",
        "gql-fetch",
        "gql-gen",
        "kube",
        "start",
    ];
    return !reservedCommands.includes(command);
}

/**
 * Does this command start up an embedded SDM?
 * @param args command-line arguments, typically process.argv
 */
export function isEmbeddedSdmCommand(args: string[]) {
    const relevant = args.slice(2);
    return relevant.length > 0 && ["create sdm", "enable local"].includes(relevant.join(" "));
}

/**
 * Call the provided function with the provided arguments and capture
 * any errors.  When the function is complete, `process.exit` will be
 * called with the appropriate code, i.e., this function will never return.
 *
 * @param fn function providing the desired command and returning a
 *           Promise of an integer exit value.
 * @param argv command-line arguments
 */
export async function cliCommand(fn: () => Promise<number>): Promise<never> {
    try {
        const status = await fn();
        process.exit(status);
    } catch (e) {
        print.error(`Unhandled Error: ${e.message}`);
        process.exit(101);
    }
    throw new Error("You will not get here. You have exited.");
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
