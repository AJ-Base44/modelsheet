import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://aj-base44.github.io",
  base: "/modelsheet",
  output: "static",
  trailingSlash: "never",
  build: {
    format: "directory",
  },
});
