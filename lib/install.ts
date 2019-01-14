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

import { execPromise } from "@atomist/sdm";
import chalk from "chalk";
import * as fs from "fs-extra";
import * as inquirer from "inquirer";
import * as path from "path";
import { createSpinner } from "./config";
import * as print from "./print";

/**
 * Command-line options and arguments for install.
 */
export interface InstallOptions {
    /** Name or keywords to install for */
    keywords: string[];
    /** Directory to run command in, must be an SDM directory */
    cwd?: string;
    /** NPM Registry to install */
    registry?: string;
}

interface ExtensionPack {
    name: string;
    description: string;
    version: string;
    maintainers: [{
        username: string;
        email: string;
    }];
}

/**
 * Search for an SDM extension pack.
 *
 * @param opts see InstallOptions
 * @return integer return value
 */
export async function install(opts: InstallOptions): Promise<number> {
    const keywords = opts.keywords.filter(k => !!k);
    let spinner = createSpinner(
        `Searching extension packs${keywords.length > 0 ? " for " : ""}${chalk.cyan(keywords.join(", "))}`);
    let packs: ExtensionPack[];

    try {
        const registryArgs = opts.registry ? ["--registry", opts.registry] : [];
        const result = await execPromise(
            "npm",
            [
                "search",
                "--json",
                ...registryArgs,
                "atomist",
                "SDM",
                "extension",
                "pack",
                ...opts.keywords.filter(k => !!k)],
            {});
        packs = JSON.parse(result.stdout);
        spinner.stop(true);
    } catch (e) {
        spinner.stop(true);
        print.error(`Failed to search registry: ${e.message}`);
        return 1;
    }

    if (packs.length > 0) {
        const questions: inquirer.Question[] = [
            {
                type: "list",
                name: "package",
                message: "Extension Packs",
                choices: packs
                    .map(p => ({
                        name: `${p.name} ${chalk.yellow(p.description)} ${chalk.reset("by")} ${
                            chalk.gray(p.maintainers.map(m => m.username).join(", "))}`,
                        value: p,
                        short: p.name,
                    })),

            },
        ];
        const answers: any = await inquirer.prompt(questions);
        spinner = createSpinner(`Installing extension pack ${chalk.cyan(answers.package.name)} in ${opts.cwd}`);
        try {
            await execPromise("npm", ["install", answers.package.name], { cwd: opts.cwd });
            spinner.stop(true);
            print.log(`Successfully installed extension pack ${chalk.cyan(answers.package.name)} by ${
                chalk.gray(answers.package.maintainers.map((m: any) => m.username).join(", "))}`);
            const p = path.join(opts.cwd, "node_modules", answers.package.name, "package.json");
            const pj = JSON.parse((await fs.readFile(p)).toString());
            print.log(`Visit ${chalk.yellow(pj.homepage)} for install and usage instructions`);
        } catch (e) {
            spinner.stop(true);
            print.error(`Failed to install extension pack '${answers.package.name}': ${e.message}`);
            return 1;
        }

    } else {
        print.log(`No SDM extension packs found for: ${opts.keywords.join(", ")}`);
        return 1;
    }
    return 0;
}
