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
exports.installAndGetFolder = installAndGetFolder;
const core = __importStar(require("@actions/core"));
const tc = __importStar(require("@actions/tool-cache"));
const github = __importStar(require("@actions/github"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const octokit = github.getOctokit(core.getInput("github-token"));
const downloadURL = "https://github.com/spacelift-io/spacectl/releases/download";
async function installAndGetFolder() {
    const version = await getVersion();
    const arch = getArchitecture();
    core.setOutput("version", version);
    const cached = tc.find("spacectl", version, arch);
    if (cached)
        return cached;
    const assetURL = await getAssetURL(version, arch);
    const zipPath = await tc.downloadTool(assetURL);
    const extractedFolder = await tc.extractZip(zipPath, path_1.default.join(os_1.default.homedir(), "spacectl"));
    await tc.cacheDir(extractedFolder, "spacectl", version, arch);
    return extractedFolder;
}
async function getAssetURL(version, arch) {
    const platform = getPlatform();
    return `${downloadURL}/${version}/spacectl_${version.substring(1)}_${platform}_${arch}.zip`;
}
async function getVersion() {
    let version = core.getInput("version") || "latest";
    if (version === "latest") {
        version = await getLatestVersion();
    }
    return version.startsWith("v") ? version : `v${version}`;
}
async function getLatestVersion() {
    const releases = (await octokit.rest.repos.listReleases({ owner: "spacelift-io", repo: "spacectl" })).data;
    const release = releases.find(r => !r.draft && !r.prerelease);
    if (!release)
        throw new Error("No releases found for Spacectl");
    return release.tag_name;
}
function getPlatform() {
    return os_1.default.platform() === "win32" ? "windows" : os_1.default.platform();
}
function getArchitecture() {
    switch (os_1.default.arch()) {
        case "x64": return "amd64";
        case "x32": return "386";
        case "arm": return "armv6l";
        default: return os_1.default.arch(); // fallback to original arch
    }
}
