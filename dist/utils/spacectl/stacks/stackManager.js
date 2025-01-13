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
const spacectlManager_1 = __importDefault(require("../spacectlManager"));
const core = __importStar(require("@actions/core"));
const child_process_1 = require("child_process");
const util_1 = __importDefault(require("util"));
// Promisify exec to use async/await
const execAsync = util_1.default.promisify(child_process_1.exec);
// Child class extending SpaceliftManager to handle stack operations
class StackManager extends spacectlManager_1.default {
    constructor() {
        super();
    }
    // Method to run a command on a specific stack
    async runCommand(stackName, command) {
        try {
            core.info(`Running command '${command}' on stack '${stackName}'...`);
            core.info('Setting env vars from runCommand');
            await this.setEnvironmentVariables();
            // Ensure the spaceliftUrl and tokens are passed if needed in the command
            const commandToRun = `spacectl stack ${command} --id ${stackName}`;
            // Use child process exec to run the command and capture output
            const { stdout, stderr } = await execAsync(commandToRun);
            return { stdout, stderr };
        }
        catch (error) {
            core.setFailed(`Failed to execute command '${command}' on stack '${stackName}': ${error.message}`);
            throw error;
        }
    }
    async getStackOutputs(stackIdOrName) {
        try {
            // Run the spacectl command
            const { stdout, stderr } = await this.runCommand(stackIdOrName, `outputs --output json`);
            if (stderr) {
                core.error(`Error getting stack outputs: ${stderr}`);
                throw new Error(stderr);
            }
            // Parse the JSON output
            const outputs = JSON.parse(stdout);
            // Sanitize the outputs
            const sanitizedOutputs = outputs.map((output) => {
                if (typeof output.value === 'string') {
                    try {
                        // Parse JSON-like strings into objects, if valid
                        output.value = JSON.parse(output.value);
                    }
                    catch {
                        // Remove extraneous quotes if not a JSON-like string
                        output.value = output.value.replace(/^"|"$/g, '');
                    }
                }
                return output;
            });
            // Set each sanitized output as a GitHub Action output
            for (const output of sanitizedOutputs) {
                core.setOutput(output.id, JSON.stringify(output.value));
            }
            // Set the entire sanitized outputs as JSON
            core.setOutput('outputs', JSON.stringify(sanitizedOutputs));
            core.info(`Successfully set sanitized stack outputs: ${JSON.stringify(sanitizedOutputs)}`);
        }
        catch (error) {
            core.setFailed(`Failed to get stack outputs: ${error.message}`);
            throw error;
        }
    }
    // Method to check if a stack exists
    async doesStackExist(stackIdOrName) {
        try {
            core.info(`Checking if stack '${stackIdOrName}' exists...`);
            // Run the spacectl command to list stacks and filter by stack ID
            const commandToRun = `spacectl stack list --search ${stackIdOrName} --output json`;
            core.info(`Executing command: ${commandToRun}`);
            const { stdout } = await execAsync(commandToRun);
            // Log raw output for debugging
            core.info(`Raw command output: ${stdout}`);
            // Parse the JSON output to check if the stack exists
            const stacks = JSON.parse(stdout);
            core.info(`Parsed stacks: ${JSON.stringify(stacks)}`);
            if (stacks.length > 0) {
                core.info(`Stack '${stackIdOrName}' exists.`);
                return true;
            }
            else {
                core.info(`Stack '${stackIdOrName}' does not exist.`);
                return false;
            }
        }
        catch (error) {
            core.error(`Error checking if stack exists: ${error.message}`);
            return false; // Default to false on error
        }
    }
}
exports.default = StackManager;
