// Example: Custom Plugin Configuration
// File: openapi-ts.config.ts

import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "./openapi.json",
  output: "./src/generated",
  plugins: [
    "@hey-api/client-fetch",
    {
      name: "@recepbayraktar/openapi-agent-tools",
      output: {
        file: "agent-descriptors",
      },
      operations: {
        includeIds: ["getUser", "createUser", "listProducts"],
        excludeIds: ["deleteUser"],
        tags: ["public"],
        methods: ["get", "post"],
      },
      metadata: {
        enabled: true,
        include: ["intentType", "safetyLevel"],
      },
    },
  ],
});
