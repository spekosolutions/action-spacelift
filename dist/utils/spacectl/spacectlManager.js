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
// Parent class to manage common Spacelift environment setup
class SpacectlManager {
    constructor() {
        this.authorizationManager = new authorizationManager_1.default(); // Initialize the AuthorizationManager
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
}
exports.default = SpacectlManager;
