import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import TOML from "@iarna/toml";

function compareCodePoints(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function normalizeTomlValue(value) {
  if (value instanceof Date) {
    const serialized = value.toISOString();
    return value.isDate === true ? serialized.slice(0, 10) : serialized;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeTomlValue(item));
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        normalizeTomlValue(nestedValue),
      ]),
    );
  }

  return value;
}

export async function discoverModelFiles(modelsDir) {
  const absoluteModelsDir = path.resolve(modelsDir);
  const files = [];

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => compareCodePoints(left.name, right.name));

    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(entryPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".toml")) {
        files.push(entryPath);
      }
    }
  }

  await visit(absoluteModelsDir);
  return files.sort(compareCodePoints);
}

export async function readTomlFile(filePath) {
  const absoluteFilePath = path.resolve(filePath);
  const source = await readFile(absoluteFilePath, "utf8");

  try {
    return normalizeTomlValue(TOML.parse(source));
  } catch (error) {
    const parseError = new Error(`Could not parse ${absoluteFilePath}: ${error.message}`, {
      cause: error,
    });
    parseError.code = "MODELSHEET_TOML_PARSE_ERROR";
    parseError.filePath = absoluteFilePath;
    throw parseError;
  }
}

export async function loadRecords(modelsDir) {
  const files = await discoverModelFiles(modelsDir);
  const entries = [];

  for (const filePath of files) {
    entries.push({
      filePath,
      record: await readTomlFile(filePath),
    });
  }

  return entries;
}
