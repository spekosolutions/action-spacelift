import * as core from '@actions/core';
import { run } from './utils/run';
import { installAndGetFolder } from './commands/spacectl';

// Define the main function correctly
const main = async (): Promise<void> => {
  try {
    const binaryFolder = await installAndGetFolder();
    core.addPath(binaryFolder);
    core.info("Added spacectl to PATH: " + binaryFolder);

    await run({
      command: core.getInput('command', { required: true }),
      region: core.getInput('region', { required: true }),
      env: core.getInput('env', { required: true }),
      integration_name: core.getInput('integration_name', { required: true }),
      service_name: core.getInput('service_name', { required: true }),
      label_prefix: core.getInput('label_prefix', { required: true }),
      label_postfix: core.getInput('label_postfix', { required: true }),
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
