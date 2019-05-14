#!/usr/bin/env node
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

import * as yb from "@atomist/sdm-local/lib/cli/invocation/command/support/yargBuilder";
// tslint:disable-next-line:no-import-side-effect
import "source-map-support/register";
import * as yargs from "yargs";

import {
    cliCommand,
    isEmbeddedSdmCommand,
    shouldAddLocalSdmCommands,
} from "./lib/command";
import { config } from "./lib/config";
import { execute } from "./lib/execute";
import { gitHook } from "./lib/gitHook";
import { gqlFetch } from "./lib/gqlFetch";
import { install } from "./lib/install";
import { kube } from "./lib/kube";
import * as print from "./lib/print";
import * as provider from "./lib/provider";
import { repositoryStart } from "./lib/repositoryStart";
import { version } from "./lib/version";
import * as workspace from "./lib/workspace";

process.env.SUPPRESS_NO_CONFIG_WARNING = "true";
if (!isEmbeddedSdmCommand(process.argv)) {
    process.env.ATOMIST_DISABLE_LOGGING = "true";
}

function setupYargs(yargBuilder: yb.YargBuilder): void {
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

    yargBuilder.withSubcommand({
        command: "config",
        aliases: ["connect", "login"],
        describe: "Connect to Atomist",
        parameters: [{
            parameterName: "api-key",
            describe: "Atomist API key",
            type: "string",
        }, {
            parameterName: "workspace-id",
            describe: "Atomist workspace ID",
            type: "string",
        }, {
            parameterName: "create-api-key",
            describe: "Create a new API key regardless if currently one is configured",
            type: "boolean",
            default: false,
        }],
        handler: argv => cliCommand(() => config({
            apiKey: argv["api-key"],
            workspaceId: argv["workspace-id"],
            createApiKey: argv["create-api-key"],
        })),
    });
    yargBuilder.withSubcommand({
        command: "workspace create",
        describe: "Create a new workspace",
        parameters: [{
            parameterName: "api-key",
            describe: "Atomist API key",
            type: "string",
        }, {
            parameterName: "workspace-name",
            describe: "Workspace name",
            type: "string",
        }],
        handler: argv => cliCommand(() => workspace.create({
            apiKey: argv["api-key"],
            workspaceName: argv["workspace-name"],
        })),
    });
    yargBuilder.withSubcommand({
        command: "provider config",
        describe: "Create a new provider",
        parameters: [{
            parameterName: "api-key",
            describe: "Atomist API key",
            type: "string",
        }, {
            parameterName: "workspace-id",
            describe: "Atomist workspace ID",
            type: "string",
        }],
        handler: argv => cliCommand(() => provider.config({
            apiKey: argv["api-key"],
            workspaceId: argv["workspace-id"],
            validateApiKey: true,
        })),
    });
    yargBuilder.withSubcommand({
        command: "execute <name>",
        describe: "Run a command",
        positional: [{
            key: "name", opts: {
                describe: "Name of command to run, command parameters PARAM=VALUE can follow",
            },
        }],
        parameters: [commonOptions.changeDir, commonOptions.install, commonOptions.changeDir],
        handler: argv => cliCommand(() => execute({
            name: argv.name,
            cwd: argv["change-dir"],
            compile: argv.compile,
            install: argv.install,
            args: argv._.filter((a: any) => a !== "execute" && a !== "exec" && a !== "cmd"),
        })),
    });
    yargBuilder.withSubcommand({
        command: "install [keywords]",
        describe: "Search and install an SDM extension pack",
        positional: [{
            key: "keywords",
            opts: {
                describe: "keywords to search for",
            },
        }],
        parameters: [
            commonOptions.changeDir,
            {
                parameterName: "registry",
                describe: "NPM registry to search",
                type: "string",
                required: false,
            }],
        handler: argv => cliCommand(() => install({
            keywords: [argv.keywords, ...argv._.filter((a: any) => a !== "install")],
            cwd: argv["change-dir"],
            registry: argv.registry,
        })),
    });
    yargBuilder.withSubcommand({
        command: "git-hook",
        describe: "Process Git hook data for local SDM",
        handler: argv => cliCommand(() => gitHook(process.argv)),
    });
    yargBuilder.withSubcommand({
        command: "gql-fetch", describe: "Retrieve GraphQL schema",
        parameters: [commonOptions.changeDir, commonOptions.install],
        handler: argv => cliCommand(() => gqlFetch({
            cwd: argv["change-dir"],
            install: argv.install,
        })),
    });
    yargBuilder.withSubcommand({
        command: "kube",
        aliases: ["k8s"],
        describe: "Deploy Atomist utilities to Kubernetes cluster",
        parameters: [{
            parameterName: "environment",
            describe: "Informative name for your Kubernetes cluster",
            type: "string",
        }, {
            parameterName: "namespace",
            describe: "Deploy utilities in namespace mode",
            type: "string",
        }, {
            parameterName: "url",
            describe: "URL of publicly accessible hostname (e.g. http://a.atomist.io)",
            type: "string",
        }, {
            parameterName: "dry-run",
            describe: "Only print the k8s objects that would be deployed, without sending them",
            type: "boolean",
        }, {
            parameterName: "yes",
            describe: "Confirm all questions with yes",
            type: "boolean",
        }],
        handler: (argv: any) => cliCommand(() => kube({
            env: argv.environment,
            ns: argv.namespace,
            dryRun: argv["dry-run"],
            yes: argv.yes,
            url: argv.url,
        })),
    });
    yargBuilder.withSubcommand({
            command: "start",
            describe: "Start an SDM or automation client",
            parameters: [
                commonOptions.changeDir,
                commonOptions.compile,
                commonOptions.install, {
                    parameterName: "local",
                    default: false,
                    describe: "Start SDM in local mode",
                    type: "boolean",
                }, {
                    parameterName: "repository-url",
                    describe: "Git URL to clone",
                    type: "string",
                    required: false,
                }, {
                    parameterName: "index",
                    describe: "Name of the file that exports the configuration",
                    type: "string",
                    required: false,
                    implies: "repository-url",
                }, {
                    parameterName: "sha",
                    describe: "Git sha to checkout",
                    type: "string",
                    required: false,
                    implies: "repository-url",
                }, {
                    parameterName: "seed-url",
                    describe: "Git URL to clone the seed to overlay with SDM repository",
                    type: "string",
                    required: false,
                    implies: "repository-url",
                }],
            handler: (argv: any) => cliCommand(() => {
                return repositoryStart({
                    cwd: argv["change-dir"],
                    cloneUrl: argv["repository-url"],
                    index: argv.index,
                    sha: argv.sha,
                    local: argv.local,
                    seedUrl: argv["seed-url"],
                    install: argv.install,
                    compile: argv.compile,
                });
            }),
        },
    )
    ;
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

async function main(): Promise<any> {
    const YargBuilder = yb.freshYargBuilder({ epilogForHelpMessage: "Copyright Atomist, Inc. 2019" });
    if (shouldAddLocalSdmCommands(process.argv)) {
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
