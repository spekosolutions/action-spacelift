import * as core from '@actions/core';
import { run } from './utils/run';
import { installSpaceliftAndGetFolder } from './commands/spacectl';
import { installTerraformAndGetFolder } from './commands/terraform';
import Config from './utils/config/config';

const main = async (): Promise<void> => {
  try {
    // Initialize configuration
    const config = Config.getInstance();

    // Install Spacelift CLI and add to PATH
    const binarySpaceliftFolder = await installSpaceliftAndGetFolder();
    core.addPath(binarySpaceliftFolder);
    core.info(`Added spacectl to PATH: ${binarySpaceliftFolder}`);

    // Install Terraform CLI and add to PATH
    (async () => {
      try {
        const binaryTerraformFolder = await installTerraformAndGetFolder();
        core.addPath(binaryTerraformFolder);
        core.info(`Added terraform to PATH: ${binaryTerraformFolder}`);
      } catch (error) {
        core.error(`Failed to install Terraform: ${(error as Error).message}`);
      }
    })();

    // Use the Config instance to retrieve settings
    core.info(`Running command: ${config.command}`);
    core.info(`Region: ${config.region}`);
    core.info(`Zone: ${config.zone}`);
    core.info(`Environment: ${config.env}`);
    core.info(`Service Name: ${config.serviceName}`);
    core.info(`Label Prefix: ${config.labelPrefix}`);
    core.info(`Label Suffix: ${config.labelSuffix}`);
    core.info(`Spacelift Module Token: ${config.spaceliftModuleToken}`);
    core.info(`Environment Context: ${config.envContext}`);
    core.info(`Parsed Environment Variables: ${JSON.stringify(config.envVars)}`);
    core.info(`Stack path: ${config.stackPath}`);

    // Pass configuration to the run function
    await run();
  } catch (e) {
    core.setFailed((e as Error).message);
    console.error(e);
  }
};

// Export the main function for testing purposes
export { main };

// Ensure proper handling of errors in the async context
main().catch((e: Error) => {
  core.setFailed(e.message);
  console.error(e);
});
