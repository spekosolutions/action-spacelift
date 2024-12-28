import * as core from '@actions/core'
import ContextManager from './graphql/contexts/contextManager'
import SpaceManager from './graphql/spaces/spaceManager'
import GraphQLStackManager from './graphql/stacks/stackManager';
import SpacectlStackManager from './spacectl/stacks/stackManager';

type Inputs = {
  command: string
  region: string
  zone: string
  env: string
  integration_name: string,
  service_name: string
  label_prefix: string
  label_postfix: string
  env_vars: string
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
    const { command, label_postfix, service_name, env, integration_name, zone, region, env_vars } = inputs;
    const githubSha = process.env.GITHUB_SHA;

    // Construct stack name from inputs
    const stackName = `${label_postfix}-${service_name}-${env}-${zone}`;
    core.info(`Using stack name: ${stackName}`);

    // Parse env_vars from string to JSON object
    let envVars: Record<string, any> = {};

    // try {
    //   core.debug(`Raw env_vars input: ${env_vars}`);
    //   envVars = JSON.parse(env_vars.trim());
    //   core.info(`Parsed env_vars: ${JSON.stringify(envVars)}`);
    // } catch (error) {
    //   core.setFailed(`Failed to parse env_vars JSON: ${(error as Error).message}`);
    //   return;
    // }

    envVars.env = env;
    envVars.region = region;
    envVars.provider_region = region;
    envVars.zone = zone;

    core.info(`Updated env_vars: ${JSON.stringify(envVars)}`);

    if (!command) {
      core.info(`Stack command is empty or not set for: ${stackName}`);
      process.exit(1);
    }

    // Generate a unique tag
    const uniqueTag = generateUniqueTag();
    core.info(`Generated unique tag: ${uniqueTag}`);

    // Check if stack exists
    const existingStack = await graphqlStackManager.getStackByName(stackName);

    if (existingStack) {
      graphqlStackManager.waitForStackRunsToFinish(stackName);
      graphqlStackManager.waitForStackToBeReady(stackName);
    } else {
      core.info(`Stack "${stackName}" does not exist. Proceeding to create a new stack.`);
    }

    let spaceId: string;
    const spaceManager = new SpaceManager();

    try {
      spaceId = await spaceManager.createServiceSpace(inputs);
    } catch (error) {
      core.error('Error creating service space:');
      throw error;
    }

    try {
      const contextManager = new ContextManager();

      const contextResult = await contextManager.createOrUpdateContext(spaceId, envVars, inputs);
      core.info(`Context result: ${JSON.stringify(contextResult)}`);

      const contextName = contextResult.contextName;
      core.info(`Context name: ${contextName}`);

      try {
        await graphqlStackManager.upsertStack(stackName, contextName, spaceId, integration_name, inputs);
        core.info(`Stack "${stackName}" was successfully upserted.`);
      } catch (error) {
        core.error(`Failed to upsert stack: ${(error as Error).message}`);
      }
    } catch (error) {
      core.error(`Failed to manage context: ${(error as Error).message}`);
    }

    await graphqlStackManager.waitForStackRunsToFinish(stackName);
    await graphqlStackManager.waitForStackToBeReady(stackName);

    try {
      const spacectlStackManager = new SpacectlStackManager();
      core.info(`Running command: ${command} on stack: ${stackName}`);

      if (!existingStack) {
        const deployCommand = `deploy --sha ${githubSha} --auto-confirm --tail`;
        await spacectlStackManager.runCommand(stackName, deployCommand);
        core.info(`First time run..sent command deploy --sha ${githubSha} to "${stackName}".`);
      }

      await graphqlStackManager.waitForStackRunsToFinish(stackName);
      await graphqlStackManager.waitForStackToBeReady(stackName);

      await spacectlStackManager.runCommand(stackName, command);
      core.info(`Command "${command}" ran successfully on stack "${stackName}"`);

      await graphqlStackManager.waitForStackRunsToFinish(stackName);
      await graphqlStackManager.waitForStackToBeReady(stackName);

      core.info(`Retrieving stack outputs for: ${stackName}`);
      const outputs = await spacectlStackManager.getStackOutputs(stackName);
      core.info(`Stack outputs: ${JSON.stringify(outputs)}`);
    } catch (error) {
      core.setFailed(`An error occurred while running command or getting outputs: ${(error as Error).message}`);
      core.error(error as Error);
    }
  } catch (error) {
    core.setFailed(`Action failed with error: ${(error as Error).message || error}`);
  }
};