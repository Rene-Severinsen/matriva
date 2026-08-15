import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const mobileRoot = path.join(repoRoot, "apps", "mobile");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "matriva-testflight-"));
const buildOnly = process.argv.includes("--build-only");

function copyProjectFile(relativePath) {
  fs.copyFileSync(path.join(mobileRoot, relativePath), path.join(tempRoot, relativePath));
}

function copyProjectDirectory(source, destination) {
  fs.cpSync(source, destination, {
    recursive: true,
    filter(sourcePath) {
      const relativePath = path.relative(source, sourcePath);
      return !/(^|[\\/])(node_modules|dist|\.expo|credentials)([\\/]|$)/.test(relativePath)
        && !/(^|[\\/])\.env(?:\.|$)/.test(relativePath);
    },
  });
}

function runSync(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with code ${result.status}`);
  }
}

function runStreaming(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, CI: "1" } });
    let output = "";
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });
    child.on("error", reject);
    child.on("close", (status) => {
      if (status !== 0) {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${status}`));
      } else {
        resolve(output);
      }
    });
  });
}

function createStandaloneProject() {
  fs.mkdirSync(path.join(tempRoot, "packages"), { recursive: true });
  copyProjectDirectory(path.join(mobileRoot, "src"), path.join(tempRoot, "src"));
  copyProjectDirectory(path.join(mobileRoot, "assets"), path.join(tempRoot, "assets"));
  copyProjectDirectory(path.join(repoRoot, "packages", "shared"), path.join(tempRoot, "packages", "shared"));
  copyProjectDirectory(path.join(repoRoot, "packages", "api-client"), path.join(tempRoot, "packages", "api-client"));
  fs.copyFileSync(path.join(repoRoot, "tsconfig.base.json"), path.join(tempRoot, "tsconfig.base.json"));
  for (const file of ["app.json", "eas.json", "index.ts"]) copyProjectFile(file);

  const mobilePackage = JSON.parse(fs.readFileSync(path.join(mobileRoot, "package.json"), "utf8"));
  mobilePackage.workspaces = ["packages/*"];
  mobilePackage.scripts = {
    ...mobilePackage.scripts,
    "build:packages": "npm run build -w @matriva/shared && npm run build -w @matriva/api-client",
    postinstall: "npm run build:packages",
  };
  fs.writeFileSync(path.join(tempRoot, "package.json"), `${JSON.stringify(mobilePackage, null, 2)}\n`);
  fs.writeFileSync(path.join(tempRoot, ".gitignore"), "node_modules/\ndist/\n.expo/\n.env*\n.DS_Store\n");

  runSync("npm", ["install", "--package-lock-only", "--ignore-scripts"], tempRoot);
  runSync("npm", ["ci", "--include=dev"], tempRoot);
  runSync("git", ["init"], tempRoot);
  runSync("git", ["add", "."], tempRoot);
  runSync("git", ["-c", "user.name=Matriva TestFlight", "-c", "user.email=build@matriva.local", "commit", "-m", "TestFlight build snapshot"], tempRoot);
}

async function main() {
  let succeeded = false;
  try {
    console.log(`Creating standalone EAS project in ${tempRoot}`);
    createStandaloneProject();

    const npx = process.platform === "win32" ? "npx.cmd" : "npx";
    const buildOutput = await runStreaming(npx, [
      "--yes",
      "eas-cli@latest",
      "build",
      "--platform",
      "ios",
      "--profile",
      "testflight",
      "--non-interactive",
      "--wait",
    ], tempRoot);

    if (buildOnly) return;

    const buildId = buildOutput.match(/projects\/[^/]+\/builds\/([0-9a-f-]{36})/)?.[1];
    if (!buildId) {
      throw new Error("Could not determine the EAS build ID from the build output.");
    }

    await runStreaming(npx, [
      "--yes",
      "eas-cli@latest",
      "submit",
      "--platform",
      "ios",
      "--profile",
      "testflight",
      "--id",
      buildId,
      "--non-interactive",
      "--wait",
    ], tempRoot);
    succeeded = true;
  } finally {
    if (buildOnly || succeeded) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } else {
      console.error(`Temporary build project retained for debugging: ${tempRoot}`);
    }
  }
}

main().catch((error) => {
  process.exitCode = 1;
  console.error(error instanceof Error ? error.message : error);
});
