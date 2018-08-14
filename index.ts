#!/usr/bin/env node
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


import * as yb from "@atomist/sdm-local/src/cli/invocation/command/support/yargBuilder";
import * as yargs from "yargs";
import {
    cliCommand,
    isEmbeddedSdmCommand,
    isReservedCommand,
} from "./lib/command";
import { config } from "./lib/config";
import { execute } from "./lib/execute";
import { git } from "./lib/git";
import { gqlFetch } from "./lib/gqlFetch";
import { gqlGen } from "./lib/gqlGen";
import { kube } from "./lib/kube";
import * as print from "./lib/print";
import { start } from "./lib/start";
import { version } from "./lib/version";

process.env.SUPPRESS_NO_CONFIG_WARNING = "true";
if (!isEmbeddedSdmCommand(process.argv)) {
    process.env.ATOMIST_DISABLE_LOGGING = "true";
}


function setupYargs(yargBuilder: yb.YargBuilder) {
    const commonOptions: { [key: string]: yb.CommandLineParameter } = {
        changeDir: {
            parameterName: "change-dir",
            alias: "C",
            default: process.cwd(),
            describe: "Path to automation client project",
            type: "string",
        },
        compile: {
            parameterName: "compile",
            default: true,
            describe: "Run 'npm run compile' before running",
            type: "boolean",
        },
        install: {
            parameterName: "install",
            describe: "Run 'npm install' before running/compiling, default is to install if no " +
                "'node_modules' directory exists",
            type: "boolean",
        },
    };

    yargBuilder.command({
        command: "config",
        describe: "Create Atomist user configuration",
        builder: ya => {
            return ya
                .option("api-key", {
                    describe: "Atomist API key",
                    type: "string",
                })
                .option("workspace-id", {
                    describe: "Atomist workspace ID",
                    type: "string",
                });
        }, handler: argv => cliCommand(() => config({
            apiKey: argv["api-key"],
            workspaceId: argv["workspace-id"],
        })),
    });
    ["execute <name>", "exec <name>", "cmd <name>"].forEach(commandLine =>
        yargBuilder.withSubcommand(
            yb.yargCommandWithPositionalArguments({
                command: commandLine,
                describe: "Run a command",
                parameters: [commonOptions.changeDir, commonOptions.compile, commonOptions.install],
                positional: [{
                    key: "name", opts: {
                        describe: "Name of command to run, command parameters PARAM=VALUE can follow",
                    },
                }]
                , handler: (argv: any) => cliCommand(() => execute({
                    name: argv.name,
                    cwd: argv["change-dir"],
                    compile: argv.compile,
                    install: argv.install,
                    args: argv._.filter((a: string) => a !== "execute" && a !== "exec" && a !== "cmd"),
                })),
            })));
    yargBuilder.withSubcommand(yb.yargCommandFromSentence({
        command: "git",
        describe: "Create a git-info.json file for an Atomist client",
        parameters: [commonOptions.changeDir],
        handler: (argv: any) => cliCommand(() => git({
            cwd: argv["change-dir"],
        })),
    }));
    yargBuilder.withSubcommand(yb.yargCommandFromSentence({
        command: "gql-fetch", describe: "Retrieve GraphQL schema",
        parameters: [commonOptions.changeDir, commonOptions.install],
        handler: (argv: any) => cliCommand(() => gqlFetch({
            cwd: argv["change-dir"],
            install: argv.install,
        })),
    }));
    yargBuilder.withSubcommand(yb.yargCommandWithPositionalArguments({
        command: "gql-gen <glob>",
        describe: "Generate TypeScript code for GraphQL",
        parameters: [commonOptions.changeDir, commonOptions.install],
        positional: [],
        handler: (argv: any) => cliCommand(() => gqlGen({
            glob: argv.glob,
            cwd: argv["change-dir"],
            install: argv.install,
        })),
    }));
    yargBuilder.withSubcommand(yb.yargCommandFromSentence({
        command: "kube", describe: "Deploy Atomist utilities to Kubernetes cluster",
        parameters: [{
            parameterName: "environment", opts: {
                describe: "Informative name for yout Kubernetes cluster",
                type: "string",
            },
        } as yb.CommandLineParameter, {
            parameterName: "namespace", opts: {
                describe: "Deploy utilities in namespace mode",
                type: "string",
            },
        } as yb.CommandLineParameter],
        handler: (argv: any) => cliCommand(() => kube({
            env: argv.environment,
            ns: argv.namespace,
        })),
    }));
    yargBuilder.withSubcommand(yb.yargCommandFromSentence({
        command: "start",
        describe: "Start an SDM or automation client",
        parameters: [
            commonOptions.changeDir,
            commonOptions.compile,
            commonOptions.install, {
                parameterName: "local",
                opts: {
                    default: false,
                    describe: "Start SDM in local mode",
                    type: "boolean",
                },
            } as yb.CommandLineParameter],
        handler: (argv: any) => cliCommand(() => start({
            cwd: argv["change-dir"],
            install: argv.install,
            compile: argv.compile,
            local: argv.local,
        })),
    }));
    yargBuilder.build().save(yargs);
    // tslint:disable-next-line:no-unused-expression
    yargs.completion("completion")
        .showHelpOnFail(false, "Specify --help for available options")
        .alias("help", ["h", "?"])
        .version(version())
        .alias("version", "v")
        .describe("version", "Show version information")
        .strict()
        .wrap(Math.min(100, yargs.terminalWidth()))
        .argv;
}

async function main() {
    const YargBuilder = yb.freshYargBuilder({ epilogForHelpMessage: "Copyright Atomist, Inc. 2018" });
    if (!isReservedCommand(process.argv)) {
        // Lazily load sdm-local to prevent early initialization
        const sdmLocal = require("@atomist/sdm-local");
        await sdmLocal.addLocalSdmCommands(YargBuilder);
    }
    setupYargs(YargBuilder);
}


main()
    .catch((err: Error) => {
        print.error(`Unhandled error: ${err.message}`);
        print.error(err.stack);
        process.exit(102);
    });
