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

  async getStackOutputs(stackIdOrName: string): Promise<void> {
    try {
      // Run the spacectl command
      const { stdout, stderr } = await this.runCommand(stackIdOrName, `outputs --output json`);
      if (stderr) {
        core.error(`Error getting stack outputs: ${stderr}`);
        throw new Error(stderr);
      }
  
      // Parse the JSON output
      const outputs = JSON.parse(stdout);
  
      // Sanitize the outputs
      const sanitizedOutputs = outputs.map((output: any) => {
        if (typeof output.value === 'string') {
          try {
            // Parse JSON-like strings into objects, if valid
            output.value = JSON.parse(output.value);
          } catch {
            // Remove extraneous quotes if not a JSON-like string
            output.value = output.value.replace(/^"|"$/g, '');
          }
        }
        return output;
      });
  
      // Set each sanitized output as a GitHub Action output
      for (const output of sanitizedOutputs) {
        core.setOutput(output.id, JSON.stringify(output.value));
      }
  
      // Set the entire sanitized outputs as JSON
      core.setOutput('outputs', JSON.stringify(sanitizedOutputs));
      core.info(`Successfully set sanitized stack outputs: ${JSON.stringify(sanitizedOutputs)}`);
    } catch (error) {
      core.setFailed(`Failed to get stack outputs: ${(error as Error).message}`);
      throw error;
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
