#!/usr/bin/env node

process.env.SUPPRESS_NO_CONFIG_WARNING = "true";

import { CommandInvocation } from "@atomist/automation-client/internal/invoker/Payload";
import { LoggingConfig } from "@atomist/automation-client/internal/util/logger";
import * as yargs from "yargs";

import {
    config,
    extractArgs,
    gitInfo,
    gqlFetch,
    gqlGen,
    kube,
    readVersion,
    run,
    start,
} from "./cli/commands";

LoggingConfig.format = "cli";

const Package = "atomist";

const compileDescribe = "Run 'npm run compile' before running";
const installDescribe = "Run 'npm install' before running/compiling, default is to install if no " +
    "'node_modules' directory exists";

// tslint:disable-next-line:no-unused-expression
yargs.completion("completion")
    .command(["execute <name>", "exec <name>", "cmd <name>"], "Run a command", ya => {
        return (ya as any) // positional is not yet supported in @types/yargs
            .positional("name", {
                describe: "Name of command to run, command parameters NAME=VALUE can follow",
                required: true,
            })
            .option("change-dir", {
                alias: "C",
                default: process.cwd(),
                describe: "Path to automation client project",
                type: "string",
            })
            .option("compile", {
                default: true,
                describe: compileDescribe,
                type: "boolean",
            })
            .option("install", {
                describe: installDescribe,
                type: "boolean",
            });
    }, argv => {
        const args = extractArgs(argv._);
        const ci: CommandInvocation = {
            name: argv.name,
            args,
        };
        try {
            const status = run(argv["change-dir"], ci, argv.install, argv.compile);
            process.exit(status);
        } catch (e) {
            console.error(`${Package}: Unhandled Error: ${e.message}`);
            process.exit(101);
        }
    })
    .command(["start", "st", "run"], "Start an automation client", ya => {
        return ya
            .option("change-dir", {
                alias: "C",
                default: process.cwd(),
                describe: "Path to automation client project",
                type: "string",
            })
            .option("compile", {
                default: true,
                describe: compileDescribe,
                type: "boolean",
            })
            .option("install", {
                describe: installDescribe,
                type: "boolean",
            });
    }, argv => {
        try {
            const status = start(argv["change-dir"], argv.install, argv.compile);
            process.exit(status);
        } catch (e) {
            console.error(`${Package}: Unhandled Error: ${e.message}`);
            process.exit(101);
        }

    })
    .command(["gql-fetch <team>"], "Introspect GraphQL schema", ya => {
        return (ya as any)
            .positional("team", {
                describe: "Atomist workspace/team ID",
                required: true,
            })
            .option("token", {
                alias: "T",
                describe: "Token to use for authentication",
                default: process.env.ATOMIST_TOKEN || process.env.GITHUB_TOKEN,
                type: "string",
            })
            .option("change-dir", {
                alias: "C",
                default: process.cwd(),
                describe: "Path to automation client project",
                type: "string",
            })
            .option("install", {
                describe: installDescribe,
                type: "boolean",
            });
    }, argv => {
        gqlFetch(argv["change-dir"], argv.team, argv.token, argv.install)
            .then(status => process.exit(status), err => {
                console.error(`${Package}: Unhandled Error: ${err.message}`);
                process.exit(101);
            });
    })
    .command(["gql-gen <glob>", "gql <glob>"], "Generate TypeScript code for GraphQL", ya => {
        return ya
            .option("change-dir", {
                alias: "C",
                default: process.cwd(),
                describe: "Path to automation client project",
                type: "string",
            })
            .option("install", {
                describe: installDescribe,
                type: "boolean",
            });
    }, argv => {
        gqlGen(argv["change-dir"], argv.glob, argv.install)
            .then(status => process.exit(status), err => {
                console.error(`${Package}: Unhandled Error: ${err.message}`);
                process.exit(101);
            });
    })
    .command("git", "Create a git-info.json file", ya => {
        return ya
            .option("change-dir", {
                alias: "C",
                describe: "Path to automation client project",
                default: process.cwd(),
            });
    }, argv => {
        gitInfo(argv)
            .then(status => process.exit(status), err => {
                console.error(`${Package}: Unhandled Error: ${err.message}`);
                process.exit(101);
            });
    })
    .command("config", "Configure environment for running automation clients", ya => {
        return ya
            .option("team", {
                describe: "Atomist workspace/team ID",
                type: "string",
                alias: "slack-team",
            })
            .option("github-user", {
                describe: "GitHub user login",
                type: "string",
            })
            .option("github-password", {
                describe: "GitHub user password",
                type: "string",
            })
            .option("github-mfa-token", {
                describe: "GitHub user password",
                type: "string",
            });
    }, argv => {
        config(argv)
            .then(status => process.exit(status), err => {
                console.error(`${Package}: Unhandled Error: ${err.message}`);
                process.exit(101);
            });
    })
    .command("kube", "Deploy Atomist Kubernetes utilities to your Kubernetes cluster", ya => {
        return ya
            .option("environment", {
                describe: "Informative name for yout Kubernetes cluster",
                type: "string",
            })
            .option("namespace", {
                describe: "Deploy utilities in namespace mode",
                type: "string",
            });
    }, argv => {
        kube(argv)
            .then(status => process.exit(status), err => {
                console.error(`${Package}: Unhandled Error: ${err.message}`);
                process.exit(101);
            });
    })
    .showHelpOnFail(false, "Specify --help for available options")
    .alias("help", ["h", "?"])
    .version(readVersion())
    .alias("version", "v")
    .describe("version", "Show version information")
    .demandCommand(1, "Missing command")
    .strict()
    .argv;
