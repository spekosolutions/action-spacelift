import * as core from '@actions/core';
import AuthorizationManager from '../authorization/authorizationManager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Parent class to manage common Spacelift environment setup
class TerraformManager {
  protected authorizationManager: AuthorizationManager;
  private token: string;

  constructor(token: string) {
    this.authorizationManager = new AuthorizationManager(); // Initialize the AuthorizationManager
    this.setupSpaceliftEnvironment();
    this.token = token;
  }

  private async setupSpaceliftEnvironment(): Promise<void> {
    try {
      await this.configureSpaceliftCredentials();
      await this.debugSpaceliftCredentials();
    } catch (error) {
      core.setFailed(`Failed to set up Spacelift environment: ${(error as Error).message}`);
    }
  }

  async configureSpaceliftCredentials(): Promise<void> {
    try {
      // Get Spacelift API token
      const spaceliftToken = await this.authorizationManager.oidcTokenAsync;

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

  async debugSpaceliftCredentials(): Promise<void> {
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
