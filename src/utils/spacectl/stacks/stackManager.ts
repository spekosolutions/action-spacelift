import SpacectlManager from '../spacectlManager'
import * as core from '@actions/core'
import { exec } from 'child_process'
import util from 'util'

// Promisify exec to use async/await
const execAsync = util.promisify(exec) // Define execAsync using util.promisify

// Child class extending SpaceliftManager to handle stack operations
class StackManager extends SpacectlManager {
  constructor() {
    super()
  }

  // Method to run a command on a specific stack
  async runCommand(stackName: string, command: string): Promise<{ stdout: string; stderr: string }> {
    try {
      core.info(`Running command '${command}' on stack '${stackName}'...`)

      core.info('Setting env vars from runCommand')
      await this.setEnvironmentVariables()

      // Ensure the spaceliftUrl and tokens are passed if needed in the command
      const commandToRun = `spacectl stack ${command} --id ${stackName}`

      // Use child process exec to run the command and capture output
      const { stdout, stderr } = await execAsync(commandToRun)

      return { stdout, stderr }
    } catch (error) {
      core.setFailed(`Failed to execute command '${command}' on stack '${stackName}': ${(error as Error).message}`)
      throw error
    }
  }

  // Method to get the outputs from a stack
  async getStackOutputs(stackIdOrName: string): Promise<void> {
    try {
      // Run the spacectl command with --output json flag
      const { stdout, stderr } = await this.runCommand(stackIdOrName, `outputs --output json`)

      // If there's an error in stderr, log and throw it
      if (stderr) {
        core.error(`Error getting stack outputs: ${stderr}`)
        throw new Error(stderr)
      }

      // Parse the JSON output
      const outputs = JSON.parse(stdout)

      // Loop through the outputs and set each as a GitHub Actions output
      for (let [key, value] of Object.entries(outputs)) {
        // Remove any surrounding quotes from the value if present
        const cleanedValue = typeof value === 'string' ? value.replace(/^"|"$/g, '') : value
        core.setOutput(key, cleanedValue)
      }

      // Also set the entire JSON as an output, after removing unnecessary quotes
      core.setOutput(
        'outputs',
        JSON.stringify(outputs, (k, v) => (typeof v === 'string' ? v.replace(/^"|"$/g, '') : v)),
      )

      core.info(`Successfully set stack outputs in GitHub Actions: ${stdout}`)
    } catch (error) {
      core.setFailed(`Failed to get stack outputs: ${(error as Error).message}`)
      throw error
    }
  }
}

export default StackManager
