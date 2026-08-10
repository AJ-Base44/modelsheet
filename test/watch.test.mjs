import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  contentForHash,
  fetchSnapshot,
  loadState,
  runWatcher,
} from "../scripts/watch.mjs";

const target = {
  id: "example-release-notes",
  lab: "Example Lab",
  kind: "release_notes",
  url: "https://example.test/releases",
  minimum_bytes: 4,
};

function response(body, init = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) headers.set("content-type", "text/html");
  return new Response(body, { status: 200, ...init, headers });
}

function quietLogger() {
  return { log() {}, error() {} };
}

test("first successful fetch creates a baseline without opening an issue", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "modelsheet-watch-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const statePath = path.join(directory, "state.json");
  const state = await loadState(statePath);
  const issues = [];

  const result = await runWatcher({
    targets: [target],
    state,
    statePath,
    fetchImpl: async () => response(`<main>${"first release page ".repeat(10)}</main>`),
    issueCreator: async (issue) => issues.push(issue),
    delayMs: 0,
    now: () => new Date("2026-08-09T10:00:00.000Z"),
    logger: quietLogger(),
  });

  assert.deepEqual(result.baselined, [target.id]);
  assert.equal(issues.length, 0);
  const stored = JSON.parse(await readFile(statePath, "utf8"));
  assert.equal(stored.urls[target.url].last_checked_at, "2026-08-09T10:00:00.000Z");
  assert.equal(stored.urls[target.url].hash_basis, "sha256-visible-text-v1");
  assert.equal(stored.urls[target.url].content_bytes, 189);
});

test("a complete changed page opens an issue and advances the hash", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "modelsheet-watch-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const statePath = path.join(directory, "state.json");
  const state = { version: 1, urls: {} };
  const issues = [];

  await runWatcher({
    targets: [target],
    state,
    statePath,
    fetchImpl: async () => response(`<main>${"first release page ".repeat(10)}</main>`),
    issueCreator: async () => assert.fail("baseline must not open an issue"),
    delayMs: 0,
    now: () => new Date("2026-08-08T10:00:00.000Z"),
    logger: quietLogger(),
  });
  const oldHash = state.urls[target.url].sha256;

  const result = await runWatcher({
    targets: [target],
    state,
    statePath,
    fetchImpl: async () => response(`<main>${"second release page ".repeat(10)}</main>`),
    issueCreator: async (issue) => issues.push(issue),
    delayMs: 0,
    now: () => new Date("2026-08-09T10:00:00.000Z"),
    logger: quietLogger(),
  });

  assert.deepEqual(result.changed, [target.id]);
  assert.equal(issues.length, 1);
  assert.match(issues[0].body, /https:\/\/example\.test\/releases/);
  assert.match(issues[0].body, /2026-08-08T10:00:00\.000Z/);
  assert.notEqual(state.urls[target.url].sha256, oldHash);
});

test("HTTP errors and partial responses never become changes", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "modelsheet-watch-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const statePath = path.join(directory, "state.json");
  const state = {
    version: 1,
    urls: {
      [target.url]: {
        target_id: target.id,
        sha256: "keep-this-hash",
        bytes: 100,
        hash_basis: "sha256-visible-text-v1",
        last_checked_at: "2026-08-08T10:00:00.000Z",
      },
    },
  };
  let calls = 0;

  const result = await runWatcher({
    targets: [target, { ...target, id: "partial", url: `${target.url}/partial` }],
    state,
    statePath,
    fetchImpl: async (url) => {
      calls += 1;
      if (url.endsWith("/partial")) {
        return new Response("partial", {
          status: 206,
          headers: { "Content-Range": "bytes 0-6/100" },
        });
      }
      return new Response("upstream error", { status: 503 });
    },
    issueCreator: async () => assert.fail("failed fetch must not open an issue"),
    delayMs: 0,
    logger: quietLogger(),
  });

  assert.equal(calls, 2);
  assert.equal(result.failures.length, 2);
  assert.equal(state.urls[target.url].sha256, "keep-this-hash");
  assert.equal(state.urls[`${target.url}/partial`], undefined);
});

