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
    // Generates an OIDC token and saves it along with its expiration time
    async generateOidcToken() {
        try {
            core.info('Generating OIDC token...');
            const response = await axios_1.default.get(`${this.actionsIdTokenRequestUrl}&audience=${this.spaceliftApiKeyEndpoint}`, {
                headers: { Authorization: `Bearer ${this.actionsIdTokenRequestToken}` }
            });
            this.oidcToken = response.data.value;
            // Assuming the OIDC token expiration is typically one hour (3600 seconds)
            this.oidcTokenExpiration = Date.now() + 3600 * 1000;
        }
        catch (error) {
            core.setFailed(`Failed to generate OIDC token: ${error}`);
            throw error;
        }
    }
    // Ensures the OIDC token is valid, generates a new one if expired
    async ensureValidOidcToken() {
        if (!this.oidcToken || (this.oidcTokenExpiration && Date.now() >= this.oidcTokenExpiration)) {
            await this.generateOidcToken();
        }
    }
    // Exchanges the OIDC token for a Bearer token and saves it along with its expiration time
    async generateBearerToken() {
        await this.ensureValidOidcToken();
        try {
            core.info('Exchanging OIDC token for bearer token...');
            const query = {
                query: `mutation { apiKeyUser(id: "${this.apiKeyId}", secret: "${this.oidcToken}") { jwt }}`
            };
            const response = await axios_1.default.post(`https://${this.spaceliftApiKeyEndpoint}/graphql`, query, {
                headers: { 'Content-Type': 'application/json' }
            });
            this.bearerToken = response.data.data.apiKeyUser.jwt;
            // Assuming the Bearer token expiration is typically one hour (3600 seconds)
            this.bearerTokenExpiration = Date.now() + 3600 * 1000;
        }
        catch (error) {
            core.setFailed(`Failed to exchange OIDC token for bearer token: ${error}`);
            throw error;
        }
    }
    // Ensures the Bearer token is valid, generates a new one if expired
    async ensureValidBearerToken() {
        if (!this.bearerToken || (this.bearerTokenExpiration && Date.now() >= this.bearerTokenExpiration)) {
            await this.generateBearerToken();
        }
    }
    // Getter for OIDC token that ensures the token is valid
    get oidcTokenAsync() {
        return (async () => {
            await this.ensureValidOidcToken();
            return this.oidcToken;
        })();
    }
    // Getter for Bearer token that ensures the token is valid
    get bearerTokenAsync() {
        return (async () => {
            await this.ensureValidBearerToken();
            return this.bearerToken;
        })();
    }
}
exports.AuthorizationManager = AuthorizationManager;
exports.default = AuthorizationManager;
