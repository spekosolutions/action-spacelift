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
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const core = __importStar(require("@actions/core"));
const run_1 = require("./utils/run");
const spacectl_1 = require("./commands/spacectl");
const terraform_1 = require("./commands/terraform");
// Define the main function correctly
const main = async () => {
    try {
        const binarySpaceliftFolder = await (0, spacectl_1.installSpaceliftAndGetFolder)();
        (async () => {
            try {
                const binaryTerraformFolder = await (0, terraform_1.installTerraformAndGetFolder)();
                console.log(`Terraform installed at ${binaryTerraformFolder}`);
                core.addPath(binaryTerraformFolder);
                core.info("Added terraform to PATH: " + binaryTerraformFolder);
            }
            catch (error) {
                console.error(`Failed to install Terraform: ${error.message}`);
            }
        })();
        core.addPath(binarySpaceliftFolder);
        core.info("Added spacectl to PATH: " + binarySpaceliftFolder);
        // Set environment variables from inputs
        process.env.COMMAND = core.getInput('command', { required: true });
        process.env.REGION = core.getInput('region', { required: true });
        process.env.ZONE = core.getInput('zone', { required: true });
        process.env.ENV = core.getInput('env', { required: true });
        process.env.INTEGRATION_NAME = core.getInput('integration_name', { required: true });
        process.env.SERVICE_NAME = core.getInput('service_name', { required: true });
        process.env.LABEL_PREFIX = core.getInput('label_prefix', { required: false });
        process.env.LABEL_SUFFIX = core.getInput('label_suffix', { required: true });
        process.env.ENV_VARS = core.getInput('env_vars', { required: false });
        process.env.SPACELIFT_MODULE_TOKEN = core.getInput('spacelift_module_token', { required: true });
        process.env.ENV_CONTEXT = core.getInput('env_context', { required: true });
        // Pass inputs to the run function
        await (0, run_1.run)();
    }
    catch (e) {
        core.setFailed(e.message);
        console.error(e);
    }
};
exports.main = main;
// Ensure proper handling of errors in the async context
main().catch((e) => {
    core.setFailed(e.message);
    console.error(e);
});
