import * as core from '@actions/core';
import ContextManager from './graphql/contexts/contextManager';
import SpaceManager from './graphql/spaces/spaceManager';
import GraphQLStackManager from './graphql/stacks/stackManager';
import SpacectlStackManager from './spacectl/stacks/stackManager';

type Inputs = {
  command: string;
  region: string;
  zone: string;
  env: string;
  integration_name: string;
  service_name: string;
  label_prefix: string;
  label_postfix: string;
  rawEnvVars: string;
};

const graphqlStackManager = new GraphQLStackManager();

const generateUniqueTag = (): string => {
  return Math.random().toString(36).substring(7);
};

const parseEnvVars = (rawEnvVars: string, inputs: Inputs): Record<string, any> => {
  try {
    const parsedRawEnvVars = JSON.parse(rawEnvVars.trim());
    return {
      ...parsedRawEnvVars,
      env: inputs.env,
      region: inputs.region,
      provider_region: inputs.region,
      zone: inputs.zone,
    };
  } catch (error) {
    core.setFailed(`Failed to parse env_vars JSON: ${(error as Error).message}`);
    throw error;
  }
};

const manageSpace = async (inputs: Inputs): Promise<string> => {
  const spaceManager = new SpaceManager();
  try {
    return await spaceManager.createServiceSpace(inputs);
  } catch (error) {
    core.error('Error creating service space:');
    throw error;
  }
};

const manageContext = async (
  spaceId: string,
  envVars: Record<string, any>,
  inputs: Inputs
): Promise<string> => {
  const contextManager = new ContextManager();
  try {
    const contextResult = await contextManager.createOrUpdateContext(spaceId, envVars, inputs);
    core.info(`Context result: ${JSON.stringify(contextResult)}`);
    return contextResult.contextName;
  } catch (error) {
    core.error(`Failed to manage context: ${(error as Error).message}`);
    throw error;
  }
};

const manageStack = async (
  stackName: string,
  contextName: string,
  spaceId: string,
  integration_name: string,
  inputs: Inputs
): Promise<void> => {
  try {
    await graphqlStackManager.upsertStack(stackName, contextName, spaceId, integration_name, inputs);
    core.info(`Stack "${stackName}" was successfully upserted.`);
  } catch (error) {
    core.error(`Failed to upsert stack: ${(error as Error).message}`);
    throw error;
  }
};

const runCommandsOnStack = async (
  stackName: string,
  githubSha: string,
  command: string,
  existingStack: boolean
): Promise<void> => {
  const spacectlStackManager = new SpacectlStackManager();

  if (!existingStack) {
    const deployCommand = `deploy --sha ${githubSha} --auto-confirm --tail`;
    await spacectlStackManager.runCommand(stackName, deployCommand);
    core.info(`First time run...sent command deploy --sha ${githubSha} to "${stackName}".`);
  }

  await spacectlStackManager.runCommand(stackName, command);
  core.info(`Command "${command}" ran successfully on stack "${stackName}".`);

  const outputs = await spacectlStackManager.getStackOutputs(stackName);
  core.info(`Stack outputs: ${JSON.stringify(outputs)}`);
};

const shouldUpdateStack = (command: string): boolean => {
  const nonUpdatingCommands = [
    'outputs',
    'resources',
    'dependencies',
    'show',
    'discard',
    'preview'
  ];
  return !nonUpdatingCommands.includes(command);
};

const isDeploymentCommand = (command: string): boolean => {
  return ['approve', 'deploy'].includes(command);
};

const isPreviewCommand = (command: string): boolean => {
  return command === 'preview';
};

export const run = async (inputs: Inputs): Promise<void> => {
  try {
    const { command, label_postfix, service_name, env, integration_name, zone, region, rawEnvVars } = inputs;
    const githubSha = process.env.GITHUB_SHA;

    if (!githubSha) {
      throw new Error('GITHUB_SHA environment variable is not set.');
    }

    const stackName = `${label_postfix}-${service_name}-${env}-${zone}`;
    core.info(`Using stack name: ${stackName}`);

    const envVars = parseEnvVars(rawEnvVars, inputs);
    core.info(`Parsed env_vars: ${JSON.stringify(envVars)}`);

    const existingStack = await graphqlStackManager.getStackByName(stackName);

    if (existingStack) {
      await graphqlStackManager.waitForStackRunsToFinish(stackName);
      await graphqlStackManager.waitForStackToBeReady(stackName);
    } else {
      core.info(`Stack "${stackName}" does not exist. Proceeding to create a new stack.`);
    }

    let spaceId = '';
    let contextName = '';

    if (shouldUpdateStack(command)) {
      spaceId = await manageSpace(inputs);
      contextName = await manageContext(spaceId, envVars, inputs);
    }

    if (!existingStack) {
      const deployCommand = `deploy --sha ${githubSha} --auto-confirm --tail`;
      await runCommandsOnStack(stackName, githubSha, deployCommand, existingStack);
    }
    
    if (isDeploymentCommand(command)) {
      await manageStack(stackName, contextName, spaceId, integration_name, inputs);
    }

    if (isPreviewCommand(command) && existingStack) {
      core.info(`Running preview command for stack: ${stackName}`);
      await runCommandsOnStack(stackName, githubSha, command, existingStack);
    } else if (!isPreviewCommand(command)) {
      await runCommandsOnStack(stackName, githubSha, command, existingStack);
    }

  } catch (error) {
    core.setFailed(`Action failed with error: ${(error as Error).message || error}`);
  }
};
