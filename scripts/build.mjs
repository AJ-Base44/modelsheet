import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadRecords, normalizeTomlValue } from "./lib/records.mjs";

const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const DEFAULT_MODELS_DIR = path.join(REPOSITORY_ROOT, "models");
const DEFAULT_OUTPUT_FILE = path.join(REPOSITORY_ROOT, "artifacts", "api.json");

function compareStrings(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * Return a JSON-safe value whose object keys have a stable code-point order.
 * Array order is preserved because some schema arrays, such as quality_order,
 * are intentionally ordered.
 */
export function canonicalize(value) {
  if (value instanceof Date) {
    return value.toJSON();
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort(compareStrings)
        .map((key) => [key, canonicalize(value[key])]),
    );
  }

  if (typeof value === "bigint") {
    throw new TypeError("Cannot emit a TOML integer outside JSON's number range");
  }

  return value;
}

export function createArtifact(entries) {
  if (entries.length === 0) {
    throw new Error("Cannot build api.json: no model records were found");
  }

  const records = entries.map(({ record }) => normalizeTomlValue(record));
  const schemaVersions = new Set(records.map((record) => record.schema_version));

  if (schemaVersions.size !== 1) {
    throw new Error(
      `Cannot build api.json: records use multiple schema versions (${[
        ...schemaVersions,
      ].join(", ")})`,
    );
  }

  const [schemaVersion] = schemaVersions;
  if (!Number.isInteger(schemaVersion)) {
    throw new Error("Cannot build api.json: schema_version must be an integer");
  }

  const models = records
    .map((record) => canonicalize(record))
    .sort((left, right) => compareStrings(left.model.id, right.model.id));

  return canonicalize({
    schema_version: schemaVersion,
    models,
  });
}

export function serializeArtifact(artifact) {
  return `${JSON.stringify(canonicalize(artifact), null, 2)}\n`;
}

export async function buildRegistry({
  modelsDir = DEFAULT_MODELS_DIR,
  outputFile = DEFAULT_OUTPUT_FILE,
} = {}) {
  const entries = await loadRecords(path.resolve(modelsDir));
  const artifact = createArtifact(entries);
  const bytes = serializeArtifact(artifact);

  await mkdir(path.dirname(path.resolve(outputFile)), { recursive: true });
  await writeFile(path.resolve(outputFile), bytes, "utf8");

  return { artifact, bytes, outputFile: path.resolve(outputFile) };
}

function parseArguments(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];

    if (argument === "--models-dir" && value) {
      options.modelsDir = value;
      index += 1;
    } else if (argument === "--output" && value) {
      options.outputFile = value;
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }

  return options;
}

const isCommandLine =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCommandLine) {
  try {
    const result = await buildRegistry(parseArguments(process.argv.slice(2)));
    console.log(`Built ${result.outputFile} (${result.artifact.models.length} models)`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
