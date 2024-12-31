import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";
import os from "os";
import path from "path";
import * as fs from "fs";

const terraformDownloadURL = "https://releases.hashicorp.com/terraform";

async function installTerraformAndGetFolder(): Promise<string> {
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
  const extractedFolder = await tc.extractZip(zipPath, path.join(os.homedir(), "terraform"));

  // Cache the extracted folder
  const cachedFolder = await tc.cacheDir(extractedFolder, "terraform", version, arch);
  core.info(`Terraform cached at ${cachedFolder}`);

  // Validate binary existence
  const terraformBinary = path.join(cachedFolder, "terraform");
  if (!fs.existsSync(terraformBinary)) {
    throw new Error(`Terraform binary not found in ${cachedFolder}`);
  }

  // Add to PATH
  core.addPath(cachedFolder);
  core.info(`Terraform added to PATH from ${cachedFolder}`);

  return cachedFolder;
}

async function getAssetURL(version: string, arch: string): Promise<string> {
  const platform = getPlatform();
  return `${terraformDownloadURL}/${version}/terraform_${version}_${platform}_${arch}.zip`;
}

async function getVersion(): Promise<string> {
  let version = core.getInput("tf_version") || "1.10.3";
  if (version === "latest") {
    version = await getLatestVersion();
  }
  return version;
}

async function getLatestVersion(): Promise<string> {
  const metadataURL = `${terraformDownloadURL}/index.json`;
  const response = await fetch(metadataURL);
  if (!response.ok) throw new Error(`Failed to fetch Terraform releases metadata: ${response.statusText}`);

  const metadata = await response.json();
  const latestVersion = metadata.versions[metadata.latest];
  if (!latestVersion) throw new Error("No latest version found for Terraform");

  return latestVersion.version;
}

function getPlatform(): string {
  switch (os.platform()) {
    case "win32": return "windows";
    case "darwin": return "darwin";
    case "linux": return "linux";
    default: throw new Error(`Unsupported platform: ${os.platform()}`);
  }
}

function getArchitecture(): string {
  switch (os.arch()) {
    case "x64": return "amd64";
    case "x32": return "386";
    case "arm": return "arm";
    case "arm64": return "arm64";
    default: throw new Error(`Unsupported architecture: ${os.arch()}`);
  }
}

export { installTerraformAndGetFolder };
