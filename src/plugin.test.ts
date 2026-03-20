import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildRoutingDescription,
  deriveIntentType,
  deriveSafetyLevel,
  extractEntityNouns,
  extractOperations,
  generateToolDescriptorsCode,
} from "./generator.js";
import pluginConfig from "./plugin.js";
import type { PluginResolvedConfig } from "./types.js";

const sampleSpec = {
  openapi: "3.0.0",
  components: {
    parameters: {
      TenantId: {
        name: "tenantId",
        in: "query",
        required: true,
        schema: {
          type: "string",
        },
      },
    },
    schemas: {
      CreateUserBody: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          email: { type: "string", format: "email" },
          age: { type: "integer", nullable: true },
        },
      },
    },
    requestBodies: {
      CreateUserRequest: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/CreateUserBody",
            },
          },
        },
      },
    },
  },
  paths: {
    "/users/{id}": {
      parameters: [{ $ref: "#/components/parameters/TenantId" }],
      get: {
        operationId: "getUserById",
        summary: "Get user by ID",
        description: "Retrieves a user by their unique identifier",
        tags: ["users"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "expand",
            in: "query",
            schema: { type: "string" },
          },
        ],
      },
    },
    "/users": {
      get: {
        operationId: "listUsers",
        summary: "List users",
        tags: ["users", "public"],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer" },
          },
        ],
      },
      post: {
        operationId: "createUser",
        summary: "Create a new user",
        tags: ["users"],
        requestBody: {
          $ref: "#/components/requestBodies/CreateUserRequest",
        },
      },
    },
    "/admin/logs": {
      delete: {
        operationId: "deleteLogs",
        summary: "Delete logs",
        tags: ["admin"],
      },
    },
    "/jobs/recompute": {
      post: {
        operationId: "recomputeJobs",
        summary: "Recompute jobs",
        tags: ["jobs"],
      },
    },
  },
};

const defaultConfig: PluginResolvedConfig = {
  name: "@recepbayraktar/openapi-agent-tools",
  output: {
    file: "tool-descriptors",
  },
  operations: {
    includeIds: undefined,
    excludeIds: undefined,
    tags: undefined,
    methods: undefined,
  },
  metadata: {
    enabled: false,
    include: undefined,
    transform: undefined,
  },
  providers: {
    vercelAiSdk: {
      enabled: false,
    },
  },
};

function readFixtureSpec(name: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(new URL(`../test/fixtures/specs/${name}.json`, import.meta.url), "utf8")
  ) as Record<string, unknown>;
}

test("extractOperations extracts descriptor-relevant operation details", () => {
  const operations = extractOperations(sampleSpec, defaultConfig);

  assert.equal(operations.length, 5);

  const getUserOperation = operations.find((operation) => operation.operationId === "getUserById");
  assert.ok(getUserOperation);
  assert.equal(getUserOperation.toolName, "get_user_by_id");
  assert.equal(getUserOperation.sdkFunctionName, "getUserById");
  assert.deepEqual(getUserOperation.parameterGroups.path, ["id"]);
  assert.deepEqual(getUserOperation.parameterGroups.query, ["tenantId", "expand"]);

  const getRequired = (getUserOperation.inputSchema.required ?? []) as string[];
  assert.ok(getRequired.includes("id"));
  assert.ok(getRequired.includes("tenantId"));

  const createUserOperation = operations.find(
    (operation) => operation.operationId === "createUser"
  );
  assert.ok(createUserOperation);
  assert.deepEqual(createUserOperation.parameterGroups.body, ["name", "email", "age"]);
  assert.ok((createUserOperation.inputSchema.properties as Record<string, unknown>)["name"]);
});

test("extractOperations applies include/exclude/tags/method filters together", () => {
  const config: PluginResolvedConfig = {
    ...defaultConfig,
    operations: {
      includeIds: ["getUserById", "createUser", "deleteLogs"],
      excludeIds: ["deleteLogs"],
      tags: ["users"],
      methods: ["get", "post"],
    },
  };

  const operations = extractOperations(sampleSpec, config);
  assert.equal(operations.length, 2);
  assert.deepEqual(operations.map((operation) => operation.operationId).sort(), [
    "createUser",
    "getUserById",
  ]);
});

