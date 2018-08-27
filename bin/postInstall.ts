/* Adding the JS directly because we can't depend on TS files for the postInstall hook */

import { userConfigPath } from "@atomist/automation-client";
import * as fs from "fs-extra";
import marked = require("marked");
import * as TerminalRenderer from "marked-terminal";

marked.setOptions({
    // Define custom renderer
    renderer: new TerminalRenderer(),
});

const Banner = `┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   🙌 @atomist/cli is now installed.                                      │
│                                                                          │
│   Head to the sdm repo (https://github.com/atomist/sdm) for more info.   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘`;

// Show an informative and friendly welcome message
if (!fs.existsSync(userConfigPath())) {
    process.stdout.write(marked(Banner).trim() + "\n\n");
}
