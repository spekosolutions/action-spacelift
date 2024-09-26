import GraphQLManager from '../graphQLManager'
import * as core from '@actions/core'
import fs from 'fs'
import yaml from 'yaml'

class ContextManager extends GraphQLManager {
  private yamlFilePath: string
  private contextName: string
  
  constructor(
    serviceName: string,
    env: string,
    yamlFilePath: string = './deployment/contexts.yml',
  ) {
    super()
    this.contextName = `${serviceName}-${env}-context`
    this.yamlFilePath = yamlFilePath
  }

  // Method to load YAML and merge with additional inputs (spaceId)
  private loadEnvValuesFromYaml(spaceId: string): any {
    try {
      const fileContents = fs.readFileSync(this.yamlFilePath, 'utf8')
      const parsedYaml = yaml.parse(fileContents)

      // Merge additional inputs (spaceId and contextName)
      return {
        ...parsedYaml,
        space: spaceId,
        name: this.contextName,
      }
    } catch (error) {
      core.setFailed(`Failed to load env values from YAML: ${(error as Error).message}`)
      throw error
    }
  }

  // Method to query the existing context by ID
  async getContextById(): Promise<any | null> {
    const query = {
      operationName: 'GetContext',
      query: `
      query GetContext($id: ID!) {
        context(id: $id) {
          id
          name
          config {
            id
            value
          }
          labels
          description
          hooks {
            beforeInit
            afterInit
            beforePlan
            afterPlan
            beforeApply
            afterApply
            beforeDestroy
            afterDestroy
            beforePerform
            afterPerform
            afterRun
          }
          space
          createdAt
          updatedAt
        }
      }
    `,
      variables: { id: this.contextName },
    }

    const response = await this.sendRequest(query)
    return response?.context || null
  }

  // Compare YAML config and labels with the existing context and update if necessary
  private detectChanges(existingContext: any, newConfig: any): boolean {
    // Ensure all fields are defined before comparison
    const existingConfig = existingContext.config?.reduce((acc: any, elem: any) => {
      acc[elem.id] = elem.value
      return acc
    }, {}) || {}

    const newConfigAttachments = newConfig.configAttachments || {}

    // Detect config changes
    const configChanges = Object.keys(newConfigAttachments).some((key) => {
      return existingConfig[key] !== newConfigAttachments[key]
    })

    // Detect label changes (ensure labels exist in both)
    const existingLabels = existingContext.labels || []
    const newLabels = newConfig.labels || []

    const labelChanges = newLabels.some((label: string) => !existingLabels.includes(label))

    // Detect hook changes (ensure hooks exist in both)
    const existingHooks = existingContext.hooks || {}
    const newHooks = newConfig.hooks || {}

    const hookChanges = JSON.stringify(existingHooks) !== JSON.stringify(newHooks)

    return configChanges || labelChanges || hookChanges
  }

  // Method to send mutation, either for update or create
  private async sendContextMutation(
    contextId: string | undefined, 
    inputs: any, 
    replaceConfigElements: boolean = false
  ): Promise<void> {
    // Ensure that ID is only added when updating an existing context
    const mutationType = contextId ? 'contextUpdateV2' : 'contextCreateV2'  // Use correct mutation names
    const mutationQuery = `
      mutation ${mutationType}($input: ContextInput!${contextId ? ', $id: ID!' : ''}${contextId ? ', $replaceConfigElements: Boolean' : ''}) {
        ${mutationType}(${contextId ? 'id: $id, ' : ''}input: $input${contextId ? ', replaceConfigElements: $replaceConfigElements' : ''}) {
          id
          name
          updatedAt
        }
      }
    `

    const variables: any = {
      input: {
        name: inputs.name, // Required
        description: inputs.description || '', // Optional
        space: inputs.space || null, // Optional
        labels: inputs.labels || [], // Required
        configAttachments: inputs.configAttachments || [], // Required
        hooks: {
          beforeInit: inputs.hooks?.beforeInit || [],
          afterInit: inputs.hooks?.afterInit || [],
          beforePlan: inputs.hooks?.beforePlan || [],
          afterPlan: inputs.hooks?.afterPlan || [],
          beforeApply: inputs.hooks?.beforeApply || [],
          afterApply: inputs.hooks?.afterApply || [],
          beforeDestroy: inputs.hooks?.beforeDestroy || [],
          afterDestroy: inputs.hooks?.afterDestroy || [],
          beforePerform: inputs.hooks?.beforePerform || [],
          afterPerform: inputs.hooks?.afterPerform || [],
          afterRun: inputs.hooks?.afterRun || [],
        },
        stackAttachments: inputs.stackAttachments || [], // Optional
      },
    }

    // Add the ID and replaceConfigElements only when updating
    if (contextId) {
      variables.id = contextId
      variables.replaceConfigElements = replaceConfigElements
    }

    await this.sendRequest({ query: mutationQuery, variables })
    core.info(`Context ${contextId ? 'updated' : 'created'} successfully.`)
  }

  // Main method to create or update the context based on changes
  async createOrUpdateContext(spaceId: string): Promise<any> {
    const inputs = this.loadEnvValuesFromYaml(spaceId)
    const existingContext = await this.getContextById()

    if (existingContext) {
      core.info(`Context with space ID '${spaceId}' already exists: ${existingContext.id}`)

      // Detect changes in config, labels, and hooks
      const hasChanges = this.detectChanges(existingContext, inputs)

      if (hasChanges) {
        core.info(`Changes detected in context, updating...`)
        await this.sendContextMutation(existingContext.id, inputs, true) // Update existing context
      } else {
        core.info(`No changes detected, skipping update.`)
      }

      return existingContext // Return the existing context
    }

    // Create new context
    await this.sendContextMutation(undefined, inputs)
    core.info(`Context created successfully.`)
  }
}

export default ContextManager
