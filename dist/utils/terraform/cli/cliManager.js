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
const terraformManager_1 = __importDefault(require("../terraformManager"));
const core = __importStar(require("@actions/core"));
const child_process_1 = require("child_process");
const util_1 = __importDefault(require("util"));
// Promisify exec to use async/await
const execAsync = util_1.default.promisify(child_process_1.exec);
// Child class extending TerraformManager to handle CLI operations
class TerraformCliManager extends terraformManager_1.default {
    constructor(token) {
        super(token);
    }
    // Run a command on a specific stack
    async runCommand(stackName, command) {
        try {
            core.info(`Running command '${command}' on stack '${stackName}'...`);
            // Build the command
            const commandToRun = `cd deployment/service/stack && ${command}`;
            // Execute the command
            const { stdout, stderr } = await execAsync(commandToRun);
            core.info(`Command output:\n${stdout}`);
            return { stdout, stderr };
        }
        catch (error) {
            core.setFailed(`Failed to execute command '${command}' on stack '${stackName}': ${error.message}`);
            throw error;
        }
    }
}
exports.default = TerraformCliManager;
