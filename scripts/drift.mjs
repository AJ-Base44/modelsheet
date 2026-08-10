import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  collectDriftEvents,
  serializeDriftArtifact,
  serializeDriftRss,
} from "./lib/drift.mjs";

const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const DEFAULT_JSON_OUTPUT = path.join(REPOSITORY_ROOT, "artifacts", "drift.json");
const DEFAULT_RSS_OUTPUT = path.join(
  REPOSITORY_ROOT,
  "artifacts",
  "drift.rss.xml",
);

function parseArguments(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];

    if (argument === "--repository" && value) {
      options.repositoryDirectory = path.resolve(value);
      index += 1;
    } else if (argument === "--repository-url" && value) {
      options.repositoryUrl = value;
      index += 1;
    } else if (argument === "--revision" && value) {
      options.revision = value;
      index += 1;
    } else if (argument === "--json-output" && value) {
      options.jsonOutput = path.resolve(value);
      index += 1;
    } else if (argument === "--rss-output" && value) {
      options.rssOutput = path.resolve(value);
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }

  return options;
}

export async function buildDriftFeed({
  repositoryDirectory = REPOSITORY_ROOT,
  repositoryUrl,
  revision = "HEAD",
  jsonOutput = DEFAULT_JSON_OUTPUT,
  rssOutput = DEFAULT_RSS_OUTPUT,
} = {}) {
  const artifact = collectDriftEvents({
    repositoryDirectory: path.resolve(repositoryDirectory),
    repositoryUrl,
    revision,
  });
  const jsonBytes = serializeDriftArtifact(artifact);
  const rssBytes = serializeDriftRss(artifact);
  const absoluteJsonOutput = path.resolve(jsonOutput);
  const absoluteRssOutput = path.resolve(rssOutput);

  await mkdir(path.dirname(absoluteJsonOutput), { recursive: true });
  await mkdir(path.dirname(absoluteRssOutput), { recursive: true });
  await Promise.all([
    writeFile(absoluteJsonOutput, jsonBytes, "utf8"),
    writeFile(absoluteRssOutput, rssBytes, "utf8"),
  ]);

  return {
    artifact,
    jsonBytes,
    rssBytes,
    jsonOutput: absoluteJsonOutput,
    rssOutput: absoluteRssOutput,
  };
}

const isCommandLine =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCommandLine) {
  try {
    const result = await buildDriftFeed(parseArguments(process.argv.slice(2)));
    console.log(
      `Built ${result.jsonOutput} and ${result.rssOutput} (${result.artifact.events.length} drift events)`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
