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
exports.AuthorizationManager = void 0;
const axios_1 = __importDefault(require("axios"));
const core = __importStar(require("@actions/core"));
class AuthorizationManager {
    constructor() {
        this.oidcToken = null;
        this.oidcTokenExpiration = null;
        this.bearerToken = null;
        this.bearerTokenExpiration = null;
        this.actionsIdTokenRequestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN || '';
        this.actionsIdTokenRequestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL || '';
        this.spaceliftApiKeyEndpoint = process.env.SPACELIFT_API_KEY_ENDPOINT || '';
        this.apiKeyId = process.env.SPACELIFT_KEY_ID || '';
    }
    async generateOidcToken() {
        try {
            core.info('Generating OIDC token...');
            const response = await axios_1.default.get(`${this.actionsIdTokenRequestUrl}&audience=${this.spaceliftApiKeyEndpoint}`, {
                headers: { Authorization: `Bearer ${this.actionsIdTokenRequestToken}` }
            });
            this.oidcToken = response.data.value;
            const expiry = response.data.expiration || 3600;
            this.oidcTokenExpiration = Date.now() + expiry * 1000;
            core.info(`OIDC token generated. Expiration time: ${new Date(this.oidcTokenExpiration).toISOString()}`);
        }
        catch (error) {
            const errorMessage = this.getErrorMessage(error);
            core.setFailed(`Failed to generate OIDC token: ${errorMessage}`);
            throw new Error(errorMessage);
        }
    }
    async ensureValidOidcToken() {
        if (!this.oidcToken || (this.oidcTokenExpiration && Date.now() >= this.oidcTokenExpiration)) {
            await this.generateOidcToken();
        }
    }
    async generateBearerToken() {
        await this.ensureValidOidcToken();
        try {
            core.info('Exchanging OIDC token for bearer token...');
            const query = {
                query: `mutation { apiKeyUser(id: "${this.apiKeyId}", secret: "${this.oidcToken}") { jwt expiration }}`
            };
            const response = await axios_1.default.post(`https://${this.spaceliftApiKeyEndpoint}/graphql`, query, {
                headers: { 'Content-Type': 'application/json' }
            });
            this.bearerToken = response.data.data.apiKeyUser.jwt;
            const expiry = response.data.data.apiKeyUser.expiration || 3600;
            this.bearerTokenExpiration = Date.now() + expiry * 1000;
            core.info(`Bearer token generated. Expiration time: ${new Date(this.bearerTokenExpiration).toISOString()}`);
        }
        catch (error) {
            const errorMessage = this.getErrorMessage(error);
            core.setFailed(`Failed to exchange OIDC token for bearer token: ${errorMessage}`);
            throw new Error(errorMessage);
        }
    }
    async ensureValidBearerToken() {
        if (!this.bearerToken || (this.bearerTokenExpiration && Date.now() >= this.bearerTokenExpiration)) {
            await this.generateBearerToken();
        }
    }
    get oidcTokenAsync() {
        return (async () => {
            await this.ensureValidOidcToken();
            return this.oidcToken;
        })();
    }
    get bearerTokenAsync() {
        return (async () => {
            await this.ensureValidBearerToken();
            return this.bearerToken;
        })();
    }
    async executeCommandWithRetry(command, retries = 3) {
        while (retries > 0) {
            try {
                await this.ensureValidBearerToken();
                core.info(`Executing command: ${command}`);
                // Example execution: await exec(command);
                core.info('Command executed successfully.');
                break;
            }
            catch (error) {
                retries--;
                const errorMessage = this.getErrorMessage(error);
                core.warning(`Command failed. Retries left: ${retries}. Error: ${errorMessage}`);
                if (retries === 0) {
                    core.setFailed(`Command failed after 3 attempts: ${errorMessage}`);
                    throw new Error(errorMessage);
                }
            }
        }
    }
    getErrorMessage(error) {
        if (axios_1.default.isAxiosError(error)) {
            // Axios-specific error
            return error.response?.data?.message || error.message || 'Unknown Axios error';
        }
        if (error instanceof Error) {
            // Generic JavaScript Error
            return error.message;
        }
        // Handle unknown types
        return typeof error === 'string' ? error : 'An unknown error occurred';
    }
}
exports.AuthorizationManager = AuthorizationManager;
exports.default = AuthorizationManager;
