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
class SpaceManager extends graphQLManager_1.default {
    constructor() {
        super();
    }
    // Method to create service space with clear distinction for existing space
    async createServiceSpace(inputs) {
        const { label_prefix, env, region, service_name, label_postfix } = inputs;
        const label = `${label_prefix}:${env}:${region}:${service_name}:${label_postfix}`;
        const labelParts = label.split(':');
        let parentId = undefined;
        let isNewSpaceCreated = false; // Flag to check if new space was created
        try {
            // Iterate over the label parts to create spaces in the hierarchy
            for (let i = 0; i < labelParts.length; i++) {
                const currentLabel = labelParts.slice(0, i + 1).join(':');
                const existingSpace = await this.findSpaceByLabel(currentLabel);
                if (existingSpace) {
                    core.info(`Space for ${currentLabel} already exists with ID: ${existingSpace.id}`);
                    parentId = existingSpace.id; // Set parentId for the next iteration
                }
                else {
                    // If no existing space, create a new one
                    if (i > 0 && !parentId) {
                        throw new Error(`Parent ID is not set for label: ${currentLabel}.`);
                    }
                    parentId = await this.createSpace(currentLabel, labelParts[i], parentId);
                    core.info(`New space created with ID: ${parentId}`);
                    isNewSpaceCreated = true; // Mark that a new space was created
                }
            }
            // Final message depending on whether the space was newly created or already existed
            if (isNewSpaceCreated) {
                core.info(`Successfully created new service space with ID: ${parentId}`);
            }
            else {
                core.info(`No new space created. Using existing space with ID: ${parentId}`);
            }
            return parentId;
        }
        catch (error) {
            // Enhanced error handling
            if (error.response && error.response.data) {
                core.error(`Failed to create service space: ${JSON.stringify(error.response.data)}`);
            }
            else {
                core.error(`Unexpected error occurred: ${error.message}`);
            }
            throw error;
        }
    }
    // Method to create a space
    async createSpace(label, serviceName, parentId) {
        core.info(`Creating space with label: ${label}`);
        const mutation = {
            query: `mutation CreateSpace($input: SpaceInput!) {
        spaceCreate(input: $input) {
          id
          name
          labels
        }
      }`,
            variables: {
                input: {
                    name: serviceName,
                    parentSpace: parentId || 'root',
                    description: `${serviceName} space for ${label}`,
                    inheritEntities: true,
                    labels: [label],
                },
            },
        };
        const response = await this.sendRequest(mutation);
        const spaceId = response.spaceCreate.id;
        core.info(`New space created with ID: ${spaceId}`);
        return spaceId;
    }
    // Method to find space by label with logging and error handling
    async findSpaceByLabel(label) {
        try {
            core.info(`Fidning space with label: ${label}`);
            // Query spaces
            const spaces = await this.querySpaces();
            //   // Log the spaces result for debugging
            //   core.info(`Queried spaces: ${JSON.stringify(spaces, null, 2)}`)
            // Find space that matches the label
            const foundSpace = spaces.find((space) => space.labels.includes(label)) || null;
            // Log the result of the space found
            if (foundSpace) {
                core.info(`Space found for label '${label}': ${JSON.stringify(foundSpace)}`);
            }
            else {
                core.info(`No space found for label '${label}'.`);
            }
            return foundSpace;
        }
        catch (error) {
            // Log any errors that occur during the query
            core.error(`Error finding space by label '${label}': ${error.message}`);
            throw error; // Rethrow the error to handle it upstream
        }
    }
    // Method to query spaces
    async querySpaces() {
        const query = {
            query: `query {
        spaces {
          id
          name
          labels
          parentSpace
        }
      }`,
        };
        const response = await this.sendRequest(query);
        return response.spaces;
    }
}
exports.default = SpaceManager;
