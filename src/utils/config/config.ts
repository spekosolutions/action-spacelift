import * as core from '@actions/core';

class Config {
  private static instance: Config;

  public readonly awsAccountId: string;
  public readonly command: string;
  public readonly env: string;
  public readonly envContext: string;
  public readonly envVars: Record<string, any>;
  public readonly githubSha: string;
  public readonly integrationName: string;
  public readonly labelPrefix: string;
  public readonly labelSuffix: string;
  public readonly region: string;
  public readonly serviceName: string;
  public readonly spaceliftModuleToken: string;
  public readonly stack_bucket_key: string;
  public readonly stack_bucket: string;
  public readonly stack_dynamodb_table: string;
  public readonly stack_encrypt: boolean;
  public readonly stack_kms_key_id: string;
  public readonly stackName: string;
  public readonly stackPath: string;
  public readonly zone: string;
  public parentSpaceId?: string;

  private constructor() {
    // Initialize settings from environment variables or inputs
    this.awsAccountId = process.env.AWS_ACCOUNT_ID!;
    this.command = core.getInput('command', { required: true });
    this.region = core.getInput('region', { required: true });
    this.zone = core.getInput('zone', { required: true });
    this.env = core.getInput('env', { required: true });
    this.integrationName = core.getInput('integration_name', { required: true });
    this.serviceName = core.getInput('service_name', { required: true });
    this.labelPrefix = core.getInput('label_prefix', { required: false }) || 'aws:services';
    this.labelSuffix = core.getInput('label_suffix', { required: true });
    this.spaceliftModuleToken = core.getInput('spacelift_module_token', { required: true });
    this.envContext = core.getInput('env_context', { required: true });
    this.githubSha = process.env.GITHUB_SHA || '';
    this.stackName = `${this.labelSuffix}-${this.serviceName}-${this.env}-${this.zone}`;
    this.stackPath = `./deployment/${this.labelSuffix}/stack`;
    this.stack_bucket = `spacelift-stacks-${this.region}-${this.awsAccountId}`
    this.stack_bucket_key = `${this.env}/${this.zone}/${this.serviceName}/${this.labelSuffix}/terraform.tfstate`
    this.stack_dynamodb_table = `spacelift-stacks-${this.region}-${this.awsAccountId}`
    this.stack_encrypt = true
    this.stack_kms_key_id = "alias/aws/s3"

    // Parse raw environment variables JSON
    const rawEnvVars = core.getInput('env_vars', { required: false }) || '{}';
    this.envVars = this.parseEnvVars(rawEnvVars);
  }

  private parseEnvVars(rawEnvVars: string): Record<string, any> {
    try {
      const parsedEnvVars = JSON.parse(rawEnvVars.trim());
      return {
        ...parsedEnvVars,
        env: this.env,
        region: this.region,
        provider_region: this.region,
        zone: this.zone,
      };
    } catch (error) {
      core.setFailed(`Failed to parse env_vars JSON: ${(error as Error).message}`);
      throw error;
    }
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  public setParentSpaceId(id: string): void {
    this.parentSpaceId = id;
  }

  public getStackName(): string {
    return `${this.labelSuffix}-${this.serviceName}-${this.env}-${this.zone}`;
  }

  public getStackVars(): string {
    if (!this.parentSpaceId) {
      throw new Error('Parent Space ID is not set. Ensure manageSpace has been executed.');
    }
    return `-var 'parent_space_id=${this.parentSpaceId}' -var 'application=${this.serviceName}' -var 'env=${this.env}' -var 'zone=${this.zone}' -var 'region=${this.region}' -var 'env_context=${this.envContext}'`;
  }
}

export default Config;
