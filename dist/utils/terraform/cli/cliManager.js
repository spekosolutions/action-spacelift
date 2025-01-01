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
const terraformManager_1 = __importDefault(require("../terraformManager"));
const core = __importStar(require("@actions/core"));
const child_process_1 = require("child_process");
const util_1 = __importDefault(require("util"));
const child_process_2 = require("child_process");
// Promisify exec to use async/await
const execAsync = util_1.default.promisify(child_process_1.exec);
// Child class extending TerraformManager to handle CLI operations
class TerraformCliManager extends terraformManager_1.default {
    constructor(token) {
        super(token);
    }
    // Run a command with real-time logging
    async runCommandWithLogs(stackPath, command) {
        return new Promise((resolve, reject) => {
            core.info(`Running Terraform command: ${command} in path: ${stackPath}`);
            const child = (0, child_process_2.spawn)(command, {
                shell: true,
                cwd: stackPath,
                env: {
                    ...process.env,
                },
            });
            // Capture and log stdout
            child.stdout.on('data', (data) => {
                core.info(data.toString().trim());
            });
            // Capture and log stderr
            child.stderr.on('data', (data) => {
                core.error(data.toString().trim());
            });
            // Handle process exit
            child.on('close', (code) => {
                if (code === 0) {
                    core.info(`Terraform command '${command}' completed successfully.`);
                    resolve();
                }
                else {
                    reject(new Error(`Terraform command '${command}' failed with exit code ${code}.`));
                }
            });
            child.on('error', (error) => {
                core.error(`Error executing Terraform command '${command}': ${error.message}`);
                reject(error);
            });
        });
    }
}
exports.default = TerraformCliManager;
