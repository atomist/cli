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

import {
    execPromise,
    spawnLog,
    StringCapturingProgressLog,
} from "@atomist/sdm";
import chalk from "chalk";
import * as fs from "fs-extra";
import * as path from "path";
import { createSpinner } from "./config";
import * as print from "./print";

/**
 * Command-line options and arguments for install.
 */
export interface InstallOptions {
    /** Name or keywords to install for */
    versionTag: string;
    /** Directory to run command in, must be an SDM directory */
    cwd?: string;
}

function getAtomistDependencies(dependencies: any): string[] {
    return Object.keys(dependencies).filter(key => key.startsWith("@atomist/"));
}

function hasPackageJson(directory: string): boolean {
    return fs.existsSync(path.join(directory, "package.json"));
}

async function updateDependenciesToTag(dependencies: string[], versionTag: string, spinner: any): Promise<void> {
    const dependenciesToUpdate = dependencies
        .filter(async d => {
            const moduleVersion = await getModuleVersion(`${d}@${versionTag}`);
            return moduleVersion !== undefined;
        })
        .map(d => `${d}@${versionTag}`);
    spinner.setSpinnerTitle(`Updating ${dependenciesToUpdate.length} dependencies to ${versionTag} ${chalk.yellow("%s")}`);
    await execPromise(
        "npm",
        [
            "install",
            "--save",
            ...dependenciesToUpdate,
        ],
    );
}

async function getModuleVersion(module: string): Promise<string | undefined> {
    const log = new StringCapturingProgressLog();
    const result = await spawnLog(
        "npm",
        ["show", module, "version"],
        {
            logCommand: false,
            log,
        });

    if (result.code === 0) {
        return log.log.trim();
    }

    return undefined;
}

async function updateDevDependenciesToTag(dependencies: string[], versionTag: string, spinner: any): Promise<void> {
    const dependenciesToUpdate = dependencies.map(d => `${d}@${versionTag}`);
    spinner.setSpinnerTitle(`Updating dev dependencies to ${versionTag} ${chalk.yellow("%s")}`);
    await execPromise(
        "npm",
        [
            "install",
            "--save-dev",
            ...dependenciesToUpdate,
        ],
    );
}

/**
 * Search for an SDM extension pack.
 *
 * @param opts see InstallOptions
 * @return integer return value
 */
export async function updateSdm(opts: InstallOptions): Promise<number> {
    if (hasPackageJson(opts.cwd)) {
        const spinner = createSpinner(`Updating dependencies in package.json`);
        try {
            const packageJson = await fs.readJson(path.join(opts.cwd, "package.json"));
            const extractedDependencies = getAtomistDependencies(packageJson.dependencies);
            const extractedDevDependencies = getAtomistDependencies(packageJson.devDependencies);
            await updateDependenciesToTag(extractedDependencies, opts.versionTag, spinner);
            await updateDevDependenciesToTag(extractedDevDependencies, opts.versionTag, spinner);
            spinner.stop(true);
            return 0;
        } catch (e) {
            print.error(`Error while updating package.json`);
            return 1;
        }
    } else {
        print.error(`Current directory does not contain a package.json`);
        return 1;
    }
}
