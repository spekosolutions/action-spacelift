import TerraformManager from '../terraformManager';
import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

class TerraformCliManager extends TerraformManager {
  private stackPath: string;

  constructor() {
    super(process.env.SPACELIFT_MODULE_TOKEN!);
    this.stackPath = `./deployment/${process.env.LABEL_SUFFIX}/stack`;
    this.initializeTerraform();
  }

  /**
   * Initialize Terraform backend if not already initialized
   */
  private async initializeTerraform(): Promise<void> {
    try {
      core.info('Initializing Terraform to configure the backend...');

      const backendConfigPath = path.join(this.stackPath, 'state.tf');
      if (!fs.existsSync(backendConfigPath)) {
        const backendConfigContent = this.generateBackendConfigContent();
        this.writeBackendConfigToFile(backendConfigContent);
      }

      await execAsync(`terraform init`, { cwd: this.stackPath });
      core.info('Terraform initialized successfully.');
    } catch (error) {
      core.error(`Error initializing Terraform: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Generate backend configuration content for Terraform
   */
  private generateBackendConfigContent(): string {
    return `
terraform {
  backend "s3" {
    bucket         = "spacelift-stacks-${process.env.AWS_REGION}-${process.env.AWS_ACCOUNT_ID}"
    key            = "${process.env.ENVIRONMENT}/${process.env.ZONE}/${process.env.SERVICE_NAME}/${process.env.LABEL_SUFFIX}/terraform.tfstate"
    region         = "${process.env.AWS_REGION}"
    dynamodb_table = "spacelift-stacks-${process.env.AWS_REGION}-${process.env.AWS_ACCOUNT_ID}"
    encrypt        = true
    kms_key_id     = "alias/aws/s3"
  }
}`.trim();
  }

  /**
   * Write backend configuration to a file if it does not already exist
   */
  private writeBackendConfigToFile(backendConfigContent: string): void {
    const backendFilePath = path.join(this.stackPath, 'state.tf');
    if (!fs.existsSync(backendFilePath)) {
      fs.writeFileSync(backendFilePath, backendConfigContent, 'utf8');
      core.info(`Backend configuration written to ${backendFilePath}`);
    } else {
      core.info(`Backend configuration already exists at ${backendFilePath}`);
    }
  }

  /**
   * Check if the Terraform state exists remotely
   */
  async checkTerraformStateExists(): Promise<boolean> {
    try {
      core.info('Checking if Terraform state exists remotely...');
      const { stdout } = await execAsync(`terraform show -json`, { cwd: this.stackPath });
      const state = JSON.parse(stdout);
      return !!state.values; // If state values exist, the state has been created
    } catch (error) {
      core.warning('Terraform state not found or could not be parsed.');
      return false;
    }
  }

  /**
   * Run a command with real-time logging
   */
  async runCommandWithLogs(
    command: string,
  ): Promise<void> {
    try {
      core.info(`Running Terraform command: ${command} in path: ${this.stackPath}`);

      await new Promise<void>((resolve, reject) => {
        const child = spawn(command, {
          shell: true,
          cwd: this.stackPath,
          env: {
            ...process.env,
          },
        });

        child.stdout.on('data', (data: Buffer) => {
          core.info(data.toString().trim());
        });

        child.stderr.on('data', (data: Buffer) => {
          core.error(data.toString().trim());
        });

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
    } catch (error) {
      core.error(`Error executing Terraform command: ${(error as Error).message}`);
      throw error;
    }
  }
}

export default TerraformCliManager;
