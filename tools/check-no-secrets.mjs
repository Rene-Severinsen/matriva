import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const ignored = new Set([".git", "node_modules", "dist", "build", ".expo"]);
const patterns = [
  /-----BEGIN (RSA |EC |OPENSSH |)?PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,
  /AIza[0-9A-Za-z_-]{35}/,
  /xox[baprs]-[0-9A-Za-z-]+/,
  /(?<!example_)(secret|password|private_key)\s*[:=]\s*["'][^"']{8,}["']/i
];

const violations = [];

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
    const text = readFileSync(path, "utf8");
    if (patterns.some((pattern) => pattern.test(text))) {
      violations.push(path.replace(`${root}/`, ""));
    }
  }
}

walk(root);

if (violations.length > 0) {
  console.error("Potential hardcoded secrets found:");
  for (const file of violations) console.error(`- ${file}`);
  process.exit(1);
}

console.log("No common hardcoded secret patterns found.");
