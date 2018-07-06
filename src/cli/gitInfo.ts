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

export function cliGitInfo(path: string): Promise<number> {
    const gitInfoName = "git-info.json";
    const gitInfoPath = `${path}/${gitInfoName}`;
    return obtainGitInfo(path)
        .then(result => fs.writeJson(gitInfoPath, result, { spaces: 2, encoding: "utf8" }))
        .then(() => {
            console.log(`Successfully wrote git information to '${gitInfoPath}'`);
            return 0;
        }, err => {
            console.log(`Failed to write git information to '${gitInfoPath}': ${err.message}`);
            return 1;
        });
}
