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
Object.defineProperty(exports, "__esModule", { value: true });
const automation_client = require("@atomist/automation-client");
const doc_chunk = require("@atomist/sdm-local/src/cli/ui/docChunk");
const fs = require("fs-extra");

/* Adding the JS directly because we can't depend on TS files for the postInstall hook */

// Show an informative and friendly welcome message
if (!fs.existsSync(automation_client.userConfigPath())) {
    var output = doc_chunk.renderProjectDocChunk("../../../docs/postInstall.md").trim();
    process.stdout.write("\n" + output + "\n\n");
}
//# sourceMappingURL=postInstall.js.map