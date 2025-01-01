import * as core from '@actions/core';
import SpaceManager from './graphql/spaces/spaceManager';
import GraphQLStackManager from './graphql/stacks/stackManager';
import TerraformCliManager from './terraform/cli/cliManager';

/**
 * Input structure for the action
 */
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
  spacelift_module_token: string;
};

const graphqlStackManager = new GraphQLStackManager();

/**
 * Helper to parse environment variables from raw input
 */
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

/**
 * Create or manage spaces
 */
const manageSpace = async (inputs: Inputs): Promise<{ spaceId: string; parentSpaceId: string }> => {
  const spaceManager = new SpaceManager();
  try {
    const parentSpaceId = await spaceManager.createServiceSpace({
      ...inputs,
      label_postfix: '', // Exclude postfix for parent space
    });
    const spaceId = await spaceManager.createServiceSpace(inputs);
    return { spaceId, parentSpaceId };
  } catch (error) {
    core.error('Error creating service space:');
    throw error;
  }
};

/**
 * Create or manage stacks
 */
const manageStack = async (stackName: string, spaceId: string, inputs: Inputs): Promise<void> => {
  try {
    const existingStack = await graphqlStackManager.getStackByName(stackName);

    if (!existingStack) {
      core.info(`Stack "${stackName}" does not exist. Creating a new stack...`);
      await graphqlStackManager.upsertStack(stackName, '', spaceId, inputs.service_name, inputs);
      core.info(`Stack "${stackName}" created successfully.`);
    } else {
      core.info(`Stack "${stackName}" already exists.`);
    }
  } catch (error) {
    core.error(`Error managing stack: ${(error as Error).message}`);
    throw error;
  }
};

/**
 * Execute commands on stack
 */
const runCommandsOnStack = async (
  stackName: string,
  githubSha: string,
  command: string,
  spacelift_module_token: string
): Promise<void> => {
  const terraformCliManager = new TerraformCliManager(spacelift_module_token);
  core.info(`Running command '${command}' on stack '${stackName}'...`);
  await terraformCliManager.runCommand(stackName, command);
  core.info(`Command '${command}' executed successfully on stack '${stackName}'.`);
};

/**
 * Main action logic
 */
export const run = async (inputs: Inputs): Promise<void> => {
  try {
    const { command, label_postfix, service_name, env, zone, region, rawEnvVars, spacelift_module_token } = inputs;
    const githubSha = process.env.GITHUB_SHA;

    if (!githubSha) {
      throw new Error('GITHUB_SHA environment variable is not set.');
    }

    const stackName = `${label_postfix}-${service_name}-${env}-${zone}`;
    core.info(`Using stack name: ${stackName}`);

    // Parse environment variables
    const envVars = parseEnvVars(rawEnvVars, inputs);
    core.info(`Parsed env_vars: ${JSON.stringify(envVars)}`);

    const terraformCliManager = new TerraformCliManager(spacelift_module_token);

    // Manage spaces before proceeding with any operations
    core.info('Creating or managing space...');
    const { spaceId, parentSpaceId } = await manageSpace(inputs);
    core.info(`Space created or managed with ID: ${spaceId}, Parent Space ID: ${parentSpaceId}`);

    // If command is Terraform-related or stack doesn't exist, execute the command
    const existingStack = await graphqlStackManager.getStackByName(stackName);
    if(!existingStack) {
      await terraformCliManager.runCommand(stackName, `terraform init`);
      await terraformCliManager.runCommand(stackName, `terraform deploy --auto-approve -var='parent_space_id=${parentSpaceId}'`);
    }

    if (command.startsWith('terraform')) {
      await terraformCliManager.runCommand(stackName, `terraform init`);
      await terraformCliManager.runCommand(stackName, `${command} -var='parent_space_id=${parentSpaceId}'`);
    } else { // This must be a sapcelift command right?
      // Run additional commands on stack
      core.info('Running additional commands on stack...');
      await runCommandsOnStack(stackName, githubSha, command, spacelift_module_token);
    }
  } catch (error) {
    core.setFailed(`Action failed with error: ${(error as Error).message || error}`);
  }
};
