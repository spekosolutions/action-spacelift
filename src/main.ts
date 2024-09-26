import * as core from '@actions/core';
import { run } from './utils/run';  // Correct ES module syntax
import { installAndGetFolder } from './commands/spacectl';

// Define the main function correctly
const main = async (): Promise<void> => {
  try {
    // Use `await` for async calls without 'import'
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

// Ensure proper handling of errors in the async context
main().catch((e: Error) => {
  core.setFailed(e.message);
  console.error(e);
});
