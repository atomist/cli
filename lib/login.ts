import { QueryNoCacheOptions } from "@atomist/automation-client";
import {
    defaultConfiguration,
    mergeConfigs,
    writeUserConfig,
} from "@atomist/automation-client/lib/configuration";
import { ApolloGraphClient } from "@atomist/automation-client/lib/graph/ApolloGraphClient";
import { Deferred } from "@atomist/automation-client/lib/internal/util/Deferred";
import { scanFreePort } from "@atomist/automation-client/lib/util/port";
import * as GitHubApi from "@octokit/rest";
import axios from "axios";
import chalk from "chalk";
import * as express from "express";
import * as inquirer from "inquirer";
import { sha256 } from "js-sha256";
import * as _ from "lodash";
import * as os from "os";
import { resolveUserConfig } from "./cliConfig";
import { maskString } from "./config";
import opn = require("opn");

export interface LoginOptions {
    createWorkspace: boolean;
    createProvider?: boolean;
    linkChatTeam?: boolean;
}

const PersonByIdentityQuery = `query PersonByIdentity {
  personByIdentity {
    team {
      id
      name
    }
    user {
      principal {
        pid
        sub
      }
    }
  }
}`;

interface PersonByIdentity {
    personByIdentity: Array<{ team: { id: string, name: string }, user: { principal: { pid: string, sub: string } } }>;
}

const CreateTeamMutation = `
mutation CreateTeam($name: String!) {
  createTeam(teamName: $name) {
    id
  }
}
`;

interface CreateTeamVariables {
    name: string;
}

interface CreateTeam {
    createTeam: {
        id: string;
        name: string;
    };
}

const CreateApiKeyMutation = `mutation createKey($description: String!){
  createApiKey(description: $description) {
  	id
    key
    description
    createdAt
    lastUsed
    owner {
      id
    }
  }
}`;

interface CreateApiKeyVariables {
    description: string;
}

interface CreateApiKey {
    createApiKey: {
        key: string;
    };
}

const CreateGitHubScmProviderMutation = `mutation CreateGitHubScmProvider {
  createSCMProvider(provider: {
    name: "GitHub.com"
    type: github_com,
    apiUrl: "https://api.github.com/"
    gitUrl: "git@github.com:"
  }) {
    providerId
  }
}`;

const CreateScmConfigurationItemMutation = `mutation SetScmProviderConfiguration($id: ID!, $orgs: String!) {
    setSCMProviderConfiguration(id: $id,
        item: {
        name:"orgs",
            description: "The managed orgs for this provider",
            value: $orgs,
    }) {
        id
    }
}`;

const SetOwnerLoginMutation = `mutation setOwnerLogin($owner: String!, $login: String!, $providerId: String!) {
  setOwnerLogin(owner: $owner, login: $login, providerId: $providerId) {
    owner
    providerId
    login
  }
}
`;

