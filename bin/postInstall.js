"use strict";
/* Adding the JS directly because we can't depend on TS files for the postInstall hook */
Object.defineProperty(exports, "__esModule", { value: true });
const automation_client_1 = require("@atomist/automation-client");
const fs = require("fs-extra");
const marked = require("marked");
const TerminalRenderer = require("marked-terminal");
marked.setOptions({
    // Define custom renderer
    renderer: new TerminalRenderer(),
});
const Banner = `┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   @atomist/cli is now installed.                                         │
│                                                                          │
│   Head to the sdm repo (https://github.com/atomist/sdm) for more info.   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘`;
// Show an informative and friendly welcome message
if (!fs.existsSync(automation_client_1.userConfigPath())) {
    process.stdout.write(marked(Banner).trim() + "\n\n");
}
//# sourceMappingURL=postInstall.js.map