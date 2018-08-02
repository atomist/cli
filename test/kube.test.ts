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

import * as assert from "power-assert";

import {
    encodeSecret,
    kubeWebhookUrls,
} from "../lib/kube";

describe("kube", () => {

    describe("kubeWebhookUrls", () => {

        it("should return a single URL", () => {
            const w = ["A1234567"];
            const u = kubeWebhookUrls(w);
            const e = "https://webhook.atomist.com/atomist/kube/teams/A1234567";
            assert.equal(u, e);
        });

        it("should return multiple URLs", () => {
            const w = ["A1234567", "A0987654", "A1029384"];
            const u = kubeWebhookUrls(w);
            // tslint:disable-next-line:max-line-length
            const e = "https://webhook.atomist.com/atomist/kube/teams/A1234567,https://webhook.atomist.com/atomist/kube/teams/A0987654,https://webhook.atomist.com/atomist/kube/teams/A1029384";
            assert.equal(u, e);
        });

        it("should return no URLs", () => {
            const w: string[] = [];
            const u = kubeWebhookUrls(w);
            const e = "";
            assert.equal(u, e);
        });

    });

    describe("encodeSecret", () => {

        it("should encode a secret value", () => {
            const s = {
                "yo-la-tengo": `{"albums":["Ride the Tiger","New Wave Hot Dogs","President Yo La Tengo","Fakebook"]}`,
            };
            const k = encodeSecret("ylt", s);
            const e = {
                apiVersion: "v1",
                kind: "Secret",
                type: "Opaque",
                metadata: {
                    name: "ylt",
                },
                data: {
                    // tslint:disable-next-line:max-line-length
                    "yo-la-tengo": "eyJhbGJ1bXMiOlsiUmlkZSB0aGUgVGlnZXIiLCJOZXcgV2F2ZSBIb3QgRG9ncyIsIlByZXNpZGVudCBZbyBMYSBUZW5nbyIsIkZha2Vib29rIl19",
                },
            };
            assert.deepStrictEqual(k, e);
        });

        it("should encode a few secret values", () => {
            const s = {
                "yo-la-tengo": `{"albums":["Ride the Tiger","New Wave Hot Dogs","President Yo La Tengo","Fakebook"]}`,
                "brokenSocialScene": "A Canadian musical collective.\n",
            };
            const k = encodeSecret("feel", s);
            const e = {
                apiVersion: "v1",
                kind: "Secret",
                type: "Opaque",
                metadata: {
                    name: "feel",
                },
                data: {
                    // tslint:disable-next-line:max-line-length
                    "yo-la-tengo": "eyJhbGJ1bXMiOlsiUmlkZSB0aGUgVGlnZXIiLCJOZXcgV2F2ZSBIb3QgRG9ncyIsIlByZXNpZGVudCBZbyBMYSBUZW5nbyIsIkZha2Vib29rIl19",
                    "brokenSocialScene": "QSBDYW5hZGlhbiBtdXNpY2FsIGNvbGxlY3RpdmUuCg==",
                },
            };
            assert.deepStrictEqual(k, e);
        });

        it("should create an empty data secret", () => {
            const s = {};
            const k = encodeSecret("nada", s);
            const e = {
                apiVersion: "v1",
                kind: "Secret",
                type: "Opaque",
                metadata: {
                    name: "nada",
                },
                data: {},
            };
            assert.deepStrictEqual(k, e);
        });

    });

});
