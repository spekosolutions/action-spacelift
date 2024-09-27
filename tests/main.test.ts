import { main } from '../src/main.js';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { installAndGetFolder } from '../src/commands/spacectl';

type InputKeys = 'command' | 'region' | 'env' | 'integration_name' | 'service_name' | 'label_prefix' | 'label_postfix' | 'github-token';

jest.mock('@actions/core');
jest.mock('@actions/github');
jest.mock('../src/commands/spacectl');

describe('Main Action', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();
    // Suppress console.error to avoid cluttering test output
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original console.error after each test
    consoleErrorSpy.mockRestore();
  });

  test('main runs successfully', async () => {
    jest.spyOn(core, 'getInput')
      .mockImplementation((name: string) => {
        const inputs: Record<InputKeys, string> = {
          command: 'foo',
          region: 'foo',
          env: 'foo',
          integration_name: 'foo',
          service_name: 'foo',
          label_prefix: 'foo',
          label_postfix: 'foo',
          'github-token': 'test-token',
        };
        return inputs[name as InputKeys];
      });

    const mockOctokit = {
      rest: {
        repos: {
          listReleases: jest.fn().mockResolvedValue({
            data: [
              {
                tag_name: 'v1.0.0',
                draft: false,
                prerelease: false,
              },
            ],
          }),
        },
      },
    };
    (github.getOctokit as jest.Mock).mockReturnValue(mockOctokit);

    (installAndGetFolder as jest.Mock).mockResolvedValue('/mocked/spacectl/folder');

    await expect(main()).resolves.toBeUndefined();

    expect(core.addPath).toHaveBeenCalledWith('/mocked/spacectl/folder');
  });

  test('main fails if installAndGetFolder throws an error', async () => {
    jest.spyOn(core, 'getInput').mockReturnValue('foo');

    (installAndGetFolder as jest.Mock).mockRejectedValue(new Error('Failed to install spacectl'));

    await main();

    expect(core.setFailed).toHaveBeenCalledWith('Failed to install spacectl');
  });
});
