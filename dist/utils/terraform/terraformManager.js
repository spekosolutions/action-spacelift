"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const authorizationManager_1 = __importDefault(require("../authorization/authorizationManager"));
// Parent class to manage common Spacelift environment setup
class TerraformManager {
    constructor() {
        this.authorizationManager = new authorizationManager_1.default(); // Initialize the AuthorizationManager
    }
}
exports.default = TerraformManager;
