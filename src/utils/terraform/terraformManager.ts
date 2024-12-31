import * as core from '@actions/core'
import AuthorizationManager from '../authorization/authorizationManager';
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Parent class to manage common Spacelift environment setup
class TerraformManager {
  protected authorizationManager: AuthorizationManager;

  constructor() {
    this.authorizationManager = new AuthorizationManager();  // Initialize the AuthorizationManager
    this.configureSpaceliftCredentials()
  }

  async configureSpaceliftCredentials(): Promise<void> {
    try {
      // Get Spacelift API token from GitHub Actions secret
      const spaceliftToken = await this.authorizationManager.oidcTokenAsync;
  
      // Define the path to the credentials file
      const terraformDir = path.join(os.homedir(), ".terraform.d");
      const credentialsFile = path.join(terraformDir, "credentials.tfrc.json");
  
      // Ensure the ~/.terraform.d directory exists
      if (!fs.existsSync(terraformDir)) {
        fs.mkdirSync(terraformDir, { recursive: true });
      }
  
      // Define the credentials content
      const credentialsContent = {
        credentials: {
          "spacelift.io": {
            token: spaceliftToken,
          },
        },
      };
  
      // Write the credentials file
      fs.writeFileSync(credentialsFile, JSON.stringify(credentialsContent, null, 2));
      core.info(`Spacelift credentials have been written to ${credentialsFile}`);
    } catch (error: any) {
      core.setFailed(`Failed to configure Spacelift credentials: ${error.message}`);
    }
  }
}

export default TerraformManager
