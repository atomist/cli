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

import {
    spawnBinary,
    SpawnOptions,
} from "./spawn";

/**
 * Command-line options for start.
 */
export type StartOptions = Pick<SpawnOptions, "cwd" | "compile" | "install"> & { local: boolean, profile: string };

/**
 * Start automation client server process.
 *
 * @param opts see StartOptions
 * @return integer return value
 */
export async function start(opts: StartOptions): Promise<number> {
    if (!!opts.local) {
        process.env.ATOMIST_MODE = "local";
    }
    if (!!opts.profile) {
        process.env.ATOMIST_CONFIG_PROFILE = opts.profile;
    }
    delete process.env.ATOMIST_DISABLE_LOGGING;

    const spawnOpts = {
        ...opts,
        command: "atm-start",
        args: [] as string[],
    };
    return spawnBinary(spawnOpts);
}
