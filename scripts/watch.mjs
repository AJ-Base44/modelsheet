import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const DEFAULT_TARGETS_PATH = path.join(REPOSITORY_ROOT, "watch", "targets.json");
const DEFAULT_STATE_PATH = path.join(REPOSITORY_ROOT, ".watch-state", "state.json");
const DEFAULT_DELAY_MS = 1_000;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MINIMUM_BYTES = 256;
const DEFAULT_MINIMUM_VISIBLE_BYTES = 128;
const MINIMUM_APP_SHELL_BYTES = 1_024;
const MINIMUM_RETAINED_FRACTION = 0.25;
const USER_AGENT =
  "Modelsheet-source-watcher/1.0 (+https://github.com/AJ-Base44/modelsheet)";

function parsePositiveInteger(value, label, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return parsed;
}

function parseArguments(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];

    if (argument === "--targets" || argument === "--state" || argument === "--repo") {
      if (!value) throw new Error(`${argument} requires a value`);
      options[argument.slice(2)] = value;
      index += 1;
      continue;
    }

    if (argument === "--delay-ms" || argument === "--timeout-ms") {
      if (!value) throw new Error(`${argument} requires a value`);
      options[argument.slice(2).replace("-", "_")] = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

export function hashContent(content) {
  return createHash("sha256").update(content).digest("hex");
}

function decodeHtmlEntity(entity) {
  const numeric = entity.match(/^&#(x[0-9a-f]+|[0-9]+);$/i);
  if (numeric) {
    const value = numeric[1].toLowerCase().startsWith("x")
      ? Number.parseInt(numeric[1].slice(1), 16)
      : Number.parseInt(numeric[1], 10);
    try {
      return String.fromCodePoint(value);
    } catch {
      return entity;
    }
  }

  const named = {
    "&amp;": "&",
    "&apos;": "'",
    "&gt;": ">",
    "&lt;": "<",
    "&nbsp;": " ",
    "&quot;": '"',
  };
  return named[entity.toLowerCase()] ?? entity;
}

export function contentForHash(content, kind, contentType = "text/html") {
  if (kind === "llms_txt") {
    return { basis: "sha256-bytes-v1", content };
  }

  if (
    contentType.startsWith("text/plain") ||
    contentType.startsWith("text/markdown") ||
    contentType.startsWith("text/x-markdown")
  ) {
    return { basis: "sha256-text-bytes-v1", content };
  }

  const visibleText = content
    .toString("utf8")
    .replace(/<!--[^]*?-->/g, " ")
    .replace(
      /<(script|style|noscript|template|svg)\b[^>]*>[^]*?<\/\1\s*>/gi,
      " ",
    )
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:article|div|h[1-6]|li|main|p|section|table|tr)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:#(?:x[0-9a-f]+|[0-9]+)|[a-z][a-z0-9]+);/gi, decodeHtmlEntity)
    .normalize("NFC")
    .replace(/\s+/gu, " ")
    .trim();

  const visibleContent = Buffer.from(visibleText, "utf8");
  if (
    visibleContent.byteLength < DEFAULT_MINIMUM_VISIBLE_BYTES &&
    content.byteLength >= MINIMUM_APP_SHELL_BYTES
  ) {
    const stableShell = content
      .toString("utf8")
      .replace(/<!--[^]*?-->/g, " ")
      .replace(/<script\b([^>]*)>[^]*?<\/script\s*>/gi, (_match, attributes) => {
        const source = attributes.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
        return source ? `<script src="${source}"></script>` : " ";
      })
      .replace(/\s+/gu, " ")
      .trim();
    return {
      basis: "sha256-html-shell-v1",
      content: Buffer.from(stableShell, "utf8"),
    };
  }

  return {
    basis: "sha256-visible-text-v1",
    content: visibleContent,
  };
}

function assertTargets(document) {
  if (document?.version !== 1 || !Array.isArray(document.targets)) {
    throw new Error("Watch target list must have version 1 and a targets array");
  }

  const ids = new Set();
  const urls = new Set();

  for (const [index, target] of document.targets.entries()) {
    const label = `targets[${index}]`;
    if (!target || typeof target !== "object" || Array.isArray(target)) {
      throw new Error(`${label} must be an object`);
    }

    const allowedKeys = new Set(["id", "lab", "kind", "url", "minimum_bytes"]);
    for (const key of Object.keys(target)) {
      if (!allowedKeys.has(key)) throw new Error(`${label} has unknown key ${key}`);
    }

    for (const key of ["id", "lab", "kind", "url"]) {
      if (typeof target[key] !== "string" || target[key].trim() === "") {
        throw new Error(`${label}.${key} must be a non-empty string`);
      }
    }

    if (!new Set(["changelog", "release_notes", "llms_txt", "docs"]).has(target.kind)) {
      throw new Error(`${label}.kind is not supported`);
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(target.url);
    } catch {
      throw new Error(`${label}.url must be a valid URL`);
    }
    if (parsedUrl.protocol !== "https:") {
      throw new Error(`${label}.url must use HTTPS`);
    }

    if (
      target.minimum_bytes !== undefined &&
      (!Number.isInteger(target.minimum_bytes) || target.minimum_bytes < 1)
    ) {
      throw new Error(`${label}.minimum_bytes must be a positive integer`);
    }

    if (ids.has(target.id)) throw new Error(`Duplicate watch target id: ${target.id}`);
    if (urls.has(target.url)) throw new Error(`Duplicate watch target URL: ${target.url}`);
    ids.add(target.id);
    urls.add(target.url);
  }

  return document.targets;
}

export async function loadTargets(targetsPath = DEFAULT_TARGETS_PATH) {
  const document = JSON.parse(await readFile(targetsPath, "utf8"));
  return assertTargets(document);
}

export async function loadState(statePath = DEFAULT_STATE_PATH) {
  try {
    const state = JSON.parse(await readFile(statePath, "utf8"));
    if (state?.version !== 1 || !state.urls || typeof state.urls !== "object") {
      throw new Error("Watch state must have version 1 and a urls object");
    }
    return state;
  } catch (error) {
    if (error?.code === "ENOENT") return { version: 1, urls: {} };
    throw error;
  }
}

export async function writeState(statePath, state) {
  await mkdir(path.dirname(statePath), { recursive: true });
  const temporaryPath = `${statePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await rename(temporaryPath, statePath);
}

function parseContentLength(headers) {
  if (headers.get("content-encoding")) return undefined;
  const value = headers.get("content-length");
  if (value === null) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

export async function fetchSnapshot(
  target,
  {
    fetchImpl = globalThis.fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    previousBytes,
  } = {},
) {
  const response = await fetchImpl(target.url, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Accept: "text/html, text/plain;q=0.9, application/json;q=0.8, */*;q=0.1",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": USER_AGENT,
    },
  });

  if (response.status !== 200) {
    throw new Error(`HTTP ${response.status}; only a complete 200 response is accepted`);
  }
  if (response.headers.get("content-range")) {
    throw new Error("Partial response rejected because Content-Range is present");
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (target.kind === "llms_txt" && !contentType.startsWith("text/plain")) {
    throw new Error(`Unexpected Content-Type for llms.txt: ${contentType || "missing"}`);
  }
  if (
    target.kind !== "llms_txt" &&
    !contentType.includes("text/html") &&
    !contentType.includes("application/xhtml+xml") &&
    !contentType.startsWith("text/plain") &&
    !contentType.startsWith("text/markdown") &&
    !contentType.startsWith("text/x-markdown")
  ) {
    throw new Error(`Unexpected Content-Type for documentation page: ${contentType || "missing"}`);
  }

  const content = Buffer.from(await response.arrayBuffer());
  const expectedLength = parseContentLength(response.headers);
  if (expectedLength !== undefined && expectedLength !== content.byteLength) {
    throw new Error(
      `Partial response rejected: expected ${expectedLength} bytes, received ${content.byteLength}`,
    );
  }

  const minimumBytes = target.minimum_bytes ?? DEFAULT_MINIMUM_BYTES;
  if (content.byteLength < minimumBytes || content.toString("utf8").trim() === "") {
    throw new Error(
      `Empty or undersized response rejected: received ${content.byteLength} bytes, minimum ${minimumBytes}`,
    );
  }

  if (
    Number.isInteger(previousBytes) &&
    previousBytes > 0 &&
    content.byteLength < Math.floor(previousBytes * MINIMUM_RETAINED_FRACTION)
  ) {
    throw new Error(
      `Suspiciously truncated response rejected: ${content.byteLength} bytes after ${previousBytes} bytes`,
    );
  }

  const fingerprint = contentForHash(content, target.kind, contentType);
  if (
    fingerprint.basis === "sha256-visible-text-v1" &&
    fingerprint.content.byteLength < DEFAULT_MINIMUM_VISIBLE_BYTES
  ) {
    throw new Error(
      `HTML response has too little visible content to hash safely: ${fingerprint.content.byteLength} bytes`,
    );
  }

  return {
    bytes: content.byteLength,
    content_bytes: fingerprint.content.byteLength,
    hash_basis: fingerprint.basis,
    sha256: hashContent(fingerprint.content),
  };
}

export function buildIssue(target, snapshot, previous, retrievedAt) {
  const title = `[source drift] ${target.lab}: ${target.id}`;
  const body = [
    "An official source watched by Modelsheet returned different content.",
    "",
    `- Source: ${target.url}`,
    `- Lab: ${target.lab}`,
    `- Target type: ${target.kind}`,
    `- Retrieved at: ${retrievedAt}`,
    `- Previous successful check: ${previous.last_checked_at}`,
    `- Previous SHA-256: \`${previous.sha256}\``,
    `- Current SHA-256: \`${snapshot.sha256}\``,
    `- Hash basis: \`${snapshot.hash_basis}\``,
    "",
    "This is detection only. A human must inspect the changed page and decide whether any registry claim needs updating.",
  ].join("\n");

  return { title, body };
}

