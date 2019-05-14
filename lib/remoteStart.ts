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
import * as _ from "lodash";
import * as os from "os";
import * as path from "path";
import * as print from "./print";
import { start } from "./start";
import gitUrlParse = require("git-url-parse");

export interface CreateOptions {
    cloneUrl: string;
    file: string;
    sha: string;
    local: boolean;
    seedUrl: string;
    compile: boolean;
    install: boolean;
}

const FilesToCopy = ["package.json", "tsconfig.json", "tslint.json"];

export async function remoteStart(opts: { cloneUrl: string } & Partial<CreateOptions>): Promise<number> {

    const optsToUse: CreateOptions = {
        file: "index.ts",
        sha: "master",
        local: false,
        seedUrl: "https://github.com/atomist-seeds/empty-sdm.git",
        compile: true,
        install: true,
        ...opts,
    };

    const gitUrl = gitUrlParse(optsToUse.cloneUrl);

    const cwd = path.join(os.homedir(), ".atomist", "sdm", gitUrl.owner, gitUrl.name);
    const seed = path.join(os.homedir(), ".atomist", "cache", `sdm-${guid().slice(0, 7)}`);

    // Git clone
    try {
        if (!(await fs.pathExists(cwd))) {
            print.info("Cloning repository...");
            await execPromise("git", ["clone", optsToUse.cloneUrl, cwd]);
            print.info("Finished");
        } else {
            print.info("Updating repository...");
            for (const f of FilesToCopy) {
                await fs.remove(path.join(cwd, f));
            }
            await execPromise("git", ["reset", "--hard"], { cwd });
            await execPromise("git", ["pull"], { cwd });
            print.info("Finished");
        }
        if (!!optsToUse.sha) {
            print.info(`Checking out '${optsToUse.sha}'...`);
            await execPromise("git", ["checkout", optsToUse.sha], { cwd });
            print.info("Finished");
        }
    } catch (e) {
        print.error(`Failed to clone/checkout repository: ${e.message}`);
        return 5;
    }

    // Move the provided file into the index.ts
    if (!!optsToUse.file && optsToUse.file !== "index.ts") {
        print.info(`Preparing '${optsToUse.file}'...`);
        await fs.move(path.join(cwd, optsToUse.file), path.join(cwd, "index.ts"), { overwrite: true });
        print.info("Finished");
    }

    // Clone the seed if there are some needed files missing in the repository
    if ([...FilesToCopy, "package-lock.json"].some(f => !fs.pathExistsSync(path.join(cwd, f)))) {
        try {
            print.info("Cloning seed...");
            await execPromise("git", ["clone", optsToUse.seedUrl, seed]);
            print.info("Finished");
        } catch (e) {
            print.error(`Failed to checkout seed: ${e.message}`);
            return 5;
        }
    }

    // Copy over package.json, tsconfig.json in case they are missing
    let packageJsonCreated = false;
    for (const f of FilesToCopy) {
        const fp = path.join(cwd, f);
        const sp = path.join(seed, f);
        if (!(await fs.pathExists(fp))) {
            print.info(`Creating '${f}'`);
            await fs.copyFile(sp, fp);

            if (f === "package.json") {
                const pj = await fs.readJson(fp);
                if ((gitUrl.owner.length === 0 || gitUrl.owner === "git") && optsToUse.cloneUrl.includes("gist")) {
                    pj.name = `@gist/${gitUrl.name.slice(0, 7)}`;
                } else {
                    pj.name = `@${gitUrl.owner}/${gitUrl.name}`;
                }

                const sha = await execPromise("git", ["log", "--pretty=format:%h", "-n", "1"], { cwd });
                pj.version = `0.1.0-${sha.stdout.trim()}`;

                await fs.writeJson(fp, pj, { replacer: undefined, spaces: 2 });
                packageJsonCreated = true;
            }
        }
    }

    // Merge the provided package.json with the one from the seed as long there isn't a package-lock.json
    if (!(await fs.pathExists(path.join(cwd, "package-lock.json"))) && !packageJsonCreated) {
        print.info(`Merging 'package.json'`);
        const spjp = path.join(seed, "package.json");
        const ppjp = path.join(cwd, "package.json");

        const spj = await fs.readJson(spjp);
        const ppj = await fs.readJson(ppjp);

        const pj = _.merge(spj, ppj);
        await fs.writeJson(ppjp, pj, { replacer: undefined, spaces: 2 });
    }

    await fs.remove(seed);

    return start({
        ...optsToUse,
        cwd,
    });
}
