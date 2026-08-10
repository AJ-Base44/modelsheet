import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY_ROOT = path.resolve(SITE_ROOT, "..");

export async function publishStaticData({
  repositoryRoot = REPOSITORY_ROOT,
  outputDir = path.join(SITE_ROOT, "dist"),
} = {}) {
  const publications = [
    {
      source: path.join(repositoryRoot, "artifacts", "api.json"),
      destination: path.join(outputDir, "api.json"),
    },
    {
      source: path.join(repositoryRoot, "schema", "source-v1.schema.json"),
      destination: path.join(outputDir, "schema", "source-v1.schema.json"),
    },
  ];

  for (const { source, destination } of publications) {
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
  }

  return publications;
}

const isCommandLine =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCommandLine) {
  try {
    const publications = await publishStaticData();
    console.log(`Published ${publications.length} static data files`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
