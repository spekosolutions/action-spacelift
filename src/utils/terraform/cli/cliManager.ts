import TerraformManager from '../terraformManager';
import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

// Child class extending TerraformManager to handle CLI operations
class TerraformCliManager extends TerraformManager {
  constructor(token: string) {
    super(token);
  }

  /**
   * Generate backend configuration content for Terraform
   * @param {string} region - AWS region
   * @param {string} awsAccountId - AWS account ID
   * @param {string} environment - Environment name (e.g., dev1)
   * @param {string} zone - Zone name (e.g., na1)
   * @param {string} serviceName - Service name
   * @param {string} labelSuffix - Stack name
   * @returns {string} Backend configuration content
   */
  generateBackendConfigContent(
    region: string,
    awsAccountId: string,
    environment: string,
    zone: string,
    serviceName: string,
    labelSuffix: string
  ): string {
    return `
terraform {
  backend "s3" {
    bucket         = "spacelift-stacks-${region}-${awsAccountId}"
    key            = "${environment}/${zone}/${serviceName}/${labelSuffix}/terraform.tfstate"
    region         = "${region}"
    dynamodb_table = "spacelift-stacks-${environment}-${region}-${awsAccountId}"
    encrypt        = true
    kms_key_id     = "alias/aws/s3"
  }
}
    `.trim();
  }

  /**
   * Write backend configuration to a file if it does not already exist
   * @param {string} stackPath - Path to the Terraform stack
   * @param {string} backendConfigContent - Backend configuration content
   * @returns {void}
   */
  writeBackendConfigToFile(stackPath: string, backendConfigContent: string): void {
    const backendFilePath = path.join(stackPath, 'state.tf');
    if (!fs.existsSync(backendFilePath)) {
      fs.writeFileSync(backendFilePath, backendConfigContent, 'utf8');
      core.info(`Backend configuration written to ${backendFilePath}`);
    } else {
      core.info(`Backend configuration already exists at ${backendFilePath}`);
    }
  }

  /**
   * Run a command with real-time logging
   * @param {string} stackPath - The path to the stack
   * @param {string} command - The Terraform command to run
   * @param {object} backendConfigParams - Parameters for generating backend configuration
   * @returns {Promise<void>} Resolves when the command completes successfully
   */
  async runCommandWithLogs(
    stackPath: string,
    command: string,
    backendConfigParams: {
      region: string;
      awsAccountId: string;
      environment: string;
      zone: string;
      serviceName: string;
      labelSuffix: string;
    }
  ): Promise<void> {
    try {
      const backendConfigContent = this.generateBackendConfigContent(
        backendConfigParams.region,
        backendConfigParams.awsAccountId,
        backendConfigParams.environment,
        backendConfigParams.zone,
        backendConfigParams.serviceName,
        backendConfigParams.labelSuffix
      );
  
      // Write the backend configuration only if it doesn't exist
      this.writeBackendConfigToFile(stackPath, backendConfigContent);
  
      // Avoid running terraform init multiple times
      if (command.includes('terraform init')) {
        core.info('Ensuring backend configuration is initialized...');
        command = 'terraform init -reconfigure';
      }
  
      // Run the Terraform command
      core.info(`Running Terraform command: ${command} in path: ${stackPath}`);
      const child = spawn(command, {
        shell: true,
        cwd: stackPath,
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
        } else {
          throw new Error(`Terraform command '${command}' failed with exit code ${code}.`);
        }
      });
    } catch (error) {
      core.error(`Error executing Terraform command: ${(error as Error).message}`);
      throw error;
    }
  }  
}

export default TerraformCliManager;