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
import { kubeCrypt } from "./lib/kubeCrypt";
import { kubeEdit } from "./lib/kubeEdit";
import { kubeFetch } from "./lib/kubeFetch";
import { kubeInstall } from "./lib/kubeInstall";
import * as print from "./lib/print";
import { repositoryStart } from "./lib/repositoryStart";
import { updateSdm } from "./lib/updateSdm";
import { version } from "./lib/version";

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
        describe: "Configure connection to Atomist",
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
        command: "connect",
        aliases: ["login"],
        describe: "DEPRECATED use 'config'",
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
        handler: argv => {
            deprecated(argv, "atomist config");
            return cliCommand(() => config({
                apiKey: argv["api-key"],
                workspaceId: argv["workspace-id"],
                createApiKey: argv["create-api-key"],
            }));
        },
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
        describe: "DEPRECATED use 'npm install'",
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
        handler: argv => {
            deprecated(argv, "npm install");
            return cliCommand(() => install({
                keywords: [argv.keywords, ...argv._.filter((a: any) => a !== "install")],
                cwd: argv["change-dir"],
                registry: argv.registry,
            }));
        },
    });
    yargBuilder.withSubcommand({
        command: "update sdm",
        describe: "Update an SDM to the latest dependency version of Atomist of a certain branch",
        parameters: [
            commonOptions.changeDir,
            {
                parameterName: "tag",
                describe: "NPM tag to update the dependencies to",
                type: "string",
                required: false,
                default: "latest",
            }],
        handler: argv => cliCommand(() => updateSdm({
            versionTag: argv.tag,
            cwd: argv["change-dir"],
        })),
    });
    yargBuilder.withSubcommand({
        command: "git-hook",
        describe: "(not for human use)",
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
        describe: "DEPRECATED use 'kube-install'",
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
        handler: (argv: any) => {
            deprecated(argv, "kube-install");
            return cliCommand(() => kubeInstall({
                env: argv.environment,
                ns: argv.namespace,
                dryRun: argv["dry-run"],
                yes: argv.yes,
                url: argv.url,
            }));
        },
    });
    yargBuilder.withSubcommand({
        command: "kube-decrypt",
        describe: "Decrypt encrypted Kubernetes secret data values",
        parameters: [{
            parameterName: "file",
            describe: "Decrypt Kubernetes secret data values from secret spec file",
            type: "string",
            conflicts: "literal",
        }, {
            parameterName: "literal",
            describe: "Decrypt secret data value provided as a literal string",
            type: "string",
            conflicts: "file",
        }, {
            parameterName: "secret-key",
            describe: "Key to use to decrypt secret data values",
            type: "string",
        }, {
            parameterName: "base64",
            describe: "Base64 decode data after decrypting",
            type: "boolean",
            default: false,
        }],
        handler: (argv: any) => cliCommand(() => kubeCrypt({
            action: "decrypt",
            base64: argv.base64,
            file: argv.file,
            literal: argv.literal,
            secretKey: argv["secret-key"],
        })),
    });
    yargBuilder.withSubcommand({
        command: "kube-encrypt",
        describe: "Encrypt Base64 encoded Kubernetes secret data values",
        parameters: [{
            parameterName: "file",
            describe: "Encrypt Kubernetes secret data values from secret spec file",
            type: "string",
            conflicts: "literal",
        }, {
            parameterName: "literal",
            describe: "Encrypt secret data value provided as a literal string",
            type: "string",
            conflicts: "file",
        }, {
            parameterName: "secret-key",
            describe: "Key to use to encrypt secret data values",
            type: "string",
        }, {
            parameterName: "base64",
            describe: "Base64 encode data before encrypting",
            type: "boolean",
            default: false,
        }],
        handler: (argv: any) => cliCommand(() => kubeCrypt({
            action: "encrypt",
            base64: argv.base64,
            file: argv.file,
            literal: argv.literal,
            secretKey: argv["secret-key"],
        })),
    });
    yargBuilder.withSubcommand({
        command: "kube-edit <secret-spec-file>",
        describe: "Decrypts a secret and opens it in an editor. Output is re-encrypted and saved back to the original file",
        positional: [{
            key: "secret-spec-file", opts: {
                describe: "Kubernetes secret spec file",
            },
        }],
        parameters: [{
            parameterName: "secret-key",
            describe: "Key used to decrypt & encrypt secret data values",
            type: "string",
        }],
        handler: (argv: any) => cliCommand(() => kubeEdit({
            file: argv["secret-spec-file"],
            secretKey: argv["secret-key"],
        })),
    });
    yargBuilder.withSubcommand({
        command: "kube-fetch",
        describe: "Fetch resources from a Kubernetes cluster using the currently configured Kubernetes credentials, " +
            "remove system-populated properties, and save each resource specification to a file",
        parameters: [{
            parameterName: "options-file",
            describe: "Path to file containing a JSON object defining options selecting which resources to fetch, see " +
                "https://atomist.github.io/sdm-pack-k8s/interfaces/_lib_kubernetes_fetch_.kubernetesfetchoptions.html " +
                "for details on the structure of the object",
            type: "string",
        }, {
            parameterName: "output-dir",
            describe: "Directory to write spec files in, if not provided current directory is used",
            type: "string",
        }, {
            parameterName: "output-format",
            describe: "File format to write spec files in, supported formats are 'json' and 'yaml', 'yaml' is the default",
            type: "string",
        }, {
            parameterName: "secret-key",
            describe: "Key to use to encrypt secret data values before writing to file",
            type: "string",
        }],
        handler: (argv: any) => cliCommand(() => kubeFetch({
            optionsFile: argv["options-file"],
            outputDir: argv["output-dir"],
            outputFormat: argv["output-format"],
            secretKey: argv["secret-key"],
        })),
    });
    yargBuilder.withSubcommand({
        command: "kube-install",
        describe: "Deploy Atomist utilities to Kubernetes a cluster",
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
        handler: (argv: any) => cliCommand(() => kubeInstall({
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
                parameterName: "profile",
                describe: "Name of configuration profiles to include",
                type: "string",
                required: false,
            }, {
                parameterName: "watch",
                describe: "Enable watch mode",
                type: "boolean",
                default: false,
                required: false,
            }, {
                parameterName: "debug",
                describe: "Enable Node.js debugger",
                type: "boolean",
                default: false,
                required: false,
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
                profile: argv.profile,
                seedUrl: argv["seed-url"],
                install: argv.install,
                compile: argv.compile,
                watch: argv.watch,
                debug: argv.debug,
            });
        }),
    });
    yargBuilder.build().save(yargs);
    // tslint:disable-next-line:no-unused-expression
    yargs.completion("completion", false as any)
        .showHelpOnFail(false, "Specify --help for available options")
        .alias("help", ["h", "?"])
        .version(version())
        .alias("version", "v")
        .describe("version", "Show version information")
        .strict()
        .wrap(Math.min(100, yargs.terminalWidth()))
        .argv;
}

function deprecated(argv: any, alt?: string): void {
    print.warn(`The '${argv._[0]}' command is DEPRECATED and will be removed in a future release.`);
    if (alt) {
        print.warn(`Use '${alt}' instead.`);
    }
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
