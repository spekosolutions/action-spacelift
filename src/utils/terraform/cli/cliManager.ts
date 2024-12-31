import TerraformManager from '../terraformManager'
import * as core from '@actions/core'
import { exec } from 'child_process'
import util from 'util'

// Promisify exec to use async/await
const execAsync = util.promisify(exec) // Define execAsync using util.promisify


// Child class extending SpaceliftManager to handle stack operations
class TerraformCliManager extends TerraformManager {
  constructor() {
    super()
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

  // Method to run a command on a specific stack
  async runCommand(stackName: string, command: string): Promise<{ stdout: string; stderr: string }> {
    try {
      core.info(`Running command '${command}' on stack '${stackName}'...`)

      core.info('Setting env vars from runCommand')
      await this.setEnvironmentVariables()

      // Ensure the spaceliftUrl and tokens are passed if needed in the command
      const commandToRun = `cd deployment/service/stack && ${command}`

      // Use child process exec to run the command and capture output
      const { stdout, stderr } = await execAsync(commandToRun)

      return { stdout, stderr }
    } catch (error) {
      core.setFailed(`Failed to execute command '${command}' on stack '${stackName}': ${(error as Error).message}`)
      throw error
    }
  }
}

export default TerraformCliManager