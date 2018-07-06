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
    CommandInvocation,
} from "@atomist/automation-client/internal/invoker/Payload";
import * as child_process from "child_process";
import * as fs from "fs-extra";
import * as glob from "glob-promise";
import * as stringify from "json-stringify-safe";
import * as path from "path";

import { cliAtomistConfig } from "./config";
import { cliGitInfo } from "./gitInfo";
import { cliAtomistKube } from "./kube";

/**
 * Parse positional parameters into parameter name/value pairs.  The
 * positional parameters should be of the form NAME[=VALUE].  If
 * =VALUE is omitted, the value is set to `undefined`.  If the VALUE
 * is empty, i.e., NAME=, then the value is the empty string.
 *
 * @param args typically argv._ from tags
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

export function readVersion(): string {
    try {
        const pj = require(path.join(__dirname, "..", "package.json"));
        return `${pj.name} ${pj.version}`;
    } catch (e) {
        try {
            // in case you are running locally
            const pj = require(path.join(__dirname, "..", "..", "package.json"));
            return `${pj.name} ${pj.version}`;
        } catch (e) {
            return "@atomist/cli 0.0.0";
        }
    }
}

export function start(
    cwd: string,
    runInstall: boolean = true,
    runCompile: boolean = true,
): number {

    const opts: ExecOptions = {
        cmd: "start.client.js",
        args: "",
        message: "Starting Automation Client",
        cwd,
        runInstall,
        runCompile,
    };
    return execJs(opts);
}

export function run(
    cwd: string,
    ci: CommandInvocation,
    runInstall: boolean = true,
    runCompile: boolean = true,
): number {

    const opts: ExecOptions = {
        cmd: "cli/run.js",
        args: `--request='${stringify(ci)}'`,
        message: `Running command '${ci.name}'`,
        cwd,
        runInstall,
        runCompile,
    };
    return execJs(opts);
}

export function gqlFetch(
    cwd: string,
    teamId: string,
    token: string = process.env.ATOMIST_TOKEN || process.env.GITHUB_TOKEN,
    runInstall: boolean = true,
): Promise<number> {

    const outDir = path.join(cwd, "src", "graphql");
    const outSchema = path.join(outDir, "schema.json");
    return fs.ensureDir(outDir)
        .then(() => {
            const opts: ExecOptions = {
                cmd: "apollo-codegen",
                args: `introspect-schema https://automation.atomist.com/graphql/team/${teamId} ` +
                    `--output ${outSchema} --header "Authorization: token ${token}"`,
                message: `Introspecting GraphQL schema for team ${teamId}`,
                cwd,
                runInstall,
                runCompile: false,
            };
            return execBin(opts);
        });
}

export function gqlGen(
    cwd: string,
    pattern: string,
    runInstall: boolean = true,
): Promise<number> {

    // Check if the project has a custom schema
    let schema = "node_modules/@atomist/automation-client/graph/schema.cortex.json";
    if (fs.existsSync(path.join(cwd, "src", "graphql", "schema.json"))) {
        schema = "./src/graphql/schema.json";
    }

    const opts: ExecOptions = {
        cmd: "gql-gen",
        args: `--file ${schema} --template typescript --no-schema --out src/typings/types.ts`,
        message: `Running GraphQL code generator`,
        cwd,
        runInstall,
        runCompile: false,
    };
    return glob(pattern)
        .then(graphqlFiles => {
            if (graphqlFiles.length > 0) {
                opts.args += ` "${pattern}"`;
            }
        }, err => {
            console.warn("GraphQL file glob pattern '${pattern}' failed, continuing");
        })
        .then(() => execBin(opts));
}

export function config(argv: any): Promise<number> {
    return cliAtomistConfig(argv);
}

export function kube(argv: any): Promise<number> {
    return cliAtomistKube(argv);
}

export function gitInfo(argv: any): Promise<number> {
    return cliGitInfo(argv["change-dir"]);
}

interface ExecOptions {
    cmd: string;
    args?: string;
    message?: string;
    cwd?: string;
    runInstall?: boolean;
    runCompile?: boolean;
    checks?: Array<() => number>;
}

function execBin(opts: ExecOptions): number {
    opts.cwd = path.resolve(opts.cwd);
    opts.cmd = (process.platform === "win32") ? `${opts.cmd}.cmd` : opts.cmd;
    opts.cmd = path.join(opts.cwd, "node_modules", ".bin", opts.cmd);
    opts.checks = [
        () => {
            if (!fs.existsSync(opts.cmd)) {
                console.error(`Project at '${opts.cwd}' is not a valid automation client project: missing ${opts.cmd}`);
                return 1;
            }
            return 0;
        },
    ];
    return execCmd(opts);
}

function execJs(opts: ExecOptions): number {
    opts.cwd = path.resolve(opts.cwd);
    const script = path.join(opts.cwd, "node_modules", "@atomist", "automation-client", opts.cmd);
    opts.args = `"${script}" ${opts.args}`;
    opts.cmd = (process.platform === "win32") ? "node.exe" : "node";
    opts.checks = [
        () => {
            if (!fs.existsSync(script)) {
                console.error(`Project at '${opts.cwd}' is not a valid automation client project: missing ${script}`);
                return 1;
            }
            return 0;
        },
    ];
    return execCmd(opts);
}

/**
 * Synchronously execute the given command with the given arguments,
 * optionally installing and compiling first.
 *
 * @param opts the exec options
 * @return integer return value of command, 0 if command is successful
 */
function execCmd(opts: ExecOptions): number {
    // if --install or --no-install is provided, do that
    // otherwise run install only if the node_modules directory does not exist
    if (opts.runInstall === true ||
        (opts.runInstall !== false && !fs.existsSync(path.join(opts.cwd, "node_modules")))) {
        const installStatus = install(opts.cwd);
        if (installStatus !== 0) {
            return installStatus;
        }
    }

    if (opts.runCompile) {
        const compileStatus = compile(opts.cwd);
        if (compileStatus !== 0) {
            return compileStatus;
        }
    }

    for (const check of opts.checks) {
        const checkStatus = check();
        if (checkStatus !== 0) {
            return checkStatus;
        }
    }

    const command = `${opts.cmd} ${opts.args}`;
    console.info(`${opts.message} in '${opts.cwd}'`);
    try {
        child_process.execSync(command, { cwd: opts.cwd, stdio: "inherit", env: process.env });
    } catch (e) {
        console.error(`Command '${command}' failed: ${e.message}`);
        return e.status as number;
    }
    return 0;
}

export function install(cwd: string): number {
    console.info(`Running 'npm install' in '${cwd}'`);
    try {
        if (!checkPackageJson(cwd)) {
            return 1;
        }
        child_process.execSync(`npm install`,
            { cwd, stdio: "inherit", env: process.env });
    } catch (e) {
        console.error(`Installation failed`);
        return e.status as number;
    }
    return 0;
}

export function compile(cwd: string): number {
    console.info(`Running 'npm run compile' in '${cwd}'`);
    try {
        if (!checkPackageJson(cwd)) {
            return 1;
        }
        child_process.execSync(`npm run compile`,
            { cwd, stdio: "inherit", env: process.env });
    } catch (e) {
        console.error(`Compilation failed`);
        return e.status as number;
    }
    return 0;
}

export function checkPackageJson(cwd: string): boolean {
    const pkgPath = path.join(cwd, "package.json");
    if (!fs.existsSync(pkgPath)) {
        console.error(`No 'package.json' in '${cwd}'`);
        return false;
    }
    return true;
}
