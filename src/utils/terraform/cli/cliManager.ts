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

  // Run a command on a specific stack
  async runCommand(stackName: string, command: string): Promise<{ stdout: string; stderr: string }> {
    core.info(`Executing command: ${command} on stack: ${stackName}`);

    return new Promise((resolve, reject) => {
      const child = spawn(command, {
        shell: true,
        env: {
          ...process.env,
        },
      });

      // Stream stdout
      child.stdout.on('data', (data: Buffer) => {
        process.stdout.write(data.toString());
      });

      // Stream stderr
      child.stderr.on('data', (data: Buffer) => {
        process.stderr.write(data.toString());
      });

      // Handle process exit
      child.on('close', (code: number) => {
        if (code === 0) {
          resolve({ stdout: '', stderr: '' });
        } else {
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });

      child.on('error', (error: Error) => {
        reject(new Error(`Failed to execute command: ${error.message}`));
      });
    });
  }
}

export default TerraformCliManager;
