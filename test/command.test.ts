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
    extractArgs,
    shouldAddLocalSdmCommands,
} from "../lib/command";

describe("command", () => {

    describe("shouldAddLocalSdmCommands", () => {

        const knownCommands = [
            "config",
            "execute",
            "git",
            "gql-fetch",
            "gql-gen",
            "kube",
            "start",
        ];

        it("should return false for empty args", () => {
            const args: string[] = [];
            assert(!shouldAddLocalSdmCommands(args));
        });

        it("should return false for no commands", () => {
            const args = ["/usr/local/Cellar/node/10.8.0/bin/node", "/Users/rihanna/develop/atomist/cli/index.js"];
            assert(!shouldAddLocalSdmCommands(args));
        });

        it("should return true for --help", () => {
            const args = ["node", "index.js", "--help"];
            assert(shouldAddLocalSdmCommands(args));
        });

        it("should return false for --version", () => {
            const args = ["node", "index.js", "--version"];
            assert(!shouldAddLocalSdmCommands(args));
        });

        it("should return false for known commands", () => {
            const firstArgs = ["node", "index.js"];
            knownCommands.forEach(c => {
                assert(!shouldAddLocalSdmCommands([...firstArgs, c]));
            });
        });

        it("should return false for known commands with more arguments", () => {
            const firstArgs = ["node", "index.js"];
            const lastArgs = ["some", "--command", "line", "-o", "ptions"];
            knownCommands.forEach(c => {
                assert(!shouldAddLocalSdmCommands([...firstArgs, c, ...lastArgs]));
            });
        });

        it("should return true for unknown commands", () => {
            const firstArgs = ["node", "index.js"];
            ["conf", "gt", "gql-fletch", "gql-generate", "kubernetes", "stop"].forEach(c => {
                assert(shouldAddLocalSdmCommands([...firstArgs, c]));
            });
        });

        it("should return true for unknown commands with more arguments", () => {
            const firstArgs = ["node", "index.js"];
            const lastArgs = ["some", "--command", "line", "-o", "ptions"];
            ["umbrella", "betta", "have", "my", "money"].forEach(c => {
                assert(shouldAddLocalSdmCommands([...firstArgs, c, ...lastArgs]));
            });
        });

        it("should ignore known commands later in the arguments", () => {
            const firstArgs = ["node", "index.js"];
            const lastArgs = ["config", "--git", "gql-fetch", "-k", "start"];
            ["umbrella", "betta", "have", "my", "money"].forEach(c => {
                assert(shouldAddLocalSdmCommands([...firstArgs, c, ...lastArgs]));
            });
        });

    });

    describe("extractArgs", () => {

        it("should parse parameter value pairs", () => {
            const pvs = ["mavis=staples", "cleotha=staples", "pervis=staples", "roebuck=pops"];
            const args = extractArgs(pvs);
            assert(args.length === pvs.length);
            assert(args[0].name === "mavis");
            assert(args[0].value === "staples");
            assert(args[1].name === "cleotha");
            assert(args[1].value === "staples");
            assert(args[2].name === "pervis");
            assert(args[2].value === "staples");
            assert(args[3].name === "roebuck");
            assert(args[3].value === "pops");
        });

        it("should parse values with equal signs", () => {
            const pvs = ["staples=cleotha=mavis=pervis=pops"];
            const args = extractArgs(pvs);
            assert(args.length === pvs.length);
            assert(args[0].name === "staples");
            assert(args[0].value === "cleotha=mavis=pervis=pops");
        });

        it("should parse parameters without value to undefined", () => {
            const pvs = ["cleotha", "mavis", "pervis", "pops"];
            const args = extractArgs(pvs);
            assert(args.length === pvs.length);
            assert(args[0].name === "cleotha");
            assert(args[0].value === undefined);
            assert(args[1].name === "mavis");
            assert(args[1].value === undefined);
            assert(args[2].name === "pervis");
            assert(args[2].value === undefined);
            assert(args[3].name === "pops");
            assert(args[3].value === undefined);
        });

        it("should parse parameters with empty values to empty strings", () => {
            const pvs = ["cleotha=", "mavis=", "pervis=", "pops="];
            const args = extractArgs(pvs);
            assert(args.length === pvs.length);
            assert(args[0].name === "cleotha");
            assert(args[0].value === "");
            assert(args[1].name === "mavis");
            assert(args[1].value === "");
            assert(args[2].name === "pervis");
            assert(args[2].value === "");
            assert(args[3].name === "pops");
            assert(args[3].value === "");
        });

    });

});
