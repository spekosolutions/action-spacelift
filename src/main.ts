import * as core from '@actions/core';
import { run } from './utils/run';
import { installSpaceliftAndGetFolder } from './commands/spacectl';
import { installTerraformAndGetFolder } from './commands/terraform';

// Define the main function correctly
const main = async (): Promise<void> => {
  try {
    const binarySpaceliftFolder = await installSpaceliftAndGetFolder();
    const binaryTerraformFolder = await installTerraformAndGetFolder();

    core.addPath(binarySpaceliftFolder);
    core.info("Added spacectl to PATH: " + binarySpaceliftFolder);

    core.addPath(binaryTerraformFolder);
    core.info("Added terraform to PATH: " + binaryTerraformFolder);
    
    await run({
      command: core.getInput('command', { required: true }),
      region: core.getInput('region', { required: true }),
      zone: core.getInput('zone', { required: true }),
      env: core.getInput('env', { required: true }),
      integration_name: core.getInput('integration_name', { required: true }),
      service_name: core.getInput('service_name', { required: true }),
      label_prefix: core.getInput('label_prefix', { required: true }),
      label_postfix: core.getInput('label_postfix', { required: true }),
      rawEnvVars: core.getInput('env_vars', { required: false }),
    });
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
