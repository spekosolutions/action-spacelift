import TerraformManager from '../terraformManager';
import * as core from '@actions/core';
import { spawn } from 'child_process';

// Child class extending TerraformManager to handle CLI operations
class TerraformCliManager extends TerraformManager {
  constructor(token: string) {
    super(token);
  }

  /**
   * Generate backend configuration string for Terraform
   * @param {string} region - AWS region
   * @param {string} awsAccountId - AWS account ID
   * @param {string} environment - Environment name (e.g., dev1)
   * @param {string} zone - Zone name (e.g., na1)
   * @param {string} serviceName - Service name
   * @param {string} stackName - Stack name
   * @returns {string} Backend configuration string
   */
  generateBackendConfig(
    region: string,
    awsAccountId: string,
    environment: string,
    zone: string,
    serviceName: string,
    stackName: string
  ): string {
    return [
      `-backend-config="bucket=spacelift-stacks-${region}-${awsAccountId}"`,
      `-backend-config="key=${environment}/${zone}/${serviceName}/${stackName}/terraform.tfstate"`,
      `-backend-config="region=${region}"`,
      `-backend-config="dynamodb_table=spacelift-stacks-${environment}-${region}-${awsAccountId}"`,
      `-backend-config="encrypt=true"`,
      `-backend-config="kms_key_id=alias/terraform-backend-key"`
    ].join(' ');
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
      stackName: string;
    }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const backendConfig = this.generateBackendConfig(
        backendConfigParams.region,
        backendConfigParams.awsAccountId,
        backendConfigParams.environment,
        backendConfigParams.zone,
        backendConfigParams.serviceName,
        backendConfigParams.stackName
      );

      const isInitCommand = command.includes('terraform init');
      const fullCommand = isInitCommand
        ? `${command} ${backendConfig}`
        : `${command} -var 'spacelift_api_key_endpoint=${process.env.SPACELIFT_API_KEY_ENDPOINT}' -var 'spacelift_api_key_id=${process.env.SPACELIFT_KEY_ID}' -var 'spacelift_api_key_secret=${process.env.SPACELIFT_API_KEY_SECRET}'`;

      core.info(`Running Terraform command: ${fullCommand} in path: ${stackPath}`);

      const child = spawn(fullCommand, {
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
