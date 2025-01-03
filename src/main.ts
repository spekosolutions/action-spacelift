import * as core from '@actions/core';
import { run } from './utils/run';
import { installSpaceliftAndGetFolder } from './commands/spacectl';
import { installTerraformAndGetFolder } from './commands/terraform';

// Define the main function correctly
const main = async (): Promise<void> => {
  try {
    const binarySpaceliftFolder = await installSpaceliftAndGetFolder();

    (async () => {
      try {
        const binaryTerraformFolder = await installTerraformAndGetFolder();
        console.log(`Terraform installed at ${binaryTerraformFolder}`);
        core.addPath(binaryTerraformFolder);
        core.info("Added terraform to PATH: " + binaryTerraformFolder);
      } catch (error) {
        console.error(`Failed to install Terraform: ${(error as Error).message}`);
      }
    })();

    core.addPath(binarySpaceliftFolder);
    core.info("Added spacectl to PATH: " + binarySpaceliftFolder);

    // Set environment variables from inputs
    process.env.COMMAND = core.getInput('command', { required: true });
    process.env.REGION = core.getInput('region', { required: true });
    process.env.ZONE = core.getInput('zone', { required: true });
    process.env.ENV = core.getInput('env', { required: true });
    process.env.INTEGRATION_NAME = core.getInput('integration_name', { required: true });
    process.env.SERVICE_NAME = core.getInput('service_name', { required: true });
    process.env.LABEL_PREFIX = core.getInput('label_prefix', { required: false });
    process.env.LABEL_SUFFIX = core.getInput('label_suffix', { required: true });
    process.env.ENV_VARS = core.getInput('env_vars', { required: false });
    process.env.SPACELIFT_MODULE_TOKEN = core.getInput('spacelift_module_token', { required: true });
    process.env.ENV_CONTEXT = core.getInput('env_context', { required: true });

    // Pass inputs to the run function
    await run();
  } catch (e) {
    core.setFailed((e as Error).message);
    console.error(e);
  }
};

// Export the main function so it can be imported in test files
export { main };

// Ensure proper handling of errors in the async context
main().catch((e: Error) => {
  core.setFailed(e.message);
  console.error(e);
});
