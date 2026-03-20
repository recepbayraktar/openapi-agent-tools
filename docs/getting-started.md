# Getting Started

This guide shows how to generate tool descriptors from an OpenAPI spec with `@recepbayraktar/openapi-agent-tools`.

## Prerequisites

- Node.js 20+
- OpenAPI 3.x spec file
- `@hey-api/openapi-ts` project setup

## 1. Install

```bash
pnpm add -D @recepbayraktar/openapi-agent-tools @hey-api/openapi-ts
```

## 2. Configure `openapi-ts`

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
      output: {
        file: "tool-descriptors",
      },
    },
  ],
});
```

## 3. Generate

```bash
npx openapi-ts
```

Default output file:

```text
src/generated/tool-descriptors.gen.ts
```

## 4. Consume Generated Descriptors

```ts
import { toolDescriptors, toolDescriptorMap } from "./generated/tool-descriptors.gen";

const searchTools = toolDescriptors.filter((descriptor) => descriptor.method === "get");
const createUser = toolDescriptorMap.create_user;
```

## 5. Validate Your Spec

Before generation, make sure:

- Every operation has an `operationId`
- Operation IDs normalize to unique `toolName` values
- Filtering rules do not remove all operations

See [Troubleshooting](./troubleshooting.md) for common failures.
