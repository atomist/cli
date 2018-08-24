import { userConfigPath } from "@atomist/automation-client";
import { adviceDoc } from "@atomist/sdm-local/src/cli/ui/consoleOutput";
import * as fs from "fs-extra";

// Show an informative and friendly welcome message
if (!fs.existsSync(userConfigPath())) {
    adviceDoc("docs/postInstall.md");
}