import TerraformManager from '../terraformManager';
import * as core from '@actions/core';
import { exec } from 'child_process';
import util from 'util';
import { spawn } from 'child_process';

// Promisify exec to use async/await
const execAsync = util.promisify(exec);

// Child class extending TerraformManager to handle CLI operations
class TerraformCliManager extends TerraformManager {
  constructor(token: string) {
    super(token);
  }

  // Run a command with real-time logging
  async runCommandWithLogs(stackPath: string, command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      core.info(`Running Terraform command: ${command} in path: ${stackPath}`);

      const updatedCommand = `${command} -var 'spacelift_api_key_endpoint=${process.env.SPACELIFT_API_KEY_ENDPOINT}' -var 'spacelift_api_key_id=${process.env.SPACELIFT_KEY_ID}' -var 'spacelift_api_key_secret=${process.env.SPACELIFT_API_KEY_SECRET}'`;
      const child = spawn(command, {
        shell: true,
        cwd: stackPath,
        env: {
          ...process.env,
        },
      });

      // Capture and log stdout
      child.stdout.on('data', (data: Buffer) => {
        core.info(data.toString().trim());
      });

      // Capture and log stderr
      child.stderr.on('data', (data: Buffer) => {
        core.error(data.toString().trim());
      });

      // Handle process exit
      child.on('close', (code: number) => {
        if (code === 0) {
          core.info(`Terraform command '${command}' completed successfully.`);
          resolve();
        } else {
          reject(new Error(`Terraform command '${command}' failed with exit code ${code}.`));
        }
      });

      child.on('error', (error: Error) => {
        core.error(`Error executing Terraform command '${command}': ${error.message}`);
        reject(error);
      });
    });
  }
}

export default TerraformCliManager;
