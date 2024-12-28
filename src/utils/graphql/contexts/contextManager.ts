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

  // Method to merge envVars into configAttachments
  private mergeEnvVarsWithConfigAttachments(envVars: Record<string, any>, configAttachments: any[]): any[] {
    const mergedConfigAttachments = [...configAttachments]

    for (const [key, value] of Object.entries(envVars)) {
      const existingIndex = mergedConfigAttachments.findIndex((attachment) => attachment.id === key)

      if (existingIndex !== -1) {
        // Update existing configAttachment
        mergedConfigAttachments[existingIndex].value = value
      } else {
        // Add new configAttachment
        mergedConfigAttachments.push({
          id: `TF_VAR_${key}`,
          type: 'ENVIRONMENT_VARIABLE',
          value: value,
          writeOnly: false,
          description: '',
          fileMode: '0644',
        })
      }
    }

    return mergedConfigAttachments
  }
  
  // Method to load YAML and merge with additional inputs (spaceId)
  // Method to load YAML and merge with additional inputs (spaceId, envVars)
  private loadEnvValuesFromYaml(spaceId: string, contextName: string, envVars: Record<string, any>): any {
    try {
      const fileContents = fs.readFileSync(this.yamlFilePath, 'utf8')
      const parsedYaml = yaml.parse(fileContents)

      // Validate YAML structure
      if (!parsedYaml.configAttachments || !Array.isArray(parsedYaml.configAttachments)) {
        core.setFailed("Missing or invalid 'configAttachments' in YAML.")
        throw new Error("Missing or invalid 'configAttachments' in YAML.")
      }

      // Merge envVars with configAttachments
      const mergedConfigAttachments = this.mergeEnvVarsWithConfigAttachments(envVars, parsedYaml.configAttachments)

      return {
        ...parsedYaml,
        space: spaceId,
        name: contextName,
        configAttachments: mergedConfigAttachments,
      }
    } catch (error) {
      core.setFailed(`Failed to load and merge env values from YAML: ${(error as Error).message}`)
      throw error
    }
  }

  // Method to query the existing context by ID
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
      core.info(`Executing GraphQL query to get context by ID: ${contextID}`)
      const response = await this.sendRequest(query)

      if (response?.context) {
        core.info(`Context found: ID = ${response.context.id}, Name = ${response.context.name}`)
        return response.context
      } else {
        core.info(`No context found for ID: ${contextID}.`)
        return null
      }
    } catch (error) {
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
    autoAttachLabel: string,
    inputs: any,
    replaceConfigElements: boolean = false
  ): Promise<{ id: string; name: string; updatedAt: string } | void> {
    const mutationType = contextId ? 'contextUpdateV2' : 'contextCreateV2';
    const mutationQuery = `
      mutation ${mutationType}($input: ContextInput!${contextId ? ', $id: ID!' : ''}${contextId ? ', $replaceConfigElements: Boolean' : ''}) {
        ${mutationType}(${contextId ? 'id: $id, ' : ''}input: $input${contextId ? ', replaceConfigElements: $replaceConfigElements' : ''}) {
          id
          name
          updatedAt
        }
      }
    `;
  
    const labels = [
      ...(Array.isArray(inputs.labels) ? inputs.labels.map((label: string) => label) : []),
      autoAttachLabel,
    ];
    
    const hooks = {
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
    };
    
    const variables: any = {
      input: {
        name: inputs.name, // Required
        description: inputs.description || '',
        space: inputs.space || null,
        labels: labels,
        configAttachments: Array.isArray(inputs.configAttachments)
          ? inputs.configAttachments.map((config: any) => ({
              id: config.id,
              type: config.type || 'ENVIRONMENT_VARIABLE',
              value: Array.isArray(config.value) ? JSON.stringify(config.value) : config.value || '',
              writeOnly: config.writeOnly !== undefined ? config.writeOnly : true,
              description: config.description || '',
              fileMode: config.fileMode || '0644',
            }))
          : [],
        hooks: hooks, // Pass sanitized hooks
        stackAttachments: inputs.stackAttachments || [],
      },
    };
  
    if (contextId) {
      variables.id = contextId;
      variables.replaceConfigElements = replaceConfigElements;
    }
  
    core.info(`Variables before mutation: ${JSON.stringify(variables)}`);
    const response = await this.sendRequest({ query: mutationQuery, variables });
    core.info(`Context ${contextId ? 'updated' : 'created'} successfully.`)
    
    return response?.[mutationType]; // Return mutation response (id, name, updatedAt)
  }
  
  // Main method to create or update the context based on changes
  async createOrUpdateContext(spaceId: string, extra_vars: any, inputs: any): Promise<any> {
    const { label_prefix, env, region, service_name, label_postfix, env_vars } = inputs

    // Generate context name and ID
    const contextName = `${label_prefix}:${env}:${region}:${service_name}:${label_postfix}`
    const contextID = contextName.replace(/:/g, '-')

    // Load and merge values
    const envVars = extra_vars
    const contextValues = this.loadEnvValuesFromYaml(spaceId, contextName, envVars)
    const existingContext = await this.getContextById(contextID)

    const autoAttachLabel = `autoattach:${contextName}`
    core.info(`Auto Label to Attach to Context: ${autoAttachLabel}`)

    if (existingContext) {
      core.info(`Context with ID ${existingContext.id} already exists...`)

      existingContext.labels = [...existingContext.labels, autoAttachLabel]
      const hasChanges = this.detectChanges(existingContext, contextValues)

      if (hasChanges) {
        core.info(`Changes detected in context, updating...`)
        const response = await this.sendContextMutation(existingContext.id, autoAttachLabel, contextValues, true)

        return { ...(response || {}), contextName }
      } else {
        core.info(`No changes detected, skipping update.`)
        return { ...existingContext, contextName }
      }
    }

    core.info(`Context ${contextName} doesn't exist, creating...`)
    const response = await this.sendContextMutation(undefined, autoAttachLabel, contextValues)
    core.info(`Context created successfully.`)

    return { ...(response || {}), contextName }
  }

}

export default ContextManager
