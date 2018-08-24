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

import { userConfigPath } from "@atomist/automation-client";
import { adviceDoc } from "@atomist/sdm-local/src/cli/ui/consoleOutput";
import * as fs from "fs-extra";

// Show an informative and friendly welcome message
if (!fs.existsSync(userConfigPath())) {
    adviceDoc("docs/postInstall.md");
}
