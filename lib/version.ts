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

import * as readPkgUp from "read-pkg-up";

import * as print from "./print";

/**
 * Read package name and version from nearest package.json and return
 * standard CLI package and version string.
 *
 * @return Promise of standard version string
 */
export function version(): string {
    try {
        // must be sync because yargs.version only accepts a string
        const pj = readPkgUp.sync({ cwd: __dirname });
        return `${pj.pkg.name} ${pj.pkg.version}`;
    } catch (e) {
        print.error(`Failed to read package.json: ${e.message}`);
    }
    return "@atomist/cli 0.0.0";
}
