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
import {
    file,
    withFile,
} from "tmp-promise";
import { kubeEdit } from "../lib/kubeEdit";

describe("kubeEdit", () => {

    const encodedSecret = {
        apiVersion: "v1",
        kind: "Secret",
        type: "Opaque",
        metadata: {
            name: "mysecret",
        },
        data: {
            username: "dGhlIHJvb3RtaW5pc3RyYXRvcg==",
            password: "Y29ycmVjdCBob3JzZSBiYXR0ZXJ5IHN0YXBsZQ==",
        },
    };

    const encryptedSecret = {
        apiVersion: "v1",
        kind: "Secret",
        type: "Opaque",
        metadata: {
            name: "mysecret",
        },
        data: {
            username: "2RtW5dUnrmmgDPmGExnYt1nHizOm+CUkMsNG9+xOnSU=",
            password: "jkc8la4XtG9KZSQzTXByBYdmx80rVtHtEMKbNOIQj13t11KWH9iR4Pnzn7IuHFbP",
        },
    };

    describe("exit handling", () => {
        it("abort edit", async () => {
            const editorCommand = `
            let args = process.argv.slice(2);
            let fileName = args[0];
            require('fs').writeFile(fileName, "", () => {});`;

            let commandErrorCode;
            let output;

            const mockEditor = await file();
            const inputfile = await file();

            await fs.writeFile(mockEditor.path, editorCommand);
            await fs.writeFile(inputfile.path, yaml.safeDump(encodedSecret));

            process.env.EDITOR = `node ${mockEditor.path}`;

            commandErrorCode = await kubeEdit({file: inputfile.path});
            output = await yaml.safeLoad(await fs.readFile(inputfile.path, "utf8"));

            await mockEditor.cleanup();
            await inputfile.cleanup();

            assert.equal(4, commandErrorCode);
            assert.deepStrictEqual(output, {
                apiVersion: "v1",
                kind: "Secret",
                type: "Opaque",
                metadata: {
                    name: "mysecret",
                },
                data: {
                    username: "dGhlIHJvb3RtaW5pc3RyYXRvcg==",
                    password: "Y29ycmVjdCBob3JzZSBiYXR0ZXJ5IHN0YXBsZQ==",
                },
            });
        });

        it("wrong secret provided", async () => {
            let output;
            let commandErrorCode;
            await withFile(async ({path, fd}) => {
                await fs.writeFile(path, yaml.safeDump(encryptedSecret));

                commandErrorCode = await kubeEdit({file: path, secretKey: "this is not the secret"});

                output = await yaml.safeLoad(await fs.readFile(path, "utf8"));
            });

            assert.equal(3, commandErrorCode);
            assert.deepStrictEqual(output, encryptedSecret);
        });

        it("missing file provided", async () => {
            let commandErrorCode;
            commandErrorCode = await kubeEdit({file: "a-file-that-doesnt-exist.yaml"});
            assert.equal(2, commandErrorCode);
        });

        it("invalid file provided", async () => {
            const invalidFileContents = `apiVersion: v1
            kind: Secret
            metadata:
              name: mysecret
            type: Opaque
            data:`;

            let commandErrorCode;
            await withFile(async ({path, fd}) => {
                await fs.writeFile(path, invalidFileContents);
                commandErrorCode = await kubeEdit({file: path});
            });
            assert.equal(2, commandErrorCode);
        });
    });

    describe("edit functionality", () => {
        it("edit nothing", async () => {
            process.env.EDITOR = "npx replace nothing yoursecret";

            let output;
            await withFile(async ({path, fd}) => {
                await fs.writeFile(path, yaml.safeDump(encodedSecret));

                await kubeEdit({file: path});

                output = await yaml.safeLoad(await fs.readFile(path, "utf8"));
            });

            assert.deepStrictEqual(output, {
                apiVersion: "v1",
                kind: "Secret",
                type: "Opaque",
                metadata: {
                    name: "mysecret",
                },
                data: {
                    username: "dGhlIHJvb3RtaW5pc3RyYXRvcg==",
                    password: "Y29ycmVjdCBob3JzZSBiYXR0ZXJ5IHN0YXBsZQ==",
                },
            });
        });

        it("edit metadata", async () => {
            process.env.EDITOR = "npx replace --silent mysecret yoursecret";

            let output;
            await withFile(async ({path, fd}) => {
                await fs.writeFile(path, yaml.safeDump(encodedSecret));

                await kubeEdit({file: path});

                output = await yaml.safeLoad(await fs.readFile(path, "utf8"));
            });

            assert.deepStrictEqual(output, {
                apiVersion: "v1",
                kind: "Secret",
                type: "Opaque",
                metadata: {
                    name: "yoursecret",
                },
                data: {
                    username: "dGhlIHJvb3RtaW5pc3RyYXRvcg==",
                    password: "Y29ycmVjdCBob3JzZSBiYXR0ZXJ5IHN0YXBsZQ==",
                },
            });
        });

        it("edit encoded", async () => {
            process.env.EDITOR = "npx replace --silent horse zebra";

            let output;
            await withFile(async ({path, fd}) => {
                await fs.writeFile(path, yaml.safeDump(encodedSecret));

                await kubeEdit({file: path});

                output = await yaml.safeLoad(await fs.readFile(path, "utf8"));
            });

            assert.deepStrictEqual(output, {
                apiVersion: "v1",
                kind: "Secret",
                type: "Opaque",
                metadata: {
                    name: "mysecret",
                },
                data: {
                    username: "dGhlIHJvb3RtaW5pc3RyYXRvcg==",
                    password: "Y29ycmVjdCB6ZWJyYSBiYXR0ZXJ5IHN0YXBsZQ==",
                },
            });
        });

        it("edit encrypted", async () => {
            process.env.EDITOR = "npx replace --silent horse zebra";

            let output;
            await withFile(async ({path, fd}) => {
                await fs.writeFile(path, yaml.safeDump(encryptedSecret));

                await kubeEdit({file: path, secretKey: "you-would-never-guess"});

                output = await yaml.safeLoad(await fs.readFile(path, "utf8"));
            });

            assert.deepStrictEqual(output, {
                apiVersion: "v1",
                kind: "Secret",
                type: "Opaque",
                metadata: {
                    name: "mysecret",
                },
                data: {
                    username: "2RtW5dUnrmmgDPmGExnYt1nHizOm+CUkMsNG9+xOnSU=",
                    password: "n04B+JR7vlmMG/Kri0XFjVWqx2q2QvskF5xeaNNgi7S+o1s0eXlCoY7yKd2LXYC1",
                },
            });
        });
    });

});
