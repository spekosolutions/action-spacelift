import { main } from '../src/main';
import * as core from '@actions/core';
import Config from '../src/utils/config/config';
import { installSpaceliftAndGetFolder } from '../src/commands/spacectl';
import { installTerraformAndGetFolder } from '../src/commands/terraform';
import { run } from '../src/utils/run';

jest.mock('@actions/core');
jest.mock('../src/utils/config/config');
jest.mock('../src/commands/spacectl');
jest.mock('../src/commands/terraform');
jest.mock('../src/utils/run');

describe('Main Action', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let mockConfig: jest.Mocked<Config>;

  beforeEach(() => {
    jest.resetAllMocks();

    // Suppress console.error to avoid cluttering test output
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Mock Config instance
    mockConfig = {
      command: 'test-command',
      region: 'test-region',
      zone: 'test-zone',
      env: 'test-env',
      serviceName: 'test-service',
      labelPrefix: 'test-label-prefix',
      labelSuffix: 'test-label-suffix',
      spaceliftModuleToken: 'test-token',
      envContext: 'test-context',
      envVars: { key: 'value' },
      githubSha: 'test-sha',
    } as unknown as jest.Mocked<Config>;

    (Config.getInstance as jest.Mock).mockReturnValue(mockConfig);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('main runs successfully', async () => {
    (installSpaceliftAndGetFolder as jest.Mock).mockResolvedValue('/mocked/spacectl/folder');
    (installTerraformAndGetFolder as jest.Mock).mockResolvedValue('/mocked/terraform/folder');

    await expect(main()).resolves.toBeUndefined();

    expect(core.addPath).toHaveBeenCalledWith('/mocked/spacectl/folder');
    expect(core.addPath).toHaveBeenCalledWith('/mocked/terraform/folder');

    expect(core.info).toHaveBeenCalledWith('Added spacectl to PATH: /mocked/spacectl/folder');
    expect(core.info).toHaveBeenCalledWith('Added terraform to PATH: /mocked/terraform/folder');

    expect(core.info).toHaveBeenCalledWith(`Running command: ${mockConfig.command}`);
    expect(core.info).toHaveBeenCalledWith(`Region: ${mockConfig.region}`);
    expect(core.info).toHaveBeenCalledWith(`Zone: ${mockConfig.zone}`);
    expect(core.info).toHaveBeenCalledWith(`Environment: ${mockConfig.env}`);
    expect(core.info).toHaveBeenCalledWith(`Service Name: ${mockConfig.serviceName}`);
    expect(core.info).toHaveBeenCalledWith(`Label Prefix: ${mockConfig.labelPrefix}`);
    expect(core.info).toHaveBeenCalledWith(`Label Suffix: ${mockConfig.labelSuffix}`);
    expect(core.info).toHaveBeenCalledWith(`Spacelift Module Token: ${mockConfig.spaceliftModuleToken}`);
    expect(core.info).toHaveBeenCalledWith(`Environment Context: ${mockConfig.envContext}`);
    expect(core.info).toHaveBeenCalledWith(`Parsed Environment Variables: ${JSON.stringify(mockConfig.envVars)}`);

    expect(run).toHaveBeenCalled();
  });

  test('main fails if installSpaceliftAndGetFolder throws an error', async () => {
    (installSpaceliftAndGetFolder as jest.Mock).mockRejectedValue(new Error('Failed to install spacectl'));

    await main();

    expect(core.setFailed).toHaveBeenCalledWith('Failed to install spacectl');
  });

  test('main logs error if installTerraformAndGetFolder throws an error', async () => {
    (installSpaceliftAndGetFolder as jest.Mock).mockResolvedValue('/mocked/spacectl/folder');
    (installTerraformAndGetFolder as jest.Mock).mockRejectedValue(new Error('Failed to install terraform'));

    await expect(main()).resolves.toBeUndefined();

    expect(core.addPath).toHaveBeenCalledWith('/mocked/spacectl/folder');
    expect(core.error).toHaveBeenCalledWith('Failed to install Terraform: Failed to install terraform');
  });
});
