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
const fs_1 = __importDefault(require("fs"));
const yaml_1 = __importDefault(require("yaml"));
class ContextManager extends graphQLManager_1.default {
    constructor(serviceName, env, yamlFilePath = './deployment/contexts.yml') {
        super();
        this.contextName = `${serviceName}-${env}-context`;
        this.yamlFilePath = yamlFilePath;
    }
    // Method to load YAML and merge with additional inputs (spaceId)
    loadEnvValuesFromYaml(spaceId) {
        try {
            const fileContents = fs_1.default.readFileSync(this.yamlFilePath, 'utf8');
            const parsedYaml = yaml_1.default.parse(fileContents);
            // Merge additional inputs (spaceId and contextName)
            return {
                ...parsedYaml,
                space: spaceId,
                name: this.contextName,
            };
        }
        catch (error) {
            core.setFailed(`Failed to load env values from YAML: ${error.message}`);
            throw error;
        }
    }
    // Method to query the existing context by ID
    async getContextById() {
        const query = {
            operationName: 'GetContext',
            query: `
      query GetContext($id: ID!) {
        context(id: $id) {
          id
          name
          config {
            id
            value
          }
          labels
          description
          hooks {
            beforeInit
            afterInit
            beforePlan
            afterPlan
            beforeApply
            afterApply
            beforeDestroy
            afterDestroy
            beforePerform
            afterPerform
            afterRun
          }
          space
          createdAt
          updatedAt
        }
      }
    `,
            variables: { id: this.contextName },
        };
        const response = await this.sendRequest(query);
        return response?.context || null;
    }
    // Compare YAML config and labels with the existing context and update if necessary
    detectChanges(existingContext, newConfig) {
        // Ensure all fields are defined before comparison
        const existingConfig = existingContext.config?.reduce((acc, elem) => {
            acc[elem.id] = elem.value;
            return acc;
        }, {}) || {};
        const newConfigAttachments = newConfig.configAttachments || {};
        // Detect config changes
        const configChanges = Object.keys(newConfigAttachments).some((key) => {
            return existingConfig[key] !== newConfigAttachments[key];
        });
        // Detect label changes (ensure labels exist in both)
        const existingLabels = existingContext.labels || [];
        const newLabels = newConfig.labels || [];
        const labelChanges = newLabels.some((label) => !existingLabels.includes(label));
        // Detect hook changes (ensure hooks exist in both)
        const existingHooks = existingContext.hooks || {};
        const newHooks = newConfig.hooks || {};
        const hookChanges = JSON.stringify(existingHooks) !== JSON.stringify(newHooks);
        return configChanges || labelChanges || hookChanges;
    }
    // Method to send mutation, either for update or create
    async sendContextMutation(contextId, inputs, replaceConfigElements = false) {
        const mutationType = contextId ? 'contextUpdateV2' : 'contextCreateV2';
        const mutationQuery = `
      mutation ${mutationType}($input: ContextInput!${contextId ? ', $id: ID!' : ''}${contextId ? ', $replaceConfigElements: Boolean' : ''}) {
        ${mutationType}(${contextId ? 'id: $id, ' : ''}input: $input${contextId ? ', replaceConfigElements: $replaceConfigElements' : ''}) {
          id
          name
          updatedAt
        }
      }
    `;
        // Only add non-null values to the variables object
        const variables = {
            input: {
                name: inputs.name,
                description: inputs.description || '', // Set defaults for optional fields
                space: inputs.space || null,
                labels: inputs.labels || [],
                configAttachments: inputs.configAttachments || [],
                hooks: {
                    beforeInit: inputs.hooks?.beforeInit || [],
                    afterInit: inputs.hooks?.afterInit || [],
                    beforePlan: inputs.hooks?.beforePlan || [],
                    afterPlan: inputs.hooks?.afterPlan || [],
                    beforeApply: inputs.hooks?.beforeApply || [],
                    afterApply: inputs.hooks?.afterApply || [],
                    beforeDestroy: inputs.hooks?.beforeDestroy || [],
                    afterDestroy: inputs.hooks?.afterDestroy || [],
                    beforePerform: inputs.hooks?.beforePerform || [],
                    afterPerform: inputs.hooks?.afterPerform || [],
                    afterRun: inputs.hooks?.afterRun || [],
                },
                stackAttachments: inputs.stackAttachments || [], // Optional
            },
        };
        if (contextId) {
            variables.id = contextId;
            variables.replaceConfigElements = replaceConfigElements;
        }
        await this.sendRequest({ query: mutationQuery, variables });
        core.info(`Context ${contextId ? 'updated' : 'created'} successfully.`);
    }
    // Main method to create or update the context based on changes
    async createOrUpdateContext(spaceId) {
        const inputs = this.loadEnvValuesFromYaml(spaceId);
        const existingContext = await this.getContextById();
        if (existingContext) {
            core.info(`Context with ID ${existingContext.id} already exists...`);
            // Detect changes in config, labels, and hooks
            const hasChanges = this.detectChanges(existingContext, inputs);
            if (hasChanges) {
                core.info(`Changes detected in context, updating...`);
                await this.sendContextMutation(existingContext.id, inputs, true); // Update existing context
            }
            else {
                core.info(`No changes detected, skipping update.`);
            }
            return existingContext; // Return the existing context
        }
        // Create new context
        await this.sendContextMutation(undefined, inputs);
        core.info(`Context created successfully.`);
    }
}
exports.default = ContextManager;
