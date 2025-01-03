"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
class Config {
    constructor(apiKeyEndpoint) {
        // Initialize settings from environment variables or inputs
        this.awsAccountId = process.env.AWS_ACCOUNT_ID;
        this.command = core.getInput('command', { required: true });
        this.region = core.getInput('region', { required: true });
        this.zone = core.getInput('zone', { required: true });
        this.env = core.getInput('env', { required: true });
        this.serviceName = core.getInput('service_name', { required: true });
        this.labelPrefix = core.getInput('label_prefix', { required: false }) || 'aws:services';
        this.labelSuffix = core.getInput('label_suffix', { required: true });
        this.spaceliftModuleToken = core.getInput('spacelift_module_token', { required: true });
        this.envContext = core.getInput('env_context', { required: true });
        this.githubSha = process.env.GITHUB_SHA || '';
        this.stackName = `${this.labelSuffix}-${this.serviceName}-${this.env}-${this.zone}`;
        this.deploymentPath = core.getInput('deployment_path', { required: true });
        this.stackPath = `${this.deploymentPath}/${this.labelSuffix}/stack`;
        this.stack_bucket = `spacelift-stacks-${this.region}-${this.awsAccountId}`;
        this.stack_bucket_key = `${this.env}/${this.zone}/${this.serviceName}/${this.labelSuffix}/terraform.tfstate`;
        this.stack_dynamodb_table = `spacelift-stacks-${this.region}-${this.awsAccountId}`;
        this.stack_encrypt = true;
        this.stack_kms_key_id = "alias/aws/s3";
        this.actionsIdTokenRequestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL || '';
        this.actionsIdTokenRequestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN || '';
        // Use the apiKeyEndpoint parameter if provided, otherwise fallback to the environment variable
        this.spaceliftApiKeyEndpoint = apiKeyEndpoint && apiKeyEndpoint.trim() !== ''
            ? apiKeyEndpoint
            : process.env.SPACELIFT_API_KEY_ENDPOINT || '';
        this.apiKeyId = process.env.SPACELIFT_KEY_ID || '';
        // Parse raw environment variables JSON
        const rawEnvVars = core.getInput('env_vars', { required: false }) || '{}';
        this.envVars = this.parseEnvVars(rawEnvVars);
    }
    parseEnvVars(rawEnvVars) {
        try {
            const parsedEnvVars = JSON.parse(rawEnvVars.trim());
            return {
                ...parsedEnvVars,
                env: this.env,
                region: this.region,
                provider_region: this.region,
                zone: this.zone,
            };
        }
        catch (error) {
            core.setFailed(`Failed to parse env_vars JSON: ${error.message}`);
            throw error;
        }
    }
    static getInstance() {
        if (!Config.instance) {
            Config.instance = new Config();
        }
        return Config.instance;
    }
    setParentSpaceId(id) {
        this.parentSpaceId = id;
    }
    getStackName() {
        return `${this.labelSuffix}-${this.serviceName}-${this.env}-${this.zone}`;
    }
    getStackVars() {
        if (!this.parentSpaceId) {
            throw new Error('Parent Space ID is not set. Ensure manageSpace has been executed.');
        }
        return `-var 'parent_space_id=${this.parentSpaceId}' -var 'env=${this.env}' -var 'zone=${this.zone}' -var 'region=${this.region}' -var 'env_context=${this.envContext}'`;
    }
}
exports.default = Config;
