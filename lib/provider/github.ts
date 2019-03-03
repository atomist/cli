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
    QueryNoCacheOptions,
} from "@atomist/automation-client";
import { Deferred } from "@atomist/automation-client/lib/internal/util/Deferred";
import { scanFreePort } from "@atomist/automation-client/lib/util/port";
import axios from "axios";
import * as express from "express";
import * as inquirer from "inquirer";
import { sha256 } from "js-sha256";
import * as _ from "lodash";
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

const OrgsQuery = `query Orgs {
  orgs {
    nodes {
      owner
      viewerCanAdminister
    }
  }
}`;

interface Orgs {
    orgs: {
        nodes: Array<{ owner: string, viewerCanAdminister: true }>;
    };
}

const GitHubProviderQuery = `query ScmProviderById {
  SCMProvider(providerType: github_com) {
    apiUrl
    url
    gitUrl
    providerType
    id
    providerId
    name
    targetConfiguration {
      orgSpecs
      repoSpecs {
        ownerSpec
        nameSpec
      }
    }
    state {
      error
      name
    }
    authProviderId
    webhooks {
      id
      url
      tags {
        name
        value
      }
    }
  }
}`;

interface GitHubProvider {
    SCMProvider: Array<{
        id: string;
        targetConfiguration: Array<{ orgSpecs: string[] }>;
    }>;
}

/**
 * Create a GitHub SCM provider for the provided team
 * @param workspaceId
 * @param apiKey
 * @param cfg
 */
export async function createGitHubCom(workspaceId: string,
                                      apiKey: string,
                                      cfg: Configuration): Promise<{ code: number }> {
    let providerId: string;
    let configuredOrgs: string[];

    const graphClient = new ApolloGraphClient(`${cfg.endpoints.graphql}/${workspaceId}`,
        { Authorization: `Bearer ${apiKey}` });

    let spinner = createSpinner(`Verifying GitHub SCM provider`);
    const providerResult = await graphClient.query<GitHubProvider, {}>({
        query: GitHubProviderQuery,
    });
    spinner.stop(true);

    if (!!providerResult && !!providerResult.SCMProvider && !!providerResult.SCMProvider[0]) {
        providerId = providerResult.SCMProvider[0].id;
        configuredOrgs = _.get(providerResult, "SCMProvider[0].targetConfiguration.orgSpecs") || [];
    } else {
        spinner = createSpinner(`Creating new GitHub SCM provider`);
        const result = await graphClient.mutate<{ createGitHubResourceProvider: { id: string } }, {}>({
            mutation: CreateGitHubScmProviderMutation,
        });
        providerId = result.createGitHubResourceProvider.id;
        configuredOrgs = [];
        spinner.stop(true);
    }

    spinner = createSpinner(`Redirecting through GitHub oauth to collect required secret`);
    const state = nonce(20);
    const verifier = nonce();
    const code = sha256(verifier);
    const port = await scanFreePort();
    const authUrl = cfg.endpoints.auth;
    const url = `${authUrl}/teams/${workspaceId}/resource-providers/${providerId}/token?code-challenge=${code}&state=${
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
        try {
            await axios.post(`${authUrl}/teams/${workspaceId}/resource-providers/${providerId}/token`, {
                "code": req.query.code,
                "code-verifier": verifier,
            }, {
                headers: { Authorization: `Bearer ${apiKey}` },
            });
            callback.resolve();
            res.redirect("https://atomist.com/success-oauth.html");
        } catch (e) {
            callback.reject(new Error(`Authentication failed: ${e.message}`));
            // res.status(500).json({ message: e.message });
            res.redirect("https://atomist.com/error-oauth.html");
        }
    });

    const server = app.listen(port);
    try {
        await callback.promise;
    } finally {
        server.close();
        spinner.stop(true);
    }

    await configure(workspaceId, apiKey, providerId, configuredOrgs, cfg);

    return {
        code: 0,
    };
}

async function configure(workspaceId: string,
                         apiKey: string,
                         providerId: string,
                         configuredOrgs: string[],
                         cfg: Configuration): Promise<any> {

    let spinner = createSpinner(`Loading GitHub organizations`);

    let graphClient = new ApolloGraphClient(
        cfg.endpoints.graphql.replace("/team", ""),
        { Authorization: `Bearer ${apiKey}` });
    const accessibleOrgs = await graphClient.query<Orgs, void>({
        query: OrgsQuery,
        options: QueryNoCacheOptions,
    });
    spinner.stop(true);

    const orgs = _.uniq([...configuredOrgs, ...accessibleOrgs.orgs.nodes.map(o => o.owner)]);

    print.log(`Please select organizations you want to enable:`);
    const questions: inquirer.Question[] = [{
        type: "checkbox",
        name: "orgs",
        message: "Organizations",
        choices: orgs.sort((o1, o2) => o1.localeCompare(o2))
            .map(o => ({
                name: o,
                value: o,
                checked: configuredOrgs.includes(o),
            })),
    }];
    const answers = await inquirer.prompt(questions);

    spinner = createSpinner(`Configuring GitHub SCM provider`);

    graphClient = new ApolloGraphClient(`${cfg.endpoints.graphql}/${workspaceId}`,
        { Authorization: `Bearer ${apiKey}` });
    await graphClient.mutate<{}, { id: string, orgs: string[], repos: Array<{ owner: string, repo: string }> }>({
        mutation: ConfigureGitHubScmProviderMutation,
        variables: {
            id: providerId,
            orgs: !answers.orgs ? [] : answers.orgs,
            repos: [],
        },
    });
    spinner.stop(true);
}
