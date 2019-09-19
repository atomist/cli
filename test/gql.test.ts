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

import * as fs from "fs-extra";
import * as path from "path";
import * as assert from "power-assert";
import * as tmp from "tmp-promise";

import { graphqlDir } from "../lib/gql";

describe("gql", () => {

    describe("libDir", () => {

        it("should find lib/graphql dir", async () => {
            const t = await tmp.dir({ unsafeCleanup: true });
            const e = path.resolve(t.path, "lib");
            await fs.ensureDir(e);
            const g = path.join(e, "graphql");
            await fs.ensureDir(g);
            const l = graphqlDir(path.join(t.path));
            assert(l === g);
        });

        it("should find src/graphql dir", async () => {
            const t = await tmp.dir({ unsafeCleanup: true });
            const e = path.join(t.path, "src");
            await fs.ensureDir(e);
            const g = path.join(e, "graphql");
            await fs.ensureDir(g);
            const l = graphqlDir(t.path);
            assert.strictEqual(l, g);
            await t.cleanup();
        });

        it("should return /graphql when there is no lib or src", () => {
            const l = graphqlDir(__dirname);
            const expected = path.join(__dirname, "graphql");
            assert.strictEqual(l, expected);
        });

        it("should return root/graphql when there is lib but no lib/graphql", async () => {
            const t = await tmp.dir({ unsafeCleanup: true });
            const e = path.join(t.path, "lib");
            await fs.ensureDir(e);
            const l = graphqlDir(t.path);
            const expected = path.join(t.path, "graphql");
            assert.strictEqual(l, expected);
            await t.cleanup();
        });

        it("should return root/graphql when there is src but no src/graphql", async () => {
            const t = await tmp.dir({ unsafeCleanup: true });
            const e = path.join(t.path, "src");
            await fs.ensureDir(e);
            const l = graphqlDir(t.path);
            const expected = path.join(t.path, "graphql");
            assert.strictEqual(l, expected);
            await t.cleanup();
        });

        it("should return graphql/ if it has graphql", async () => {
            const t = await tmp.dir({ unsafeCleanup: true });
            const g = path.join(t.path, "graphql");
            await fs.ensureDir(g);
            const result = graphqlDir(t.path);
            assert.strictEqual(result, g);
            await t.cleanup();
        });

    });

});
