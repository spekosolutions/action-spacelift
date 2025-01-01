import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import AuthorizationManager from '../authorization/authorizationManager';


// Class to manage Spacelift environment setup for Terraform
class TerraformManager {
  private authorizationManager: AuthorizationManager;
  private token: string;

  constructor(token: string) {
    this.token = token;
    this.authorizationManager = new AuthorizationManager();  // Initialize the AuthorizationManager
    this.setupSpaceliftEnvironment();
    this.setEnvironmentVariables();
  }

  private setupSpaceliftEnvironment(): void {
    try {
      this.configureSpaceliftCredentials();
      this.debugSpaceliftCredentials();
    } catch (error) {
      core.setFailed(`Failed to set up Spacelift environment: ${(error as Error).message}`);
    }
  }

  // Set environment variables for Spacelift
  async setEnvironmentVariables(): Promise<void> {
    core.info('Starting environment variable setup for Spacelift...')

    try {
      // Log and set environment variables
      core.info('Setting OIDC_TOKEN environment variable...')
      core.exportVariable('OIDC_TOKEN', await this.authorizationManager.oidcTokenAsync)

      core.info('Setting SPACELIFT_API_KEY_ENDPOINT environment variable...')
      core.exportVariable('SPACELIFT_API_KEY_ENDPOINT', `https://${this.authorizationManager.spaceliftApiKeyEndpoint}`)

      // Log the SPACELIFT_KEY_ID environment variable
      if (process.env.SPACELIFT_KEY_ID) {
        core.info(`SPACELIFT_API_KEY_ID: ${process.env.SPACELIFT_KEY_ID}`)
        core.exportVariable('SPACELIFT_API_KEY_ID', process.env.SPACELIFT_KEY_ID)
      } else {
        core.warning('SPACELIFT_KEY_ID is not set in the environment.')
      }

      // Log the ACTIONS_ID_TOKEN_REQUEST_TOKEN environment variable
      if (process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN) {
        core.info(`ACTIONS_ID_TOKEN_REQUEST_TOKEN is set.`)
        core.exportVariable('SPACELIFT_API_KEY_SECRET',  await this.authorizationManager.oidcTokenAsync)
      } else {
        core.warning('ACTIONS_ID_TOKEN_REQUEST_TOKEN is not set in the environment.')
      }

      core.info('All environment variables set successfully.')
    } catch (error) {
      core.error(`Error during environment variable setup: ${(error as Error).message}`)
      throw error
    }
  }

  private configureSpaceliftCredentials(): void {
    try {
      // Define the path to the credentials file
      const terraformDir = path.join(os.homedir(), '.terraform.d');
      const credentialsFile = path.join(terraformDir, 'credentials.tfrc.json');

      // Ensure the ~/.terraform.d directory exists
      if (!fs.existsSync(terraformDir)) {
        fs.mkdirSync(terraformDir, { recursive: true });
      }

      // Define the credentials content
      const credentialsContent = {
        credentials: {
          'spacelift.io': {
            token: this.token,
          },
        },
      };

      // Write the credentials file
      fs.writeFileSync(credentialsFile, JSON.stringify(credentialsContent, null, 2));
      core.info(`Spacelift credentials have been written to ${credentialsFile}`);

      // Export TF_CLI_CONFIG_FILE environment variable
      process.env.TF_CLI_CONFIG_FILE = credentialsFile;
      core.info(`TF_CLI_CONFIG_FILE has been set to ${credentialsFile}`);
    } catch (error) {
      core.setFailed(`Failed to configure Spacelift credentials: ${(error as Error).message}`);
      throw error;
    }
  }

  private debugSpaceliftCredentials(): void {
    try {
      // Define the path to the credentials file
      const credentialsFile = path.join(os.homedir(), '.terraform.d', 'credentials.tfrc.json');

      // Check if the credentials file exists
      if (!fs.existsSync(credentialsFile)) {
        core.warning(`Credentials file not found at: ${credentialsFile}`);
      } else {
        // Read and log the file contents
        const fileContents = fs.readFileSync(credentialsFile, 'utf8');
        const base64Encoded = Buffer.from(fileContents).toString('base64');
        core.info(`Base64-encoded credentials:\n${base64Encoded}`);
        core.info(`Contents of ${credentialsFile}:\n${fileContents}`);
      }

      // Log the exported TF_CLI_CONFIG_FILE variable
      if (process.env.TF_CLI_CONFIG_FILE) {
        core.info(`TF_CLI_CONFIG_FILE is set to ${process.env.TF_CLI_CONFIG_FILE}`);
      } else {
        core.warning('TF_CLI_CONFIG_FILE is not set.');
      }
    } catch (error) {
      core.setFailed(`Failed to debug Spacelift credentials: ${(error as Error).message}`);
    }
  }
}

export default TerraformManager;
