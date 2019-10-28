#!/usr/bin/env node
"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// If you change this file, commit both this file and the generated
// .js, .d.ts., and .js.map because we cannot execute TypeScript in
// the postInstall hook because the devDependencies might not be
// available.
const configuration_1 = require("@atomist/automation-client/lib/configuration");
const fs = require("fs-extra");
function printErr(e) {
    process.stderr.write(`@atomist/cli:postInstall [ERROR] ${e.message}\n`);
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (fs.existsSync(configuration_1.userConfigPath())) {
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
        }
        catch (e) {
            printErr(e);
        }
    });
}
// we do not want any postInstall failure to cause install to fail
main()
    .catch(e => {
    printErr(e);
})
    .then(() => process.exit(0), e => process.exit(0));
//# sourceMappingURL=postInstall.js.map