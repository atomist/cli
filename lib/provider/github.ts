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

import {
    ApolloGraphClient,
    Configuration,
} from "@atomist/automation-client";
import { Deferred } from "@atomist/automation-client/lib/internal/util/Deferred";
import { scanFreePort } from "@atomist/automation-client/lib/util/port";
import axios from "axios";
import * as express from "express";
import * as inquirer from "inquirer";
import opn = require("opn");
import {
    createSpinner,
    nonce,
} from "../config";
import * as print from "../print";
import {
    ConfigureGitHubScmProviderMutation,
    CreateGitHubScmProviderMutation,
} from "./util";

/**
 * Create a GitHub SCM provider for the provided team
 * @param workspaceId
 * @param apiKey
 * @param cfg
 */
export async function createGitHubCom(workspaceId: string,
                                      apiKey: string,
                                      cfg: Configuration): Promise<{ code: number }> {

    let spinner = createSpinner(`Creating new GitHub SCM provider`);
    const graphClient = new ApolloGraphClient(`${cfg.endpoints.graphql}/${workspaceId}`,
        { Authorization: `Bearer ${apiKey}` });
    const result = await graphClient.mutate<{ createGitHubResourceProvider: { id: string } }, {}>({
        mutation: CreateGitHubScmProviderMutation,
    });
    const providerId = result.createGitHubResourceProvider.id;
    spinner.stop(true);

    spinner = createSpinner(`Redirecting through GitHub oauth to collect required secret`);
    const state = nonce(20);
    const port = await scanFreePort();
    const authUrl = cfg.endpoints.auth;
    const url = `${authUrl}/teams/${workspaceId}/resource-providers/${providerId}/token?state=${
        state}&link=true&redirect-uri=${encodeURIComponent(`http://127.0.0.1:${port}/callback`)}`;

    let redirectUrl;
    const redirect = await axios.get(
        url,
        {
            headers: { Authorization: `Bearer ${apiKey}` },
            maxRedirects: 0,
            validateStatus: status => status === 302,
        },
    );
    redirectUrl = redirect.headers.location;

    await opn(redirectUrl, { wait: false });

    const app = express();
    const callback = new Deferred<{}>();
    app.get("/callback", async (req, res) => {
        if (state !== req.query.state) {
            callback.reject("State parameter not correct after authentication. Abort!");
            // res.status(500).json({ message: "State parameter not correct after authentication" });
            res.redirect("https://atomist.com/error-oauth.html");
            return;
        }
        callback.resolve({});
        res.redirect("https://atomist.com/success-oauth.html");
    });

    const server = app.listen(port);
    try {
        await callback.promise;
    } finally {
        server.close();
        spinner.stop(true);
    }

    print.log(`Please provide a comma separated lists of organization names
and/or glob patterns.`);
    const questions: inquirer.Question[] = [{
        type: "input",
        name: "orgs",
        message: "Organizations",
    }];
    const answers = await inquirer.prompt(questions);

    if (answers.orgs && answers.orgs.length > 0) {
        spinner = createSpinner(`Configuring GitHub SCM provider`);
        await graphClient.mutate<{}, { id: string, orgs: string[], repos: Array<{ owner: string, repo: string }> }>({
            mutation: ConfigureGitHubScmProviderMutation,
            variables: {
                id: providerId,
                orgs: (answers.orgs as string).split(",").map(o => o.trim()),
                repos: [],
            },
        });
        spinner.stop(true);
    }

    return {
        code: 0,
    };
}
