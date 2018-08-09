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
 * Try to identify the subcommand being invoked and, if there is no
 * command or the command is a reserved command, return true.
 * Otherwise return false.
 *
 * @param args command-line arguments, typically process.argv
 * @return true is the SDM local commands should be loaded
 */
export function isReservedCommand(args: string[]): boolean {
    const command = guessCommand(args);
    if (command === undefined) {
        return true;
    }
    const reservedCommands = ["config", "git", "gql-fetch", "gql-gen", "kube", "start"];
    return reservedCommands.includes(command);
}

/*
  * Take a guess at what command they're going to run.
  * This will be inaccurate if they pass a dash-arg with a parameter.
  * But it's close enough for deciding whether to spend time loading SDM commands.
  */
function guessCommand(processArgv: string[]): string | undefined {
    const realArgs = processArgv.slice(2); // remove 'node <script>'
    const nonDashArgs = realArgs.filter(a => !a.startsWith("-"));
    return nonDashArgs[0]; // might be undefined
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
