import * as core from '@actions/core'
import ContextManager from './graphql/contexts/contextManager'
import SpaceManager from './graphql/spaces/spaceManager'
import GraphQLStackManager from './graphql/stacks/stackManager';
import SpacectlStackManager from './spacectl/stacks/stackManager';

type Inputs = {
  command: string
  region: string
  env: string
  integration_name: string,
  service_name: string
  label_prefix: string
  label_postfix: string
}

// Helper to generate a unique tag for the stack
const generateUniqueTag = (): string => {
  return Math.random().toString(36).substring(7)
}

 // Initialize the StackManager with the Spacelift URL and bearer token
const graphqlStackManager = new GraphQLStackManager();

export const run = async (inputs: Inputs): Promise<void> => {
  try {
    // Destructure the necessary fields from inputs
    const { command, label_postfix, service_name, env, integration_name, region } = inputs

    // Construct stack name from inputs
    const stackName = `${label_postfix}-${service_name}-${env}-${region}`
    core.info(`Using stack name: ${stackName}`)

    // Generate a unique tag
    const uniqueTag = generateUniqueTag()
    core.info(`Generated unique tag: ${uniqueTag}`)

    if (command.includes('deploy')) {
      // Declare the spaceId variable to be used later
      let spaceId: string

      // Create service space and upsert the stack
      const spaceManager = new SpaceManager()

      try {
        spaceId = await spaceManager.createServiceSpace(inputs)
      } catch (error) {
        core.error('Error creating service space:')
        throw error
      }

      try {
        // Initialize the ContextManager with required values
        const contextManager = new ContextManager();
        
        // Call createOrUpdateContext without passing yamlFilePath or contextName
        const result = await contextManager.createOrUpdateContext(spaceId, inputs);
        core.info(`Context result: ${JSON.stringify(result)}`);
      } catch (error) {
        core.error(`Failed to manage context: ${(error as Error).message}`);
      }

      try {
        // Call the upsertStack method to create or update the stack
        await graphqlStackManager.upsertStack(stackName, spaceId, integration_name, inputs);
    
        core.info(`Stack "${stackName}" was successfully upserted.`);
      } catch (error) {
        core.error(`Failed to upsert stack: ${(error as Error).message}`);
      }
    }

    // Run command on stack
    try {
      graphqlStackManager.waitForStackRunsToFinish(stackName);
      graphqlStackManager.waitForStackToBeReady(stackName);
      
      const spacectlStackManager = new SpacectlStackManager();
      core.info(`Running command: ${command} on stack: ${stackName}`);

      await spacectlStackManager.runCommand(stackName, command);
      core.info(`Command "${command}" ran successfully on stack "${stackName}"`);

      core.info(`Retrieving stack outputs for: ${stackName}`);
      const outputs = await spacectlStackManager.getStackOutputs(stackName);
      core.info(`Stack outputs: ${JSON.stringify(outputs)}`);
    } catch (error) {
      core.setFailed(`An error occurred while running command or getting outputs: ${(error as Error).message}`);
      core.error(error as Error);
    }
    
  } catch (error) {
    core.setFailed(`Action failed with error: ${(error as Error).message || error}`)
  }
}
