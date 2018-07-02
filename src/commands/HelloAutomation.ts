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
    success,
    Tags,
    Value,
} from "@atomist/automation-client";
import * as appRoot from "app-root-path";
import { hostname } from "os";

// tslint:disable-next-line:no-var-requires
const pj: any = require(`${appRoot.path}/package.json`);

@CommandHandler("sends information about this automation back to channel", `hello ${pj.name.replace(/^@/, "")}`)
@Tags("hello", "automation")
export class HelloAutomation implements HandleCommand {

    @Value("name")
    private name: string;
    @Value("version")
    private version: string;
    @Value("teamIds")
    private teamIds: string[];
    @Value("groups")
    private groups: string[];
    @Value("environment")
    private environment: string;

    public handle(ctx: HandlerContext): Promise<HandlerResult> {
        const pkg = `${pj.name}:${pj.version}`;
        const atm = `${this.name}:${this.version}`;
        const name = (pkg === atm) ? pkg : `package ${pkg} automation ${atm}`;
        const target = (this.teamIds.length > 1) ? `teams ${this.teamIds.join(", ")}` :
            ((this.teamIds.length > 0) ? `team ${this.teamIds[0]}` :
                ((this.groups.length > 1) ? `groups ${this.groups.join(", ")}` : `group ${this.groups[0]}`));
        let git = "";
        try {
            // tslint:disable-next-line:no-var-requires
            const gi: any = require(`${appRoot.path}/git-info.json`);
            git = ` using ${gi.repository}:${gi.branch}@${gi.sha}`;
        } catch (e) {
            logger.debug(`unable to require git-info.json: ${e.message}`);
        }
        const msg = `Hello from ${name} on ${hostname()} in ${this.environment} for ${target}${git}`;
        return ctx.messageClient.respond(msg)
            .then(success, failure);
    }
}
