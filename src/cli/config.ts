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

import * as GitHubApi from "@octokit/rest";
import * as inquirer from "inquirer";
import * as stringify from "json-stringify-safe";
import * as _ from "lodash";
import * as os from "os";

import {
    getUserConfig,
    userConfigPath,
    writeUserConfig,
} from "@atomist/automation-client/configuration";

const github = new GitHubApi();

function createGitHubToken(user: string, password: string, mfa?: string): Promise<string> {
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
    return github.authorization.create(params).then(res => {
        if (res.data && res.data.token) {
            return res.data.token;
        }
        throw new Error(`GitHub API returned successful but there is no token`);
    });
}

export function cliAtomistConfig(argv: any): Promise<number> {

    const argTeamId: string = argv["workspace-id"];
    const argGitHubUser: string = argv["github-user"];
    const argGitHubPassword: string = argv["github-password"];
    const argGitHubMfaToken: string = argv["github-mfa-token"];
    const argAtomistToken: string = argv["atomist-token"];

    const userConfig = getUserConfig() || {};
    if (!userConfig.teamIds) {
        userConfig.teamIds = [];
    }
    if (argTeamId) {
        if (!userConfig.teamIds.includes(argTeamId)) {
            userConfig.teamIds.push(argTeamId);
        }
    }
    if (argAtomistToken) {
        if (userConfig.token && userConfig.token !== argAtomistToken) {
            console.log(`Overwriting current token with value from command line.`);
        }
        userConfig.token = argAtomistToken;
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
        console.log(`
As part of the Atomist configuration, we need to create a GitHub
personal access token for you that will be used to authenticate with
the Atomist API.  The personal access token will have "read:org" and
"repo" scopes, be labeled as being for the "Atomist API", and will be
written to a file on your local machine.  Atomist does not retain the
token nor your GitHub username and password.
`);
        if (!argGitHubUser) {
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
        if (!argGitHubPassword) {
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
        if (!argGitHubMfaToken) {
            questions.push({
                type: "input",
                name: "mfa",
                message: "GitHub 2FA Code",
                when: (answers: any) => {
                    const user = (argGitHubUser) ? argGitHubUser : answers.user;
                    const password = (argGitHubPassword) ? argGitHubPassword : answers.password;
                    return createGitHubToken(user, password)
                        .then(token => {
                            userConfig.token = token;
                            return false;
                        })
                        .catch(err => {
                            if (err.code === 401 && err.message) {
                                const msg = JSON.parse(err.message);
                                const mfaErr = "Must specify two-factor authentication OTP code.";
                                if ((msg.message as string).indexOf(mfaErr) > -1) {
                                    return true;
                                }
                            }
                            throw err;
                        });
                },
                validate: (value: string, answers: any) => {
                    if (!/^\d{6}$/.test(value)) {
                        return `The GitHub 2FA you entered is invalid, it should be six digits: ${value}`;
                    }
                    return true;
                },
            } as any as inquirer.Question);
        }
    } else {
        console.log(`
Your Atomist client configuration already has an access token.
To generate a new token, remove the existing token from
'${configPath}'
and run \`atomist config\` again.
`);
    }

    return inquirer.prompt(questions)
        .then(answers => {
            if (answers.teamIds) {
                userConfig.teamIds = (answers.teamIds as string).split(/\s+/);
            }

            const sdm: any = {};

            if (answers.dockerRegistry) {
                sdm.docker = {
                    registry: answers.dockerRegistry,
                    user: answers.dockerUser,
                    password: answers.dockerPassword,
                };
            }

            if (answers.cfUser) {
                sdm.cloudfoundry = {
                    user: answers.cfUser,
                    password: answers.cfPassword,
                    org: answers.cfOrg,
                    space: {
                        staging: answers.cfSpaceStaging,
                        production: answers.cfSpaceProd,
                    },
                    api: answers.cfApi,
                };
            }

            if (answers.npm) {
                try {
                    sdm.npm = JSON.parse(answers.npm);
                } catch (e) {
                    e.message = `Failed to parse NPM configuration as JSON: ${e.message}`;
                    return Promise.reject(e);
                }
            }

            if (answers.checkstylePath) {
                sdm.checkstyle = {
                    enable: answers.checkstyle,
                    path: answers.checkstylePath,
                };
            }

            if (userConfig.sdm) {
                _.merge(userConfig.sdm, sdm);
            } else {
                userConfig.sdm = sdm;
            }

            if (!userConfig.token) {
                const user = (argGitHubUser) ? argGitHubUser : answers.user;
                const password = (argGitHubPassword) ? argGitHubPassword : answers.password;
                const mfa = (argGitHubMfaToken) ? argGitHubMfaToken : answers.mfa;
                return createGitHubToken(user, password, mfa)
                    .then(token => {
                        userConfig.token = token;
                    });
            }
        })
        .then(() => writeUserConfig(userConfig))
        .then(() => {
            console.info(`Successfully created Atomist client configuration: ${configPath}`);
            return 0;
        }, err => {
            console.error(`Failed to create client configuration '${configPath}': ${stringify(err)}`);
            return 1;
        });
}
