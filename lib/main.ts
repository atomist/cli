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

process.env.SUPPRESS_NO_CONFIG_WARNING = "true";
process.env.ATOMIST_DISABLE_LOGGING = "true";

import { addLocalSdmCommands } from "@atomist/sdm-local";
import * as yargs from "yargs";

import {
    cliCommand,
    isReservedCommand,
} from "./command";
import { config } from "./config";
import { execute } from "./execute";
import { git } from "./git";
import { gqlFetch } from "./gqlFetch";
import { gqlGen } from "./gqlGen";
import { kube } from "./kube";
import { start } from "./start";
import { version } from "./version";

const CommonOptions: { [key: string]: yargs.Options; } = {
    changeDir: {
        alias: "C",
        default: process.cwd(),
        describe: "Path to automation client project",
        type: "string",
    },
    compile: {
        default: true,
        describe: "Run 'npm run compile' before running",
        type: "boolean",
    },
    install: {
        describe: "Run 'npm install' before running/compiling, default is to install if no " +
            "'node_modules' directory exists",
        type: "boolean",
    },
};

function addConfigCommand(yar: yargs.Argv) {
    yar.command("config", "Create Atomist user configuration", ya => {
        return ya
            .option("api-key", {
                describe: "Atomist API key",
                type: "string",
            })
            .option("workspace-id", {
                describe: "Atomist workspace ID",
                type: "string",
            });
    }, argv => cliCommand(() => config({
        apiKey: argv["api-key"],
        workspaceId: argv["workspace-id"],
    })));
}

function addExecuteCommand(yar: yargs.Argv) {
    yar.command(["execute <name>", "exec <name>", "cmd <name>"], "Run a command", ya => {
        return ya
            .positional("name", {
                describe: "Name of command to run, command parameters PARAM=VALUE can follow",
            })
            .option("change-dir", CommonOptions.changeDir)
            .option("compile", CommonOptions.compile)
            .option("install", CommonOptions.install);
    }, argv => cliCommand(() => execute({
        name: argv.name,
        cwd: argv["change-dir"],
        compile: argv.compile,
        install: argv.install,
        args: argv._.filter(a => a !== "execute" && a !== "exec" && a !== "cmd"),
    })));
}

function addGitCommand(yar: yargs.Argv) {
    yar.command("git", "Create a git-info.json file for an Atomist client", ya => {
        return ya
            .option("change-dir", CommonOptions.changeDir);
    }, argv => cliCommand(() => git({
        cwd: argv["change-dir"],
    })));
}

function addGqlFetchCommand(yar: yargs.Argv) {
    yar.command("gql-fetch", "Retrieve GraphQL schema", (ya: yargs.Argv) => {
        return ya
            .option("change-dir", CommonOptions.changeDir)
            .option("install", CommonOptions.install);
    }, argv => cliCommand(() => gqlFetch({
        cwd: argv["change-dir"],
        install: argv.install,
    })));
}

function addGqlGenCommand(yar: yargs.Argv) {
    yar.command("gql-gen <glob>", "Generate TypeScript code for GraphQL", ya => {
        return ya
            .option("change-dir", CommonOptions.changeDir)
            .option("install", CommonOptions.install);
    }, argv => cliCommand(() => gqlGen({
        glob: argv.glob,
        cwd: argv["change-dir"],
        install: argv.install,
    })));
}

function addKubeCommand(yar: yargs.Argv) {
    yar.command("kube", "Deploy Atomist utilities to Kubernetes cluster", ya => {
        return ya
            .option("environment", {
                describe: "Informative name for yout Kubernetes cluster",
                type: "string",
            })
            .option("namespace", {
                describe: "Deploy utilities in namespace mode",
                type: "string",
            });
    }, argv => cliCommand(() => kube({
        env: argv.environment,
        ns: argv.namespace,
    })));
}
function addStartCommand(yar: yargs.Argv) {
    yar.command("start", "Start an SDM or automation client", ya => {
        return ya
            .option("change-dir", CommonOptions.changeDir)
            .option("compile", CommonOptions.compile)
            .option("install", CommonOptions.install)
            .option("local", {
                default: false,
                describe: "Start SDM in local mode",
                type: "boolean",
            });
    }, argv => cliCommand(() => start({
        cwd: argv["change-dir"],
        install: argv.install,
        compile: argv.compile,
        local: argv.local,
    })));
}

function setupYargs() {
    addConfigCommand(yargs);
    addStartCommand(yargs);
    addExecuteCommand(yargs);
    addGitCommand(yargs);
    addGqlFetchCommand(yargs);
    addGqlGenCommand(yargs);
    addKubeCommand(yargs);

    // tslint:disable-next-line:no-unused-expression
    yargs.completion("completion")
        .epilog("Copyright Atomist, Inc. 2018")
        .showHelpOnFail(false, "Specify --help for available options")
        .alias("help", ["h", "?"])
        .version(version())
        .alias("version", "v")
        .describe("version", "Show version information")
        .demandCommand(1, "Missing command.\n\tType 'atomist new sdm' to create a new SDM")
        .strict()
        .wrap(Math.min(100, yargs.terminalWidth()))
        .argv;
}

export async function main() {
    if (!isReservedCommand(process.argv)) {
        await addLocalSdmCommands(yargs);
    }
    setupYargs();
}
