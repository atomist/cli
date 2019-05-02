import { execPromise } from "@atomist/sdm";
import * as fs from "fs-extra";
import * as path from "path";
import * as print from "..//print";
import * as glob from "glob";

export interface InitOptions {
    goalSetId: string;
    sha: string;
    cloneUrl: string;
}

export async function init(opts: InitOptions): Promise<number> {

    // 1. clone the repo
    try {
        print.info("Cloning repository...");
        await execPromise("git", ["clone", opts.cloneUrl, "."]);
        await execPromise("git", ["checkout", opts.sha]);
        print.info("Finished");
    } catch (e) {
        print.error(`Failed to checkout repository: ${e.message}`);
        return 5;
    }

    // 2. load input
    const inputs: string[] = JSON.parse(process.env.ATOMIST_INPUT || "[]");
    for (const input of inputs) {
        print.info(`Restoring '${input}'`);
        try {
            const files = glob.sync(input, { cwd: "/atm/share" });
            for (const file of files) {
                await fs.copy(path.join("/", "atm", "share", file), path.join(process.cwd(), file), {
                    overwrite: true,
                    recursive: true,
                });
                print.info(`Successfully restored '${file}'`);
            }
        } catch (e) {
            print.info(`Failed to restore '${input}': ${JSON.stringify(e)}`);
        }
    }

    return 0;
}
