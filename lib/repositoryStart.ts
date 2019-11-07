/*
 * Copyright © 2019 Atomist, Inc.
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

import { guid } from "@atomist/automation-client";
import { execPromise } from "@atomist/automation-client/lib/util/child_process";
import * as fg from "fast-glob";
import * as fs from "fs-extra";
import gitUrlParse = require("git-url-parse");
import * as _ from "lodash";
import * as os from "os";
import * as path from "path";
import * as print from "./print";
import {
    start,
    StartOptions,
} from "./start";

/**
 * Configuration options for repository start command
 */
export interface RepositoryStartOptions extends StartOptions {
    cloneUrl: string;
    index: string;
    yaml: string;
    sha: string;
    seedUrl: string;
}

/**
 * Files to check and copy from the seed into the cloned client/SDM repo
 */
const FilesToCopy = [
    "node_modules",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "tslint.json",
    ".gitignore",
];

/**
 * Clone, prepare and start an SDM/client project from a remote Git or Gist location
 */
export async function repositoryStart(opts: { cloneUrl: string } & Partial<RepositoryStartOptions>): Promise<number> {

    const optsToUse: RepositoryStartOptions = _.merge({
        index: "index.ts",
        yaml: undefined,
        sha: "master",
        local: false,
        profile: undefined,
        watch: false,
        debug: false,
        seedUrl: process.env.SEED_URL || "https://github.com/atomist-seeds/empty-sdm.git",
    }, opts);

    let cwd = optsToUse.cwd;

    if (!!optsToUse.cloneUrl) {

        const gitUrl = gitUrlParse(optsToUse.cloneUrl);

        cwd = path.join(os.homedir(), ".atomist", "sdm", gitUrl.owner, gitUrl.name);
        let seed = path.join(os.homedir(), ".atomist", "cache", `sdm-${guid().slice(0, 7)}`);

        // Git clone
        try {
            await clone(optsToUse, cwd);
        } catch (e) {
            print.error(`Failed to clone/checkout repository: ${e.message}`);
            return 5;
        }

        if (!!optsToUse.yaml) {
            // If yaml is specified use that
            const patterns = optsToUse.yaml.split(",").map(p => p.trim());
            await copyYamlIndexJs(patterns, optsToUse, cwd);
        } else if (!!optsToUse.index && optsToUse.index !== "index.ts") {
            // Move the provided file into the index.ts
            await copyIndexTs(optsToUse, cwd);
        }

        // Clone the seed if there are some needed files missing in the repository
        try {
            if (FilesToCopy.some(f => !fs.pathExistsSync(path.join(cwd, f)))) {
                if (isRemoteSeed(optsToUse)) {
                    await cloneSeed(optsToUse, seed);
                } else {
                    seed = optsToUse.seedUrl;
                    optsToUse.install = false;
                }
            }
        } catch (e) {
            print.error(`Failed to checkout seed: ${e.message}`);
            return 10;
        }

        // Copy over package.json, tsconfig.json in case they are missing
        try {
            await copyFiles(optsToUse, cwd, seed);
        } catch (e) {
            print.error(`Failed to copy seed files into clone: ${e.message}`);
            return 15;
        }

        // Delete the seed clone as we don't need it any more
        try {
            if (isRemoteSeed(optsToUse)) {
                await fs.remove(seed);
            }
        } catch (e) {
            print.warn(`Failed to remove seed: ${e.message}`);
        }

        // Find out if we need to compile
        const files = await fg(`${cwd}/**/*.ts`,
            { ignore: [`${cwd}/**/{.git,node_modules}/**`] });
        if (files.length > 0) {
            optsToUse.compile = true;
        } else {
            optsToUse.compile = false;
        }
    }

    // Finally call start on the SDM/client
    return start({
        ...optsToUse,
        cwd,
    });
}
function isRemoteSeed(opts: RepositoryStartOptions): boolean {
    return opts.seedUrl.startsWith("git@") || opts.seedUrl.startsWith("https://");
}

async function clone(optsToUse: RepositoryStartOptions, cwd: string): Promise<void> {
    if (!(await fs.pathExists(cwd))) {
        print.info("Cloning repository...");
        await execPromise(
            "git",
            ["clone", optsToUse.cloneUrl, cwd]);
        print.info("Finished");
    } else {
        print.info("Updating repository...");
        for (const f of FilesToCopy) {
            await fs.remove(path.join(cwd, f));
        }
        await execPromise(
            "git",
            ["reset", "--hard"],
            { cwd });
        await execPromise(
            "git",
            ["pull"],
            { cwd });
        print.info("Finished");
    }
    if (!!optsToUse.sha) {
        print.info(`Checking out '${optsToUse.sha}'...`);
        await execPromise(
            "git",
            ["checkout", optsToUse.sha],
            { cwd });
        print.info("Finished");
    }
}

async function cloneSeed(optsToUse: RepositoryStartOptions, seed: string): Promise<void> {
    print.info("Cloning seed...");
    await execPromise(
        "git",
        ["clone", optsToUse.seedUrl, seed]);
    print.info("Finished");
}

async function copyIndexTs(optsToUse: RepositoryStartOptions, cwd: string): Promise<void> {
    print.info(`Preparing '${optsToUse.index}'...`);
    const from = path.join(cwd, optsToUse.index.replace(".ts", "").replace(".js", ""));
    // Rewrite the index.ts to export the configuration from provided file to not break relative imports
    const indexTs = `import { configuration as cfg } from "${from}";

export const configuration = cfg;
`;
    await fs.writeFile(path.join(cwd, "index.ts"), indexTs);
    print.info("Finished");
}

async function copyYamlIndexJs(pattern: string[], optsToUse: RepositoryStartOptions, cwd: string): Promise<void> {
    print.info(`Preparing 'index.js'...`);
    // Rewrite the index.js to export the configuration from provided file to not break relative imports
    const indexJs = `const sdm_core = require("@atomist/sdm-core");
exports.configuration = sdm_core.configureYaml(${pattern.map(p => `"${p}"`).join(", ")});
`;
    await fs.writeFile(path.join(cwd, "index.js"), indexJs);
    print.info("Finished");
}

async function copyFiles(optsToUse: RepositoryStartOptions, cwd: string, seed: string): Promise<void> {
    const gitUrl = gitUrlParse(optsToUse.cloneUrl);

    for (const f of FilesToCopy) {
        const fp = path.join(cwd, f);
        const sp = path.join(seed, f);
        if (!(await fs.pathExists(fp)) && (await fs.pathExists(sp))) {
            print.info(`Creating '${f}'`);

            if (f === "node_modules") {
                await fs.ensureSymlink(sp, fp);
            } else {
                await fs.ensureDir(path.dirname(fp));
                await fs.copyFile(sp, fp);

                if (f === "package.json") {
                    const pj = await fs.readJson(fp);

                    // This is special handling required to support gist clone urls
                    if ((gitUrl.owner.length === 0 || gitUrl.owner === "git")
                        && optsToUse.cloneUrl.includes("gist")) {
                        pj.name = `@gist/${gitUrl.name.slice(0, 7)}`;
                    } else {
                        pj.name = `@${gitUrl.owner}/${gitUrl.name}`;
                    }

                    const sha = await execPromise(
                        "git",
                        ["log", "--pretty=format:%h", "-n", "1"],
                        { cwd });
                    pj.version = `0.1.0-${sha.stdout.trim()}`;

                    await fs.writeJson(fp, pj, { replacer: undefined, spaces: 2 });
                }
            }
        } else if (f === "package.json") {
            optsToUse.install = true;
        }
    }
}
