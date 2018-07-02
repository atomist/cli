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

import {
    CommandHandler,
    failure,
    HandleCommand,
    HandlerContext,
    HandlerResult,
    logger,
    MappedParameter,
    MappedParameters,
    Parameter,
    Success,
    success,
    Tags,
} from "@atomist/automation-client";

import { Person } from "../typings/types";

@CommandHandler("sends a hello back to the channel", "hello world")
@Tags("hello")
export class HelloWorld implements HandleCommand {

    @Parameter({
        displayName: "Name",
        description: "name of person to say hello to",
        pattern: /^.+$/,
        validInput: "a single line of text",
        minLength: 1,
        maxLength: 100,
        required: true,
    })
    public name: string;

    @MappedParameter(MappedParameters.SlackUserName)
    public slackUser: string;

    public handle(ctx: HandlerContext): Promise<HandlerResult> {
        logger.debug(`incoming parameter was ${this.name}`);

        if (!ctx.graphClient) {
            return Promise.resolve(Success);
        }

        return ctx.graphClient.query<Person.Query, Person.Variables>({
            name: "person",
            variables: { teamId: ctx.teamId, slackUser: this.slackUser },
        })
            .then(result => {
                if (result && result.ChatTeam && result.ChatTeam[0] && result.ChatTeam[0].members &&
                    result.ChatTeam[0].members[0] && result.ChatTeam[0].members[0].person) {

                    return result.ChatTeam[0].members[0].person;
                } else {
                    return null;
                }
            })
            .then(person => {
                if (person) {
                    return ctx.messageClient.respond(`Hello ${this.name} from ${person.forename} ${person.surname}`);
                } else {
                    return ctx.messageClient.respond(`Hello ${this.name}`);
                }
            })
            .then(success, failure);
    }
}
