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
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class TerraformCliManager extends terraformManager_1.default {
    constructor() {
        super();
        this.initialized = false;
    }
    /**
     * Explicitly initialize Terraform backend if not already initialized
     */
    async initialize() {
        if (this.initialized) {
            core.info('TerraformCliManager is already initialized.');
            return;
        }
        try {
            core.info('Initializing Terraform to configure the backend...');
            const backendConfigPath = path.join(this.config.stackPath, 'state.tf');
            if (!fs.existsSync(backendConfigPath)) {
                const backendConfigContent = this.generateBackendConfigContent();
                this.writeBackendConfigToFile(backendConfigContent);
            }
            await execAsync(`terraform init`, { cwd: this.config.stackPath });
            core.info('Terraform initialized successfully.');
            this.initialized = true;
        }
        catch (error) {
            core.error(`Error initializing Terraform: ${error.message}`);
            throw error;
        }
    }
    /**
     * Generate backend configuration content for Terraform
     */
    generateBackendConfigContent() {
        return `
terraform {
  backend "s3" {
    bucket         = "spacelift-stacks-${this.config.region}-${this.config.awsAccountId}"
    key            = "${this.config.env}/${this.config.zone}/${this.config.serviceName}/${this.config.labelSuffix}/terraform.tfstate"
    region         = "${this.config.region}"
    dynamodb_table = "spacelift-stacks-${this.config.region}-${this.config.awsAccountId}"
    encrypt        = true
    kms_key_id     = "alias/aws/s3"
  }
}`.trim();
    }
    /**
     * Write backend configuration to a file if it does not already exist
     */
    writeBackendConfigToFile(backendConfigContent) {
        const backendFilePath = path.join(this.config.stackPath, 'state.tf');
        if (!fs.existsSync(backendFilePath)) {
            fs.writeFileSync(backendFilePath, backendConfigContent, 'utf8');
            core.info(`Backend configuration written to ${backendFilePath}`);
        }
        else {
            core.info(`Backend configuration already exists at ${backendFilePath}`);
        }
    }
    /**
     * Check if the Terraform state exists remotely
     */
    async checkTerraformStateExists() {
        try {
            core.info('Checking if Terraform state exists remotely...');
            const { stdout } = await execAsync(`terraform show -json`, { cwd: this.config.stackPath });
            const state = JSON.parse(stdout);
            return !!state.values; // If state values exist, the state has been created
        }
        catch (error) {
            core.warning('Terraform state not found or could not be parsed.');
            return false;
        }
    }
    /**
     * Run a command with real-time logging
     */
    async runCommandWithLogs(command) {
        try {
            core.info(`Running Terraform command: ${command} in path: ${this.config.stackPath}`);
            await new Promise((resolve, reject) => {
                const child = (0, child_process_1.spawn)(command, {
                    shell: true,
                    cwd: this.config.stackPath,
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
        catch (error) {
            core.error(`Error executing Terraform command: ${error.message}`);
            throw error;
        }
    }
}
exports.default = TerraformCliManager;
