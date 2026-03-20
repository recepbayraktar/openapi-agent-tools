# Configuration

The plugin accepts one config object inside `openapi-ts.config.ts`.

## Minimal

```ts
{
  name: "@recepbayraktar/openapi-agent-tools",
}
```

## Full

```ts
{
  name: "@recepbayraktar/openapi-agent-tools",
  output: {
    file: "tool-descriptors",
  },
  operations: {
    includeIds: ["getUserById", "createUser"],
    excludeIds: ["deleteUser"],
    tags: ["public"],
    methods: ["get", "post"],
  },
  metadata: {
    enabled: true,
    include: ["intentType", "entityNouns", "safetyLevel", "routingDescription"],
    transform: (metadata, operation) => ({
      ...metadata,
      routingDescription: `route:${operation.operationId}`,
    }),
  },
  providers: {
    vercelAiSdk: {
      enabled: true,
    },
  },
}
```

## Options

### `output.file`

- Type: `string`
- Default: `"tool-descriptors"`
- Description: Generated filename without `.gen.ts` suffix.

### `operations.includeIds`

- Type: `string[]`
- Default: `undefined`
- Description: Include only these `operationId` values.

### `operations.excludeIds`

- Type: `string[]`
- Default: `undefined`
- Description: Exclude these `operationId` values.

### `operations.tags`

- Type: `string[]`
- Default: `undefined`
- Description: Keep operations with at least one matching tag.

### `operations.methods`

- Type: `("get" | "post" | "put" | "patch" | "delete")[]`
- Default: `undefined`
- Description: Keep operations matching the listed HTTP methods.

### `metadata.enabled`

- Type: `boolean`
- Default: `false`
- Description: Enables metadata generation.

### `metadata.include`

- Type: `("intentType" | "entityNouns" | "safetyLevel" | "routingDescription")[]`
- Default: all metadata fields when metadata is enabled
- Description: Limits which metadata fields are emitted.

### `metadata.transform`

- Type: `(metadata, operation) => ToolDescriptorMetadata | undefined`
- Default: `undefined`
- Description: Overrides or enriches derived metadata after built-in heuristics.

### `providers.vercelAiSdk.enabled`

- Type: `boolean`
- Default: `false`
- Description: Emits direct `tools` exports for Vercel AI SDK integration.

## Validation Rules

Validation is strict and fail-fast:

- Unknown keys: `E_CONFIG_UNKNOWN_KEY`
- Wrong value type: `E_CONFIG_INVALID_TYPE`
- Invalid enum entry: `E_CONFIG_INVALID_ENUM`
- Invalid array item type: `E_CONFIG_INVALID_ARRAY_ITEM`
- Empty string value: `E_CONFIG_EMPTY_STRING`

See [Troubleshooting](./troubleshooting.md) for diagnostic examples.
