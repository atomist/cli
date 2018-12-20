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
