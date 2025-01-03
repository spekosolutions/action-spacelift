import * as core from '@actions/core';
import SpaceManager from './graphql/spaces/spaceManager';
import GraphQLStackManager from './graphql/stacks/stackManager';
import TerraformCliManager from './terraform/cli/cliManager';
import StackManager from './spacectl/stacks/stackManager';

const graphqlStackManager = new GraphQLStackManager();
const spacectlStackManager = new StackManager();
const terraformCliManager = new TerraformCliManager();

/**
 * Helper to parse environment variables from raw input
 */
const parseEnvVars = (rawEnvVars: string): Record<string, any> => {
  try {
    const parsedRawEnvVars = JSON.parse(rawEnvVars.trim());
    return {
      ...parsedRawEnvVars,
      env: process.env.ENV!,
      region: process.env.REGION!,
      provider_region: process.env.REGION!,
      zone: process.env.ZONE!,
    };
  } catch (error) {
    core.setFailed(`Failed to parse env_vars JSON: ${(error as Error).message}`);
    throw error;
  }
};

/**
 * Create or manage spaces
 */
const manageSpace = async (): Promise<{ parentSpaceId: string }> => {
  const spaceManager = new SpaceManager();
  try {
    const parentSpaceId = await spaceManager.createServiceSpace();
    core.info(`Using Parent Space with ID: ${parentSpaceId}`);
    // !! We changed to use terraform for creating stacks, so we don't need to create a space here
    // const spaceId = await spaceManager.createServiceSpace(process.env as Record<string, string>);
    return { parentSpaceId };
  } catch (error) {
    core.error('Error creating service space:');
    throw error;
  }
};

/**
 * Create or manage stacks based on Terraform state
 */
const manageStack = async (stackName: string): Promise<void> => {
  try {
    const stateExists = await terraformCliManager.checkTerraformStateExists();

    const stackVars = `-var 'parent_space_id=${process.env.PARENT_SPACE_ID}' -var 'application=${process.env.SERVICE_NAME}' -var 'env=${process.env.ENV}' -var 'zone=${process.env.ZONE}' -var 'region=${process.env.REGION}' -var 'env_context=${process.env.ENV_CONTEXT}`;

    if (!stateExists) {
      core.info(`State for stack "${stackName}" does not exist. Initializing and applying Terraform...`);
      await terraformCliManager.runCommandWithLogs(`terraform apply --auto-approve ${stackVars}`);
      core.info(`Stack "${stackName}" created successfully.`);
      core.info(`Running first time deployment on stack..."${stackName}"`);
      await spacectlStackManager.runCommand(stackName, `deploy --tail --auto-confirm`);
    } else {
      core.info(`State for stack "${stackName}" already exists.`);
      core.info('Running additional Spacelift commands on stack...');
      if(process.env.COMMAND!.startsWith('terraform')) {
        await terraformCliManager.runCommandWithLogs(process.env.COMMAND!);
      } else {
        // !! Change this in the future - mayeb a switch, or make user pass in full spacectl command prefix (spacectl)
        await spacectlStackManager.runCommand(stackName, `deploy --tail --auto-confirm`);
      }
    }
  } catch (error) {
    core.error(`Error managing stack: ${(error as Error).message}`);
    throw error;
  }
};

/**
 * Main action logic
 */
export const run = async (): Promise<void> => {
  try {
    const githubSha = process.env.GITHUB_SHA;
    if (!githubSha) {
      throw new Error('GITHUB_SHA environment variable is not set.');
    }

    const stackName = `${process.env.LABEL_SUFFIX}-${process.env.SERVICE_NAME}-${process.env.ENV}-${process.env.ZONE}`;
    core.info(`Using stack name: ${stackName}`);

    // Parse environment variables
    const envVars = parseEnvVars(process.env.ENV_VARS || '{}');
    core.info(`Parsed env_vars: ${JSON.stringify(envVars)}`);

    // Manage spaces before proceeding with any operations
    core.info('Creating or managing space...');
    await manageSpace();

    // Manage stacks based on Terraform state
    await manageStack(stackName);
  } catch (error) {
    core.setFailed(`Action failed with error: ${(error as Error).message || error}`);
  }
};
