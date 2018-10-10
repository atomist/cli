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

import { cleanCommandString } from "../lib/spawn";

describe("spawn", () => {

    describe("cleanCommandString", () => {

        it("should create a command string", () => {
            const c = "bodeans";
            const a = ["black", "and", "white"];
            const s = cleanCommandString(c, a);
            const e = "bodeans 'black' 'and' 'white'";
            assert(s === e);
        });

        it("should allow no arguments", () => {
            const c = "bodeans";
            const s = cleanCommandString(c);
            assert(s === c);
        });

        it("should clean the command string", () => {
            const c = "bodeans";
            const a = ["black", "Authorization: token h3110f4ch4nc3", "white"];
            const s = cleanCommandString(c, a);
            const e = "bodeans 'black' 'Authorization: <hidden>' 'white'";
            assert(s === e);
        });

        it("should clean all of the command string", () => {
            const c = "bodeans";
            const a = ["black", "Authorization: token h3110f4ch4nc3", "2 Authorization: Bearer B4DF0RY0U", "white"];
            const s = cleanCommandString(c, a);
            const e = "bodeans 'black' 'Authorization: <hidden>' '2 Authorization: <hidden>' 'white'";
            assert(s === e);
        });

    });

});
