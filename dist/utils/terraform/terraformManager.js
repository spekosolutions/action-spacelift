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
const authorizationManager_1 = __importDefault(require("../authorization/authorizationManager"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
// Parent class to manage common Spacelift environment setup
class TerraformManager {
    constructor() {
        this.authorizationManager = new authorizationManager_1.default(); // Initialize the AuthorizationManager
        this.setupSpaceliftEnvironment();
    }
    async setupSpaceliftEnvironment() {
        try {
            await this.configureSpaceliftCredentials();
            await this.debugSpaceliftCredentials();
        }
        catch (error) {
            core.setFailed(`Failed to set up Spacelift environment: ${error.message}`);
        }
    }
    async configureSpaceliftCredentials() {
        try {
            // Get Spacelift API token
            const spaceliftToken = await this.authorizationManager.oidcTokenAsync;
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
                        token: spaceliftToken,
                    },
                },
            };
            // Write the credentials file
            fs.writeFileSync(credentialsFile, JSON.stringify(credentialsContent, null, 2));
            core.info(`Spacelift credentials have been written to ${credentialsFile}`);
        }
        catch (error) {
            core.setFailed(`Failed to configure Spacelift credentials: ${error.message}`);
            throw error;
        }
    }
    async debugSpaceliftCredentials() {
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
                core.info(`Contents of ${credentialsFile}:\n${fileContents}`);
            }
        }
        catch (error) {
            core.setFailed(`Failed to debug Spacelift credentials: ${error.message}`);
        }
    }
}
exports.default = TerraformManager;
