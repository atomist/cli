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

import * as print from "./print";

/**
 * Generate git-info.json for automation client.
 *
 * @param opts see GitOptions
 * @return integer return value
 */
export async function gitHook(args: string[]): Promise<number> {
    try {
        const sdmLocal = require("@atomist/sdm-local");
        await sdmLocal.runOnGitHook(args);
    } catch (e) {
        print.error(`Failed to process Git hook: ${e.message}`);
        return 1;
    }
    return 0;
}
