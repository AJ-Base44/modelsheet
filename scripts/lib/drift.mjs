import { spawnSync } from "node:child_process";

import TOML from "@iarna/toml";

import { canonicalize } from "../build.mjs";
import { normalizeTomlValue } from "./records.mjs";

const MODEL_PATH_PREFIX = "models/";
const TOML_EXTENSION = ".toml";

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function runGit(repositoryDirectory, arguments_, { allowFailure = false } = {}) {
  const result = spawnSync("git", arguments_, {
    cwd: repositoryDirectory,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });

  if (result.error) {
    throw new Error(`Could not run git ${arguments_.join(" ")}: ${result.error.message}`, {
      cause: result.error,
    });
  }

  if (!allowFailure && result.status !== 0) {
    const detail = (result.stderr || result.stdout || "unknown Git error").trim();
    throw new Error(`git ${arguments_.join(" ")} failed: ${detail}`);
  }

  return result;
}

function gitText(repositoryDirectory, arguments_) {
  return runGit(repositoryDirectory, arguments_).stdout;
}

function readBlobBatch(repositoryDirectory, specifications) {
  if (specifications.length === 0) return new Map();

  const result = spawnSync("git", ["cat-file", "--batch"], {
    cwd: repositoryDirectory,
    input: `${specifications.join("\n")}\n`,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });

  if (result.error) {
    throw new Error(`Could not read historical Git blobs: ${result.error.message}`, {
      cause: result.error,
    });
  }

  if (result.status !== 0) {
    throw new Error(
      `Could not read historical Git blobs: ${String(result.stderr || "unknown Git error").trim()}`,
    );
  }

  const blobs = new Map();
  let offset = 0;

  for (const specification of specifications) {
    const headerEnd = result.stdout.indexOf(10, offset);
    if (headerEnd === -1) {
      throw new Error(`Git returned an incomplete blob header for ${specification}`);
    }

    const header = result.stdout.subarray(offset, headerEnd).toString("utf8");
    if (header.endsWith(" missing")) {
      throw new Error(`Historical Git blob does not exist: ${specification}`);
    }

    const match = /\sblob\s(\d+)$/.exec(header);
    if (!match) {
      throw new Error(`Git returned an unexpected blob header for ${specification}: ${header}`);
    }

    const length = Number.parseInt(match[1], 10);
    const contentStart = headerEnd + 1;
    const contentEnd = contentStart + length;
    blobs.set(
      specification,
      result.stdout.subarray(contentStart, contentEnd).toString("utf8"),
    );
    offset = contentEnd + 1;
  }

  return blobs;
}

export function assertCompleteHistory(repositoryDirectory) {
  const shallow = gitText(repositoryDirectory, [
    "rev-parse",
    "--is-shallow-repository",
  ]).trim();

  if (shallow === "true") {
    throw new Error(
      "Cannot build the drift feed from a shallow repository. Fetch complete history first (for GitHub Actions use checkout fetch-depth: 0; locally run git fetch --unshallow).",
    );
  }

  if (shallow !== "false") {
    throw new Error(`Git returned an unexpected shallow-repository state: ${shallow}`);
  }
}

export function normalizeRepositoryUrl(remoteUrl) {
  const value = remoteUrl.trim();
  let normalized;

  if (/^git@[^:]+:.+/.test(value)) {
    const match = /^git@([^:]+):(.+)$/.exec(value);
    normalized = `https://${match[1]}/${match[2]}`;
  } else if (/^ssh:\/\/git@/.test(value)) {
    const url = new URL(value);
    normalized = `https://${url.hostname}${url.pathname}`;
  } else if (/^https?:\/\//.test(value)) {
    normalized = value;
  } else {
    throw new Error(
      `Cannot derive public commit links from remote URL ${JSON.stringify(value)}. Pass repositoryUrl explicitly.`,
    );
  }

  return normalized.replace(/\.git\/?$/, "").replace(/\/$/, "");
}

function resolveRepositoryUrl(repositoryDirectory, explicitUrl) {
  if (explicitUrl) {
    return normalizeRepositoryUrl(explicitUrl);
  }

  const result = runGit(
    repositoryDirectory,
    ["remote", "get-url", "origin"],
    { allowFailure: true },
  );

  if (result.status !== 0 || !result.stdout.trim()) {
    throw new Error(
      "Cannot build commit links because this repository has no origin remote. Pass repositoryUrl explicitly.",
    );
  }

  return normalizeRepositoryUrl(result.stdout);
}

function parseToml(source, context) {
  try {
    return normalizeTomlValue(TOML.parse(source));
  } catch (error) {
    throw new Error(`Could not parse historical TOML at ${context}: ${error.message}`, {
      cause: error,
    });
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepEqual(left, right) {
  if (Object.is(left, right)) return true;

  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => deepEqual(value, right[index]))
    );
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left).sort(compareStrings);
    const rightKeys = Object.keys(right).sort(compareStrings);
    return (
      deepEqual(leftKeys, rightKeys) &&
      leftKeys.every((key) => deepEqual(left[key], right[key]))
    );
  }

  return false;
}

