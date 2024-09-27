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
// Helper to generate a unique tag for the stack
const generateUniqueTag = () => {
    return Math.random().toString(36).substring(7);
};
const run = async (inputs) => {
    try {
        // Destructure the necessary fields from inputs
        const { command, label_postfix, service_name, env, integration_name, region } = inputs;
        // Construct stack name from inputs
        const stackName = `${label_postfix}-${service_name}-${env}-${region}`;
        core.info(`Using stack name: ${stackName}`);
        // Generate a unique tag
        const uniqueTag = generateUniqueTag();
        core.info(`Generated unique tag: ${uniqueTag}`);
        // Declare the spaceId variable to be used later
        let spaceId;
        // Create service space and upsert the stack
        const spaceManager = new spaceManager_1.default();
        try {
            spaceId = await spaceManager.createServiceSpace(inputs);
        }
        catch (error) {
            console.error('Error creating service space:', error);
            throw error;
        }
        try {
            // Initialize the ContextManager with required values
            const contextManager = new contextManager_1.default();
            // Call createOrUpdateContext without passing yamlFilePath or contextName
            const result = await contextManager.createOrUpdateContext(spaceId, inputs);
            console.log('Context result:', result);
        }
        catch (error) {
            console.error(`Failed to manage context: ${error.message}`);
        }
        try {
            // Initialize the StackManager with the Spacelift URL and bearer token
            const graphqlStackManager = new stackManager_1.default();
            // Call the upsertStack method to create or update the stack
            await graphqlStackManager.upsertStack(stackName, spaceId, integration_name, inputs);
            console.log(`Stack "${stackName}" was successfully upserted.`);
        }
        catch (error) {
            console.error(`Failed to upsert stack: ${error.message}`);
        }
        // Run command on stack
        try {
            const spacectlStackManager = new stackManager_2.default();
            await spacectlStackManager.runCommand(stackName, command);
            await spacectlStackManager.getStackOutputs(stackName);
        }
        catch (error) {
            core.setFailed(`An error occurred: ${error.message}`);
            console.error(error);
        }
    }
    catch (error) {
        core.setFailed(`Action failed with error: ${error.message || error}`);
    }
};
exports.run = run;
