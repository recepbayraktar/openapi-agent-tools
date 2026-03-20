# Examples

## Minimal Plugin Setup

```ts
import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "./openapi.json",
  output: "./src/generated",
  plugins: [
    "@hey-api/client-fetch",
    {
      name: "@recepbayraktar/openapi-agent-tools",
    },
  ],
});
```

## Filter by Methods and Tags

```ts
{
  name: "@recepbayraktar/openapi-agent-tools",
  operations: {
    tags: ["public"],
    methods: ["get", "post"],
    excludeIds: ["deleteUser"],
  },
}
```

## Include Specific Operations Only

```ts
{
  name: "@recepbayraktar/openapi-agent-tools",
  operations: {
    includeIds: ["getUserById", "createUser"],
  },
}
```

## Enable Metadata

```ts
{
  name: "@recepbayraktar/openapi-agent-tools",
  metadata: {
    enabled: true,
    include: ["intentType", "safetyLevel"],
  },
}
```

## Metadata Transform

```ts
{
  name: "@recepbayraktar/openapi-agent-tools",
  metadata: {
    enabled: true,
    include: ["intentType"],
    transform: (metadata, operation) => ({
      ...metadata,
      routingDescription: `route:${operation.operationId}`,
    }),
  },
}
```

## Consume Descriptor Output

```ts
import { toolDescriptors, toolDescriptorMap } from "./generated/tool-descriptors.gen";

const writeTools = toolDescriptors.filter((descriptor) =>
  ["post", "put", "patch", "delete"].includes(descriptor.method)
);

const getUser = toolDescriptorMap.get_user_by_id;
```

## Vercel AI SDK Integration

```ts
{
  name: "@recepbayraktar/openapi-agent-tools",
  providers: {
    vercelAiSdk: {
      enabled: true,
    },
  },
}
```

```ts
import { tools as generatedTools } from "./generated/tool-descriptors.gen";

export const tools = {
  ...generatedTools,
  get_user_by_id: {
    ...generatedTools.get_user_by_id,
    execute: async (input) => api.getUserById(input),
  },
};
```

Generated tools expose both `inputSchema` and `parameters` so you can match your AI SDK version.
