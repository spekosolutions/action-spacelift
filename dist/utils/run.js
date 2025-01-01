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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = void 0;
const core = __importStar(require("@actions/core"));
const spaceManager_1 = __importDefault(require("./graphql/spaces/spaceManager"));
const stackManager_1 = __importDefault(require("./graphql/stacks/stackManager"));
const cliManager_1 = __importDefault(require("./terraform/cli/cliManager"));
const stackManager_2 = __importDefault(require("./spacectl/stacks/stackManager"));
const graphqlStackManager = new stackManager_1.default();
const spacectlStackManager = new stackManager_2.default();
/**
 * Helper to parse environment variables from raw input
 */
const parseEnvVars = (rawEnvVars, inputs) => {
    try {
        const parsedRawEnvVars = JSON.parse(rawEnvVars.trim());
        return {
            ...parsedRawEnvVars,
            env: inputs.env,
            region: inputs.region,
            provider_region: inputs.region,
            zone: inputs.zone,
        };
    }
    catch (error) {
        core.setFailed(`Failed to parse env_vars JSON: ${error.message}`);
        throw error;
    }
};
/**
 * Create or manage spaces
 */
const manageSpace = async (inputs) => {
    const spaceManager = new spaceManager_1.default();
    try {
        const parentSpaceId = await spaceManager.createServiceSpace({
            ...inputs,
            label_postfix: '', // Exclude postfix for parent space
        });
        const spaceId = await spaceManager.createServiceSpace(inputs);
        return { spaceId, parentSpaceId };
    }
    catch (error) {
        core.error('Error creating service space:');
        throw error;
    }
};
/**
 * Create or manage stacks
 */
const manageStack = async (stackName, spaceId, inputs) => {
    try {
        const existingStack = await graphqlStackManager.getStackByName(stackName);
        if (!existingStack) {
            core.info(`Stack "${stackName}" does not exist. Creating a new stack...`);
            await graphqlStackManager.upsertStack(stackName, '', spaceId, inputs.service_name, inputs);
            core.info(`Stack "${stackName}" created successfully.`);
        }
        else {
            core.info(`Stack "${stackName}" already exists.`);
        }
    }
    catch (error) {
        core.error(`Error managing stack: ${error.message}`);
        throw error;
    }
};
/**
 * Execute Terraform commands with real-time log streaming
 */
const executeTerraformCommand = async (terraformCliManager, stackPath, command, backendConfigParams) => {
    try {
        core.info(`Executing Terraform command: ${command}`);
        await terraformCliManager.runCommandWithLogs(stackPath, command, backendConfigParams);
        core.info(`Terraform command executed successfully: ${command}`);
    }
    catch (error) {
        core.error(`Terraform command failed: ${error.message}`);
        throw error;
    }
};
/**
 * Execute Spacelift commands
 */
const executeSpaceliftCommand = async (stackName, command) => {
    try {
        core.info(`Executing Spacelift command: ${command}`);
        await spacectlStackManager.runCommand(stackName, command);
        core.info(`Spacelift command executed successfully: ${command}`);
    }
    catch (error) {
        core.error(`Spacelift command failed: ${error.message}`);
        throw error;
    }
};
/**
 * Main action logic
 */
const run = async (inputs) => {
    try {
        const { command, label_postfix, service_name, env, zone, region, rawEnvVars, spacelift_module_token, env_context } = inputs;
        const githubSha = process.env.GITHUB_SHA;
        if (!githubSha) {
            throw new Error('GITHUB_SHA environment variable is not set.');
        }
        const stackName = `${label_postfix}-${service_name}-${env}-${zone}`;
        core.info(`Using stack name: ${stackName}`);
        // Parse environment variables
        const envVars = parseEnvVars(rawEnvVars, inputs);
        core.info(`Parsed env_vars: ${JSON.stringify(envVars)}`);
        const terraformCliManager = new cliManager_1.default(spacelift_module_token);
        // Manage spaces before proceeding with any operations
        core.info('Creating or managing space...');
        const { spaceId, parentSpaceId } = await manageSpace(inputs);
        core.info(`Space created or managed with ID: ${spaceId}, Parent Space ID: ${parentSpaceId}`);
        const backendConfigParams = {
            region,
            awsAccountId: process.env.AWS_ACCOUNT_ID,
            environment: env,
            zone,
            serviceName: service_name,
            stackName,
        };
        const stackPath = `./deployment/${label_postfix}/stack`;
        const stackVars = `-var 'parent_space_id=${parentSpaceId}' -var 'application=${service_name}' -var 'env=${env}' -var 'zone=${zone}' -var 'region=${region}' -var 'env_context=${env_context}`;
        const existingStack = await graphqlStackManager.getStackByName(stackName);
        if (!existingStack) {
            await executeTerraformCommand(terraformCliManager, stackPath, `terraform init`, backendConfigParams);
            await executeTerraformCommand(terraformCliManager, stackPath, `terraform apply --auto-approve ${stackVars}'`, backendConfigParams);
        }
        // If command is Terraform-related, execute Terraform commands
        if (command.startsWith('terraform')) {
            await executeTerraformCommand(terraformCliManager, stackPath, `terraform init`, backendConfigParams);
            await executeTerraformCommand(terraformCliManager, stackPath, `${command} ${stackVars}'`, backendConfigParams);
            return; // Skip further operations for Terraform commands
        }
        else {
            // If command is Spacelift-related, execute Spacelift commands
            core.info('Running additional Spacelift commands on stack...');
            await executeSpaceliftCommand(stackName, command);
        }
    }
    catch (error) {
        core.setFailed(`Action failed with error: ${error.message || error}`);
    }
};
exports.run = run;
