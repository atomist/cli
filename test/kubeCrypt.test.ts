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

import * as k8s from "@kubernetes/client-node";
import * as assert from "power-assert";
import { DeepPartial } from "ts-essentials";
import {
    base64,
    cryptEncode,
} from "../lib/kubeCrypt";

describe("kubeCrypt", () => {

    describe("base64", () => {

        it("encode", () => {
            const secret: DeepPartial<k8s.V1Secret> = {
                apiVersion: "v1",
                kind: "Secret",
                type: "Opaque",
                data: {
                    jane: "doe",
                    john: "smith",
                },
            };

            const encodedSecret = base64(secret, true);

            assert.deepStrictEqual(encodedSecret, {
                apiVersion: "v1",
                kind: "Secret",
                type: "Opaque",
                data: {
                    jane: "ZG9l",
                    john: "c21pdGg=",
                },
            });
        });

        it("decode", () => {
            const secret: DeepPartial<k8s.V1Secret> = {
                apiVersion: "v1",
                kind: "Secret",
                type: "Opaque",
                data: {
                    music: "Um9jayAmIFJvbGw=",
                },
            };

            const encodedSecret = base64(secret, false);

            assert.deepStrictEqual(encodedSecret, {
                apiVersion: "v1",
                kind: "Secret",
                type: "Opaque",
                data: {
                    music: "Rock & Roll",
                },
            });
        });
    });

    describe("doKubeCrypt", () => {

        it("encrypt without base64", async () => {
            const secret: DeepPartial<k8s.V1Secret> = {
                apiVersion: "v1",
                kind: "Secret",
                type: "Opaque",
                data: {
                    jane: "doe",
                    john: "smith",
                },
            };

            const encodedSecret = await cryptEncode(secret, "super-secret-key", true, false);

            assert.deepStrictEqual(encodedSecret, {
                apiVersion: "v1",
                kind: "Secret",
                type: "Opaque",
                data: {
                    jane: "UiYhAtTurHKXQ2rWnmOs/Q==",
                    john: "VNqXYEwNsLpS7TQ4hJmSFw==",
                },
            });
        });

        it("encrypt with base64", async () => {
            const secret: DeepPartial<k8s.V1Secret> = {
                apiVersion: "v1",
                kind: "Secret",
                type: "Opaque",
                data: {
                    jane: "doe",
                    john: "smith",
                },
            };

            const encodedSecret = await cryptEncode(secret, "super-secret-key", true, true);

            assert.deepStrictEqual(encodedSecret, {
                apiVersion: "v1",
                kind: "Secret",
                type: "Opaque",
                data: {
                    jane: "ZTqxNwPNH8m87L2D6nzYaQ==",
                    john: "dwM3clgniklNL8yBW67xMA==",
                },
            });
        });

        it("decrypt without base64", async () => {
            const secret: DeepPartial<k8s.V1Secret> = {
                apiVersion: "v1",
                kind: "Secret",
                type: "Opaque",
                data: {
                    jane: "UiYhAtTurHKXQ2rWnmOs/Q==",
                    john: "VNqXYEwNsLpS7TQ4hJmSFw==",
                },
            };

            const encodedSecret = await cryptEncode(secret, "super-secret-key", false, false);

            assert.deepStrictEqual(encodedSecret, {
                apiVersion: "v1",
                kind: "Secret",
                type: "Opaque",
                data: {
                    jane: "doe",
                    john: "smith",
                },
            });
        });

        it("decrypt with base64", async () => {
            const secret: DeepPartial<k8s.V1Secret> = {
                apiVersion: "v1",
                kind: "Secret",
                type: "Opaque",
                data: {
                    jane: "ZTqxNwPNH8m87L2D6nzYaQ==",
                    john: "dwM3clgniklNL8yBW67xMA==",
                },
            };

            const encodedSecret = await cryptEncode(secret, "super-secret-key", false, true);

            assert.deepStrictEqual(encodedSecret, {
                apiVersion: "v1",
                kind: "Secret",
                type: "Opaque",
                data: {
                    jane: "doe",
                    john: "smith",
                },
            });
        });
    });
});