export async function createGitHubIssue(
  issue,
  {
    fetchImpl = globalThis.fetch,
    repository = process.env.GITHUB_REPOSITORY,
    token = process.env.GITHUB_TOKEN,
  } = {},
) {
  if (!repository) throw new Error("GITHUB_REPOSITORY or --repo is required");
  if (!token) throw new Error("GITHUB_TOKEN is required to open a drift issue");

  const response = await fetchImpl(`https://api.github.com/repos/${repository}/issues`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify(issue),
  });

  if (response.status !== 201) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`GitHub issue creation failed with HTTP ${response.status}: ${detail}`);
  }

  return response.json();
}

const wait = (milliseconds) =>
  milliseconds === 0
    ? Promise.resolve()
    : new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function runWatcher({
  targets,
  state,
  statePath,
  fetchImpl = globalThis.fetch,
  issueCreator,
  delayMs = DEFAULT_DELAY_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  now = () => new Date(),
  logger = console,
}) {
  const failures = [];
  const changed = [];
  const baselined = [];
  const unchanged = [];

  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    const previous = state.urls[target.url];

    try {
      const snapshot = await fetchSnapshot(target, {
        fetchImpl,
        timeoutMs,
        previousBytes: previous?.bytes,
      });
      const retrievedAt = now().toISOString();

      if (!previous || previous.hash_basis !== snapshot.hash_basis) {
        state.urls[target.url] = {
          target_id: target.id,
          sha256: snapshot.sha256,
          bytes: snapshot.bytes,
          content_bytes: snapshot.content_bytes,
          hash_basis: snapshot.hash_basis,
          last_checked_at: retrievedAt,
        };
        await writeState(statePath, state);
        baselined.push(target.id);
        logger.log(
          `BASELINE ${target.id} (${snapshot.bytes} response bytes; ${snapshot.content_bytes} hashed bytes)`,
        );
      } else if (previous.sha256 === snapshot.sha256) {
        state.urls[target.url] = {
          ...previous,
          target_id: target.id,
          bytes: snapshot.bytes,
          content_bytes: snapshot.content_bytes,
          hash_basis: snapshot.hash_basis,
          last_checked_at: retrievedAt,
        };
        await writeState(statePath, state);
        unchanged.push(target.id);
        logger.log(`UNCHANGED ${target.id}`);
      } else {
        const issue = buildIssue(target, snapshot, previous, retrievedAt);
        await issueCreator(issue, target);
        state.urls[target.url] = {
          target_id: target.id,
          sha256: snapshot.sha256,
          bytes: snapshot.bytes,
          content_bytes: snapshot.content_bytes,
          hash_basis: snapshot.hash_basis,
          last_checked_at: retrievedAt,
        };
        await writeState(statePath, state);
        changed.push(target.id);
        logger.log(`CHANGED ${target.id}; issue opened`);
      }
    } catch (error) {
      failures.push({ target_id: target.id, message: error.message });
      logger.error(`FAILED ${target.id}: ${error.message}`);
    }

    if (index < targets.length - 1) await wait(delayMs);
  }

  return { baselined, unchanged, changed, failures };
}

async function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  const targetsPath = path.resolve(arguments_.targets ?? DEFAULT_TARGETS_PATH);
  const statePath = path.resolve(arguments_.state ?? DEFAULT_STATE_PATH);
  const repository = arguments_.repo ?? process.env.GITHUB_REPOSITORY;
  const delayMs = parsePositiveInteger(
    arguments_.delay_ms ?? process.env.WATCH_DELAY_MS,
    "delay",
    DEFAULT_DELAY_MS,
  );
  const timeoutMs = parsePositiveInteger(
    arguments_.timeout_ms ?? process.env.WATCH_TIMEOUT_MS,
    "timeout",
    DEFAULT_TIMEOUT_MS,
  );

  const [targets, state] = await Promise.all([
    loadTargets(targetsPath),
    loadState(statePath),
  ]);

  const result = await runWatcher({
    targets,
    state,
    statePath,
    delayMs,
    timeoutMs,
    issueCreator: (issue) => createGitHubIssue(issue, { repository }),
  });

  console.log(
    `Watch complete: ${result.baselined.length} baselined, ${result.unchanged.length} unchanged, ${result.changed.length} changed, ${result.failures.length} failed.`,
  );

  if (result.failures.length > 0) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
