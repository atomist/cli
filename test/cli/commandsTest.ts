import "mocha";
import * as assert from "power-assert";

import { extractArgs } from "../../src/cli/commands";

describe("atomist CLI", () => {

    describe("extractArgs", () => {

        it("should parse parameter value pairs", () => {
            const pvs = ["mavis=staples", "cleotha=staples", "pervis=staples", "roebuck=pops"];
            const args = extractArgs(pvs);
            assert.equal(args.length, pvs.length);
            assert.equal(args[0].name, "mavis");
            assert.equal(args[0].value, "staples");
            assert.equal(args[1].name, "cleotha");
            assert.equal(args[1].value, "staples");
            assert.equal(args[2].name, "pervis");
            assert.equal(args[2].value, "staples");
            assert.equal(args[3].name, "roebuck");
            assert.equal(args[3].value, "pops");
        });

        it("should parse values with equal signs", () => {
            const pvs = ["staples=cleotha=mavis=pervis=pops"];
            const args = extractArgs(pvs);
            assert.equal(args.length, pvs.length);
            assert.equal(args[0].name, "staples");
            assert.equal(args[0].value, "cleotha=mavis=pervis=pops");
        });

        it("should parse parameters without value to undefined", () => {
            const pvs = ["cleotha", "mavis", "pervis", "pops"];
            const args = extractArgs(pvs);
            assert.equal(args.length, pvs.length);
            assert.equal(args[0].name, "cleotha");
            assert.equal(args[0].value, undefined);
            assert.equal(args[1].name, "mavis");
            assert.equal(args[1].value, undefined);
            assert.equal(args[2].name, "pervis");
            assert.equal(args[2].value, undefined);
            assert.equal(args[3].name, "pops");
            assert.equal(args[3].value, undefined);
        });

        it("should parse parameters with empty values to empty strings", () => {
            const pvs = ["cleotha=", "mavis=", "pervis=", "pops="];
            const args = extractArgs(pvs);
            assert.equal(args.length, pvs.length);
            assert.equal(args[0].name, "cleotha");
            assert.equal(args[0].value, "");
            assert.equal(args[1].name, "mavis");
            assert.equal(args[1].value, "");
            assert.equal(args[2].name, "pervis");
            assert.equal(args[2].value, "");
            assert.equal(args[3].name, "pops");
            assert.equal(args[3].value, "");
        });

    });

});
