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

import {
    getUserConfig,
    userConfigPath,
    writeUserConfig,
} from "@atomist/automation-client/configuration";
import * as GitHubApi from "@octokit/rest";
import * as inquirer from "inquirer";
import * as os from "os";

import * as print from "./print";

/**
 * Command-line options and arguments for config.
 */
export interface ConfigOptions {
    /** GitHub.com user login name */
    githubUser?: string;
    /** GitHub.com user login password */
    githubPassword?: string;
    /** GitHub.com user login multi-factor authentication token */
    githubMfaToken?: string;
    /** Atomist token, currently a GitHub personal access token with read:org scope */
    token?: string;
    /** Atomist workspace/team ID */
    workspaceId?: string;
}

/* tslint:disable:cyclomatic-complexity */
/**
 * Generate Atomist user configuration file, potentially merging with
 * existing user configuration.
 *
 * @param opts see ConfigOptions
 * @return integer return value
 */
export async function config(opts: ConfigOptions): Promise<number> {
    const userConfig = getUserConfig() || {};
    if (!userConfig.teamIds) {
        userConfig.teamIds = [];
    }
    if (opts.workspaceId) {
        if (!userConfig.teamIds.includes(opts.workspaceId)) {
            userConfig.teamIds.push(opts.workspaceId);
        }
    }
    if (opts.token) {
        if (userConfig.token && userConfig.token !== opts.token) {
            print.warn(`Overwriting current token with value from command line.`);
        }
        userConfig.token = opts.token;
    }

    const questions: inquirer.Question[] = [];

    const teamsQuestion: inquirer.Question = {
        type: "input",
        name: "teamIds",
        message: "Atomist Workspace IDs (space delimited)",
        validate: value => {
            if (!/\S/.test(value) && userConfig.teamIds.length < 1) {
                return `The list of team IDs you entered is empty`;
            }
            return true;
        },
    };
    if (userConfig.teamIds.length > 0) {
        teamsQuestion.default = userConfig.teamIds.join(" ");
    }
    questions.push(teamsQuestion);

    const configPath = userConfigPath();
    if (!userConfig.token) {
        print.log(`
As part of the Atomist configuration, we need to create a GitHub
personal access token for you that will be used to authenticate with
the Atomist API.  The personal access token will have "read:org" and
"repo" scopes, be labeled as being for the "Atomist API", and will be
written to a file on your local machine.  Atomist does not retain the
token nor your GitHub username and password.
`);
        if (!opts.githubUser) {
            questions.push({
                type: "input",
                name: "user",
                message: "GitHub Username",
                validate: value => {
                    if (!/^[-.A-Za-z0-9]+$/.test(value)) {
                        return `The GitHub username you entered contains invalid characters: ${value}`;
                    }
                    return true;
                },
            });
        }
        if (!opts.githubPassword) {
            questions.push({
                type: "password",
                name: "password",
                message: "GitHub Password",
                validate: value => {
                    if (value.length < 1) {
                        return `The GitHub password you entered is empty`;
                    }
                    return true;
                },
            });
        }
        if (!opts.githubMfaToken) {
            questions.push({
                type: "input",
                name: "mfa",
                message: "GitHub 2FA Code",
                when: async ans => {
                    const user = (opts.githubUser) ? opts.githubUser : ans.user;
                    const password = (opts.githubPassword) ? opts.githubPassword : ans.password;
                    try {
                        const token = await createGitHubToken(user, password);
                        userConfig.token = token;
                    } catch (e) {
                        if (e.code === 401 && e.message) {
                            const msg = JSON.parse(e.message);
                            const mfaErr = "Must specify two-factor authentication OTP code.";
                            if ((msg.message as string).indexOf(mfaErr) > -1) {
                                return true;
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
            });
        }
    } else {
        print.log(`
Your Atomist client configuration already has an access token.
To generate a new token, remove the existing token from
'${configPath}'
and run \`atomist config\` again.
`);
    }

    try {
        const answers = await inquirer.prompt(questions);
        if (answers.teamIds) {
            userConfig.teamIds = (answers.teamIds as string).split(/\s+/);
        }

        if (!userConfig.token) {
            const user = (opts.githubUser) ? opts.githubUser : answers.user;
            const password = (opts.githubPassword) ? opts.githubPassword : answers.password;
            const mfa = (opts.githubMfaToken) ? opts.githubMfaToken : answers.mfa;
            const token = await createGitHubToken(user, password, mfa);
            userConfig.token = token;
        }

        await writeUserConfig(userConfig);
    } catch (e) {
        print.error(`Failed to create client configuration '${configPath}': ${e.message}`);
        return 1;
    }
    print.info(`Successfully created Atomist client configuration: ${configPath}`);
    return 0;
}
/* tslint:enable:cyclomatic-complexity */

/**
 * Create a GitHub.com personal access token using a GitHub.com user
 * name, password, and optionally MFA token.
 *
 * @param user GitHub.com user name
 * @param password GitHub.com user password
 * @param mfa GitHub.com user MFA token
 * @return Promise of the token
 */
async function createGitHubToken(user: string, password: string, mfa?: string): Promise<string> {
    const github = new GitHubApi();
    github.authenticate({
        type: "basic",
        username: user,
        password,
    });
    const host = os.hostname();
    const params: GitHubApi.AuthorizationCreateParams = {
        scopes: ["read:org", "repo"],
        note: `Atomist API on ${host}`,
        note_url: "http://www.atomist.com/",
    };
    if (mfa) {
        (params as any).headers = { "X-GitHub-OTP": mfa };
    }
    const res = await github.authorization.create(params);
    if (!res.data || !res.data.token) {
        throw new Error(`GitHub API returned successful but there is no token`);
    }
    return res.data.token;
}
