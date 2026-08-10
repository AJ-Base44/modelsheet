import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const REPOSITORY_ROOT = path.resolve(PACKAGE_ROOT, "..", "..");
const SOURCE_FILE = path.join(REPOSITORY_ROOT, "artifacts", "api.json");
const TARGET_FILE = path.join(PACKAGE_ROOT, "data", "api.json");

function parseArguments(argv) {
  if (argv.length === 0) return { check: false };
  if (argv.length === 1 && argv[0] === "--check") return { check: true };
  throw new Error(`Unknown arguments: ${argv.join(" ")}`);
}

function validateArtifact(source) {
  let artifact;
  try {
    artifact = JSON.parse(source);
  } catch (error) {
    throw new Error(`Could not parse ${SOURCE_FILE}: ${error.message}`, {
      cause: error,
    });
  }

  if (
    artifact?.schema_version !== 1 ||
    !Array.isArray(artifact.models) ||
    typeof artifact.counts?.total_records !== "number" ||
    artifact.counts.total_records !== artifact.models.length
  ) {
    throw new Error(`${SOURCE_FILE} is not a valid Modelsheet v1 artifact`);
  }
}

async function main() {
  const { check } = parseArguments(process.argv.slice(2));

  try {
    await access(SOURCE_FILE);
  } catch {
    throw new Error(
      `Missing ${SOURCE_FILE}. Run "npm run build" from the repository root first.`,
    );
  }

  const source = await readFile(SOURCE_FILE, "utf8");
  validateArtifact(source);

  if (check) {
    let target;
    try {
      target = await readFile(TARGET_FILE, "utf8");
    } catch {
      throw new Error(
        `Missing package snapshot. Run "npm run package:sync" from the repository root.`,
      );
    }

    if (target !== source) {
      throw new Error(
        `Package snapshot is stale. Run "npm run package:sync" from the repository root.`,
      );
    }

    console.log(`Package snapshot matches ${SOURCE_FILE}`);
    return;
  }

  await mkdir(path.dirname(TARGET_FILE), { recursive: true });
  await writeFile(TARGET_FILE, source, "utf8");
  console.log(`Synchronized ${TARGET_FILE}`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
