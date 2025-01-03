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
const config_1 = __importDefault(require("./config/config"));
// Initialize Config globally
const config = config_1.default.getInstance();
const graphqlStackManager = new stackManager_1.default();
const spacectlStackManager = new stackManager_2.default();
const terraformCliManager = new cliManager_1.default();
/**
 * Helper to parse environment variables from raw input
 */
const parseEnvVars = () => {
    try {
        return {
            ...config.envVars,
            env: config.env,
            region: config.region,
            provider_region: config.region,
            zone: config.zone,
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
const manageSpace = async () => {
    const spaceManager = new spaceManager_1.default();
    try {
        const parentSpaceId = await spaceManager.createServiceSpace();
        core.info(`Using Parent Space with ID: ${parentSpaceId}`);
        return { parentSpaceId };
    }
    catch (error) {
        core.error('Error creating service space:');
        throw error;
    }
};
/**
 * Create or manage stacks based on Terraform state
 */
/**
 * Create or manage stacks based on Terraform state
 */
const manageStack = async () => {
    try {
        await terraformCliManager.initialize(); // Explicit initialization
        const stateExists = await terraformCliManager.checkTerraformStateExists();
        const stackVars = `-var 'parent_space_id=${config.parentSpaceId}' -var 'application=${config.serviceName}' -var 'env=${config.env}' -var 'zone=${config.zone}' -var 'region=${config.region}' -var 'env_context=${config.envContext}'`;
        if (!stateExists) {
            core.info(`State for stack "${config.stackName}" does not exist. Initializing and applying Terraform...`);
            await terraformCliManager.runCommandWithLogs(`terraform apply --auto-approve ${stackVars}`);
            core.info(`Stack "${config.stackName}" created successfully.`);
            core.info(`Running first-time deployment on stack "${config.stackName}"`);
            await spacectlStackManager.runCommand(config.stackName, `deploy --tail --auto-confirm`);
        }
        else {
            core.info(`State for stack "${config.stackName}" already exists.`);
            core.info('Running additional Spacelift commands on stack...');
            if (config.command.startsWith('terraform')) {
                await terraformCliManager.runCommandWithLogs(config.command);
            }
            else {
                await spacectlStackManager.runCommand(config.stackName, `deploy --tail --auto-confirm`);
            }
        }
    }
    catch (error) {
        core.error(`Error managing stack: ${error.message}`);
        throw error;
    }
};
/**
 * Main action logic
 */
const run = async () => {
    try {
        const githubSha = config.githubSha;
        if (!githubSha) {
            throw new Error('GITHUB_SHA environment variable is not set.');
        }
        core.info(`Using stack name: ${config.stackName}`);
        // Parse environment variables
        const envVars = parseEnvVars();
        core.info(`Parsed env_vars: ${JSON.stringify(envVars)}`);
        // Manage spaces before proceeding with any operations
        core.info('Creating or managing space...');
        await manageSpace();
        // Manage stacks based on Terraform state
        await manageStack();
    }
    catch (error) {
        core.setFailed(`Action failed with error: ${error.message || error}`);
    }
};
exports.run = run;
