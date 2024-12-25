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

    if (!command){
      core.info(`Stack command is empty or not set for: ${stackName}`)
      process.exit(1);
    }

    // Generate a unique tag
    const uniqueTag = generateUniqueTag()
    core.info(`Generated unique tag: ${uniqueTag}`)

    // Check if stack exists
    const existingStack = await graphqlStackManager.getStackByName(stackName)

    if (existingStack) {
      graphqlStackManager.waitForStackRunsToFinish(stackName);
      graphqlStackManager.waitForStackToBeReady(stackName);
    } else {
      core.info(`Stack "${stackName}" does not exist. Proceeding to create a new stack.`);
    }

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
    
      // Call createOrUpdateContext
      const contextResult = await contextManager.createOrUpdateContext(spaceId, inputs);
      core.info(`Context result: ${JSON.stringify(contextResult)}`);
      
      // Access contextName directly
      const contextName = contextResult.contextName;
    
      core.info(`Context name: ${contextName}`);
      
      try {
        // Call the upsertStack method and pass contextName
        await graphqlStackManager.upsertStack(stackName, contextName, spaceId, integration_name, inputs);
        core.info(`Stack "${stackName}" was successfully upserted.`);
      } catch (error) {
        core.error(`Failed to upsert stack: ${(error as Error).message}`);
      }
    } catch (error) {
      core.error(`Failed to manage context: ${(error as Error).message}`);
    }      

    // Run command on stack
    try {
      await graphqlStackManager.waitForStackRunsToFinish(stackName);
      await graphqlStackManager.waitForStackToBeReady(stackName);
      const spacectlStackManager = new SpacectlStackManager();
      core.info(`Running command: ${command} on stack: ${stackName}`);
      
      if (!existingStack) {
        // Extract --sha value from the command
        const shaMatch = command.match(/--sha\s+(\S+)/);
        if (shaMatch) {
          const shaValue = shaMatch[1]; // Extract the captured group
          const newCommand = `deploy --sha ${shaValue}`;
          await spacectlStackManager.runCommand(stackName, newCommand);
        } else {
          console.error("SHA value not found in the command");
        }
      }

      await graphqlStackManager.waitForStackRunsToFinish(stackName);
      await graphqlStackManager.waitForStackToBeReady(stackName);

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
