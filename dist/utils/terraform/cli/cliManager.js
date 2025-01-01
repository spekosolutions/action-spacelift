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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
// Child class extending TerraformManager to handle CLI operations
class TerraformCliManager extends terraformManager_1.default {
    constructor(token) {
        super(token);
    }
    /**
     * Generate backend configuration content for Terraform
     * @param {string} region - AWS region
     * @param {string} awsAccountId - AWS account ID
     * @param {string} environment - Environment name (e.g., dev1)
     * @param {string} zone - Zone name (e.g., na1)
     * @param {string} serviceName - Service name
     * @param {string} labelSuffix - Stack name
     * @returns {string} Backend configuration content
     */
    generateBackendConfigContent(region, awsAccountId, environment, zone, serviceName, labelSuffix) {
        return `
terraform {
  backend "s3" {
    bucket         = "spacelift-stacks-${region}-${awsAccountId}"
    key            = "${environment}/${zone}/${serviceName}/${labelSuffix}/terraform.tfstate"
    region         = "${region}"
    dynamodb_table = "spacelift-stacks-${region}-${awsAccountId}"
    encrypt        = true
    kms_key_id     = "alias/aws/s3"
  }
}
    `.trim();
    }
    /**
     * Write backend configuration to a file if it does not already exist
     * @param {string} stackPath - Path to the Terraform stack
     * @param {string} backendConfigContent - Backend configuration content
     * @returns {void}
     */
    writeBackendConfigToFile(stackPath, backendConfigContent) {
        const backendFilePath = path.join(stackPath, 'state.tf');
        if (!fs.existsSync(backendFilePath)) {
            fs.writeFileSync(backendFilePath, backendConfigContent, 'utf8');
            core.info(`Backend configuration written to ${backendFilePath}`);
        }
        else {
            core.info(`Backend configuration already exists at ${backendFilePath}`);
        }
    }
    /**
     * Run a command with real-time logging
     * @param {string} stackPath - The path to the stack
     * @param {string} command - The Terraform command to run
     * @param {object} backendConfigParams - Parameters for generating backend configuration
     * @returns {Promise<void>} Resolves when the command completes successfully
     */
    async runCommandWithLogs(stackPath, command, backendConfigParams) {
        try {
            const backendConfigContent = this.generateBackendConfigContent(backendConfigParams.region, backendConfigParams.awsAccountId, backendConfigParams.environment, backendConfigParams.zone, backendConfigParams.serviceName, backendConfigParams.labelSuffix);
            // Write the backend configuration only if it doesn't exist
            this.writeBackendConfigToFile(stackPath, backendConfigContent);
            // Avoid running terraform init multiple times
            if (command.includes('terraform init')) {
                core.info('Ensuring backend configuration is initialized...');
                command = 'terraform init -reconfigure';
            }
            // Run the Terraform command
            core.info(`Running Terraform command: ${command} in path: ${stackPath}`);
            const child = (0, child_process_1.spawn)(command, {
                shell: true,
                cwd: stackPath,
                env: {
                    ...process.env,
                },
            });
            child.stdout.on('data', (data) => {
                core.info(data.toString().trim());
            });
            child.stderr.on('data', (data) => {
                core.error(data.toString().trim());
            });
            child.on('close', (code) => {
                if (code === 0) {
                    core.info(`Terraform command '${command}' completed successfully.`);
                }
                else {
                    throw new Error(`Terraform command '${command}' failed with exit code ${code}.`);
                }
            });
        }
        catch (error) {
            core.error(`Error executing Terraform command: ${error.message}`);
            throw error;
        }
    }
}
exports.default = TerraformCliManager;
