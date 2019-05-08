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

import { execPromise } from "@atomist/automation-client/lib/util/child_process";
import * as fs from "fs-extra";
import * as path from "path";
import * as print from "../print";
import { start } from "../start";
import gitUrlParse = require("git-url-parse");

export interface CreateOptions {
    cloneUrl: string;
    sha?: string;
    local?: boolean;
}

const FilesToCopy = ["package.json", "tsconfig.json", "tslint.json"];

export async function wrap(opts: CreateOptions): Promise<number> {

    const cwd = path.join(process.cwd(), "sdm");
    const seed = path.join(process.cwd(), "seed");

    // Git clone
    try {
        print.info("Cloning repository...");
        await execPromise("git", ["clone", opts.cloneUrl, cwd]);
        if (!!opts.sha) {
            await execPromise("git", ["checkout", opts.sha], { cwd });
        }
        print.info("Finished");
    } catch (e) {
        print.error(`Failed to checkout repository: ${e.message}`);
        return 5;
    }

    // copy over package.json, tsconfig.json
    try {
        print.info("Cloning seed...");
        await execPromise("git", ["clone", "https://github.com/atomist-seeds/empty-sdm.git", seed]);
        print.info("Finished");
    } catch (e) {
        print.error(`Failed to checkout seed: ${e.message}`);
        return 5;
    }

    for (const f of FilesToCopy) {
        const fp = path.join(cwd, f);
        const sp = path.join(seed, f);
        if (!(await fs.pathExists(fp))) {
            print.info(`No '${f}' provided. Copying from seed`);
            await fs.copyFile(sp, fp);

            if (f === "package.json") {
                const pj = await fs.readJson(fp);
                const gitUrl = gitUrlParse(opts.cloneUrl);
                pj.name = `@${gitUrl.owner}/${gitUrl.name}`;

                const sha = await execPromise("git", ["log", "--pretty=format:%h", "-n", "1"], { cwd });
                pj.version = `0.1.0-${sha.stdout.trim()}`;

                await fs.writeJson(fp, pj, { replacer: undefined, spaces: 2 });
            }
        }
    }

    return await start({ compile: true, install: true, cwd, local: opts.local });
}
