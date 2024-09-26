import * as core from '@actions/core'
import AuthorizationManager from '../authorization/authorizationManager';

// Parent class to manage common Spacelift environment setup
class SpacectlManager {
  private authorizationManager: AuthorizationManager;

  constructor() {
    this.authorizationManager = new AuthorizationManager();  // Initialize the AuthorizationManager
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
}

export default SpacectlManager
