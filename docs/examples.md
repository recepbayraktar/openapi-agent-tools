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
