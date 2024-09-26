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
const axios_1 = __importDefault(require("axios"));
const core = __importStar(require("@actions/core"));
const authorizationManager_1 = __importDefault(require("../authorization/authorizationManager"));
class GraphQLManager {
    constructor() {
        this.authorizationManager = new authorizationManager_1.default(); // Initialize the AuthorizationManager
    }
    // Send GraphQL request with Bearer token
    async sendRequest(mutation) {
        try {
            const bearerToken = await this.authorizationManager.bearerTokenAsync; // Retrieve Bearer token
            const response = await axios_1.default.post(`https://${this.authorizationManager.spaceliftApiKeyEndpoint}/graphql`, mutation, {
                headers: {
                    Authorization: `Bearer ${bearerToken}`,
                    'Content-Type': 'application/json',
                },
            });
            if (response.data.errors) {
                throw new Error(JSON.stringify(response.data.errors));
            }
            return response.data?.data;
        }
        catch (error) {
            core.setFailed(`Failed to execute GraphQL request: ${error.message}`);
            throw error;
        }
    }
}
exports.default = GraphQLManager;
