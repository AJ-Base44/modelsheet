import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(TEST_DIR, "..");
const REPOSITORY_ROOT = path.resolve(SITE_ROOT, "..");
const DIST_ROOT = path.join(SITE_ROOT, "dist");
const PUBLICATION_URL = "https://aj-base44.github.io/modelsheet/";

test("the built page uses the GitHub Pages base and canonical URL", async () => {
  const html = await readFile(path.join(DIST_ROOT, "index.html"), "utf8");

  assert.match(html, new RegExp(`<link rel="canonical" href="${PUBLICATION_URL}"`));
  assert.match(html, new RegExp(`<meta property="og:url" content="${PUBLICATION_URL}"`));
  assert.match(html, /<a class="wordmark" href="\/modelsheet\/"/);
  assert.doesNotMatch(html, /modelsheet\.dev/);

  const rootRelativeUrls = [
    ...html.matchAll(/\b(?:href|src)="(\/[^#\"]*)"/g),
  ].map((match) => match[1]);

  assert.ok(rootRelativeUrls.length > 0, "expected at least one built root-relative URL");
  assert.ok(
    rootRelativeUrls.every((url) => url === "/modelsheet" || url.startsWith("/modelsheet/")),
    `found a URL outside the GitHub Pages base: ${rootRelativeUrls.join(", ")}`,
  );
});

test("the drift page exposes semantic history and machine-readable feeds", async () => {
  const html = await readFile(path.join(DIST_ROOT, "drift", "index.html"), "utf8");

  assert.match(
    html,
    new RegExp(`<link rel="canonical" href="${PUBLICATION_URL}drift"`),
  );
  assert.match(
    html,
    new RegExp(
      `<link rel="alternate" type="application/rss\\+xml" title="Modelsheet drift feed" href="${PUBLICATION_URL}drift\\.rss\\.xml"`,
    ),
  );
  assert.match(html, /The drift/);
  assert.match(html, /What changed, exactly\./);
  assert.match(html, /data-drift-event/);
  assert.match(html, /href="\/modelsheet\/drift\.json"/);
  assert.match(html, /href="\/modelsheet\/drift\/v1\.json"/);
  assert.match(html, /href="\/modelsheet\/drift\.rss\.xml"/);
});

test("the deployed API is byte-identical to the deterministic artifact", async () => {
  const [source, published, versioned] = await Promise.all([
    readFile(path.join(REPOSITORY_ROOT, "artifacts", "api.json")),
    readFile(path.join(DIST_ROOT, "api.json")),
    readFile(path.join(DIST_ROOT, "api", "v1.json")),
  ]);

  assert.deepEqual(published, source);
  assert.deepEqual(versioned, source);
  assert.doesNotThrow(() => JSON.parse(published.toString("utf8")));
});

test("the deployed drift JSON and RSS are byte-identical to generated artifacts", async () => {
  const [jsonSource, jsonLatest, jsonVersioned, rssSource, rssPublished] =
    await Promise.all([
      readFile(path.join(REPOSITORY_ROOT, "artifacts", "drift.json")),
      readFile(path.join(DIST_ROOT, "drift.json")),
      readFile(path.join(DIST_ROOT, "drift", "v1.json")),
      readFile(path.join(REPOSITORY_ROOT, "artifacts", "drift.rss.xml")),
      readFile(path.join(DIST_ROOT, "drift.rss.xml")),
    ]);

  assert.deepEqual(jsonLatest, jsonSource);
  assert.deepEqual(jsonVersioned, jsonSource);
  assert.deepEqual(rssPublished, rssSource);
  assert.equal(JSON.parse(jsonLatest.toString("utf8")).feed_version, 1);
  assert.match(rssPublished.toString("utf8"), /<rss version="2\.0">/);
});

test("the public schema has a resolvable GitHub Pages identifier", async () => {
  const [source, published] = await Promise.all([
    readFile(path.join(REPOSITORY_ROOT, "schema", "source-v1.schema.json")),
    readFile(path.join(DIST_ROOT, "schema", "source-v1.schema.json")),
  ]);

  assert.deepEqual(published, source);
  assert.equal(
    JSON.parse(published.toString("utf8")).$id,
    `${PUBLICATION_URL}schema/source-v1.schema.json`,
  );
});
