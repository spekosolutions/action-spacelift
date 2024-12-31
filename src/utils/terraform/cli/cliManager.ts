import TerraformManager from '../terraformManager';
import * as core from '@actions/core';
import { exec } from 'child_process';
import util from 'util';

// Promisify exec to use async/await
const execAsync = util.promisify(exec);

// Child class extending TerraformManager to handle CLI operations
class TerraformCliManager extends TerraformManager {
  constructor(token: string) {
    super(token);
  }

  // Run a command on a specific stack
  async runCommand(stackName: string, command: string): Promise<{ stdout: string; stderr: string }> {
    try {
      core.info(`Running command '${command}' on stack '${stackName}'...`);

      // Build the command
      const commandToRun = `cd deployment/service/stack && ${command}`;

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
