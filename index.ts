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
    shouldAddLocalSdmCommands,
} from "./lib/command";
import { config } from "./lib/config";
import { execute } from "./lib/execute";
import { git } from "./lib/git";
import { gitHook } from "./lib/gitHook";
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

        })))
        .command("execute <name>", "Run a command", ya => {
            return ya
                .positional("name", {
                    describe: "Name of command to run, command parameters PARAM=VALUE can follow",
                })
                .option("change-dir", commonOptions.changeDir)
                .option("compile", commonOptions.compile)
                .option("install", commonOptions.install);
        }, argv => cliCommand(() => execute({
            name: argv.name,
            cwd: argv["change-dir"],
            compile: argv.compile,
            install: argv.install,
            args: argv._.filter(a => a !== "execute" && a !== "exec" && a !== "cmd"),
        })))
        .command("git", "[DEPRECATED] Create a git-info.json file for an Atomist client", ya => {
            return ya
                .option("change-dir", commonOptions.changeDir);
        }, argv => cliCommand(() => git({

            cwd: argv["change-dir"],

        })))
        .command("gql-fetch", "Retrieve GraphQL schema", (ya: yargs.Argv) => {
            return ya
                .option("change-dir", commonOptions.changeDir)
                .option("install", commonOptions.install);
        }, argv => cliCommand(() => gqlFetch({
        })))
        .command("git-hook", "Process Git hook data for local SDM", ya => {
            return ya;
        }, argv => cliCommand(() => gitHook(process.argv)))
        .command("gql-fetch", "Retrieve GraphQL schema", (ya: yargs.Argv) => {
            return ya
                .option("change-dir", commonOptions.changeDir)
                .option("install", commonOptions.install);
        }, argv => cliCommand(() => gqlFetch({
            cwd: argv["change-dir"],
            install: argv.install,

        })))
        .command("gql-gen <glob>", "Generate TypeScript code for GraphQL", ya => {
            return ya
                .option("change-dir", commonOptions.changeDir)
                .option("install", commonOptions.install);
        }, argv => cliCommand(() => gqlGen({
        })))
        .command("gql-gen <glob>", "[DEPRECATED] Generate TypeScript code for GraphQL", ya => {
            return ya
                .option("change-dir", commonOptions.changeDir)
                .option("install", commonOptions.install);
        }, argv => cliCommand(() => gqlGen({
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
<<<<<<< HEAD
    const YargBuilder = yb.freshYargBuilder({ epilogForHelpMessage: "Copyright Atomist, Inc. 2018" });
    if (!isReservedCommand(process.argv)) {
||||||| merged common ancestors
    if (!isReservedCommand(process.argv)) {
=======
    if (shouldAddLocalSdmCommands(process.argv)) {
>>>>>>> master
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