test("a suspiciously shrunken response is rejected without advancing state", async () => {
  await assert.rejects(
    fetchSnapshot(target, {
      fetchImpl: async () => response(`<main>${"content ".repeat(20)}</main>`),
      previousBytes: 1_000,
    }),
    /Suspiciously truncated response rejected/,
  );
});

test("issue creation failure leaves the old hash in place for a retry", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "modelsheet-watch-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const statePath = path.join(directory, "state.json");
  const state = { version: 1, urls: {} };

  await runWatcher({
    targets: [target],
    state,
    statePath,
    fetchImpl: async () => response(`<main>${"first release page ".repeat(10)}</main>`),
    issueCreator: async () => {},
    delayMs: 0,
    logger: quietLogger(),
  });
  const oldHash = state.urls[target.url].sha256;

  const result = await runWatcher({
    targets: [target],
    state,
    statePath,
    fetchImpl: async () => response(`<main>${"second release page ".repeat(10)}</main>`),
    issueCreator: async () => {
      throw new Error("GitHub unavailable");
    },
    delayMs: 0,
    logger: quietLogger(),
  });

  assert.equal(result.failures.length, 1);
  assert.equal(state.urls[target.url].sha256, oldHash);
});

test("dynamic scripts and markup do not churn the visible-content hash", () => {
  const first = Buffer.from(
    `<html data-build="one"><script>nonce = 1</script><main><h1>Release notes</h1><p>${"Stable public content. ".repeat(8)}</p></main></html>`,
  );
  const second = Buffer.from(
    `<html data-build="two"><script>nonce = 2</script><main><h1>Release notes</h1><p>${"Stable public content. ".repeat(8)}</p></main></html>`,
  );

  const firstFingerprint = contentForHash(first, "changelog");
  const secondFingerprint = contentForHash(second, "changelog");

  assert.deepEqual(secondFingerprint.content, firstFingerprint.content);
  assert.equal(firstFingerprint.basis, "sha256-visible-text-v1");
});

test("a page shell with no meaningful visible content fails loudly", async () => {
  await assert.rejects(
    fetchSnapshot(target, {
      fetchImpl: async () =>
        response("<html><head><script>renderEverything()</script></head><body>Loading</body></html>"),
    }),
    /too little visible content/,
  );
});

test("a complete JavaScript app shell is hashed as a deployment fingerprint", async () => {
  const shell = `<html><head><script src="/app-a.js"></script></head><body>Loading</body>${" ".repeat(1_100)}</html>`;
  const snapshot = await fetchSnapshot(target, {
    fetchImpl: async () => response(shell),
  });

  assert.equal(snapshot.hash_basis, "sha256-html-shell-v1");
  assert.ok(snapshot.content_bytes < Buffer.byteLength(shell));
  assert.ok(snapshot.content_bytes > 0);
});

test("volatile inline challenge data does not churn an app-shell hash", () => {
  const padding = " ".repeat(1_100);
  const first = Buffer.from(
    `<html><script src="/app-a.js"></script><script>challenge='one'</script><body>Loading</body>${padding}</html>`,
  );
  const second = Buffer.from(
    `<html><script src="/app-a.js"></script><script>challenge='two'</script><body>Loading</body>${padding}</html>`,
  );

  const firstFingerprint = contentForHash(first, "release_notes");
  const secondFingerprint = contentForHash(second, "release_notes");

  assert.equal(firstFingerprint.basis, "sha256-html-shell-v1");
  assert.deepEqual(secondFingerprint.content, firstFingerprint.content);
});

test("official Markdown responses are hashed without HTML extraction", async () => {
  const markdownTarget = { ...target, minimum_bytes: 4 };
  const markdown = `# Release notes\n\n${"Documented change. ".repeat(10)}`;
  const snapshot = await fetchSnapshot(markdownTarget, {
    fetchImpl: async () =>
      response(markdown, { headers: { "content-type": "text/markdown" } }),
  });

  assert.equal(snapshot.hash_basis, "sha256-text-bytes-v1");
  assert.equal(snapshot.content_bytes, Buffer.byteLength(markdown));
});
