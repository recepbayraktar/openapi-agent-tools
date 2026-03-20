# Generated Output

By default, the plugin generates a single file:

```text
tool-descriptors.gen.ts
```

## Exported Values

- `toolDescriptors: ToolDescriptor[]`
- `toolDescriptorMap: Record<string, ToolDescriptor>`
- optional provider-specific exports when enabled (for example `tools` for Vercel AI SDK)

## `ToolDescriptor` Fields

Each descriptor includes:

- `method`, `path`, `operationId`
- `toolName`, `sdkFunctionName`
- `summary`, optional `description`, `tags`
- `inputSchema` (JSON Schema)
- `parameterGroups` (`path`, `query`, `header`, `cookie`, `body`)
- optional `metadata`

## Runtime Expectations

- By default this package does not generate runtime wrappers.
- Provider exports are generated only when explicitly enabled in config.
- Generated provider exports do not add runtime package imports; you provide execution bindings.
- Vercel tool definitions include both `inputSchema` and `parameters` for SDK-version compatibility.
- You own runtime execution and transport mapping.

## Request Body Handling

- Required object request bodies may be flattened into top-level input properties.
- Optional object request bodies remain under `body` to preserve optionality.

## Name Collision Safety

If two operations normalize to the same `toolName`, generation fails with a clear error.
