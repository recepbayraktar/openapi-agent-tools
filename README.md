# @recepbayraktar/openapi-agent-tools

[![CI](https://github.com/recepbayraktar/openapi-chat-tools/actions/workflows/ci.yml/badge.svg)](https://github.com/recepbayraktar/openapi-chat-tools/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Hey API plugin that generates framework-agnostic tool descriptors from OpenAPI specs.

This repository is public, and the package is published to npm (not GitHub Packages).

## Why This Plugin

- Descriptor-only output (no runtime `tool()` wrappers)
- One generated file (`tool-descriptors.gen.ts` by default)
- JSON Schema input models from parameters and request bodies
- Optional metadata enrichment (`intentType`, `entityNouns`, `safetyLevel`, `routingDescription`)
- Strict, fail-fast validation with explicit diagnostics

## Installation

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

Generate files:

```bash
npx openapi-ts
```

Use generated descriptors:

```ts
import { toolDescriptors, toolDescriptorMap } from "./generated/tool-descriptors.gen";

for (const descriptor of toolDescriptors) {
  console.log(descriptor.toolName, descriptor.inputSchema);
}

const getUser = toolDescriptorMap.get_user_by_id;
```

## Important Behavior

- Every operation must have an `operationId`.
- If filtering excludes all operations, generation fails with `E_SPEC_NO_OPERATIONS_MATCHED`.
- Normalized `toolName` collisions fail generation.

## Documentation

- [Getting Started](./docs/getting-started.md)
- [Configuration](./docs/configuration.md)
- [Generated Output](./docs/generated-output.md)
- [Examples](./docs/examples.md)
- [Troubleshooting](./docs/troubleshooting.md)
- [Publishing](./docs/publishing.md)

## Development

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## License

MIT
