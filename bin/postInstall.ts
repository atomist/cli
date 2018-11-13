#!/usr/bin/env node
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

// If you change this file, commit both this file and the generated
// .js, .d.ts., and .js.map because we cannot execute TypeScript in
// the postInstall hook because the devDependencies might not be
// available.

import { userConfigPath } from "@atomist/automation-client/lib/configuration";
import * as fs from "fs-extra";

function printErr(e: Error): void {
    process.stderr.write(`@atomist/cli:postInstall [ERROR] ${e.message}\n`);
}

async function main(): Promise<void> {

    try {

        if (fs.existsSync(userConfigPath())) {
            process.exit(0);
        }

        // show an informative and friendly welcome message
        const banner = `
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   @atomist/cli is now installed.                                         │
│                                                                          │
│   Head to the SDM repo (https://github.com/atomist/sdm) for more info.   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

`;
        process.stdout.write(banner);

    } catch (e) {
        printErr(e);
    }
}

// we do not want any postInstall failure to cause install to fail
main()
    .catch(e => {
        printErr(e);
    })
    .then(() => process.exit(0), e => process.exit(0));
