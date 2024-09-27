import GraphQLManager from '../graphQLManager'
import * as core from '@actions/core'
import { execSync } from 'child_process'
import IntegrationManager from '../integrations/integrationManager'

class StackManager extends GraphQLManager {
  private integrationManager: IntegrationManager

  constructor() {
    super()
    this.integrationManager = new IntegrationManager() // Initialize in the constructor
  }

  // Method to upsert a stack
  async upsertStack(stackName: string, customSpace: string, integration_name: string, inputs: any): Promise<void> {
    const existingStack = await this.getStackByName(stackName)
    let newStack: { id: string } | undefined

    if (existingStack) {
      core.info(`Updating existing stack: ${stackName}`);
      await this.waitForStackRunsToFinish(stackName);  // Ensure runs are finished
      await this.waitForStackToBeReady(stackName);
      await this.updateStack(existingStack.id, customSpace, inputs);
    } else {
      core.info(`Creating new stack: ${stackName}`);
      newStack = await this.createStack(stackName, customSpace, inputs);
      await this.waitForStackToBeReady(stackName);
    }

    const stackId = existingStack?.id || newStack?.id
    if (stackId) {
      const integrationName = integration_name

      const existingAwsIntegration = existingStack?.attachedAwsIntegrations?.find(
        (integration: any) => integration.name === integrationName,
      )

      if (existingAwsIntegration) {
        core.info(`AWS integration '${integrationName}' is already attached to the stack. Skipping attachment.`)
      } else {
        const awsIntegration = await this.integrationManager.getAWSIntegrationByName(integrationName)
        if (awsIntegration) {
          core.info(`Attaching AWS integration '${integrationName}' to the stack.`)
          await this.integrationManager.attachAWSIntegrationToStack(awsIntegration.id, stackId, true, true)
        } else {
          core.warning(`No AWS integration found for the environment: ${inputs.env}`)
        }
      }
    } else {
      core.error('No stack ID available for attaching AWS integration.')
    }
  }

  // Method to update a stack
  async updateStack(stackId: string, customSpace: string, inputs: any): Promise<void> {
    core.info(`Updating stack with ID: ${stackId}`)

    const stackInput = await this.prepareStackInput(stackId, customSpace, inputs)
    core.info(`Prepared stack input: ${JSON.stringify(stackInput)}`)

    const mutationQuery = {
      query: `mutation UpdateStack($id: ID!, $input: StackInput!) {
        stackUpdate(id: $id, input: $input) {
          id
        }
      }`,
      variables: { id: stackId, input: stackInput },
    }

    await this.sendRequest(mutationQuery)
    core.info(`Stack ${stackId} updated successfully.`)
  }

  // Method to create a stack
  async createStack(stackName: string, customSpace: string, inputs: any): Promise<{ id: string } | undefined> {
    const stackInput = await this.prepareStackInput(stackName, customSpace, inputs)

    const mutationQuery = {
      query: `mutation CreateStack($input: StackInput!) {
        stackCreate(input: $input) {
          id
        }
      }`,
      variables: {
        input: { ...stackInput },
      },
    }

    const response = await this.sendRequest(mutationQuery)
    core.info(`New stack created: ${stackName}`)
    return response.stackCreate
  }

  // Method to prepare the stack input
  async prepareStackInput(stackName: string, customSpace: string, inputs: any) {
    const yamlInput = execSync('yq -o=json eval ./deployment/service/stack.yml').toString()
    const jsonInput = JSON.parse(yamlInput)
    jsonInput.name = stackName
    jsonInput.labels.push(`env:${inputs.env}`)
    jsonInput.labels.push(`region:${inputs.region}`)
    jsonInput.space = customSpace
    return jsonInput
  }

  // Method to wait for stack runs to finish
  async waitForStackRunsToFinish(stackId: string, timeout = 300000): Promise<void> {
    const startTime = Date.now()
    while (true) {
      const query = {
        query: `
          query GetStack($id: ID!) {
            stack(id: $id) {
              runs {
                id
                state
              }
            }
          }
        `,
        variables: { id: stackId },
      }

      try {
        core.info(`Sending request for waitForStackRunsToFinish.`)

        const response = await this.sendRequest(query)
        core.info(`Stack details: ${JSON.stringify(response, null, 2)}`);
        core.info(`Response received for waitForStackRunsToFinish.`)

        const runs = response?.stack?.runs || []
        const activeRuns = runs.filter((run: any) => run.state !== 'SUCCESS' && run.state !== 'FAILURE')

        if (activeRuns.length === 0) {
          core.info(`All runs for stack ${stackId} have finished.`)
          return
        }

        if (Date.now() - startTime > timeout) {
          throw new Error(`Timeout waiting for runs to finish for stack: ${stackId}`)
        }

        await new Promise((resolve) => setTimeout(resolve, 10000))
      } catch (error) {
        console.error(`Error while checking stack runs: ${(error as any).message}`)
        throw error // Rethrow the error to handle it upstream
      }
    }
  }

  // Method to wait for stack to be ready
  async waitForStackToBeReady(stackName: string): Promise<void> {
    let isReady = false
    while (!isReady) {
      const stackDetails = await this.getStackByName(stackName)
      if (!stackDetails) {
        throw new Error(`No stack found with the name: ${stackName}`)
      }

      core.info(`Stack details: ${JSON.stringify(stackDetails, null, 2)}`);

      if (stackDetails.createdAt) {
        isReady = true
        core.info(`Stack ${stackName} is ready.`)
      } else {
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    }
  }

  // Method to get a stack by name
  async getStackByName(stackName: string): Promise<any | null> {
    const query = {
      query: `
        query SearchStacks($input: SearchInput!) {
          searchStacks(input: $input) {
            edges {
              node {
                id
                name
                state
                createdAt
                attachedAwsIntegrations {
                  id
                  name
                }
              }
            }
          }
        }
      `,
      variables: { input: { first: 50, fullTextSearch: stackName } },
    }

    const response = await this.sendRequest(query)
    return response?.searchStacks?.edges[0]?.node || null
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
  async getAWSIntegrationByName(integrationName: string, stackId: string): Promise<any | null> {
    const query = {
      query: `query AWSIntegrations { awsIntegrations { id name } }`,
    }

    const response = await this.sendRequest(query)
    const integrations = response?.awsIntegrations || []
    return integrations.find((integration: any) => integration.name === integrationName) || null
  }
}

export default StackManager
