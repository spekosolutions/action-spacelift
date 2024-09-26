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
const execAsync = util_1.default.promisify(child_process_1.exec); // Define execAsync using util.promisify
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
    // Method to get the outputs from a stack
    async getStackOutputs(stackIdOrName) {
        try {
            // Run the spacectl command with --output json flag
            const { stdout, stderr } = await this.runCommand(stackIdOrName, `outputs --output json`);
            // If there's an error in stderr, log and throw it
            if (stderr) {
                core.error(`Error getting stack outputs: ${stderr}`);
                throw new Error(stderr);
            }
            // Parse the JSON output
            const outputs = JSON.parse(stdout);
            // Loop through the outputs and set each as a GitHub Actions output
            for (let [key, value] of Object.entries(outputs)) {
                // Remove any surrounding quotes from the value if present
                const cleanedValue = typeof value === 'string' ? value.replace(/^"|"$/g, '') : value;
                core.setOutput(key, cleanedValue);
            }
            // Also set the entire JSON as an output, after removing unnecessary quotes
            core.setOutput('outputs', JSON.stringify(outputs, (k, v) => (typeof v === 'string' ? v.replace(/^"|"$/g, '') : v)));
            core.info(`Successfully set stack outputs in GitHub Actions: ${stdout}`);
        }
        catch (error) {
            core.setFailed(`Failed to get stack outputs: ${error.message}`);
            throw error;
        }
    }
}
exports.default = StackManager;
