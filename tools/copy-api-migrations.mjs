import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  ".."
);

const sourceDirectory = join(
  repositoryRoot,
  "apps",
  "api",
  "src",
  "migrations"
);

const targetDirectory = join(
  repositoryRoot,
  "apps",
  "api",
  "dist",
  "migrations"
);

const sourceFiles = (await readdir(sourceDirectory))
  .filter((name) => /^\d+_.+\.sql$/.test(name))
  .sort();

if (sourceFiles.length === 0) {
  throw new Error(
    `No API migration files found in ${sourceDirectory}`
  );
}

await rm(targetDirectory, {
  recursive: true,
  force: true
});

await mkdir(targetDirectory, {
  recursive: true
});

for (const fileName of sourceFiles) {
  await cp(
    join(sourceDirectory, fileName),
    join(targetDirectory, fileName)
  );
}

const copiedFiles = (await readdir(targetDirectory))
  .filter((name) => /^\d+_.+\.sql$/.test(name))
  .sort();

if (
  copiedFiles.length !== sourceFiles.length ||
  copiedFiles.some((name, index) => name !== sourceFiles[index])
) {
  throw new Error(
    "Copied API migrations do not match source migrations."
  );
}

console.log(
  JSON.stringify({
    event: "api.migrations_copied",
    migrationCount: copiedFiles.length,
    targetDirectory
  })
);
