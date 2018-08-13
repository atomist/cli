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

import * as child_process from "child_process";
import * as spawn from "cross-spawn";
import * as fs from "fs-extra";
import * as path from "path";

import * as print from "./print";

/**
 * Options when executing a command.
 */
export interface SpawnOptions {
    /** Command to execute */
    command: string;
    /** Command-line arguments of command */
    args?: string[];
    /** Directory to run command in, must be an automation client directory */
    cwd?: string;
    /** If true or no node_modules directory exists, run "npm install" before running command */
    install?: boolean;
    /** If true, run `npm run compile` before running command */
    compile?: boolean;
    /** Checks to run after the optional install and compile */
    checks?: Array<() => number>;
}

/**
 * Run a binary automation-client dependency in a platform-independent-ish way.
 */
export async function spawnBinary(opts: SpawnOptions): Promise<number> {
    opts.cwd = path.resolve(opts.cwd);
    opts.command = path.join(opts.cwd, "node_modules", ".bin", opts.command);
    opts.checks = [
        () => {
            if (!fs.existsSync(opts.command)) {
                print.error(`Project at '${opts.cwd}' is not a valid automation client: missing ${opts.command}`);
                print.error(`Make sure the @atomist/automation-client dependency in the project is up to date`);
                return 1;
            }
            return 0;
        },
    ];
    return spawnCommand(opts);
}

/**
 * Run an @atomist/automation-client Node.js script.
 */
export async function spawnJs(opts: SpawnOptions): Promise<number> {
    opts.cwd = path.resolve(opts.cwd);
    const script = path.join(opts.cwd, "node_modules", "@atomist", "automation-client", opts.command);
    opts.args = [script, ...opts.args];
    opts.command = process.argv0;
    opts.checks = [
        () => {
            if (!fs.existsSync(script)) {
                print.error(`Project at '${opts.cwd}' is not a valid automation client project: missing ${script}`);
                print.error(`Make sure the @atomist/automation-client dependency in the project is up to date`);
                return 1;
            }
            return 0;
        },
    ];
    return spawnCommand(opts);
}

/**
 * Run the given command with the given arguments, optionally
 * installing and compiling first and return a Promise of the command
 * exit value.
 *
 * @param opts see SpawnOptions
 * @return Promise of integer return value of command, Promise.resolve(0) if command is successful
 */
async function spawnCommand(opts: SpawnOptions): Promise<number> {
    // if --install or --no-install is provided, do that
    if (opts.install ||
        // otherwise run install if --no-install was not given & the node_modules directory does not exist
        // tslint:disable-next-line:no-boolean-literal-compare
        (opts.install !== false && !fs.existsSync(path.join(opts.cwd, "node_modules")))) {
        const installStatus = await npmInstall(opts.cwd);
        if (installStatus !== 0) {
            return installStatus;
        }
    }

    if (opts.compile) {
        const compileStatus = await npmCompile(opts.cwd);
        if (compileStatus !== 0) {
            return compileStatus;
        }
    }

    if (opts.checks) {
        for (const check of opts.checks) {
            const checkStatus = check();
            if (checkStatus !== 0) {
                return checkStatus;
            }
        }
    }

    return spawnPromise(opts);
}

/**
 * Run `npm install`.  It ensures a package.json exist in cwd.
 *
 * @param cwd directory to run install in
 * @return return value of the `npm install` command
 */
async function npmInstall(cwd: string): Promise<number> {
    return spawnPromise({
        command: "npm",
        args: ["install"],
        cwd,
        checkPackageJson: true,
    });
}

/**
 * Run `npm run compile`.  It ensures a package.json exist in cwd.
 *
 * @param cwd directory to run the compilation in
 * @return return value of the `npm run compile` command
 */
async function npmCompile(cwd: string): Promise<number> {
    return spawnPromise({
        command: "npm",
        args: ["run", "compile"],
        cwd,
        checkPackageJson: true,
    });
}

/**
 * Options used by spawnPromise to execute a command.
 */
export interface SpawnPromiseOptions {
    /** Executable to spawn */
    command: string;
    /** Arguments to pass to executable */
    args?: string[];
    /** Directory to launch executable process in, default is process process.cwd */
    cwd?: string;
    /** If true, ensure package.json exist in cwd before running command */
    checkPackageJson?: boolean;
}

/**
 * Run a command and return a promise supplying the exit value of
 * the command.
 *
 * @param options see SpawnPromiseoptions
 * @return a Promise of the return value of the spawned command
 */
export async function spawnPromise(options: SpawnPromiseOptions): Promise<number> {
    const signals: { [key: string]: number } = {
        SIGHUP: 1,
        SIGINT: 2,
        SIGQUIT: 3,
        SIGILL: 4,
        SIGTRAP: 5,
        SIGABRT: 6,
        SIGBUS: 7,
        SIGFPE: 8,
        SIGKILL: 9,
        SIGUSR1: 10,
        SIGSEGV: 11,
        SIGUSR2: 12,
        SIGPIPE: 13,
        SIGALRM: 14,
        SIGTERM: 15,
        SIGCHLD: 17,
        SIGCONT: 18,
        SIGSTOP: 19,
        SIGTSTP: 20,
        SIGTTIN: 21,
        SIGTTOU: 22,
        SIGURG: 23,
        SIGXCPU: 24,
        SIGXFSZ: 25,
        SIGVTALRM: 26,
        SIGPROF: 27,
        SIGSYS: 31,
    };
    const cwd = (options.cwd) ? options.cwd : process.cwd();
    const spawnOptions: child_process.SpawnOptions = {
        cwd,
        env: process.env,
        stdio: "inherit",
    };
    const cmdString = cleanCommandString(options.command, options.args);
    try {
        if (options.checkPackageJson && !checkPackageJson(cwd)) {
            return 1;
        }
        print.info(`Running "${cmdString}" in '${cwd}'`);
        const cp = spawn(options.command, options.args, spawnOptions);
        return new Promise<number>((resolve, reject) => {
            cp.on("exit", (code, signal) => {
                if (code === 0) {
                    resolve(code);
                } else if (code) {
                    print.error(`Command "${cmdString}" failed with non-zero status: ${code}`);
                    resolve(code);
                } else {
                    print.error(`Command "${cmdString}" exited due to signal: ${signal}`);
                    if (signals[signal]) {
                        resolve(128 + signals[signal]);
                    }
                    resolve(128 + 32);
                }
            });
            cp.on("error", err => {
                const msg = `Command "${cmdString}" errored when spawning: ${err.message}`;
                print.error(msg);
                reject(new Error(msg));
            });
        });
    } catch (e) {
        print.error(`Failed to spawn command "${cmdString}": ${e.message}`);
        return 100;
    }
}

/**
 * Check if a package.json file exists in cwd.
 *
 * @param cwd directory to check for package.json
 * @return true if package.json exists in cwd, false otherwise
 */
function checkPackageJson(cwd: string): boolean {
    const pkgPath = path.join(cwd, "package.json");
    if (!fs.existsSync(pkgPath)) {
        print.error(`No 'package.json' in '${cwd}'`);
        return false;
    }
    return true;
}

/**
 * Create string representation of command and arguments, removing
 * sensitive information.
 *
 * @param cmd command
 * @param args command arguments
 * @return sanitized string representing command
 */
export function cleanCommandString(cmd: string, args?: string[]): string {
    const cmdString = cmd + ((args && args.length > 0) ? ` '${args.join("' '")}'` : "");
    return cmdString.replace(/Authorization:\s+\w+\s+\w+/g, "Authorization: <hidden>");
}
