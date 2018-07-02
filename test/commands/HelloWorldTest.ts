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

import "mocha";
import * as assert from "power-assert";

import { HandlerContext, logger } from "@atomist/automation-client";
import { LoggingConfig } from "@atomist/automation-client/internal/util/logger";

import { HelloWorld } from "../../src/commands/HelloWorld";
import { Person } from "../../src/typings/types";

LoggingConfig.format = "cli";
(logger as any).level = process.env.LOG_LEVEL || "info";

describe("HelloWorld", () => {

    const hello = new HelloWorld();
    hello.name = "Chance the Rapper";
    hello.slackUser = "LilChano";
    const teamId = "T79TH";
    const forename = "Chancelor";
    const surname = "Bennett";
    const emptyResponse = Promise.resolve({
        ChatTeam: [{
            members: [],
        }],
    });

    it("should extract sender person", async () => {
        let responseMessage: string;
        const ctx = {
            graphClient: {
                query(opts: any): Promise<Person.Query> {
                    if (!opts.name || opts.name !== "person") {
                        return emptyResponse;
                    }
                    if (!opts.variables || opts.variables.slackUser !== hello.slackUser) {
                        return emptyResponse;
                    }
                    if (!opts.variables || opts.variables.teamId !== teamId) {
                        return emptyResponse;
                    }
                    return Promise.resolve({
                        ChatTeam: [{
                            members: [{
                                person: {
                                    forename,
                                    surname,
                                },
                            }],
                        }],
                    });
                },
            },
            messageClient: {
                respond(msg: string): Promise<any> {
                    responseMessage = msg;
                    return Promise.resolve(msg);
                },
            },
            teamId,
        } as HandlerContext;

        const result = await hello.handle(ctx);
        assert(result.code === 0);
        assert(responseMessage === `Hello ${hello.name} from ${forename} ${surname}`);

    });

    it("should respond when no sender person found", async () => {
        let responseMessage: string;
        const ctx = {
            graphClient: {
                query(opts: any): Promise<Person.Query> {
                    return emptyResponse;
                },
            },
            messageClient: {
                respond(msg: string): Promise<any> {
                    responseMessage = msg;
                    return Promise.resolve(msg);
                },
            },
            teamId,
        } as HandlerContext;

        const result = await hello.handle(ctx);
        assert(result.code === 0);
        assert(responseMessage === `Hello ${hello.name}`);
    });

});
