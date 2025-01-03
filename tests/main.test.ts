import { main } from '../src/main';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { installSpaceliftAndGetFolder } from '../src/commands/spacectl';
import { installTerraformAndGetFolder } from '../src/commands/terraform';
import Config from '../src/utils/config/config';
import AuthorizationManager from '../src/utils/authorization/authorizationManager';

jest.mock('@actions/core');
jest.mock('@actions/github');
jest.mock('../src/commands/spacectl');
jest.mock('../src/commands/terraform');
jest.mock('../src/utils/config/config');

// Mock AuthorizationManager completely
jest.mock('../src/utils/authorization/authorizationManager', () => {
  return jest.fn().mockImplementation(() => ({
    ensureValidOidcToken: jest.fn().mockResolvedValue(undefined),
    ensureValidBearerToken: jest.fn().mockResolvedValue(undefined),
    oidcTokenAsync: Promise.resolve('mock-oidc-token'),
    bearerTokenAsync: Promise.resolve('mock-bearer-token'),
  }));
});

describe('Main Action', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    jest.spyOn(core, 'getInput').mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        command: 'apply',
        region: 'us-east-1',
        zone: 'zone1',
        env: 'dev',
        integration_name: 'integration',
        service_name: 'test-service',
        label_prefix: 'prefix',
        label_postfix: 'postfix',
        'github-token': 'mocked-token',
        env_vars: '{}',
      };
      return inputs[name] || '';
    });

    process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN = 'mock-token';
    process.env.ACTIONS_ID_TOKEN_REQUEST_URL = 'https://mock-token-url';
    process.env.SPACELIFT_API_KEY_ENDPOINT = 'mock-endpoint';
    process.env.SPACELIFT_KEY_ID = 'mock-key-id';

    (github.getOctokit as jest.Mock).mockReturnValue({
      rest: {
        repos: {
          listReleases: jest.fn().mockResolvedValue({
            data: [
              { tag_name: 'v1.0.0', draft: false, prerelease: false },
            ],
          }),
        },
      },
    });

    (installSpaceliftAndGetFolder as jest.Mock).mockResolvedValue('/mocked/spacectl/folder');
    (installTerraformAndGetFolder as jest.Mock).mockResolvedValue('/mocked/terraform/folder');
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('main runs successfully', async () => {
    await expect(main()).resolves.toBeUndefined();

    expect(core.addPath).toHaveBeenCalledWith('/mocked/spacectl/folder');
    expect(core.addPath).toHaveBeenCalledWith('/mocked/terraform/folder');
    expect(core.info).toHaveBeenCalledWith('Added spacectl to PATH: /mocked/spacectl/folder');
    expect(core.info).toHaveBeenCalledWith('Added terraform to PATH: /mocked/terraform/folder');
  });

  test('main fails if installSpaceliftAndGetFolder throws an error', async () => {
    (installSpaceliftAndGetFolder as jest.Mock).mockRejectedValue(new Error('Failed to install spacectl'));

    await main();

    expect(core.setFailed).toHaveBeenCalledWith('Failed to install spacectl');
  });
});
