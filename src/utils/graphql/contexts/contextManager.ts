import GraphQLManager from '../graphQLManager'
import * as core from '@actions/core'
import fs from 'fs'
import yaml from 'yaml'

class ContextManager extends GraphQLManager {
  private yamlFilePath: string

  constructor(yamlFilePath: string = './deployment/contexts.yml') {
    super()
    this.yamlFilePath = yamlFilePath
  }

  // Method to load YAML and merge with additional inputs (spaceId)
  private loadEnvValuesFromYaml(spaceId: string, contextName: string): any {
    try {
      const fileContents = fs.readFileSync(this.yamlFilePath, 'utf8')
      const parsedYaml = yaml.parse(fileContents)

      // Perform validation on the YAML content to ensure required fields are present
      if (!parsedYaml.configAttachments || parsedYaml.configAttachments.length === 0) {
        core.setFailed("Missing 'configAttachments' in YAML.")
        throw new Error("Missing 'configAttachments' in YAML.")
      }

      // Check for other critical values in configAttachments
      parsedYaml.configAttachments.forEach((config: any) => {
        if (!config.id || !config.value) {
          core.setFailed("Each configAttachment must have a valid 'id' and 'value'.")
          throw new Error("Each configAttachment must have a valid 'id' and 'value'.")
        }
        if (!config.type) {
          config.type = 'ENVIRONMENT_VARIABLE' // Default to ENVIRONMENT_VARIABLE if not provided
        }
        if (config.writeOnly === undefined) {
          config.writeOnly = true // Default to true if not provided
        }
      })

      return {
        ...parsedYaml,
        space: spaceId,
        name: contextName,
      }
    } catch (error) {
      core.setFailed(`Failed to load env values from YAML: ${(error as Error).message}`)
      throw error
    }
  }

  // Method to query the existing context by ID
  async getContextById(contextID: string): Promise<any | null> {
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
      variables: { id: contextID },
    }

    try {
      // Log the query and variables
      core.info(`Executing GraphQL query to get context by ID: ${contextID}`)
      core.info(`Query variables: ${JSON.stringify(query.variables)}`)

      const response = await this.sendRequest(query)

      // Log the full response, whether it contains a context or not
      core.info(`Full GraphQL response: ${JSON.stringify(response)}`)

      if (response?.context) {
        core.info(`Context found: ID = ${response.context.id}, Name = ${response.context.name}`)
        return response.context
      } else {
        core.info(`No context found for ID: ${contextID}. Response: ${JSON.stringify(response)}`)
        return null
      }
    } catch (error) {
      // Log the error if the GraphQL query fails
      core.error(`Failed to get context by ID: ${contextID}. Error: ${(error as Error).message}`)
      throw error
    }
  }

  // Compare YAML config and labels with the existing context and update if necessary
  private detectChanges(existingContext: any, newConfig: any): boolean {
    const existingConfig =
      existingContext.config?.reduce((acc: any, elem: any) => {
        acc[elem.id] = elem.value
        return acc
      }, {}) || {}

    const newConfigAttachments = newConfig.configAttachments || {}

    // Detect config changes
    const configChanges = Object.keys(newConfigAttachments).some((key) => {
      return existingConfig[key] !== newConfigAttachments[key]
    })

    // Detect label changes
    const existingLabels = existingContext.labels || []
    const newLabels = newConfig.labels || []

    const labelChanges = newLabels.some((label: string) => !existingLabels.includes(label))

    // Detect hook changes
    const existingHooks = existingContext.hooks || {}
    const newHooks = newConfig.hooks || {}

    const hookChanges = JSON.stringify(existingHooks) !== JSON.stringify(newHooks)

    return configChanges || labelChanges || hookChanges
  }

  // Method to send mutation, either for update or create
  private async sendContextMutation(
    contextId: string | undefined,
    inputs: any,
    replaceConfigElements: boolean = false,
  ): Promise<void> {
    const mutationType = contextId ? 'contextUpdateV2' : 'contextCreateV2'
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
        configAttachments:
          inputs.configAttachments.map((config: any) => ({
            id: config.id, // Must be provided
            type: config.type || 'ENVIRONMENT_VARIABLE', // Default to 'ENVIRONMENT_VARIABLE'
            value: config.value || '', // Ensure value is provided
            writeOnly: config.writeOnly !== undefined ? config.writeOnly : true, // Default to 'true'
            description: config.description || '', // Optional
            fileMode: config.fileMode || '0644', // Optional, provide a default if needed
          })) || [], // Required
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

    // If updating, add ID and replaceConfigElements
    if (contextId) {
      variables.id = contextId
      variables.replaceConfigElements = replaceConfigElements
    }

    core.info(`Variables before mutation: ${JSON.stringify(variables)}`)

    await this.sendRequest({ query: mutationQuery, variables })
    core.info(`Context ${contextId ? 'updated' : 'created'} successfully.`)
  }

  // Main method to create or update the context based on changes
  async createOrUpdateContext(spaceId: string, inputs: any): Promise<any> {
    const { label_prefix, env, region, service_name, label_postfix } = inputs
    const contextName = `${label_prefix}:${env}:${region}:${service_name}:${label_postfix}`
    // Transformed context name with hyphens for querying and creation
    const contextID = contextName.replace(/:/g, '-');
    const contextValues = this.loadEnvValuesFromYaml(spaceId, contextName)
    const existingContext = await this.getContextById(contextID)

    if (existingContext) {
      core.info(`Context with ID ${existingContext.id} already exists...`)

      // Detect changes in config, labels, and hooks
      const hasChanges = this.detectChanges(existingContext, contextValues)

      if (hasChanges) {
        core.info(`Changes detected in context, updating...`)
        await this.sendContextMutation(existingContext.id, contextValues, true) // Update existing context
      } else {
        core.info(`No changes detected, skipping update.`)
      }

      return existingContext // Return the existing context
    }

    // Create new context
    core.info(`Context ${contextName} doesn't exist, creating...`)
    await this.sendContextMutation(undefined, contextValues)
    core.info(`Context created successfully.`)
  }
}

export default ContextManager
