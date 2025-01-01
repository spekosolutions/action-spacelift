import * as core from '@actions/core';
import SpaceManager from './graphql/spaces/spaceManager';
import GraphQLStackManager from './graphql/stacks/stackManager';
import TerraformCliManager from './terraform/cli/cliManager';
import StackManager from './spacectl/stacks/stackManager';

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
  env_context: string;
};

const graphqlStackManager = new GraphQLStackManager();
const spacectlStackManager = new StackManager();

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
 * Execute Terraform commands with real-time log streaming
 */
const executeTerraformCommand = async (
  terraformCliManager: TerraformCliManager,
  stackPath: string,
  command: string
): Promise<void> => {
  try {
    core.info(`Executing Terraform command: ${command}`);
    await terraformCliManager.runCommandWithLogs(stackPath, command);
    core.info(`Terraform command executed successfully: ${command}`);
  } catch (error) {
    core.error(`Terraform command failed: ${(error as Error).message}`);
    throw error;
  }
};

/**
 * Execute Spacelift commands
 */
const executeSpaceliftCommand = async (
  stackName: string,
  command: string
): Promise<void> => {
  try {
    core.info(`Executing Spacelift command: ${command}`);
    await spacectlStackManager.runCommand(stackName, command);
    core.info(`Spacelift command executed successfully: ${command}`);
  } catch (error) {
    core.error(`Spacelift command failed: ${(error as Error).message}`);
    throw error;
  }
};

/**
 * Main action logic
 */
export const run = async (inputs: Inputs): Promise<void> => {
  try {
    const { command, label_postfix, service_name, env, zone, region, rawEnvVars, spacelift_module_token, env_context } = inputs;
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

    const stackPath = `./deployment/${label_postfix}/stack`;
    const stackVars = `-var 'parent_space_id=${parentSpaceId}' -var 'application=${service_name}' -var 'env=${env}' -var 'zone=${zone}' -var 'region=${region}' -var 'env_context=${env_context}`;
    const existingStack = await graphqlStackManager.getStackByName(stackName);

    if(!existingStack) {
      await executeTerraformCommand(terraformCliManager, stackPath, `terraform init`);
      await executeTerraformCommand(terraformCliManager, stackPath, `terraform apply --auto-approve ${stackVars}'`);
    }

    // If command is Terraform-related, execute Terraform commands
    if (command.startsWith('terraform')) {
      await executeTerraformCommand(terraformCliManager, stackPath, `terraform init`);
      await executeTerraformCommand(terraformCliManager, stackPath, `${command} ${stackVars}'`);
      return; // Skip further operations for Terraform commands
    } else {
      // If command is Spacelift-related, execute Spacelift commands
      core.info('Running additional Spacelift commands on stack...');
      await executeSpaceliftCommand(stackName, command);
    }
  } catch (error) {
    core.setFailed(`Action failed with error: ${(error as Error).message || error}`);
  }
};
