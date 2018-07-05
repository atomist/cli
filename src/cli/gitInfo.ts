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