test("extractOperations keeps optional object request bodies nested under body", () => {
  const operations = extractOperations(
    {
      openapi: "3.0.0",
      paths: {
        "/reports": {
          post: {
            operationId: "createReport",
            requestBody: {
              required: false,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["name"],
                    properties: {
                      name: { type: "string" },
                      format: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    defaultConfig
  );

  const createReportOperation = operations.find(
    (operation) => operation.operationId === "createReport"
  );
  assert.ok(createReportOperation);
  assert.deepEqual(createReportOperation.parameterGroups.body, ["body"]);
  assert.deepEqual(createReportOperation.inputSchema.required, undefined);
  assert.deepEqual(createReportOperation.inputSchema.properties, {
    body: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string" },
        format: { type: "string" },
      },
    },
  });
});

test("extractOperations includes header and cookie parameters in descriptor inputs", () => {
  const operations = extractOperations(
    {
      openapi: "3.0.0",
      paths: {
        "/reports": {
          get: {
            operationId: "listReports",
            parameters: [
              {
                name: "x-tenant-id",
                in: "header",
                required: true,
                schema: { type: "string" },
              },
              {
                name: "session",
                in: "cookie",
                required: true,
                schema: { type: "string" },
              },
              {
                name: "page",
                in: "query",
                schema: { type: "integer" },
              },
            ],
          },
        },
      },
    },
    defaultConfig
  );

  const listReportsOperation = operations.find(
    (operation) => operation.operationId === "listReports"
  );
  assert.ok(listReportsOperation);
  assert.deepEqual(listReportsOperation.parameterGroups.header, ["x-tenant-id"]);
  assert.deepEqual(listReportsOperation.parameterGroups.cookie, ["session"]);
  assert.deepEqual(listReportsOperation.parameterGroups.query, ["page"]);
  assert.deepEqual(listReportsOperation.inputSchema.required, ["x-tenant-id", "session"]);
  assert.deepEqual(listReportsOperation.inputSchema.properties, {
    "x-tenant-id": { type: "string" },
    session: { type: "string" },
    page: { type: "integer" },
  });
});

test("extractOperations lets operation-level parameters override path-level parameters", () => {
  const operations = extractOperations(
    {
      openapi: "3.0.0",
      paths: {
        "/users/{id}": {
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          get: {
            operationId: "getUser",
            parameters: [
              {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "integer" },
              },
            ],
          },
        },
      },
    },
    defaultConfig
  );

  const getUserOperation = operations.find((operation) => operation.operationId === "getUser");
  assert.ok(getUserOperation);
  assert.deepEqual(getUserOperation.parameterGroups.path, ["id"]);
  assert.deepEqual(getUserOperation.inputSchema.required, ["id"]);
  assert.deepEqual(getUserOperation.inputSchema.properties, {
    id: { type: "integer" },
  });
});

test("generateToolDescriptorsCode throws when normalized tool names collide", () => {
  const operations = extractOperations(
    {
      openapi: "3.0.0",
      paths: {
        "/users/by-id": {
          get: {
            operationId: "getUserById",
          },
        },
        "/users/by_id": {
          get: {
            operationId: "get_user_by_id",
          },
        },
      },
    },
    defaultConfig
  );

  assert.throws(
    () => generateToolDescriptorsCode(operations, defaultConfig),
    /Duplicate normalized toolName "get_user_by_id"/
  );
});

test("generateToolDescriptorsCode creates descriptor-only output", () => {
  const operations = extractOperations(sampleSpec, defaultConfig);
  const code = generateToolDescriptorsCode(operations, defaultConfig);

  assert.ok(code.includes("// AUTO-GENERATED - DO NOT EDIT"));
  assert.ok(code.includes("Generated by @recepbayraktar/openapi-agent-tools"));
  assert.ok(code.includes("export const toolDescriptors: ToolDescriptor[] = ["));
  assert.ok(code.includes("export const toolDescriptorMap: Record<string, ToolDescriptor> = {"));
  assert.ok(code.includes('"inputSchema":'));
  assert.ok(code.includes('"parameterGroups":'));

  assert.ok(!code.includes('import { tool } from "ai"'));
  assert.ok(!code.includes("execute: async"));
  assert.ok(!code.includes("createVercelAiTools"));
  assert.ok(!code.includes("console.log"));
  assert.ok(!code.includes("IMPORTANT: All filter parameters"));
});

test("generateToolDescriptorsCode keeps metadata disabled by default", () => {
  const operations = extractOperations(sampleSpec, defaultConfig);
  const code = generateToolDescriptorsCode(operations, defaultConfig);

  assert.ok(!code.includes('"metadata":'));
});

test("generateToolDescriptorsCode includes only selected metadata fields", () => {
  const config: PluginResolvedConfig = {
    ...defaultConfig,
    metadata: {
      enabled: true,
      include: ["intentType", "safetyLevel"],
      transform: undefined,
    },
  };

  const operations = extractOperations(sampleSpec, config);
  const code = generateToolDescriptorsCode(operations, config);

  assert.ok(code.includes('"metadata":'));
  assert.ok(code.includes('"intentType": "read"'));
  assert.ok(code.includes('"safetyLevel": "safe"'));
  assert.ok(!code.includes('"entityNouns":'));
  assert.ok(!code.includes('"routingDescription":'));
});

test("generateToolDescriptorsCode allows metadata transforms to override derived metadata", () => {
  const config: PluginResolvedConfig = {
    ...defaultConfig,
    metadata: {
      enabled: true,
      include: ["intentType"],
      transform: (metadata, operation) => ({
        ...metadata,
        routingDescription: `route:${operation.operationId}`,
      }),
    },
  };

  const operations = extractOperations(sampleSpec, config);
  const code = generateToolDescriptorsCode(operations, config);

  assert.ok(code.includes('"intentType": "read"'));
  assert.ok(code.includes('"routingDescription": "route:getUserById"'));
});

test("generateToolDescriptorsCode emits direct Vercel AI SDK tools when provider integration is enabled", () => {
  const config: PluginResolvedConfig = {
    ...defaultConfig,
    providers: {
      vercelAiSdk: {
        enabled: true,
      },
    },
  };

  const operations = extractOperations(sampleSpec, config);
  const code = generateToolDescriptorsCode(operations, config);

  assert.ok(code.includes("export interface VercelAiToolDefinition"));
  assert.ok(code.includes("export const tools: VercelAiToolMap = {"));
  assert.ok(!code.includes("createVercelAiTools"));
  assert.ok(code.includes("Missing execute implementation for tool"));
  assert.ok(code.includes("inputSchema: toolDescriptorMap"));
  assert.ok(code.includes("parameters: toolDescriptorMap"));
});

test("plugin config exposes plugin identity and default output", () => {
  assert.equal(pluginConfig.name, "@recepbayraktar/openapi-agent-tools");
  assert.equal(pluginConfig.output, "tool-descriptors");
});

test("plugin handler generates tool-descriptors.gen.ts by default", () => {
  const created: Array<{ id: string; path: string; content: string }> = [];

  (pluginConfig.handler as (args: unknown) => void)({
    plugin: {
      name: pluginConfig.name,
      output: "ignored",
      config: {},
      createFile: ({ id, path }: { id: string; path: string }) => {
        const target = { id, path, content: "" };
        created.push(target);
        return {
          add: (content: string) => {
            target.content = content;
          },
        };
      },
      forEach: () => {},
      context: {
        spec: sampleSpec,
      },
    },
  });

  assert.equal(created.length, 1);
  assert.equal(created[0]?.id, "tool-descriptors");
  assert.equal(created[0]?.path, "tool-descriptors");
  assert.ok(created[0]?.content.includes("export const toolDescriptors"));
});

test("plugin handler supports custom output file", () => {
  const created: Array<{ id: string; path: string }> = [];

  (pluginConfig.handler as (args: unknown) => void)({
    plugin: {
      name: pluginConfig.name,
      output: "ignored",
      config: {
        output: {
          file: "descriptors",
        },
      },
      createFile: ({ id, path }: { id: string; path: string }) => {
        created.push({ id, path });
        return {
          add: () => {},
        };
      },
      forEach: () => {},
      context: {
        spec: sampleSpec,
      },
    },
  });

  assert.equal(created.length, 1);
  assert.equal(created[0]?.id, "descriptors");
  assert.equal(created[0]?.path, "descriptors");
});

test("plugin handler throws for invalid methods in config", () => {
  assert.throws(() => {
    (pluginConfig.handler as (args: unknown) => void)({
      plugin: {
        name: pluginConfig.name,
        output: "ignored",
        config: {
          operations: {
            methods: ["gett"],
          },
        },
        createFile: () => ({
          add: () => {},
        }),
        forEach: () => {},
        context: {
          spec: sampleSpec,
        },
      },
    });
  }, /E_CONFIG_INVALID_ENUM/);
});

test("plugin handler throws for invalid metadata fields in config", () => {
  assert.throws(() => {
    (pluginConfig.handler as (args: unknown) => void)({
      plugin: {
        name: pluginConfig.name,
        output: "ignored",
        config: {
          metadata: {
            enabled: true,
            include: ["intentTypo"],
          },
        },
        createFile: () => ({
          add: () => {},
        }),
        forEach: () => {},
        context: {
          spec: sampleSpec,
        },
      },
    });
  }, /E_CONFIG_INVALID_ENUM/);
});

test("plugin handler throws clearly when filters exclude every operation", () => {
  assert.throws(() => {
    (pluginConfig.handler as (args: unknown) => void)({
      plugin: {
        name: pluginConfig.name,
        output: "ignored",
        config: {
          operations: {
            includeIds: ["missingOperation"],
          },
        },
        createFile: () => ({
          add: () => {},
        }),
        forEach: () => {},
        context: {
          spec: sampleSpec,
        },
      },
    });
  }, /E_SPEC_NO_OPERATIONS_MATCHED/);
});

test("plugin handler throws when operations are missing operationId", () => {
  assert.throws(() => {
    (pluginConfig.handler as (args: unknown) => void)({
      plugin: {
        name: pluginConfig.name,
        output: "ignored",
        config: {},
        createFile: () => ({
          add: () => {},
        }),
        forEach: () => {},
        context: {
          spec: {
            paths: {
              "/reports": {
                get: {
                  summary: "List reports",
                },
              },
            },
          },
        },
      },
    });
  }, /E_SPEC_OPERATION_ID_MISSING/);
});

test("plugin handler rejects operations.methods when not an array", () => {
  assert.throws(() => {
    (pluginConfig.handler as (args: unknown) => void)({
      plugin: {
        name: pluginConfig.name,
        output: "ignored",
        config: {
          operations: {
            methods: "get",
          },
        },
        createFile: () => ({
          add: () => {},
        }),
        forEach: () => {},
        context: {
          spec: sampleSpec,
        },
      },
    });
  }, /E_CONFIG_INVALID_TYPE/);
});

test("plugin handler rejects includeIds entries that are not strings", () => {
  assert.throws(() => {
    (pluginConfig.handler as (args: unknown) => void)({
      plugin: {
        name: pluginConfig.name,
        output: "ignored",
        config: {
          operations: {
            includeIds: ["getUserById", 42],
          },
        },
        createFile: () => ({
          add: () => {},
        }),
        forEach: () => {},
        context: {
          spec: sampleSpec,
        },
      },
    });
  }, /E_CONFIG_INVALID_ARRAY_ITEM/);
});

test("plugin handler rejects unknown config keys", () => {
  assert.throws(() => {
    (pluginConfig.handler as (args: unknown) => void)({
      plugin: {
        name: pluginConfig.name,
        output: "ignored",
        config: {
          random: true,
        },
        createFile: () => ({
          add: () => {},
        }),
        forEach: () => {},
        context: {
          spec: sampleSpec,
        },
      },
    });
  }, /E_CONFIG_UNKNOWN_KEY/);
});

test("plugin handler rejects unknown provider config keys", () => {
  assert.throws(() => {
    (pluginConfig.handler as (args: unknown) => void)({
      plugin: {
        name: pluginConfig.name,
        output: "ignored",
        config: {
          providers: {
            customProvider: {
              enabled: true,
            },
          },
        },
        createFile: () => ({
          add: () => {},
        }),
        forEach: () => {},
        context: {
          spec: sampleSpec,
        },
      },
    });
  }, /E_CONFIG_UNKNOWN_KEY/);
});

test("plugin handler rejects providers.vercelAiSdk when not an object", () => {
  assert.throws(() => {
    (pluginConfig.handler as (args: unknown) => void)({
      plugin: {
        name: pluginConfig.name,
        output: "ignored",
        config: {
          providers: {
            vercelAiSdk: true,
          },
        },
        createFile: () => ({
          add: () => {},
        }),
        forEach: () => {},
        context: {
          spec: sampleSpec,
        },
      },
    });
  }, /E_CONFIG_INVALID_TYPE/);
});

test("plugin handler rejects providers.vercelAiSdk.enabled when not boolean", () => {
  assert.throws(() => {
    (pluginConfig.handler as (args: unknown) => void)({
      plugin: {
        name: pluginConfig.name,
        output: "ignored",
        config: {
          providers: {
            vercelAiSdk: {
              enabled: "yes",
            },
          },
        },
        createFile: () => ({
          add: () => {},
        }),
        forEach: () => {},
        context: {
          spec: sampleSpec,
        },
      },
    });
  }, /E_CONFIG_INVALID_TYPE/);
});

test("plugin handler rejects output.file when empty", () => {
  assert.throws(() => {
    (pluginConfig.handler as (args: unknown) => void)({
      plugin: {
        name: pluginConfig.name,
        output: "ignored",
        config: {
          output: {
            file: "   ",
          },
        },
        createFile: () => ({
          add: () => {},
        }),
        forEach: () => {},
        context: {
          spec: sampleSpec,
        },
      },
    });
  }, /E_CONFIG_EMPTY_STRING/);
});

test("plugin handler rejects output when section is not an object", () => {
  assert.throws(() => {
    (pluginConfig.handler as (args: unknown) => void)({
      plugin: {
        name: pluginConfig.name,
        output: "ignored",
        config: {
          output: "tool-descriptors",
        },
        createFile: () => ({
          add: () => {},
        }),
        forEach: () => {},
        context: {
          spec: sampleSpec,
        },
      },
    });
  }, /E_CONFIG_INVALID_TYPE/);
});

test("plugin handler rejects metadata.enabled when not boolean", () => {
  assert.throws(() => {
    (pluginConfig.handler as (args: unknown) => void)({
      plugin: {
        name: pluginConfig.name,
        output: "ignored",
        config: {
          metadata: {
            enabled: "true",
          },
        },
        createFile: () => ({
          add: () => {},
        }),
        forEach: () => {},
        context: {
          spec: sampleSpec,
        },
      },
    });
  }, /E_CONFIG_INVALID_TYPE/);
});

test("plugin handler rejects when OpenAPI paths are missing", () => {
  assert.throws(() => {
    (pluginConfig.handler as (args: unknown) => void)({
      plugin: {
        name: pluginConfig.name,
        output: "ignored",
        config: {},
        createFile: () => ({
          add: () => {},
        }),
        forEach: () => {},
        context: {
          spec: {},
        },
      },
    });
  }, /E_SPEC_PATHS_MISSING/);
});

test("fixture specs preserve descriptor edge cases", () => {
  const optionalBodyOperation = extractOperations(
    readFixtureSpec("optional-body"),
    defaultConfig
  )[0];
  assert.ok(optionalBodyOperation);
  assert.deepEqual(optionalBodyOperation.parameterGroups.body, ["body"]);
  assert.deepEqual(optionalBodyOperation.inputSchema.properties, {
    body: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string" },
        format: { type: "string" },
      },
    },
  });

  const headerCookieOperation = extractOperations(
    readFixtureSpec("header-cookie"),
    defaultConfig
  )[0];
  assert.ok(headerCookieOperation);
  assert.deepEqual(headerCookieOperation.parameterGroups, {
    path: [],
    query: ["page"],
    header: ["x-tenant-id"],
    cookie: ["session"],
    body: [],
  });

  const overrideOperation = extractOperations(readFixtureSpec("override"), defaultConfig)[0];
  assert.ok(overrideOperation);
  assert.deepEqual(overrideOperation.inputSchema.properties, {
    id: { type: "integer" },
  });

  const collisionOperations = extractOperations(readFixtureSpec("collision"), defaultConfig);
  assert.throws(
    () => generateToolDescriptorsCode(collisionOperations, defaultConfig),
    /Duplicate normalized toolName/
  );
});

test("deriveIntentType infers read/search/create/update/delete/workflow", () => {
  assert.equal(deriveIntentType("get", "getUserById"), "read");
  assert.equal(deriveIntentType("get", "listUsers"), "search");
  assert.equal(deriveIntentType("post", "createUser"), "create");
  assert.equal(deriveIntentType("post", "recomputeJobs"), "workflow");
  assert.equal(deriveIntentType("patch", "updateUser"), "update");
  assert.equal(deriveIntentType("delete", "deleteUser"), "delete");
});

test("deriveSafetyLevel marks dangerous and confirm operations", () => {
  assert.equal(deriveSafetyLevel("get", "getUser"), "safe");
  assert.equal(deriveSafetyLevel("delete", "deleteUser"), "dangerous");
  assert.equal(deriveSafetyLevel("post", "forceCloseOrder"), "dangerous");
  assert.equal(deriveSafetyLevel("post", "createUser"), "confirm");
});

test("extractEntityNouns and routing description keep metadata heuristics reusable", () => {
  const nouns = extractEntityNouns("/api/v1/orders/{id}/items", "getOrderItems");

  assert.ok(nouns.includes("order"));
  assert.ok(nouns.includes("item"));

  const routingDescription = buildRoutingDescription("search", "List orders", nouns, ["orders"]);
  assert.ok(routingDescription.includes("[search]"));
  assert.ok(routingDescription.includes("Entities:"));
  assert.ok(routingDescription.includes("Tags:"));
});
