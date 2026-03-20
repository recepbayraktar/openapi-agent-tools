# @recepbayraktar/openapi-agent-tools

[![CI](https://github.com/recepbayraktar/openapi-chat-tools/actions/workflows/ci.yml/badge.svg)](https://github.com/recepbayraktar/openapi-chat-tools/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Generate framework-agnostic tool descriptors from OpenAPI specs with a Hey API plugin.

## Install

```bash
pnpm add -D @recepbayraktar/openapi-agent-tools @hey-api/openapi-ts
```

## Quick Start

```ts
// openapi-ts.config.ts
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

```bash
npx openapi-ts
```

Default output file:

```text
src/generated/tool-descriptors.gen.ts
```

## Generated Exports

- `toolDescriptors: ToolDescriptor[]`
- `toolDescriptorMap: Record<string, ToolDescriptor>`

## Provider Integrations

Descriptor output stays provider-agnostic by default.

If you enable a provider integration, the generated file also includes provider-specific exports.

### Vercel AI SDK

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

When enabled, generated output adds a direct `tools` export compatible with AI SDK tool maps.

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

Generated tools expose both `inputSchema` and `parameters` for AI SDK version compatibility.

## Notes

- Every operation should define `operationId`.
- If filters remove all operations, generation fails with `E_SPEC_NO_OPERATIONS_MATCHED`.
- `toolName` collisions fail generation.

## Docs

- [Getting Started](./docs/getting-started.md)
- [Configuration](./docs/configuration.md)
- [Generated Output](./docs/generated-output.md)
- [Examples](./docs/examples.md)
- [Troubleshooting](./docs/troubleshooting.md)

## Development

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
```
