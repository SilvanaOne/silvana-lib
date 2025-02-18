import { defineConfig, defaultPlugins } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "open-api.yaml",
  output: "src/client",
  plugins: [
    ...defaultPlugins,
    {
      name: "@hey-api/typescript",
    },
    {
      name: "@hey-api/client-fetch",
    },
  ],
});
