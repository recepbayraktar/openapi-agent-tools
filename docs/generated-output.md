# Generated Output

By default, the plugin generates a single file:

```text
tool-descriptors.gen.ts
```

## Exported Values

- `toolDescriptors: ToolDescriptor[]`
- `toolDescriptorMap: Record<string, ToolDescriptor>`

## `ToolDescriptor` Fields

Each descriptor includes:

- `method`, `path`, `operationId`
- `toolName`, `sdkFunctionName`
- `summary`, optional `description`, `tags`
- `inputSchema` (JSON Schema)
- `parameterGroups` (`path`, `query`, `header`, `cookie`, `body`)
- optional `metadata`

## Runtime Expectations

- This package does not generate runtime wrappers.
- This package does not add `ai` imports.
- You own runtime execution and transport mapping.

## Request Body Handling

- Required object request bodies may be flattened into top-level input properties.
- Optional object request bodies remain under `body` to preserve optionality.

## Name Collision Safety

If two operations normalize to the same `toolName`, generation fails with a clear error.
