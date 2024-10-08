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
const graphQLManager_1 = __importDefault(require("../graphQLManager"));
const core = __importStar(require("@actions/core"));
class IntegrationManager extends graphQLManager_1.default {
    constructor() {
        super();
    }
    // Method to attach AWS integration to stack
    async attachAWSIntegrationToStack(integrationId, stackId, read, write) {
        const mutationQuery = {
            query: `
        mutation AttachAWSIntegration($id: ID!, $stack: ID!, $read: Boolean!, $write: Boolean!) {
          awsIntegrationAttach(id: $id, stack: $stack, read: $read, write: $write) {
            id
            stackId
          }
        }
      `,
            variables: { id: integrationId, stack: stackId, read, write },
        };
        await this.sendRequest(mutationQuery);
        core.info(`AWS integration attached to stack ${stackId}`);
    }
    // Method to get AWS integration by name
    async getAWSIntegrationByName(integrationName) {
        const query = {
            query: `query AWSIntegrations { awsIntegrations { id name } }`,
        };
        const response = await this.sendRequest(query);
        const integrations = response?.awsIntegrations || [];
        return integrations.find((integration) => integration.name === integrationName) || null;
    }
}
exports.default = IntegrationManager;
