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
// tslint:disable-next-line:import-blacklist
import axios from "axios";
import chalk from "chalk";
import * as express from "express";
import * as inquirer from "inquirer";
import { sha256 } from "js-sha256";
import * as _ from "lodash";
import {
    createSpinner,
    nonce,
} from "../config";
import * as print from "../print";
import {
    ConfigureGitHubScmProviderMutation,
    CreateGitHubScmProviderMutation,
} from "./util";
import opn = require("opn");

const OrgsQuery = `query Orgs {
  orgs {
    nodes {
      owner
      ownerType
      viewerCanAdminister
    }
  }
}`;

interface Orgs {
    orgs: {
        nodes: Array<{ owner: string, viewerCanAdminister: boolean, ownerType: "organization" | "user" }>;
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
    credential {
      secret
      scopes
    }
  }
}`;

interface GitHubProvider {
    SCMProvider: Array<{
        id: string;
        targetConfiguration: { orgSpecs: string[], repoSpecs: Array<{ ownerSpec: string, nameSpec: string }> };
        state: {
            error: string;
            name: string;
        },
        credential: {
            secret: string;
            scopes: string[];
        }
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
    let configuredRepos: Array<{ ownerSpec: string, nameSpec: string }> = [];

    const graphClient = new ApolloGraphClient(`${cfg.endpoints.graphql}/${workspaceId}`,
        { Authorization: `Bearer ${apiKey}` });

    let spinner = createSpinner(`Verifying GitHub SCM provider`);
    const providerResult = await graphClient.query<GitHubProvider, {}>({
        query: GitHubProviderQuery,
        options: QueryNoCacheOptions,
    });
    spinner.stop(true);

    if (!!providerResult && !!providerResult.SCMProvider && !!providerResult.SCMProvider[0]) {
        const provider = providerResult.SCMProvider[0];
        providerId = provider.id;
        configuredOrgs = _.get(providerResult, "SCMProvider[0].targetConfiguration.orgSpecs") || [];
        configuredRepos = _.get(providerResult, "SCMProvider[0].targetConfiguration.repoSpecs") || [];

        if (!!provider.state && !!provider.state.error) {
            print.log(`GitHub SCM provider is in state ${chalk.cyan(provider.state.name)} with:
${chalk.red(provider.state.error)}`);
        } else if (!!provider.state) {
            print.log(`GitHub SCM provider is in state ${chalk.cyan(provider.state.name)}`);
        }
    } else {
        spinner = createSpinner(`Creating new GitHub SCM provider`);
        const result = await graphClient.mutate<{ createGitHubResourceProvider: { id: string } }, {}>({
            mutation: CreateGitHubScmProviderMutation,
        });
        providerId = result.createGitHubResourceProvider.id;
        configuredOrgs = [];
        spinner.stop(true);
    }

    const secret = _.get(providerResult, "SCMProvider[0].credential.secret");
    const state = _.get(providerResult, "SCMProvider[0].state.name");

    if (!secret || state === "unauthorized") {

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
                validateStatus: status => status === 302 || status === 303,
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
    }

    const newProviderResult = await graphClient.query<GitHubProvider, {}>({
        query: GitHubProviderQuery,
        options: QueryNoCacheOptions,
    });

    await configure(
        workspaceId,
        apiKey,
        providerId,
        configuredOrgs,
        configuredRepos,
        newProviderResult.SCMProvider[0].credential.secret,
        cfg);

    return {
        code: 0,
    };
}

async function configure(workspaceId: string,
                         apiKey: string,
                         providerId: string,
                         configuredOrgs: string[],
                         configuredRepos: Array<{ ownerSpec: string, nameSpec: string }>,
                         token: string,
                         cfg: Configuration): Promise<any> {

    let spinner = createSpinner(`Loading available GitHub organizations`);

    let graphClient = new ApolloGraphClient(
        cfg.endpoints.graphql.replace("/team", ""),
        { Authorization: `Bearer ${apiKey}` });
    const accessibleOrgs = await graphClient.query<Orgs, void>({
        query: OrgsQuery,
        options: QueryNoCacheOptions,
    });
    spinner.stop(true);

    const orgs = _.uniq([
        ...configuredOrgs,
        ...accessibleOrgs.orgs.nodes.filter(ao => ao.ownerType === "organization").map(o => o.owner)]);

    print.log("");
    print.log(`You can now connect GitHub organizations and/or repositories to
Atomist. When an organization or repository gets connected, Atomist
will install a webhook to receive events like pushes, issues and PRs.`);
    print.log("");
    const questions: inquirer.Question[] = [{
        type: "list",
        name: "type",
        message: "Connect",
        choices: [{
            name: "Organizations",
            value: "orgs",
        }, {
            name: "Repositories",
            value: "repos",
        }]
    }, {
        type: "checkbox",
        name: "orgs",
        message: "Organizations",
        choices: orgs.sort((o1, o2) => o1.localeCompare(o2))
            .map(o => ({
                name: o,
                value: o,
                checked: configuredOrgs.includes(o),
                disabled: () => {
                    const aorg = accessibleOrgs.orgs.nodes.find(ao => ao.owner === o);
                    if (!!aorg && !aorg.viewerCanAdminister) {
                        return "no administrator access";
                    }
                    return undefined;
                },
            })),
        when: a => orgs.length > 0 && a.type === "orgs",
    }, {
        type: "checkbox",
        name: "repos",
        message: "Repositories",
        choices: [
            { name: "Connect new repository", value: "<new_repo>" },
            new inquirer.Separator(),
            ...configuredRepos.sort((o1, o2) =>
                `${o1.ownerSpec}/${o1.nameSpec}`.localeCompare(`${o2.ownerSpec}/${o2.nameSpec}`))
                .map(o => ({
                    name: `${o.ownerSpec}/${o.nameSpec}`,
                    value: o,
                    checked: true,
                }))],
        when: a => configuredRepos.length > 0 && a.type === "repos",
    }, {
        type: "input",
        name: "newRepo",
        message: "Connect repository (owner/repo)",
        when: a => a.type === "repos" && configuredRepos.length === 0 || (!!a.repos && a.repos.includes("<new_repo>")),
        validate: async input => {
            if (!input || input.length === 0) {
                return true;
            }
            try {
                await axios.get(
                    `https://api.github.com/repos/${input}`,
                    { headers: { Authorization: `token ${token}` } });
                return true;
            } catch (e) {
                return chalk.red(`Repository ${input} does not exist or you don't have permissions to access it`);
            }
        },
    }];
    const answers = await inquirer.prompt(questions);

    spinner = createSpinner(`Configuring GitHub SCM provider`);

    graphClient = new ApolloGraphClient(`${cfg.endpoints.graphql}/${workspaceId}`,
        { Authorization: `Bearer ${apiKey}` });

    const repos = (!answers.repos ? [] : answers.repos).filter((r: any) => r !== "<new_repo>").map((r: any) => ({
        owner: r.ownerSpec,
        repo: r.nameSpec,
    }));

    if (!!answers.newRepo) {
        repos.push(slugToRepoSpec(answers.newRepo));
    }

    await graphClient.mutate<{}, { id: string, orgs: string[], repos: Array<{ owner: string, repo: string }> }>({
        mutation: ConfigureGitHubScmProviderMutation,
        variables: {
            id: providerId,
            orgs: !answers.orgs ? [] : answers.orgs,
            repos,
        },
    });
    spinner.stop(true);
}

function slugToRepoSpec(slug: string): { owner: string, repo: string } {
    const parts = slug.split("/");
    return { owner: parts[0], repo: parts[1] };
}