function appendProperty(basePath, key) {
  if (/^[A-Za-z0-9_-]+$/.test(key)) {
    return basePath ? `${basePath}.${key}` : key;
  }

  return `${basePath}[${JSON.stringify(key)}]`;
}

function keyedArray(array) {
  if (
    array.length === 0 ||
    !array.every(
      (value) => isPlainObject(value) && typeof value.id === "string" && value.id,
    )
  ) {
    return null;
  }

  const entries = new Map(array.map((value) => [value.id, value]));
  return entries.size === array.length ? entries : null;
}

function addChange(changes, path, before, after) {
  if (before === undefined) {
    changes.push({
      path,
      kind: "added",
      after: canonicalize(after),
    });
  } else if (after === undefined) {
    changes.push({
      path,
      kind: "removed",
      before: canonicalize(before),
    });
  } else {
    changes.push({
      path,
      kind: "changed",
      before: canonicalize(before),
      after: canonicalize(after),
    });
  }
}

function visitDiff(before, after, path, changes) {
  if (deepEqual(before, after)) return;

  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort(
      compareStrings,
    );

    for (const key of keys) {
      visitDiff(before[key], after[key], appendProperty(path, key), changes);
    }
    return;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const beforeById = keyedArray(before);
    const afterById = keyedArray(after);

    if (beforeById && afterById) {
      const ids = [...new Set([...beforeById.keys(), ...afterById.keys()])].sort(
        compareStrings,
      );

      for (const id of ids) {
        visitDiff(
          beforeById.get(id),
          afterById.get(id),
          `${path}[id=${JSON.stringify(id)}]`,
          changes,
        );
      }
      return;
    }
  }

  addChange(changes, path, before, after);
}

export function semanticDiff(before, after) {
  const changes = [];
  visitDiff(before, after, "", changes);
  return changes;
}

function toModelPath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function isModelToml(filePath) {
  const normalized = toModelPath(filePath);
  return normalized.startsWith(MODEL_PATH_PREFIX) && normalized.endsWith(TOML_EXTENSION);
}

function modelIdentity(record, filePath, context) {
  const model = record?.model;
  const required = ["id", "name", "lab", "modality"];
  const missing = required.filter(
    (field) => typeof model?.[field] !== "string" || model[field].length === 0,
  );

  if (missing.length > 0) {
    throw new Error(
      `Historical record ${context} is missing model identity field(s): ${missing.join(", ")}`,
    );
  }

  return canonicalize({
    id: model.id,
    name: model.name,
    lab: model.lab,
    modality: model.modality,
    path: toModelPath(filePath),
  });
}

function parseNameStatus(output) {
  const tokens = output.split("\0");
  if (tokens.at(-1) === "") tokens.pop();

  const changes = [];
  for (let index = 0; index < tokens.length; ) {
    const status = tokens[index++];
    const kind = status[0];

    if (kind === "R" || kind === "C") {
      const beforePath = tokens[index++];
      const afterPath = tokens[index++];
      changes.push({ status: kind, beforePath, afterPath });
    } else {
      const filePath = tokens[index++];
      changes.push({
        status: kind,
        beforePath: kind === "A" ? undefined : filePath,
        afterPath: kind === "D" ? undefined : filePath,
      });
    }
  }

  return changes
    .filter(
      ({ beforePath, afterPath }) =>
        (beforePath && isModelToml(beforePath)) ||
        (afterPath && isModelToml(afterPath)),
    )
    .sort((left, right) =>
      compareStrings(
        left.afterPath || left.beforePath,
        right.afterPath || right.beforePath,
      ),
    );
}

function changedModelFiles(repositoryDirectory, sha, parent) {
  if (parent) {
    return parseNameStatus(
      gitText(repositoryDirectory, [
        "diff",
        "--name-status",
        "-z",
        "-M",
        parent,
        sha,
        "--",
        "models",
      ]),
    );
  }

  return parseNameStatus(
    gitText(repositoryDirectory, [
      "diff-tree",
      "--root",
      "--no-commit-id",
      "--name-status",
      "-r",
      "-z",
      "-M",
      sha,
      "--",
      "models",
    ]),
  );
}

function readHistoricalRecord(blobs, revision, filePath) {
  const specification = `${revision}:${toModelPath(filePath)}`;
  return parseToml(
    blobs.get(specification),
    specification,
  );
}

function commitMetadata(repositoryDirectory, sha, repositoryUrl) {
  const output = gitText(repositoryDirectory, [
    "show",
    "-s",
    "--format=%P%x00%cI%x00%B",
    sha,
  ]);
  const firstSeparator = output.indexOf("\0");
  const secondSeparator = output.indexOf("\0", firstSeparator + 1);
  if (firstSeparator === -1 || secondSeparator === -1) {
    throw new Error(`Could not read metadata for commit ${sha}`);
  }

  return {
    parents: output.slice(0, firstSeparator).trim().split(/\s+/).filter(Boolean),
    commit: {
      sha,
      date: output.slice(firstSeparator + 1, secondSeparator),
      message: output.slice(secondSeparator + 1).trimEnd(),
      url: `${repositoryUrl}/commit/${sha}`,
    },
  };
}

