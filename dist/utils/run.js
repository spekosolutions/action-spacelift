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
const contextManager_1 = __importDefault(require("./graphql/contexts/contextManager"));
const spaceManager_1 = __importDefault(require("./graphql/spaces/spaceManager"));
const stackManager_1 = __importDefault(require("./graphql/stacks/stackManager"));
const stackManager_2 = __importDefault(require("./spacectl/stacks/stackManager"));
const cliManager_1 = __importDefault(require("./terraform/cli/cliManager"));
const graphqlStackManager = new stackManager_1.default();
const generateUniqueTag = () => {
    return Math.random().toString(36).substring(7);
};
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
const manageSpace = async (inputs) => {
    const spaceManager = new spaceManager_1.default();
    try {
        return await spaceManager.createServiceSpace(inputs);
    }
    catch (error) {
        core.error('Error creating service space:');
        throw error;
    }
};
const manageContext = async (spaceId, envVars, inputs) => {
    const contextManager = new contextManager_1.default();
    try {
        const contextResult = await contextManager.createOrUpdateContext(spaceId, envVars, inputs);
        core.info(`Context result: ${JSON.stringify(contextResult)}`);
        return contextResult.contextName;
    }
    catch (error) {
        core.error(`Failed to manage context: ${error.message}`);
        throw error;
    }
};
const manageStack = async (stackName, contextName, spaceId, integration_name, inputs) => {
    try {
        await graphqlStackManager.upsertStack(stackName, contextName, spaceId, integration_name, inputs);
        core.info(`Stack "${stackName}" was successfully upserted.`);
    }
    catch (error) {
        core.error(`Failed to upsert stack: ${error.message}`);
        throw error;
    }
};
const runCommandsOnStack = async (stackName, githubSha, command, existingStack) => {
    const spacectlStackManager = new stackManager_2.default();
    if (!existingStack) {
        const deployCommand = `deploy --sha ${githubSha} --auto-confirm --tail`;
        await spacectlStackManager.runCommand(stackName, deployCommand);
        core.info(`First time run...sent command deploy --sha ${githubSha} to "${stackName}".`);
    }
    await spacectlStackManager.runCommand(stackName, command);
    core.info(`Command "${command}" ran successfully on stack "${stackName}".`);
    const outputs = await spacectlStackManager.getStackOutputs(stackName);
    core.info(`Stack outputs: ${JSON.stringify(outputs)}`);
};
const shouldUpdateStack = (command) => {
    const nonUpdatingCommands = [
        'outputs',
        'resources',
        'dependencies',
        'show',
        'discard',
        'preview'
    ];
    return !nonUpdatingCommands.includes(command);
};
const isDeploymentCommand = (command) => {
    return ['approve', 'deploy'].includes(command);
};
const isPreviewCommand = (command) => {
    return command === 'preview';
};
const run = async (inputs) => {
    try {
        const { command, label_postfix, service_name, env, integration_name, zone, region, rawEnvVars, spacelift_module_token } = inputs;
        const githubSha = process.env.GITHUB_SHA;
        if (!githubSha) {
            throw new Error('GITHUB_SHA environment variable is not set.');
        }
        const stackName = `${label_postfix}-${service_name}-${env}-${zone}`;
        core.info(`Using stack name: ${stackName}`);
        const envVars = parseEnvVars(rawEnvVars, inputs);
        core.info(`Parsed env_vars: ${JSON.stringify(envVars)}`);
        const existingStack = await graphqlStackManager.getStackByName(stackName);
        const terraformCliManager = new cliManager_1.default(spacelift_module_token);
        await terraformCliManager.runCommand(stackName, "terraform init");
        if (existingStack) {
            await graphqlStackManager.waitForStackRunsToFinish(stackName);
            await graphqlStackManager.waitForStackToBeReady(stackName);
        }
        else {
            core.info(`Stack "${stackName}" does not exist. Proceeding to create a new stack.`);
        }
        let spaceId = '';
        let contextName = '';
        if (shouldUpdateStack(command)) {
            spaceId = await manageSpace(inputs);
            contextName = await manageContext(spaceId, envVars, inputs);
        }
        if (!existingStack) {
            const deployCommand = `deploy --sha ${githubSha} --auto-confirm --tail`;
            await runCommandsOnStack(stackName, githubSha, deployCommand, existingStack);
        }
        if (isDeploymentCommand(command)) {
            await manageStack(stackName, contextName, spaceId, integration_name, inputs);
        }
        if (isPreviewCommand(command) && existingStack) {
            core.info(`Running preview command for stack: ${stackName}`);
            await runCommandsOnStack(stackName, githubSha, command, existingStack);
        }
        else if (!isPreviewCommand(command)) {
            await runCommandsOnStack(stackName, githubSha, command, existingStack);
        }
    }
    catch (error) {
        core.setFailed(`Action failed with error: ${error.message || error}`);
    }
};
exports.run = run;
