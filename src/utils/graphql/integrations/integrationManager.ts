import GraphQLManager from '../graphQLManager'
import * as core from '@actions/core'

class IntegrationManager extends GraphQLManager {
  constructor() {
    super()
  }

  // Method to attach AWS integration to stack
  async attachAWSIntegrationToStack(
    integrationId: string,
    stackId: string,
    read: boolean,
    write: boolean,
  ): Promise<void> {
    const mutationQuery = {
      query: `
        mutation AttachAWSIntegration($id: ID!, $stack: ID!, $read: Boolean!, $write: Boolean!) {
          awsIntegrationAttach(id: $id, stack: $stack, read: $read, write: $write) {
            id
            stackId
          }
        }
      `,
      variables: { id: integrationId, stack: stackId, read, write },
    }

    await this.sendRequest(mutationQuery)
    core.info(`AWS integration attached to stack ${stackId}`)
  }

  // Method to get AWS integration by name
  async getAWSIntegrationByName(integrationName: string): Promise<any | null> {
    const query = {
      query: `query AWSIntegrations { awsIntegrations { id name } }`,
    }

    const response = await this.sendRequest(query)
    const integrations = response?.awsIntegrations || []
    return integrations.find((integration: any) => integration.name === integrationName) || null
  }
}

export default IntegrationManager
