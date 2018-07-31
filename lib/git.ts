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

import { obtainGitInfo } from "@atomist/automation-client/internal/env/gitInfo";
import * as fs from "fs-extra";
import * as path from "path";

import * as print from "./print";
import { SpawnOptions } from "./spawn";

/**
 * Command-line options for git.
 */
export type GitOptions = Pick<SpawnOptions, "cwd">;

/**
 * Generate git-info.json for automation client.
 *
 * @param opts see GitOptions
 * @return integer return value
 */
export async function git(opts: GitOptions): Promise<number> {
    const gitInfoName = "git-info.json";
    const gitInfoPath = path.join(opts.cwd, gitInfoName);
    try {
        const gitInfo = await obtainGitInfo(opts.cwd);
        await fs.writeJson(gitInfoPath, gitInfo, { spaces: 2, encoding: "utf8" });
        print.info(`Successfully wrote git information to '${gitInfoPath}'`);
    } catch (e) {
        print.error(`Failed to write git information to '${gitInfoPath}': ${e.message}`);
        return 1;
    }
    return 0;
}
