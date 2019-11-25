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
import * as yaml from "js-yaml";
import * as assert from "power-assert";
import { withFile } from "tmp-promise";
import {
    handleSecretParameter,
    wrapLiteral,
} from "../lib/kubeCrypt";

describe("kubeCrypt", () => {

    describe("handleSecretParameter", () => {
        const secret = {
            apiVersion: "v1",
            kind: "Secret",
            type: "Opaque",
            data: {
                username: "some username",
                password: "some password",
            },
        };

        it("file input", async () => {
            await withFile(async ({ path, fd }) => {
                await fs.writeFile(path, yaml.safeDump(secret));

                const s = await handleSecretParameter({
                    action: "encrypt",
                    file: path,
                });

                assert.deepEqual(s, secret);
            });
        });

        it("literal input", async () => {
            await withFile(async ({ path, fd }) => {
                await fs.writeFile(path, yaml.safeDump(secret));

                const s = await handleSecretParameter({
                    action: "decrypt",
                    literal: "something",
                });

                const key = Object.keys(s.data)[0];
                assert.deepEqual(s.data[key], "something");
            });
        });
    });

    describe("wrapLiteral", () => {

        it("single line with special characters", () => {
            const o = wrapLiteral("thingmabob <>--!#@!", "doodad");

            assert.deepEqual(o, {
                apiVersion: "v1",
                kind: "Secret",
                type: "Opaque",
                data: {
                    "thingmabob <>--!#@!": "doodad",
                },
            });
        });
    });
});
