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

export const CreateGitHubScmProviderMutation = `
mutation CreateGitHubResourceProvider {
  createGitHubResourceProvider {
    id
  }
}`;

export const ConfigureGitHubScmProviderMutation = `
    mutation ConfigureGitHubScmResourceProvider($id: ID!, $orgs: [String!]!, $repos: [SCMResourceProviderRepoInput!]!) {
      configureGitHubResourceProvider(id: $id, config: {orgs: $orgs, repos: $repos}) {
        id
      }
    }`;

export const CreateScmProviderMutation = `
mutation CreateScmProvider($name: String!, $type: ProviderType!, $apiUrl: String!, $gitUrl: String!) {
  createSCMProvider(provider: {
    name: $name
    type: $type
    apiUrl: $apiUrl
    gitUrl: $gitUrl
  }) {
    providerId
  }
}`;

export const CreateScmConfigurationItemMutation = `
mutation SetScmProviderConfiguration($id: ID!, $value: String!, $name: String!, $description: String!) {
  setSCMProviderConfiguration(id: $id, item: {name: $name, description: $description, value: $value}) {
    id
  }
}
`;

export const CreateDockerRegistryMutation = `
mutation CreateDockerRegistryProvider($type: DockerRegistryType!, $name: String!, $url: String!) {
  createDockerRegistryProvider(type: $type, name: $name, url: $url) {
    id
  }
}
`;

export const CreateBinaryRepositoryProviderMutation = `
mutation CreateBinaryRepositoryProvider($type: BinaryRepositoryType!, $name: String!, $url: String!) {
  createBinaryRegistryProvider(type: $type, name: $name, url: $url) {
    id
  }
}
`;

export const DeleteResourceProviderMutation = `
mutation DeleteResourceProvider($id: String!) {
  deleteResourceProvider(id: $id)
}
`;

export const CreateGenericResourceUserMutation = `
mutation CreateGenericResourceUser($username: String!, $resourceProviderId: ID!) {
  createResourceUser(login: $username, resourceProviderId: $resourceProviderId, resourceUserType: GenericResourceUser) {
    id
  }
}`;

export const SetCredentialForResourceUserMutation = `
mutation CreateGenericResourceUser($resourceUser: ID!, $resourceProviderId: ID!, $password: String!) {
  setCredential(providerId: $resourceProviderId, resourceUserId: $resourceUser, credential: { type: Password, password: $password}) {
    id
  }
}`;

export const LinkCredentialMutation = `
mutation LinkCredential($resourceProviderId: ID!, $credentialId: ID!) {
  linkCredentialToResourceProvider(resourceProviderId: $resourceProviderId, credentialId: $credentialId) {
    id
  }
}`;

export async function configureCredentialsForResourceProvider(providerId: string,
                                                              username: string,
                                                              password: string,
                                                              workspaceId: string,
                                                              apiKey: string,
                                                              cfg: Configuration): Promise<void> {
    const graphClient = new ApolloGraphClient(`${cfg.endpoints.graphql}/${workspaceId}`,
        { Authorization: `Bearer ${apiKey}` });

    const createResourceUserResult = await graphClient.mutate<{ createResourceUser: { id: string } }, {}>({
        mutation: CreateGenericResourceUserMutation,
        variables: {
            username,
            resourceProviderId: providerId,
        },
    });

    const setCredentialResult = await graphClient.mutate<{ setCredential: { id: string } }, {}>({
        mutation: SetCredentialForResourceUserMutation,
        variables: {
            resourceUser: createResourceUserResult.createResourceUser.id,
            resourceProviderId: providerId,
            password,
        },
    });

    await graphClient.mutate<{ linkCredentialToResourceProvider: { id: string } }, {}>({
        mutation: CreateGenericResourceUserMutation,
        variables: {
            credentialId: setCredentialResult.setCredential.id,
            resourceProviderId: providerId,
        },
    });
}
