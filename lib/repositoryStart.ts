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

import { guid } from "@atomist/automation-client";
import { execPromise } from "@atomist/automation-client/lib/util/child_process";
import * as fs from "fs-extra";
import gitUrlParse = require("git-url-parse");
import * as _ from "lodash";
import * as os from "os";
import * as path from "path";
import * as print from "./print";
import {
    start,
    StartOptions,
} from "./start";

/**
 * Configuration options for repository start command
 */
export interface RepositoryStartOptions extends StartOptions {
    cloneUrl: string;
    index: string;
    sha: string;
    seedUrl: string;
    yaml?: string;
}

/**
 * Files to check and copy from the seed into the cloned client/SDM repo
 */
const FilesToCopy = [
    "package.json",
    "tsconfig.json",
    "tslint.json",
];

/**
 * Clone, prepare and start an SDM/client project from a remote Git or Gist location
 */
export async function repositoryStart(opts: { cloneUrl: string } & Partial<RepositoryStartOptions>): Promise<number> {

    const optsToUse: RepositoryStartOptions = _.merge({
        index: "index.ts",
        sha: "master",
        local: false,
        seedUrl: "https://github.com/atomist-seeds/empty-sdm.git",
        compile: true,
        install: true,
    }, opts);

    let cwd = optsToUse.cwd;

    if (!!optsToUse.cloneUrl) {

        const gitUrl = gitUrlParse(optsToUse.cloneUrl);

        cwd = path.join(os.homedir(), ".atomist", "sdm", gitUrl.owner, gitUrl.name);
        const seed = path.join(os.homedir(), ".atomist", "cache", `sdm-${guid().slice(0, 7)}`);

        // Git clone
        try {
            await clone(optsToUse, cwd);
        } catch (e) {
            print.error(`Failed to clone/checkout repository: ${e.message}`);
            return 5;
        }

        // Move the provided file into the index.ts
        if (!!optsToUse.index && optsToUse.index !== "index.ts") {
            await copyIndexTs(optsToUse, cwd);
        }

        // Clone the seed if there are some needed files missing in the repository
        try {
            if (FilesToCopy.some(f => !fs.pathExistsSync(path.join(cwd, f)))) {
                await cloneSeed(optsToUse, seed);
            }
        } catch (e) {
            print.error(`Failed to checkout seed: ${e.message}`);
            return 10;
        }

        // Copy over package.json, tsconfig.json in case they are missing
        try {
            await copyFiles(optsToUse, cwd, seed);
        } catch (e) {
            print.error(`Failed to copy seed files into clone: ${e.message}`);
            return 15;
        }

        // Delete the seed clone as we don't need it any more
        try {
            await fs.remove(seed);
        } catch (e) {
            print.warn(`Failed to remove seed: ${e.message}`);
        }
    }

    // Finally call start on the SDM/client
    return start({
        ...optsToUse,
        cwd,
    });
}

async function clone(optsToUse: RepositoryStartOptions, cwd: string): Promise<void> {
    if (!(await fs.pathExists(cwd))) {
        print.info("Cloning repository...");
        await execPromise(
            "git",
            ["clone", optsToUse.cloneUrl, cwd]);
        print.info("Finished");
    } else {
        print.info("Updating repository...");
        for (const f of FilesToCopy) {
            await fs.remove(path.join(cwd, f));
        }
        await execPromise(
            "git",
            ["reset", "--hard"],
            { cwd });
        await execPromise(
            "git",
            ["pull"],
            { cwd });
        print.info("Finished");
    }
    if (!!optsToUse.sha) {
        print.info(`Checking out '${optsToUse.sha}'...`);
        await execPromise(
            "git",
            ["checkout", optsToUse.sha],
            { cwd });
        print.info("Finished");
    }
}

async function cloneSeed(optsToUse: RepositoryStartOptions, seed: string): Promise<void> {
    print.info("Cloning seed...");
    await execPromise(
        "git",
        ["clone", optsToUse.seedUrl, seed]);
    print.info("Finished");
}

async function copyIndexTs(optsToUse: RepositoryStartOptions, cwd: string): Promise<void> {
    print.info(`Preparing '${optsToUse.index}'...`);
    await fs.move(path.join(cwd, optsToUse.index), path.join(cwd, "index.ts"), { overwrite: true });
    print.info("Finished");
}

async function copyFiles(optsToUse: RepositoryStartOptions, cwd: string, seed: string): Promise<void> {
    const gitUrl = gitUrlParse(optsToUse.cloneUrl);

    for (const f of FilesToCopy) {
        const fp = path.join(cwd, f);
        const sp = path.join(seed, f);
        if (!(await fs.pathExists(fp)) && (await fs.pathExists(sp))) {
            print.info(`Creating '${f}'`);
            await fs.copyFile(sp, fp);

            if (f === "package.json") {
                const pj = await fs.readJson(fp);

                // This is special handling required to support gist clone urls
                if ((gitUrl.owner.length === 0 || gitUrl.owner === "git")
                    && optsToUse.cloneUrl.includes("gist")) {
                    pj.name = `@gist/${gitUrl.name.slice(0, 7)}`;
                } else {
                    pj.name = `@${gitUrl.owner}/${gitUrl.name}`;
                }

                const sha = await execPromise(
                    "git",
                    ["log", "--pretty=format:%h", "-n", "1"],
                    { cwd });
                pj.version = `0.1.0-${sha.stdout.trim()}`;

                await fs.writeJson(fp, pj, { replacer: undefined, spaces: 2 });
            }
        }
    }
}
