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

import { execPromise } from "@atomist/sdm";
import * as fs from "fs-extra";
import * as yaml from "js-yaml";
import * as assert from "power-assert";
import { withFile } from "tmp-promise";

// tslint:disable-next-line: typedef
describe("kube-decrypt cli", function() {

    // tslint:disable-next-line: no-invalid-this
    this.timeout("5s");

    const encryptedSecret = {
        apiVersion: "v1",
        kind: "Secret",
        type: "Opaque",
        data: {
            remember: "KsSz7+4qYPKJFgAiHM9Dn7q7Of5hqKHIpm2SNQF7wWEAEwY8TftCBxfz2xeVLRKN",
        },
    };

    it("show help message", async () => {
        const result = await execPromise(
            "node",
            [
                "index",
                "kube-decrypt",
                "--help",
            ]);

        assert(result.stdout.includes("Decrypt encrypted Kubernetes secret data values"));
    });

    it("file and literal provided", async () => {
        try {
            await execPromise(
                "node",
                [
                    "index",
                    "kube-decrypt",
                    "--file=blah",
                    "--literal=blahblah",
                ]);
            assert.fail("command should fail");
        } catch (e) {
            assert(e.stderr.includes("Arguments file and literal are mutually exclusive"));
        }
    });

    it("literal and key provided", async () => {
        const execResult = await execPromise(
            "node",
            [
                "index",
                "kube-decrypt",
                "--secret-key=key",
                "--literal=PAk9Y8m7GR8KJULQo+g63HmZUmsLIg1VgiVAnBVjmFQhcHly+lM0i0U/BbZP8f0e",
            ]);

        const encryptedString = execResult.stdout.trim();
        assert.equal(encryptedString, "Y29ycmVjdCB6ZWJyYSBiYXR0ZXJ5IHN0YXBsZQ==");
    });

    it("literal, base64 and key provided", async () => {
        const execResult = await execPromise(
            "node",
            [
                "index",
                "kube-decrypt",
                "--secret-key=key",
                `--literal="PAk9Y8m7GR8KJULQo+g63HmZUmsLIg1VgiVAnBVjmFQhcHly+lM0i0U/BbZP8f0e"`,
                "--base64",
            ]);

        const encryptedString = execResult.stdout.trim();
        assert.equal(encryptedString, "correct zebra battery staple");
    });

    it("file and key provided", async () => {
        await withFile(async fr => {
            await fs.writeFile(fr.path, yaml.safeDump(encryptedSecret));

            const execResult = await execPromise(
                "node",
                [
                    "index",
                    "kube-decrypt",
                    "--secret-key=key",
                    `--file=${fr.path}`,
                ]);

            const output = yaml.safeLoad(execResult.stdout);
            assert.deepEqual(output, {
                apiVersion: "v1",
                kind: "Secret",
                type: "Opaque",
                data: {
                    remember: "Y29ycmVjdCBob3JzZSBzdGFwbGUgYmF0dGVyeQ==",
                },
            });
        });
    });

    it("file, base64 and key provided", async () => {
        await withFile(async fr => {
            await fs.writeFile(fr.path, yaml.safeDump(encryptedSecret));

            const execResult = await execPromise(
                "node",
                [
                    "index",
                    "kube-decrypt",
                    "--secret-key=key",
                    `--file=${fr.path}`,
                    "--base64",
                ]);

            const output = yaml.safeLoad(execResult.stdout);
            assert.deepEqual(output, {
                apiVersion: "v1",
                kind: "Secret",
                type: "Opaque",
                data: {
                    remember: "correct horse staple battery",
                },
            });
        });
    });
}).timeout("5s");