export async function login(opts: LoginOptions): Promise<number> {
    const Spinner = require("cli-spinner").Spinner;
    const userConfig = resolveUserConfig();
    const defaultConfig = defaultConfiguration();
    const config = mergeConfigs(defaultConfig, userConfig);

    const providers = await axios.get(`${config.endpoints.auth}/providers`);
    let authUrl;
    let team;

    // Verify api key
    if (!config.apiKey) {

        let questions: inquirer.Question[] = [
            {
                type: "password",
                name: "apiKey",
                message: `Enter your ${chalk.cyan("api key")} from ${chalk.blue("https://app.atomist.com/apikeys")}
    or hit ${chalk.cyan("<ENTER>")} to select an authentication provider to login with Atomist`,
            },
        ];

        const answers = await inquirer.prompt(questions);
        if (!answers.apiKey) {

            console.log(` 
Select one of the following authentication providers available to login with Atomist:`);

            questions = [
                {
                    type: "list",
                    name: "provider",
                    message: "Authentication Provider",
                    choices: providers.data.map((p: any) => ({
                        name: p.display_name,
                        value: p.login_url,
                    })),
                },
            ];

            try {
                const answers = await inquirer.prompt(questions);
                if (answers.provider) {
                    authUrl = answers.provider;
                }
            } catch (e) {
                return 1;
            }

            try {
                const state = nonce(20);
                const verifier = nonce();
                const code = sha256(verifier);
                const port = await scanFreePort();
                const url = `${authUrl}?state=${state}&redirect-uri=http://127.0.0.1:${port}/callback&code-challenge=${code}`;

                let spinner = new Spinner(`Waiting for login flow to finish in your browser ${chalk.yellow("%s")} `);
                spinner.setSpinnerDelay(100);
                spinner.setSpinnerString("⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏");
                spinner.start();

                await opn(url, { wait: false });

                const app = express();
                const callback = new Deferred<{ jwt: string }>();
                app.get("/callback", async (req, res) => {
                    if (state !== req.query.state) {
                        // Do something with this error
                    }
                    try {
                        const token = await axios.post(`${config.endpoints.auth}/token`, {
                            code: req.query.code,
                            verifier,
                            grant_type: "pkce",
                        });
                        callback.resolve({ jwt: token.data.access_token });
                        res.redirect("https://atomist.com/success-github.html");
                    } catch (e) {
                        res.status(500).json(e);
                    }
                });

                const server = app.listen(port);
                const jwt = (await callback.promise).jwt;
                spinner.stop(true);
                server.close();

                const graphClient = new ApolloGraphClient(
                    config.endpoints.graphql.replace("/team", ""),
                    { Authorization: `Bearer ${jwt}` });

                spinner = new Spinner(`Creating new api key ${chalk.yellow("%s")} `);
                spinner.setSpinnerDelay(100);
                spinner.setSpinnerString("⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏");
                spinner.start();

                const result = await graphClient.mutate<CreateApiKey, CreateApiKeyVariables>({
                    mutation: CreateApiKeyMutation,
                    variables: {
                        description: `Generated by Atomist CLI on ${os.hostname()}`,
                    },
                });
                userConfig.apiKey = result.createApiKey.key;
                await writeUserConfig(userConfig);
                spinner.stop(true);

            } catch (e) {
                console.error(e);
                return 1;
            }
        } else {
            userConfig.apiKey = answers.apiKey;
        }
    }

    const workspaceIds: string[] = [];

    const graphClient = new ApolloGraphClient(
        config.endpoints.graphql.replace("/team", ""),
        { Authorization: `Bearer ${userConfig.apiKey}` });
    const result = await graphClient.query<PersonByIdentity, void>({
        query: PersonByIdentityQuery,
        options: QueryNoCacheOptions,
    });
    const teams = _.get(result, "personByIdentity") || [];

    // Ask user to select teams
    if (teams.length > 0 && !opts.createWorkspace) {

        console.log("");
        let questions: inquirer.Question[] = [
            {
                type: "list",
                name: "workspace",
                message: "Manage Workspace",
                choices: [
                    { name: "Create a new workspace", value: "new_workspace" },
                    { name: "Connect to existing workspace", value: "existing_workspace" },
                ],
            },
        ];

        const answers = await inquirer.prompt(questions);
        if (answers.workspace === "new_workspace") {
            opts.createWorkspace = true;
        } else {
            console.log(`
Select one or more workspaces to connect to:`);

            questions = [
                {
                    type: "checkbox",
                    name: "workspaceIds",
                    message: "Workspace IDs",
                    choices: teams.sort((p1, p2) => p1.team.name.localeCompare(p2.team.name))
                        .map(p => ({
                            name: `${p.team.id} - ${p.team.name}`,
                            value: p.team.id,
                            checked: config.workspaceIds.includes(p.team.id),
                        })),
                },
            ];

            try {
                const answers = await inquirer.prompt(questions);
                if (answers.workspaceIds) {
                    workspaceIds.push(...answers.workspaceIds);
                }
            } catch (e) {
                return 1;
            }
        }
    }

    if (opts.createWorkspace || teams.length === 0) {
        console.log(`
Create a new workspace:`);

        const questions: inquirer.Question[] = [
            {
                type: "input",
                name: "workspaceName",
                message: "Workspace Name",
                validate: value => {
                    return value && value.length > 3;
                },
            },
        ];
        try {
            const answers = await inquirer.prompt(questions);
            if (answers.workspaceName) {
                const spinner = new Spinner(`Creating new workspace ${chalk.cyan(answers.workspaceName)} ${chalk.yellow("%s")} `);
                spinner.setSpinnerDelay(100);
                spinner.setSpinnerString("⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏");
                spinner.start();

                const result = await graphClient.mutate<CreateTeam, CreateTeamVariables>({
                    mutation: CreateTeamMutation,
                    variables: {
                        name: answers.workspaceName,
                    },
                });
                workspaceIds.push(result.createTeam.id);

                spinner.stop(true);
                console.log(`Successfully created new workspace ${chalk.cyan(answers.workspaceName)} with id ${chalk.cyan(result.createTeam.id)}`);
                opts.createProvider = true;
                opts.linkChatTeam = true;
                team = { id: result.createTeam.id, name: answers.workspaceName };
            }
        } catch (e) {
            console.error(e);
            return 1;
        }
    }

    if (opts.createProvider) {
        console.log(`
You can now configure an SCM provider to connect your new workspace ${chalk.cyan(team.name)}
to source code events. Please select from the following list of supported SCM systems:`);
        let questions: inquirer.Question[] = [
            {
                type: "list",
                name: "provider",
                message: "Create SCM provider",
                choices: [
                    { name: "GitHub", value: "github_com" },
                    { name: "GitLab", value: "gitlab" },
                    { name: "BitBucket", value: "bitbucket" },
                    { name: "None", value: "none" },
                ],
            },
            {
                type: "input",
                name: "username",
                message: `GitHub Username`,
                when: answers => {
                    return answers.provider === "github_com" && !userConfig.token;
                },
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
                message: `GitHub Password`,
                when: answers => {
                    return answers.provider === "github_com" && !userConfig.token;
                },
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
                message: "GitHub 2FA Code",
                when: async answers => {
                    if (answers.provider === "github_com" && !userConfig.token) {
                        const username = answers.username;
                        const password = answers.password;
                        try {
                            const token = await createGitHubToken(username, password);
                            userConfig.token = token;
                        } catch (e) {
                            if (e.status === 401 && e.headers["x-github-otp"]) {
                                return e.headers["x-github-otp"].includes("required");
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

        let answers = await inquirer.prompt(questions);
        if (answers.provider === "github_com") {

            if (!userConfig.token) {
                const spinner = new Spinner(`Creating new GitHub personal access token ${chalk.yellow("%s")} `);
                spinner.setSpinnerDelay(100);
                spinner.setSpinnerString("⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏");
                spinner.start();
                const user = answers.username;
                const password = answers.password;
                const mfa = answers.mfa;
                const token = await createGitHubToken(user, password, mfa);
                userConfig.token = token;
                spinner.stop(true);
            }

            questions = [
                {
                    type: "checkbox",
                    name: "orgs",
                    message: "GitHub Organizations",
                    choices: await readOrgs(userConfig.token),
                },
            ];

            answers = await inquirer.prompt(questions);

            const spinner = new Spinner(`Creating new GitHub SCM provider for workspace ${chalk.cyan(team.name)} ${chalk.yellow("%s")} `);
            spinner.setSpinnerDelay(100);
            spinner.setSpinnerString("⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏");
            spinner.start();

            try {
                const graphClient = new ApolloGraphClient(`${config.endpoints.graphql}/${team.id}`,
                    { Authorization: `Bearer ${userConfig.apiKey}` });
                await graphClient.mutate<{}, any>({
                    mutation: CreateGitHubScmProviderMutation,
                });
                // TODO get provider id from the previous mutation result
                const providerId = `${team.id}_zjlmxjzwhurspem`;
                await graphClient.mutate<{}, { id: string, orgs: string }>({
                    mutation: CreateScmConfigurationItemMutation,
                    variables: {
                        id: providerId,
                        orgs: answers.orgs.join(","),
                    },
                });

                const gc = new ApolloGraphClient(
                    config.endpoints.graphql.replace("/team", ""),
                    { Authorization: `Bearer ${userConfig.apiKey}` });
                const result = await gc.query<PersonByIdentity, void>({
                    query: PersonByIdentityQuery,
                    options: QueryNoCacheOptions,
                });
                const teams = _.get(result, "personByIdentity") || [];
                if (teams.some(t => t.user.principal.pid === "zjlmxjzwhurspem")) {
                    const login = teams.filter(t => t.user.principal.pid === "zjlmxjzwhurspem")[0].user.principal.sub;

                    for (const org of answers.orgs) {
                        await graphClient.mutate<any, any>({
                            mutation: SetOwnerLoginMutation,
                            variables: {
                                providerId: "zjlmxjzwhurspem",
                                owner: org,
                                login,
                            },
                        });
                    }
                }

                spinner.stop(true);
                console.log(`Successfully created new GitHub SCM provider for workspace ${chalk.cyan(team.name)}`);
            } catch (e) {
                console.error(e);
            }
        }
    }

    userConfig.workspaceIds = workspaceIds;
    await writeUserConfig(userConfig);

    if (opts.linkChatTeam) {
        console.log(`
You can now link a Chat Procider to your new workspace ${chalk.cyan(team.name)}.
Please select from the following list of supported chat providers:`);
        const questions: inquirer.Question[] = [
            {
                type: "list",
                name: "chatProvider",
                message: "Link Chat Provider to Atomist",
                choices: [
                    { name: "Slack", value: "slack" },
                    { name: "Microsoft Teams", value: "msteams" },
                    { name: "None", value: "none" },
                ],
            }];
        const answers = await inquirer.prompt(questions);
        if (answers.chatProvider === "slack") {
            await opn(`https://slack.com/oauth/authorize?scope=channels:write,bot&client_id=9196525393.53870336391&state=${team.id}`, { wait: false });
        }
    }

    return 0;
}

function nonce(length: number = 40): string {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

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
    const params: any = {
        scopes: ["repo", "admin:repo_hook", "admin:org_hook", "read:org"],
        note: `Atomist CLI on ${host}`,
        note_url: "http://app.atomist.com/",
        fingerprint: Date.now(),
    };
    if (mfa) {
        (params as any).headers = { "X-GitHub-OTP": mfa };
    }
    const res = await github.oauthAuthorizations.createAuthorization(params);
    if (!res.data || !res.data.token) {
        throw new Error(`GitHub API returned successful but there is no token`);
    }
    return res.data.token;
}

async function readOrgs(token: string): Promise<Array<{ name: string, value: string }>> {
    const github = new GitHubApi();
    github.authenticate({
        type: "token",
        token,
    });
    const res = await github.orgs.listForAuthenticatedUser({
        per_page: 100,
    });
    return res.data.sort((o1, o2) => o1.login.localeCompare(o2.login)).map(org => ({
        name: org.login,
        value: org.login,
    }));
}