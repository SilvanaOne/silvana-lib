import { defineConfig, defaultPlugins } from "@hey-api/openapi-ts";

export default defineConfig({
  client: {
    bundle: false,
    name: "@hey-api/client-fetch",
  },
  input: "open-api.yaml",
  output: "src/client",
  plugins: [
    ...defaultPlugins,
    {
      name: "@hey-api/typescript",
    },
  ],
});
