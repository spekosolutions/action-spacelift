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
        await (0, run_1.run)({
            command: core.getInput('command', { required: true }),
            region: core.getInput('region', { required: true }),
            zone: core.getInput('zone', { required: true }),
            env: core.getInput('env', { required: true }),
            integration_name: core.getInput('integration_name', { required: true }),
            service_name: core.getInput('service_name', { required: true }),
            label_prefix: core.getInput('label_prefix', { required: true }),
            label_postfix: core.getInput('label_postfix', { required: true }),
            rawEnvVars: core.getInput('env_vars', { required: false }),
            spacelift_module_token: core.getInput('spacelift_module_token', { required: true }),
        });
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
