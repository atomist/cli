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
    EventFired,
    EventHandler,
    failure,
    GraphQL,
    HandleEvent,
    HandlerContext,
    HandlerResult,
    logger,
    Success,
    success,
    Tags,
} from "@atomist/automation-client";

import * as graphql from "../typings/types";

@EventHandler("notify repo channels when there is a push", GraphQL.subscription("push"))
@Tags("push", "notification")
export class NotifyOnPush implements HandleEvent<graphql.PushWithRepo.Subscription> {

    public handle(e: EventFired<graphql.PushWithRepo.Subscription>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.debug(`incoming event is ${JSON.stringify(e.data)}`);

        return Promise.all(e.data.Push.map(p => {
            if (p.repo && p.repo.channels && p.repo.channels.length > 0) {
                return ctx.messageClient.addressChannels(`Got a push with sha \`${p.after.sha}\``,
                    p.repo.channels.map(c => c.name));
            } else {
                return Success;
            }
        }))
            .then(success, failure);
    }
}
