/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as assert from "power-assert";

import * as fs from "fs-extra";
import * as path from "path";
import * as tmp from "tmp-promise";

import { libDir } from "../lib/gql";

describe("gql", () => {

    describe("libDir", () => {

        it("should find lib dir", () => {
            const l = libDir(path.join(__dirname, ".."));
            const e = path.resolve(__dirname, "..", "lib");
            assert.equal(l, e);
        });

        it("should find src dir", async () => {
            const t = await tmp.dir({ unsafeCleanup: true });
            const e = path.join(t.path, "src");
            await fs.ensureDir(e);
            const l = libDir(t.path);
            assert.equal(l, e);
            t.cleanup();
        });

        it("should return lib when there is no dir", () => {
            const l = libDir(__dirname);
            const e = path.resolve(__dirname, "lib");
            assert.equal(l, e);
        });

    });

});