function makeEventId(sha, modelId) {
  return `${sha}:${modelId}`;
}

function createModelEvent({
  change,
  sha,
  parent,
  commit,
  blobs,
}) {
  const before = change.beforePath
    ? readHistoricalRecord(blobs, parent || `${sha}^`, change.beforePath)
    : undefined;
  const after = change.afterPath
    ? readHistoricalRecord(blobs, sha, change.afterPath)
    : undefined;
  const record = after || before;
  const filePath = change.afterPath || change.beforePath;
  const model = modelIdentity(record, filePath, `${sha}:${filePath}`);
  const base = {
    id: makeEventId(sha, model.id),
    model,
    commit,
  };

  if (!before) {
    return { ...base, type: "model_added" };
  }

  if (!after) {
    return { ...base, type: "model_removed" };
  }

  const changes = semanticDiff(before, after);
  const moved = toModelPath(change.beforePath) !== toModelPath(change.afterPath);

  if (changes.length === 0 && !moved) {
    return null;
  }

  if (changes.length === 0) {
    return {
      ...base,
      type: "model_moved",
      previous_path: toModelPath(change.beforePath),
    };
  }

  return {
    ...base,
    type: "model_updated",
    ...(moved ? { previous_path: toModelPath(change.beforePath) } : {}),
    changes,
  };
}

export function collectDriftEvents({
  repositoryDirectory,
  repositoryUrl,
  revision = "HEAD",
}) {
  assertCompleteHistory(repositoryDirectory);
  const publicRepositoryUrl = resolveRepositoryUrl(
    repositoryDirectory,
    repositoryUrl,
  );
  const output = gitText(repositoryDirectory, [
    "rev-list",
    "--topo-order",
    revision,
    "--",
    "models",
  ]).trim();
  const commits = output ? output.split(/\r?\n/) : [];
  const events = [];

  for (const sha of commits) {
    const metadata = commitMetadata(repositoryDirectory, sha, publicRepositoryUrl);
    const parents = metadata.parents;
    const parent = parents[0];
    const commit = metadata.commit;
    const fileChanges = changedModelFiles(repositoryDirectory, sha, parent);
    const blobSpecifications = fileChanges.flatMap((change) => [
      ...(change.beforePath
        ? [`${parent || `${sha}^`}:${toModelPath(change.beforePath)}`]
        : []),
      ...(change.afterPath
        ? [`${sha}:${toModelPath(change.afterPath)}`]
        : []),
    ]);
    const blobs = readBlobBatch(repositoryDirectory, blobSpecifications);

    for (const change of fileChanges) {
      const event = createModelEvent({
        change,
        sha,
        parent,
        commit,
        blobs,
      });
      if (event) events.push(canonicalize(event));
    }
  }

  return canonicalize({
    feed_version: 1,
    repository: publicRepositoryUrl,
    events,
  });
}

export function serializeDriftArtifact(artifact) {
  return `${JSON.stringify(canonicalize(artifact), null, 2)}\n`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function summarizeEvent(event) {
  if (event.type === "model_added") return "Model record added.";
  if (event.type === "model_removed") return "Model record removed.";
  if (event.type === "model_moved") {
    return `Model record moved from ${event.previous_path} to ${event.model.path}.`;
  }

  return event.changes
    .map((change) => {
      if (change.kind === "added") {
        return `${change.path}: added ${JSON.stringify(change.after)}`;
      }
      if (change.kind === "removed") {
        return `${change.path}: removed ${JSON.stringify(change.before)}`;
      }
      return `${change.path}: ${JSON.stringify(change.before)} -> ${JSON.stringify(change.after)}`;
    })
    .join("\n");
}

function eventTitle(event) {
  if (event.type === "model_added") return `${event.model.name}: record added`;
  if (event.type === "model_removed") return `${event.model.name}: record removed`;
  if (event.type === "model_moved") return `${event.model.name}: record moved`;
  const suffix = event.changes.length === 1 ? "field changed" : "fields changed";
  return `${event.model.name}: ${event.changes.length} ${suffix}`;
}

export function serializeDriftRss(artifact, { title = "Modelsheet drift feed" } = {}) {
  const items = artifact.events.map(
    (event) => `    <item>
      <title>${escapeXml(eventTitle(event))}</title>
      <link>${escapeXml(event.commit.url)}</link>
      <guid isPermaLink="false">${escapeXml(event.id)}</guid>
      <pubDate>${escapeXml(new Date(event.commit.date).toUTCString())}</pubDate>
      <description>${escapeXml(summarizeEvent(event))}</description>
    </item>`,
  );
  const lastBuildDate = artifact.events[0]
    ? `\n    <lastBuildDate>${escapeXml(new Date(artifact.events[0].commit.date).toUTCString())}</lastBuildDate>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(artifact.repository)}</link>
    <description>Capability and pricing changes derived from Modelsheet&apos;s model-record Git history.</description>${lastBuildDate}
${items.join("\n")}
  </channel>
</rss>
`;
}
