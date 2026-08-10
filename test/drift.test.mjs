import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, copyFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, test } from "node:test";

import { buildDriftFeed } from "../scripts/drift.mjs";
import {
  collectDriftEvents,
  serializeDriftArtifact,
  serializeDriftRss,
} from "../scripts/lib/drift.mjs";

const TEST_ROOT = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(TEST_ROOT, "fixtures", "drift");
const PUBLIC_REPOSITORY_URL = "https://github.com/example/modelsheet";

let temporaryDirectory;
let repositoryDirectory;
let artifact;

function git(arguments_, cwd = repositoryDirectory, extraEnvironment = {}) {
  const result = spawnSync("git", arguments_, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...extraEnvironment },
    windowsHide: true,
  });

  assert.equal(
    result.status,
    0,
    `git ${arguments_.join(" ")} failed:\n${result.stderr || result.stdout}`,
  );
  return result.stdout.trim();
}

async function installFixture(name, destination) {
  await copyFile(path.join(FIXTURES, name), destination);
}

function commit(message, date) {
  git(["add", "--all"]);
  git(["commit", "--message", message], repositoryDirectory, {
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_DATE: date,
  });
}

before(async () => {
  temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "modelsheet-drift-"));
  repositoryDirectory = path.join(temporaryDirectory, "source");
  const modelsDirectory = path.join(repositoryDirectory, "models", "example");
  const firstModel = path.join(modelsDirectory, "video-one.toml");
  const secondModel = path.join(modelsDirectory, "image-two.toml");

  await mkdir(modelsDirectory, { recursive: true });
  git(["init", "--initial-branch=main"], repositoryDirectory);
  git(["config", "user.name", "Modelsheet Test"]);
  git(["config", "user.email", "test@example.invalid"]);
  git(["remote", "add", "origin", `${PUBLIC_REPOSITORY_URL}.git`]);

  await installFixture("model-v1.toml", firstModel);
  commit("add first model", "2026-01-01T12:00:00Z");

  await installFixture("model-formatted.toml", firstModel);
  commit("format TOML only", "2026-01-02T12:00:00Z");

  await installFixture("model-v2.toml", firstModel);
  commit("change capabilities and pricing", "2026-01-03T12:00:00Z");

  await installFixture("added-model.toml", secondModel);
  commit("add second model", "2026-01-04T12:00:00Z");

  await rm(secondModel);
  commit("remove second model", "2026-01-05T12:00:00Z");

  artifact = collectDriftEvents({ repositoryDirectory });
});

after(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

test("semantic history omits formatting-only TOML commits", () => {
  assert.equal(artifact.feed_version, 1);
  assert.equal(artifact.repository, PUBLIC_REPOSITORY_URL);
  assert.equal(artifact.events.length, 4);
  assert.equal(
    artifact.events.some((event) => event.commit.message === "format TOML only"),
    false,
  );
});

test("capability and pricing updates carry stable exact paths and values", () => {
  const event = artifact.events.find(
    (candidate) => candidate.commit.message === "change capabilities and pricing",
  );

  assert.deepEqual(event.model, {
    id: "example/video-one",
    lab: "Example Lab",
    modality: "video",
    name: "Video One",
    path: "models/example/video-one.toml",
  });
  assert.equal(event.type, "model_updated");
  assert.deepEqual(event.changes, [
    {
      after: [5, 10, 15],
      before: [5, 10],
      kind: "changed",
      path: 'capability_profiles[id="generate"].duration.values',
    },
    {
      after: 1.25,
      before: 1,
      kind: "changed",
      path: 'pricing.charges[id="standard"].amount',
    },
  ]);
  assert.match(event.commit.sha, /^[0-9a-f]{40}$/);
  assert.equal(event.commit.date, "2026-01-03T12:00:00Z");
  assert.equal(
    event.commit.url,
    `${PUBLIC_REPOSITORY_URL}/commit/${event.commit.sha}`,
  );
});

test("record additions and removals stay compact", () => {
  const added = artifact.events.find(
    (event) => event.commit.message === "add second model",
  );
  const removed = artifact.events.find(
    (event) => event.commit.message === "remove second model",
  );

  assert.equal(added.type, "model_added");
  assert.equal(removed.type, "model_removed");
  assert.equal(added.model.id, "example/image-two");
  assert.equal(removed.model.id, "example/image-two");
  assert.equal(Object.hasOwn(added, "changes"), false);
  assert.equal(Object.hasOwn(removed, "changes"), false);
});

test("JSON and RSS bytes are deterministic and share the same events", async () => {
  const jsonOnce = serializeDriftArtifact(artifact);
  const jsonTwice = serializeDriftArtifact(artifact);
  const rssOnce = serializeDriftRss(artifact);
  const rssTwice = serializeDriftRss(artifact);

  assert.equal(jsonOnce, jsonTwice);
  assert.equal(rssOnce, rssTwice);
  assert.equal((rssOnce.match(/<item>/g) || []).length, artifact.events.length);
  for (const event of artifact.events) {
    assert.match(rssOnce, new RegExp(event.commit.sha));
  }

  const jsonOutput = path.join(temporaryDirectory, "output", "drift.json");
  const rssOutput = path.join(temporaryDirectory, "output", "drift.rss.xml");
  await buildDriftFeed({
    repositoryDirectory,
    jsonOutput,
    rssOutput,
  });
  assert.equal(await readFile(jsonOutput, "utf8"), jsonOnce);
  assert.equal(await readFile(rssOutput, "utf8"), rssOnce);
  const firstWrittenJson = await readFile(jsonOutput, "utf8");
  const firstWrittenRss = await readFile(rssOutput, "utf8");
  await buildDriftFeed({
    repositoryDirectory,
    jsonOutput,
    rssOutput,
  });

  assert.equal(await readFile(jsonOutput, "utf8"), firstWrittenJson);
  assert.equal(await readFile(rssOutput, "utf8"), firstWrittenRss);
});

test("shallow history fails loudly before emitting a partial feed", async () => {
  const shallowDirectory = path.join(temporaryDirectory, "shallow");
  git(
    [
      "clone",
      "--depth",
      "1",
      pathToFileURL(repositoryDirectory).href,
      shallowDirectory,
    ],
    temporaryDirectory,
  );

  assert.throws(
    () => collectDriftEvents({ repositoryDirectory: shallowDirectory }),
    /Cannot build the drift feed from a shallow repository.*fetch-depth: 0.*git fetch --unshallow/,
  );
});
