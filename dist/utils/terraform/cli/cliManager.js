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
// Child class extending TerraformManager to handle CLI operations
class TerraformCliManager extends terraformManager_1.default {
    constructor(token) {
        super(token);
    }
    /**
     * Generate backend configuration string for Terraform
     * @param {string} region - AWS region
     * @param {string} awsAccountId - AWS account ID
     * @param {string} environment - Environment name (e.g., dev1)
     * @param {string} zone - Zone name (e.g., na1)
     * @param {string} serviceName - Service name
     * @param {string} stackName - Stack name
     * @returns {string} Backend configuration string
     */
    generateBackendConfig(region, awsAccountId, environment, zone, serviceName, stackName) {
        return [
            `-backend-config="bucket=spacelift-stacks-${region}-${awsAccountId}"`,
            `-backend-config="key=${environment}/${zone}/${serviceName}/${stackName}/terraform.tfstate"`,
            `-backend-config="region=${region}"`,
            `-backend-config="dynamodb_table=spacelift-stacks-${environment}-${region}-${awsAccountId}"`,
            `-backend-config="encrypt=true"`,
            `-backend-config="kms_key_id=alias/terraform-backend-key"`
        ].join(' ');
    }
    /**
     * Run a command with real-time logging
     * @param {string} stackPath - The path to the stack
     * @param {string} command - The Terraform command to run
     * @param {object} backendConfigParams - Parameters for generating backend configuration
     * @returns {Promise<void>} Resolves when the command completes successfully
     */
    async runCommandWithLogs(stackPath, command, backendConfigParams) {
        return new Promise((resolve, reject) => {
            const backendConfig = this.generateBackendConfig(backendConfigParams.region, backendConfigParams.awsAccountId, backendConfigParams.environment, backendConfigParams.zone, backendConfigParams.serviceName, backendConfigParams.stackName);
            const fullCommand = `${command} ${backendConfig} -var 'spacelift_api_key_endpoint=${process.env.SPACELIFT_API_KEY_ENDPOINT}' -var 'spacelift_api_key_id=${process.env.SPACELIFT_KEY_ID}' -var 'spacelift_api_key_secret=${process.env.SPACELIFT_API_KEY_SECRET}'`;
            core.info(`Running Terraform command: ${fullCommand} in path: ${stackPath}`);
            const child = (0, child_process_1.spawn)(fullCommand, {
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
                    resolve();
                }
                else {
                    reject(new Error(`Terraform command '${command}' failed with exit code ${code}.`));
                }
            });
            child.on('error', (error) => {
                core.error(`Error executing Terraform command '${command}': ${error.message}`);
                reject(error);
            });
        });
    }
}
exports.default = TerraformCliManager;
