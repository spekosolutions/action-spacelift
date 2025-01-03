import * as core from '@actions/core';
import SpaceManager from './graphql/spaces/spaceManager';
import GraphQLStackManager from './graphql/stacks/stackManager';
import TerraformCliManager from './terraform/cli/cliManager';
import StackManager from './spacectl/stacks/stackManager';
import Config from './config/config';

// Initialize Config globally
const config = Config.getInstance();

const graphqlStackManager = new GraphQLStackManager();
const spacectlStackManager = new StackManager();
const terraformCliManager = new TerraformCliManager();

/**
 * Helper to parse environment variables from raw input
 */
const parseEnvVars = (): Record<string, any> => {
  try {
    return {
      ...config.envVars,
      env: config.env,
      region: config.region,
      provider_region: config.region,
      zone: config.zone,
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
    return { parentSpaceId };
  } catch (error) {
    core.error('Error creating service space:');
    throw error;
  }
};

/**
 * Create or manage stacks based on Terraform state
 */
/**
 * Create or manage stacks based on Terraform state
 */
const manageStack = async (): Promise<void> => {
  try {
    await terraformCliManager.initialize(); // Explicit initialization

    const stateExists = await terraformCliManager.checkTerraformStateExists();

    const stackVars = `-var 'parent_space_id=${config.parentSpaceId}' -var 'application=${config.serviceName}' -var 'env=${config.env}' -var 'zone=${config.zone}' -var 'region=${config.region}' -var 'env_context=${config.envContext}'`;

    if (!stateExists) {
      core.info(`State for stack "${config.stackName}" does not exist. Initializing and applying Terraform...`);
      await terraformCliManager.runCommandWithLogs(`terraform apply --auto-approve ${stackVars}`);
      core.info(`Stack "${config.stackName}" created successfully.`);
      core.info(`Running first-time deployment on stack "${config.stackName}"`);
      await spacectlStackManager.runCommand(config.stackName, `deploy --tail --auto-confirm`);
    } else {
      core.info(`State for stack "${config.stackName}" already exists.`);
      core.info('Running additional Spacelift commands on stack...');
      if (config.command.startsWith('terraform')) {
        await terraformCliManager.runCommandWithLogs(`${config.command} ${stackVars}`);
      } else {
        await spacectlStackManager.runCommand(config.stackName, `deploy --tail --auto-confirm`);
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
    const githubSha = config.githubSha;
    if (!githubSha) {
      throw new Error('GITHUB_SHA environment variable is not set.');
    }

    core.info(`Using stack name: ${config.stackName}`);

    // Parse environment variables
    const envVars = parseEnvVars();
    core.info(`Parsed env_vars: ${JSON.stringify(envVars)}`);

    // Manage spaces before proceeding with any operations
    core.info('Creating or managing space...');
    await manageSpace();

    // Manage stacks based on Terraform state
    await manageStack();
  } catch (error) {
    core.setFailed(`Action failed with error: ${(error as Error).message || error}`);
  }
};
