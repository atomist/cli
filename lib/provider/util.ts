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
