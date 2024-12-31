import TerraformManager from '../terraformManager';
import * as core from '@actions/core';
import { exec } from 'child_process';
import util from 'util';

// Promisify exec to use async/await
const execAsync = util.promisify(exec);

// Child class extending TerraformManager to handle CLI operations
class TerraformCliManager extends TerraformManager {
  constructor() {
    super();
  }

  // Set environment variables for Spacelift
  async setEnvironmentVariables(): Promise<void> {
    try {
      core.info('Setting environment variables for Spacelift...');
      
      const oidcToken = await this.authorizationManager.oidcTokenAsync;

      core.exportVariable('OIDC_TOKEN', oidcToken);
      core.exportVariable('SPACELIFT_API_KEY_ENDPOINT', `https://${this.authorizationManager.spaceliftApiKeyEndpoint}`);

      if (process.env.SPACELIFT_KEY_ID) {
        core.exportVariable('SPACELIFT_API_KEY_ID', process.env.SPACELIFT_KEY_ID);
      }

      if (process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN) {
        core.exportVariable('SPACELIFT_API_KEY_SECRET', oidcToken);
      }

      core.info('Environment variables set successfully.');
    } catch (error) {
      core.error(`Error during environment variable setup: ${(error as Error).message}`);
      throw error;
    }
  }

  // Run a command on a specific stack
  async runCommand(stackName: string, command: string): Promise<{ stdout: string; stderr: string }> {
    try {
      core.info(`Running command '${command}' on stack '${stackName}'...`);
      await this.setEnvironmentVariables();

      // Build the command
      const commandToRun = `cd deployment/service && ${command}`;

      // Execute the command
      const { stdout, stderr } = await execAsync(commandToRun);

      core.info(`Command output:\n${stdout}`);
      return { stdout, stderr };
    } catch (error) {
      core.setFailed(`Failed to execute command '${command}' on stack '${stackName}': ${(error as Error).message}`);
      throw error;
    }
  }
}

export default TerraformCliManager;
