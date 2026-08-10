import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://modelsheet.dev",
  output: "static",
  trailingSlash: "never",
  build: {
    format: "directory",
  },
});
