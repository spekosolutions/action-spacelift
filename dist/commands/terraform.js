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
exports.installTerraformAndGetFolder = installTerraformAndGetFolder;
const core = __importStar(require("@actions/core"));
const tc = __importStar(require("@actions/tool-cache"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const fs = __importStar(require("fs"));
const terraformDownloadURL = "https://releases.hashicorp.com/terraform";
async function installTerraformAndGetFolder() {
    const version = await getVersion();
    const arch = getArchitecture();
    core.setOutput("version", version);
    const cached = tc.find("terraform", version, arch);
    if (cached) {
        core.info(`Terraform found in cache at ${cached}`);
        return cached;
    }
    const assetURL = await getAssetURL(version, arch);
    core.info(`Downloading Terraform from ${assetURL}...`);
    const zipPath = await tc.downloadTool(assetURL);
    const extractedFolder = await tc.extractZip(zipPath, path_1.default.join(os_1.default.homedir(), "terraform"));
    // Cache the extracted folder
    const cachedFolder = await tc.cacheDir(extractedFolder, "terraform", version, arch);
    core.info(`Terraform cached at ${cachedFolder}`);
    // Validate binary existence
    const terraformBinary = path_1.default.join(cachedFolder, "terraform");
    if (!fs.existsSync(terraformBinary)) {
        throw new Error(`Terraform binary not found in ${cachedFolder}`);
    }
    // Add to PATH
    core.addPath(cachedFolder);
    core.info(`Terraform added to PATH from ${cachedFolder}`);
    return cachedFolder;
}
async function getAssetURL(version, arch) {
    const platform = getPlatform();
    return `${terraformDownloadURL}/${version}/terraform_${version}_${platform}_${arch}.zip`;
}
async function getVersion() {
    let version = core.getInput("tf_version") || "1.10.3";
    if (version === "latest") {
        version = await getLatestVersion();
    }
    return version;
}
async function getLatestVersion() {
    const metadataURL = `${terraformDownloadURL}/index.json`;
    const response = await fetch(metadataURL);
    if (!response.ok)
        throw new Error(`Failed to fetch Terraform releases metadata: ${response.statusText}`);
    const metadata = await response.json();
    const latestVersion = metadata.versions[metadata.latest];
    if (!latestVersion)
        throw new Error("No latest version found for Terraform");
    return latestVersion.version;
}
function getPlatform() {
    switch (os_1.default.platform()) {
        case "win32": return "windows";
        case "darwin": return "darwin";
        case "linux": return "linux";
        default: throw new Error(`Unsupported platform: ${os_1.default.platform()}`);
    }
}
function getArchitecture() {
    switch (os_1.default.arch()) {
        case "x64": return "amd64";
        case "x32": return "386";
        case "arm": return "arm";
        case "arm64": return "arm64";
        default: throw new Error(`Unsupported architecture: ${os_1.default.arch()}`);
    }
}
