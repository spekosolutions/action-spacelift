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
const core = __importStar(require("@actions/core"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const authorizationManager_1 = __importDefault(require("../authorization/authorizationManager"));
// Class to manage Spacelift environment setup for Terraform
class TerraformManager {
    constructor(token) {
        this.token = token;
        this.authorizationManager = new authorizationManager_1.default(); // Initialize the AuthorizationManager
        this.setupSpaceliftEnvironment();
        this.setEnvironmentVariables();
    }
    setupSpaceliftEnvironment() {
        try {
            this.configureSpaceliftCredentials();
            this.debugSpaceliftCredentials();
        }
        catch (error) {
            core.setFailed(`Failed to set up Spacelift environment: ${error.message}`);
        }
    }
    // Set environment variables for Spacelift
    async setEnvironmentVariables() {
        core.info('Starting environment variable setup for Spacelift...');
        try {
            // Log and set environment variables
            core.info('Setting OIDC_TOKEN environment variable...');
            core.exportVariable('OIDC_TOKEN', await this.authorizationManager.oidcTokenAsync);
            core.info('Setting SPACELIFT_API_KEY_ENDPOINT environment variable...');
            core.exportVariable('SPACELIFT_API_KEY_ENDPOINT', `https://${this.authorizationManager.spaceliftApiKeyEndpoint}`);
            // Log the SPACELIFT_KEY_ID environment variable
            if (process.env.SPACELIFT_KEY_ID) {
                core.info(`SPACELIFT_API_KEY_ID: ${process.env.SPACELIFT_KEY_ID}`);
                core.exportVariable('SPACELIFT_API_KEY_ID', process.env.SPACELIFT_KEY_ID);
            }
            else {
                core.warning('SPACELIFT_KEY_ID is not set in the environment.');
            }
            // Log the ACTIONS_ID_TOKEN_REQUEST_TOKEN environment variable
            if (process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN) {
                core.info(`ACTIONS_ID_TOKEN_REQUEST_TOKEN is set.`);
                core.exportVariable('SPACELIFT_API_KEY_SECRET', await this.authorizationManager.oidcTokenAsync);
            }
            else {
                core.warning('ACTIONS_ID_TOKEN_REQUEST_TOKEN is not set in the environment.');
            }
            core.info('All environment variables set successfully.');
        }
        catch (error) {
            core.error(`Error during environment variable setup: ${error.message}`);
            throw error;
        }
    }
    configureSpaceliftCredentials() {
        try {
            // Define the path to the credentials file
            const terraformDir = path.join(os.homedir(), '.terraform.d');
            const credentialsFile = path.join(terraformDir, 'credentials.tfrc.json');
            // Ensure the ~/.terraform.d directory exists
            if (!fs.existsSync(terraformDir)) {
                fs.mkdirSync(terraformDir, { recursive: true });
            }
            // Define the credentials content
            const credentialsContent = {
                credentials: {
                    'spacelift.io': {
                        token: this.token,
                    },
                },
            };
            // Write the credentials file
            fs.writeFileSync(credentialsFile, JSON.stringify(credentialsContent, null, 2));
            core.info(`Spacelift credentials have been written to ${credentialsFile}`);
            // Export TF_CLI_CONFIG_FILE environment variable
            process.env.TF_CLI_CONFIG_FILE = credentialsFile;
            core.info(`TF_CLI_CONFIG_FILE has been set to ${credentialsFile}`);
        }
        catch (error) {
            core.setFailed(`Failed to configure Spacelift credentials: ${error.message}`);
            throw error;
        }
    }
    debugSpaceliftCredentials() {
        try {
            // Define the path to the credentials file
            const credentialsFile = path.join(os.homedir(), '.terraform.d', 'credentials.tfrc.json');
            // Check if the credentials file exists
            if (!fs.existsSync(credentialsFile)) {
                core.warning(`Credentials file not found at: ${credentialsFile}`);
            }
            else {
                // Read and log the file contents
                const fileContents = fs.readFileSync(credentialsFile, 'utf8');
                const base64Encoded = Buffer.from(fileContents).toString('base64');
                core.info(`Base64-encoded credentials:\n${base64Encoded}`);
                core.info(`Contents of ${credentialsFile}:\n${fileContents}`);
            }
            // Log the exported TF_CLI_CONFIG_FILE variable
            if (process.env.TF_CLI_CONFIG_FILE) {
                core.info(`TF_CLI_CONFIG_FILE is set to ${process.env.TF_CLI_CONFIG_FILE}`);
            }
            else {
                core.warning('TF_CLI_CONFIG_FILE is not set.');
            }
        }
        catch (error) {
            core.setFailed(`Failed to debug Spacelift credentials: ${error.message}`);
        }
    }
}
exports.default = TerraformManager;
