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
const terraformCliManager = new cliManager_1.default();
/**
 * Helper to parse environment variables from raw input
 */
const parseEnvVars = (rawEnvVars) => {
    try {
        const parsedRawEnvVars = JSON.parse(rawEnvVars.trim());
        return {
            ...parsedRawEnvVars,
            env: process.env.ENV,
            region: process.env.REGION,
            provider_region: process.env.REGION,
            zone: process.env.ZONE,
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
        // !! We changed to use terraform for creating stacks, so we don't need to create a space here
        // const spaceId = await spaceManager.createServiceSpace(process.env as Record<string, string>);
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
const manageStack = async (stackName) => {
    try {
        const stateExists = await terraformCliManager.checkTerraformStateExists();
        const stackVars = `-var 'parent_space_id=${process.env.PARENT_SPACE_ID}' -var 'application=${process.env.SERVICE_NAME}' -var 'env=${process.env.ENV}' -var 'zone=${process.env.ZONE}' -var 'region=${process.env.REGION}' -var 'env_context=${process.env.ENV_CONTEXT}`;
        if (!stateExists) {
            core.info(`State for stack "${stackName}" does not exist. Initializing and applying Terraform...`);
            await terraformCliManager.runCommandWithLogs(`terraform apply --auto-approve ${stackVars}`);
            core.info(`Stack "${stackName}" created successfully.`);
            core.info(`Running first time deployment on stack..."${stackName}"`);
            await spacectlStackManager.runCommand(stackName, `deploy --tail --auto-confirm`);
        }
        else {
            core.info(`State for stack "${stackName}" already exists.`);
            core.info('Running additional Spacelift commands on stack...');
            if (process.env.COMMAND.startsWith('terraform')) {
                await terraformCliManager.runCommandWithLogs(process.env.COMMAND);
            }
            else {
                // !! Change this in the future - mayeb a switch, or make user pass in full spacectl command prefix (spacectl)
                await spacectlStackManager.runCommand(stackName, `deploy --tail --auto-confirm`);
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
        const githubSha = process.env.GITHUB_SHA;
        if (!githubSha) {
            throw new Error('GITHUB_SHA environment variable is not set.');
        }
        const stackName = `${process.env.LABEL_SUFFIX}-${process.env.SERVICE_NAME}-${process.env.ENV}-${process.env.ZONE}`;
        core.info(`Using stack name: ${stackName}`);
        // Parse environment variables
        const envVars = parseEnvVars(process.env.ENV_VARS || '{}');
        core.info(`Parsed env_vars: ${JSON.stringify(envVars)}`);
        // Manage spaces before proceeding with any operations
        core.info('Creating or managing space...');
        await manageSpace();
        // Manage stacks based on Terraform state
        await manageStack(stackName);
    }
    catch (error) {
        core.setFailed(`Action failed with error: ${error.message || error}`);
    }
};
exports.run = run;
