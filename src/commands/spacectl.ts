import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";
import * as github from "@actions/github";
import os from "os";
import path from "path";

const octokit = github.getOctokit(core.getInput("github-token"));
const downloadURL = "https://github.com/spacelift-io/spacectl/releases/download";

async function installAndGetFolder(): Promise<string> {
  const version = await getVersion();
  const arch = getArchitecture();
  core.setOutput("version", version);

  const cached = tc.find("spacectl", version, arch);
  if (cached) return cached;

  const assetURL = await getAssetURL(version, arch);
  const zipPath = await tc.downloadTool(assetURL);
  const extractedFolder = await tc.extractZip(zipPath, path.join(os.homedir(), "spacectl"));
  await tc.cacheDir(extractedFolder, "spacectl", version, arch);

  return extractedFolder;
}

async function getAssetURL(version: string, arch: string): Promise<string> {
  const platform = getPlatform();
  return `${downloadURL}/${version}/spacectl_${version.substring(1)}_${platform}_${arch}.zip`;
}

async function getVersion(): Promise<string> {
  let version = core.getInput("version") || "latest";
  if (version === "latest") {
    version = await getLatestVersion();
  }
  return version.startsWith("v") ? version : `v${version}`;
}

async function getLatestVersion(): Promise<string> {
  const releases = (await octokit.rest.repos.listReleases({ owner: "spacelift-io", repo: "spacectl" })).data;
  const release = releases.find(r => !r.draft && !r.prerelease);
  if (!release) throw new Error("No releases found for Spacectl");
  return release.tag_name;
}

function getPlatform(): string {
  return os.platform() === "win32" ? "windows" : os.platform();
}

function getArchitecture(): string {
  switch (os.arch()) {
    case "x64": return "amd64";
    case "x32": return "386";
    case "arm": return "armv6l";
    default: return os.arch(); // fallback to original arch
  }
}

export { installAndGetFolder };
