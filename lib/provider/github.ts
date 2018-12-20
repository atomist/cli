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
import * as GitHubApi from "@octokit/rest";
import chalk from "chalk";
import * as inquirer from "inquirer";
import * as os from "os";
import {
    createSpinner,
    maskString,
} from "../config";
import * as print from "../print";
import {
    CreateScmConfigurationItemMutation,
    CreateScmProviderMutation,
} from "./util";

/**
 * Create a GitHub SCM provider for the provided team
 * @param workspaceId
 * @param apiKey
 * @param cfg
 */
export async function createGitHubCom(workspaceId: string,
                                      apiKey: string,
                                      cfg: Configuration):
    Promise<{ code: number, configuration: Partial<Configuration> }> {

    let token = cfg.token;
    if (!token) {
        try {
            token = await obtainToken();
        } catch (e) {
            print.error(`Failed to obtain GitHub token: ${e.message}`);
            return {
                code: 1,
                configuration: {},
            };
        }
    }

    print.log(`Specify which GitHub organizations and/or repositories
you want to connect to Atomist. Please comma separated
names or glob patterns.`);
    const questions: inquirer.Question[] = [{
        type: "input",
        name: "orgs",
        message: "Organizations",
    }, {
        type: "input",
        name: "repos",
        message: "Repositories",
    }];
    const answers = await inquirer.prompt(questions);

    const spinner = createSpinner(`Creating new GitHub SCM provider`);

    const graphClient = new ApolloGraphClient(`${cfg.endpoints.graphql}/${workspaceId}`,
        { Authorization: `Bearer ${apiKey}` });
    await graphClient.mutate<{}, any>({
        mutation: CreateScmProviderMutation,
        variables: {
            name: "GitHub.com",
            type: "github_com",
            apiUrl: "https://api.github.com",
            gitUrl: "git@github.com:",
        },
    });

    // TODO get provider id from the previous mutation result
    const providerId = `${workspaceId}_zjlmxjzwhurspem`;

    if (answers.orgs && answers.orgs.length > 0) {
        await graphClient.mutate<{}, { id: string, name: string, value: string, description: string }>({
            mutation: CreateScmConfigurationItemMutation,
            variables: {
                id: providerId,
                value: answers.orgs.replace(/ /g, ""),
                name: "orgs",
                description: "Organizations",
            },
        });
    }
    if (answers.repos && answers.repos.length > 0) {
        await graphClient.mutate<{}, { id: string, name: string, value: string, description: string }>({
            mutation: CreateScmConfigurationItemMutation,
            variables: {
                id: providerId,
                value: answers.repos.replace(/ /g, ""),
                name: "repos",
                description: "Repositories",
            },
        });
    }

    spinner.stop(true);

    return {
        code: 0,
        configuration: {
            token,
        },
    };
}

async function obtainToken(): Promise<string> {
    let token: string;

    print.log(`In order to create a GitHub SCM resource provider,
we need to obtain a GitHub token with ${chalk.cyan("admin:org_hook")}
scope. The token will ${chalk.bold("not")} be stored with Atomist!`);
    const questions: inquirer.Question[] = [
        {
            type: "input",
            name: "username",
            message: `GitHub username`,
            when: !token,
            validate: value => {
                if (!/^[-.A-Za-z0-9]+$/.test(value)) {
                    return `The GitHub username you entered contains invalid characters: ${value}`;
                }
                return true;
            },
        },
        {
            type: "input",
            name: "password",
            transformer: maskString,
            message: `GitHub password`,
            when: !token,
            validate: value => {
                if (value.length < 1) {
                    return `The GitHub password you entered is empty`;
                }
                return true;
            },
        },
        {
            type: "input",
            name: "mfa",
            message: "GitHub 2FA code",
            when: async ans => {
                if (!token) {
                    const username = ans.username;
                    const password = ans.password;
                    try {
                        token = await createToken(username, password);
                    } catch (e) {
                        if (e.status === 401 && e.headers["x-github-otp"]) {
                            return e.headers["x-github-otp"].includes("required");
                        } else {
                            throw e;
                        }
                    }
                }
                return false;
            },
            validate: (value: string) => {
                if (!/^\d{6}$/.test(value)) {
                    return `The GitHub 2FA you entered is invalid, it should be six digits: ${value}`;
                }
                return true;
            },
        },
    ];

    const answers = await inquirer.prompt(questions);

    const spinner = createSpinner(`Creating new GitHub personal access token`);
    token = await createToken(answers.username, answers.password, answers.mfa);
    spinner.stop(true);
    return token;
}

/**
 * Create a GitHub.com personal access token using a GitHub.com user
 * name, password, and optionally MFA token.
 * @param user GitHub.com user name
 * @param password GitHub.com user password
 * @param mfa GitHub.com user MFA token
 * @return Promise of the token
 */
async function createToken(user: string, password: string, mfa?: string): Promise<string> {
    const github = new GitHubApi();
    github.authenticate({
        type: "basic",
        username: user,
        password,
    });
    const host = os.hostname();
    const params: any = {
        scopes: ["repo", "admin:repo_hook", "admin:org_hook"],
        note: `Atomist CLI on ${host}`,
        note_url: "http://app.atomist.com/",
        fingerprint: Date.now(),
    };
    if (mfa) {
        (params).headers = { "X-GitHub-OTP": mfa };
    }
    const res = await github.oauthAuthorizations.createAuthorization(params);
    if (!res.data || !res.data.token) {
        throw new Error(`GitHub API returned successful but there is no token`);
    }
    return res.data.token;
}
