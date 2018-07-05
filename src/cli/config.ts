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

    const argTeamId: string = argv.team;
    const argGitHubUser: string = argv["github-user"];
    const argGitHubPassword: string = argv["github-password"];
    const argGitHubMfaToken: string = argv["github-mfa-token"];

    const userConfig = getUserConfig() || {};
    if (!userConfig.teamIds) {
        userConfig.teamIds = [];
    }
    if (argTeamId) {
        if (!userConfig.teamIds.includes(argTeamId)) {
            userConfig.teamIds.push(argTeamId);
        }
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

    if (process.env.ATOMIST_DOCKER_REGISTRY || process.env.ATOMIST_DOCKER_USER ||
        process.env.ATOMIST_DOCKER_PASSWORD) {
        const dockerRegistry: inquirer.Question = {
            type: "input",
            name: "dockerRegistry",
            message: "Docker Registry Host",
            validate: value => {
                if (!/\S/.test(value) && !process.env.ATOMIST_DOCKER_REGISTRY) {
                    return `The Docker registry host you entered is empty`;
                }
                return true;
            },
        };
        if (process.env.ATOMIST_DOCKER_REGISTRY) {
            dockerRegistry.default = process.env.ATOMIST_DOCKER_REGISTRY;
        }
        const dockerUser: inquirer.Question = {
            type: "input",
            name: "dockerUser",
            message: "Docker Registry Username",
            validate: value => {
                if (!/\S/.test(value) && !process.env.ATOMIST_DOCKER_USER) {
                    return `The Docker registry username you entered is empty`;
                }
                return true;
            },
        };
        if (process.env.ATOMIST_DOCKER_USER) {
            dockerUser.default = process.env.ATOMIST_DOCKER_USER;
        }
        const dockerPassword: inquirer.Question = {
            type: "password",
            name: "dockerPassword",
            message: "Docker Registry Password",
            validate: value => {
                if (!/\S/.test(value) && !process.env.ATOMIST_DOCKER_PASSWORD) {
                    return `The Docker registry password you entered is empty`;
                }
                return true;
            },
        };
        if (process.env.ATOMIST_DOCKER_PASSWORD) {
            dockerPassword.default = process.env.ATOMIST_DOCKER_PASSWORD;
        }
        questions.push(dockerRegistry, dockerUser, dockerPassword);
    }

    if (process.env.PCF_API || process.env.PCF_ORG || process.env.PCF_SPACE_STAGING ||
        process.env.PCF_SPACE_PRODUCTION || process.env.PIVOTAL_USER || process.env.PIVOTAL_PASSWORD) {
        const cfUser: inquirer.Question = {
            type: "input",
            name: "cfUser",
            message: "Cloud Foundry Username",
            validate: value => {
                if (!/\S/.test(value) && !process.env.PIVOTAL_USER) {
                    return `The Cloud Foundry username you entered is empty`;
                }
                return true;
            },
        };
        if (process.env.PIVOTAL_USER) {
            cfUser.default = process.env.PIVOTAL_USER;
        }
        const cfPassword: inquirer.Question = {
            type: "password",
            name: "cfPassword",
            message: "Cloud Foundry Password",
            validate: value => {
                if (!/\S/.test(value) && !process.env.PIVOTAL_PASSWORD) {
                    return `The Cloud Foundry password you entered is empty`;
                }
                return true;
            },
        };
        if (process.env.PIVOTAL_PASSWORD) {
            cfPassword.default = process.env.PIVOTAL_PASSWORD;
        }
        const cfOrg: inquirer.Question = {
            type: "input",
            name: "cfOrg",
            message: "Cloud Foundry Org",
            validate: value => {
                if (!/\S/.test(value) && !process.env.PCF_ORG) {
                    return `The Cloud Foundry Org you entered is empty`;
                }
                return true;
            },
        };
        if (process.env.PCF_ORG) {
            cfOrg.default = process.env.PCF_ORG;
        }
        const cfSpaceStaging: inquirer.Question = {
            type: "input",
            name: "cfSpaceStaging",
            message: "Cloud Foundry Staging Space",
            validate: value => {
                if (!/\S/.test(value) && !process.env.PCF_SPACE_STAGING) {
                    return `The Cloud Foundry Space you entered is empty`;
                }
                return true;
            },
        };
        if (process.env.PCF_SPACE_STAGING) {
            cfOrg.default = process.env.PCF_SPACE_STAGING;
        }
        const cfSpaceProd: inquirer.Question = {
            type: "input",
            name: "cfSpaceProd",
            message: "Cloud Foundry Production Space",
            validate: value => {
                if (!/\S/.test(value) && !process.env.PCF_SPACE_PRODUCTION) {
                    return `The Cloud Foundry Space you entered is empty`;
                }
                return true;
            },
        };
        if (process.env.PCF_SPACE_PRODUCTION) {
            cfOrg.default = process.env.PCF_SPACE_PRODUCTION;
        }
        const cfApi: inquirer.Question = {
            type: "input",
            name: "cfApi",
            message: "Cloud Foundry API endpoint",
            validate: value => {
                if (!/\S/.test(value) && !process.env.PCF_API) {
                    return `The Cloud Foundry API endpoint you entered is empty`;
                }
                return true;
            },
        };
        if (process.env.PCF_API) {
            cfApi.default = process.env.PCF_API;
        } else {
            cfApi.default = "https://api.run.pivotal.io";
        }
        questions.push(cfUser, cfPassword, cfOrg, cfSpaceStaging, cfSpaceProd, cfApi);
    }

    if (process.env.ATOMIST_NPM) {
        const npm: inquirer.Question = {
            type: "input",
            name: "npm",
            message: "NPM configuration (JSON stringified)",
            validate: value => {
                if (!/\S/.test(value) && !process.env.ATOMIST_NPM) {
                    return `The NPM configuration you entered is empty`;
                }
                return true;
            },
            default: process.env.ATOMIST_NPM,
        };
        questions.push(npm);
    }

    if (process.env.USE_CHECKSTYLE || process.env.CHECKSTYLE_PATH) {
        const checkstyle: inquirer.Question = {
            type: "confirm",
            name: "checkstyle",
            message: "Use checkstyle?",
        };
        if (process.env.USE_CHECKSTYLE) {
            checkstyle.default = process.env.USE_CHECKSTYLE;
        }
        const checkstylePath: inquirer.Question = {
            type: "input",
            name: "checkstylePath",
            message: "Absolute path to checkstyle jar",
            validate: value => {
                if (!value && !process.env.CHECKSTYLE_PATH) {
                    return `You must provide a path to the checkstyle jar`;
                }
                if (value && !/\.jar$/i.test(value)) {
                    return `The path to the checkstyle jar must end with '.jar'`;
                }
                return true;
            },
        };
        if (process.env.CHECKSTYLE_PATH) {
            checkstylePath.default = process.env.CHECKSTYLE_PATH;
        }
        questions.push(checkstyle, checkstylePath);
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
