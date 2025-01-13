import SpacectlManager from '../spacectlManager';
import * as core from '@actions/core';
import { exec } from 'child_process';
import util from 'util';

// Promisify exec to use async/await
const execAsync = util.promisify(exec);

// Child class extending SpaceliftManager to handle stack operations
class StackManager extends SpacectlManager {
  constructor() {
    super();
  }

  // Method to run a command on a specific stack
  async runCommand(stackName: string, command: string): Promise<{ stdout: string; stderr: string }> {
    try {
      core.info(`Running command '${command}' on stack '${stackName}'...`);

      core.info('Setting env vars from runCommand');
      await this.setEnvironmentVariables();

      // Ensure the spaceliftUrl and tokens are passed if needed in the command
      const commandToRun = `spacectl stack ${command} --id ${stackName}`;

      // Use child process exec to run the command and capture output
      const { stdout, stderr } = await execAsync(commandToRun);

      return { stdout, stderr };
    } catch (error) {
      core.setFailed(`Failed to execute command '${command}' on stack '${stackName}': ${(error as Error).message}`);
      throw error;
    }
  }

  // Method to get the outputs from a stack
  async getStackOutputs(stackIdOrName: string): Promise<void> {
    try {
      // Run the spacectl command with --output json flag
      const { stdout, stderr } = await this.runCommand(stackIdOrName, `outputs --output json`);

      // Check if there are any errors in stderr
      if (stderr) {
        core.error(`Error getting stack outputs: ${stderr}`);
        throw new Error(stderr.trim());
      }

      // Parse the JSON output
      const outputs: Record<string, any> = JSON.parse(stdout);

      // Loop through the outputs and set each as a GitHub Actions output
      for (const [key, value] of Object.entries(outputs)) {
        // Ensure the value is sanitized and handle both string and non-string values
        const cleanedValue =
          typeof value === 'string' ? value.replace(/^"|"$/g, '').trim() : value;

        // Set the output in GitHub Actions
        core.setOutput(key, cleanedValue);
      }

      // Set the entire JSON as a single output
      core.setOutput(
        'outputs',
        JSON.stringify(outputs, (k, v) =>
          typeof v === 'string' ? v.replace(/^"|"$/g, '').trim() : v
        )
      );

      core.info(`Successfully set stack outputs in GitHub Actions: ${stdout}`);
    } catch (error) {
      const errorMessage = `Failed to get stack outputs: ${(error as Error).message}`;
      core.setFailed(errorMessage);
      throw new Error(errorMessage);
    }
  }

  // Method to check if a stack exists
  async doesStackExist(stackIdOrName: string): Promise<boolean> {
    try {
      core.info(`Checking if stack '${stackIdOrName}' exists...`);
  
      // Run the spacectl command to list stacks and filter by stack ID
      const commandToRun = `spacectl stack list --search ${stackIdOrName} --output json`;
      core.info(`Executing command: ${commandToRun}`);
      const { stdout } = await execAsync(commandToRun);
  
      // Log raw output for debugging
      core.info(`Raw command output: ${stdout}`);
  
      // Parse the JSON output to check if the stack exists
      const stacks = JSON.parse(stdout);
      core.info(`Parsed stacks: ${JSON.stringify(stacks)}`);
  
      if (stacks.length > 0) {
        core.info(`Stack '${stackIdOrName}' exists.`);
        return true;
      } else {
        core.info(`Stack '${stackIdOrName}' does not exist.`);
        return false;
      }
    } catch (error) {
      core.error(`Error checking if stack exists: ${(error as Error).message}`);
      return false; // Default to false on error
    }
  }  
}

export default StackManager;
