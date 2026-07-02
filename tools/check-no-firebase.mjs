import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const ignored = new Set([".git", "node_modules", "dist", "build", ".expo"]);
const allowedFiles = new Set([
  "MATRIVA_RULESET.md",
  "MATRIVA_SCOPE_V1.md",
  "README.md",
  "docs/compliance/dependency-audit.md",
  "package-lock.json",
  "package.json",
  "tools/check-no-firebase.mjs"
]);
const forbidden = [
  /firebase/i,
  /@react-native-firebase/i,
  /firestore/i,
  /cloud functions/i
];

const violations = [];

function hasForbiddenPackageName(name) {
  return /(^|\/)firebase($|\/)|@react-native-firebase/i.test(name);
}

function checkPackageJson(path, relativePath) {
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  const dependencyGroups = [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
    manifest.optionalDependencies
  ];

  for (const dependencies of dependencyGroups) {
    if (!dependencies) continue;
    for (const name of Object.keys(dependencies)) {
      if (hasForbiddenPackageName(name)) {
        violations.push(`${relativePath}: ${name}`);
      }
    }
  }
}

function checkPackageLock(path) {
  const lockfile = JSON.parse(readFileSync(path, "utf8"));
  const packages = lockfile.packages ?? {};

  for (const packagePath of Object.keys(packages)) {
    if (hasForbiddenPackageName(packagePath)) {
      violations.push(`package-lock.json: ${packagePath}`);
    }
  }
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (ignored.has(entry)) continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path);
      continue;
    }
    if (stat.size > 1024 * 1024) continue;
    const relativePath = path.replace(`${root}/`, "");
    if (entry === "package.json") {
      checkPackageJson(path, relativePath);
      continue;
    }
    if (entry === "package-lock.json") {
      checkPackageLock(path);
      continue;
    }
    if (allowedFiles.has(relativePath)) continue;
    const text = readFileSync(path, "utf8");
    for (const pattern of forbidden) {
      if (pattern.test(text)) {
        violations.push(relativePath);
        break;
      }
    }
  }
}

walk(root);

if (violations.length > 0) {
  console.error("Firebase-related references are not allowed:");
  for (const file of violations) console.error(`- ${file}`);
  process.exit(1);
}

console.log("No disallowed Firebase references found.");
