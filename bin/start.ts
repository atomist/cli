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

import "source-map-support/register";
import * as yargs from "yargs";
import { cliCommand } from "../lib/command";
import { repositoryStart } from "../lib/repositoryStart";
import { version } from "../lib/version";

function start(): void {
    yargs.command("start", "Start an SDM or automation client", argv => {
        argv.options({
            "change-dir": {
                alias: "C",
                default: process.cwd(),
                describe: "Path to automation client project",
                type: "string",
            },
            "compile": {
                default: true,
                describe: "Run 'npm run compile' before running",
                type: "boolean",
            },
            "install": {
                describe: "Run 'npm install' before running/compiling, default is to install if no " +
                    "'node_modules' directory exists",
                type: "boolean",
            },
            "local": {
                default: false,
                describe: "Start SDM in local mode",
                type: "boolean",
            },
            "profile": {
                describe: "Name of configuration profiles to include",
                type: "string",
                required: false,
                alias: "profiles",
            },
            "watch": {
                describe: "Enable watch mode",
                type: "boolean",
                default: false,
                required: false,
            },
            "debug": {
                describe: "Enable Node.js debugger",
                type: "boolean",
                default: false,
                required: false,
            },
            "repository-url": {
                describe: "Git URL to clone",
                type: "string",
                required: false,
            },
            "index": {
                describe: "Name of the file that exports the configuration",
                type: "string",
                required: false,
                implies: "repository-url",
                conflicts: "yaml",
            },
            "yaml": {
                describe: "Glob patters for yaml files to import",
                type: "string",
                required: false,
                implies: "repository-url",
                conflicts: "index",
            },
            "sha": {
                describe: "Git sha to checkout",
                type: "string",
                required: false,
                implies: "repository-url",
                alias: "branch",
            },
            "seed-url": {
                describe: "Git URL to clone the seed to overlay with SDM repository",
                type: "string",
                required: false,
                implies: "repository-url",
            },
        });
        return yargs;
    }, (argv: any) => {
        cliCommand(() => {
            return repositoryStart({
                cwd: argv["change-dir"],
                cloneUrl: argv["repository-url"],
                index: argv.index,
                yaml: argv.yaml,
                sha: argv.sha,
                local: argv.local,
                profile: argv.profile,
                seedUrl: argv["seed-url"],
                install: argv.install,
                compile: argv.compile,
                watch: argv.watch,
                debug: argv.debug,
            });
        });
    })
        .completion("completion", false as any)
        .showHelpOnFail(true, "Specify --help for available options")
        .alias("help", ["h", "?"])
        .version(version())
        .alias("version", "v")
        .describe("version", "Show version information")
        .strict()
        .wrap(Math.min(100, yargs.terminalWidth()))
        .argv;
}

start();
