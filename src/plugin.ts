import { OpenApiAgentToolsDiagnosticError, PLUGIN_NAME } from "./errors.js";
import { extractOperations, generateToolDescriptorsCode } from "./generator.js";
import type {
  HttpMethod,
  MetadataField,
  MetadataTransform,
  PluginResolvedConfig,
} from "./types.js";

const METADATA_FIELDS: MetadataField[] = [
  "intentType",
  "entityNouns",
  "safetyLevel",
  "routingDescription",
];

const HTTP_METHODS: HttpMethod[] = ["get", "post", "put", "patch", "delete"];
const ROOT_CONFIG_KEYS = ["output", "operations", "metadata", "providers"] as const;
const OUTPUT_CONFIG_KEYS = ["file"] as const;
const OPERATIONS_CONFIG_KEYS = ["includeIds", "excludeIds", "tags", "methods"] as const;
const METADATA_CONFIG_KEYS = ["enabled", "include", "transform"] as const;
const PROVIDERS_CONFIG_KEYS = ["vercelAiSdk"] as const;
const VERCEL_AI_SDK_CONFIG_KEYS = ["enabled"] as const;
const DEFAULT_OUTPUT_FILE = "tool-descriptors";

interface PluginFile {
  add: (content: string) => void;
}

interface Plugin {
  name: string;
  output: string;
  config?: PluginConfigInput;
  createFile: (options: { id: string; path: string }) => PluginFile;
  forEach: (...args: unknown[]) => void;
  context?: {
    spec?: unknown;
  };
}

interface PluginConfigInput {
  output?: unknown;
  operations?: unknown;
  metadata?: unknown;
  providers?: unknown;
  [key: string]: unknown;
}

interface HandlerContext {
  plugin: Plugin;
  context?: {
    spec?: unknown;
  };
}

interface OpenAPIOperationLike {
  operationId?: unknown;
}

type OpenAPISpecLike = {
  paths?: Record<string, Record<string, unknown>>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function countOperationsMissingOperationId(spec: OpenAPISpecLike): number {
  let count = 0;

  for (const pathItem of Object.values(spec.paths ?? {})) {
    if (!isObject(pathItem)) {
      continue;
    }

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method] as OpenAPIOperationLike | undefined;

      if (operation && typeof operation.operationId !== "string") {
        count += 1;
      }
    }
  }

  return count;
}

function assertKnownKeys(
  value: Record<string, unknown>,
  path: string,
  allowedKeys: readonly string[]
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      throw new OpenApiAgentToolsDiagnosticError({
        code: "E_CONFIG_UNKNOWN_KEY",
        message: `Unknown configuration key "${key}".`,
        path: `${path}.${key}`,
        allowed: allowedKeys,
      });
    }
  }
}

function readStringArray(value: unknown, path: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new OpenApiAgentToolsDiagnosticError({
      code: "E_CONFIG_INVALID_TYPE",
      message: "Expected an array of strings.",
      path,
      expected: "string[]",
      received: value,
    });
  }

  const normalized: string[] = [];

  for (const [index, item] of value.entries()) {
    if (typeof item !== "string") {
      throw new OpenApiAgentToolsDiagnosticError({
        code: "E_CONFIG_INVALID_ARRAY_ITEM",
        message: "Array item must be a string.",
        path: `${path}[${index}]`,
        expected: "string",
        received: item,
      });
    }

    const trimmed = item.trim();

    if (trimmed.length === 0) {
      throw new OpenApiAgentToolsDiagnosticError({
        code: "E_CONFIG_EMPTY_STRING",
        message: "String values cannot be empty.",
        path: `${path}[${index}]`,
      });
    }

    normalized.push(trimmed);
  }

  return normalized;
}

function readEnumArray<T extends string>(
  value: unknown,
  options: {
    path: string;
    allowedValues: readonly T[];
    normalize?: (value: string) => string;
  }
): T[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new OpenApiAgentToolsDiagnosticError({
      code: "E_CONFIG_INVALID_TYPE",
      message: "Expected an array.",
      path: options.path,
      expected: `(${options.allowedValues.join(" | ")})[]`,
      received: value,
    });
  }

  const normalizedValues: T[] = [];

  for (const [index, item] of value.entries()) {
    if (typeof item !== "string") {
      throw new OpenApiAgentToolsDiagnosticError({
        code: "E_CONFIG_INVALID_ARRAY_ITEM",
        message: "Array item must be a string.",
        path: `${options.path}[${index}]`,
        expected: "string",
        received: item,
      });
    }

    const trimmed = item.trim();
    if (trimmed.length === 0) {
      throw new OpenApiAgentToolsDiagnosticError({
        code: "E_CONFIG_EMPTY_STRING",
        message: "String values cannot be empty.",
        path: `${options.path}[${index}]`,
      });
    }

    const normalizedItem = (options.normalize ? options.normalize(trimmed) : trimmed) as T;

    if (!options.allowedValues.includes(normalizedItem)) {
      throw new OpenApiAgentToolsDiagnosticError({
        code: "E_CONFIG_INVALID_ENUM",
        message: `Invalid enum value "${item}".`,
        path: `${options.path}[${index}]`,
        allowed: options.allowedValues,
      });
    }

    normalizedValues.push(normalizedItem);
  }

  return normalizedValues;
}

function readMethods(value: unknown): HttpMethod[] | undefined {
  return readEnumArray(value, {
    path: "config.operations.methods",
    allowedValues: HTTP_METHODS,
    normalize: (method) => method.toLowerCase(),
  });
}

function readMetadataFields(value: unknown): MetadataField[] | undefined {
  return readEnumArray(value, {
    path: "config.metadata.include",
    allowedValues: METADATA_FIELDS,
  });
}

function readBoolean(value: unknown, path: string, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "boolean") {
    throw new OpenApiAgentToolsDiagnosticError({
      code: "E_CONFIG_INVALID_TYPE",
      message: "Expected a boolean.",
      path,
      expected: "boolean",
      received: value,
    });
  }

  return value;
}

function readMetadataTransform(value: unknown): MetadataTransform | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "function") {
    throw new OpenApiAgentToolsDiagnosticError({
      code: "E_CONFIG_INVALID_TYPE",
      message: "Expected a function.",
      path: "config.metadata.transform",
      expected: "function",
      received: value,
    });
  }

  return value as MetadataTransform;
}

function readOutputFile(value: unknown): string {
  if (value === undefined) {
    return DEFAULT_OUTPUT_FILE;
  }

  if (typeof value !== "string") {
    throw new OpenApiAgentToolsDiagnosticError({
      code: "E_CONFIG_INVALID_TYPE",
      message: "Expected a string output filename.",
      path: "config.output.file",
      expected: "string",
      received: value,
    });
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new OpenApiAgentToolsDiagnosticError({
      code: "E_CONFIG_EMPTY_STRING",
      message: "Output filename cannot be empty.",
      path: "config.output.file",
    });
  }

  return trimmed;
}

function readRootConfig(config: unknown): PluginConfigInput {
  if (config === undefined) {
    return {};
  }

  if (!isObject(config)) {
    throw new OpenApiAgentToolsDiagnosticError({
      code: "E_CONFIG_INVALID_TYPE",
      message: "Plugin config must be an object.",
      path: "config",
      expected: "object",
      received: config,
    });
  }

  const rootConfig = config as PluginConfigInput;
  assertKnownKeys(rootConfig, "config", ROOT_CONFIG_KEYS);
  return rootConfig;
}

function readSection(
  config: PluginConfigInput,
  key: keyof PluginConfigInput,
  path: string,
  allowedKeys: readonly string[]
): Record<string, unknown> {
  const value = config[key];

  if (value === undefined) {
    return {};
  }

  if (!isObject(value)) {
    throw new OpenApiAgentToolsDiagnosticError({
      code: "E_CONFIG_INVALID_TYPE",
      message: "Expected an object section.",
      path,
      expected: "object",
      received: value,
    });
  }

  assertKnownKeys(value, path, allowedKeys);
  return value;
}

function resolveConfig(plugin: Plugin): PluginResolvedConfig {
  const config = readRootConfig(plugin.config);
  const outputConfig = readSection(config, "output", "config.output", OUTPUT_CONFIG_KEYS);
  const operationsConfig = readSection(
    config,
    "operations",
    "config.operations",
    OPERATIONS_CONFIG_KEYS
  );
  const metadataConfig = readSection(config, "metadata", "config.metadata", METADATA_CONFIG_KEYS);
  const providersConfig = readSection(
    config,
    "providers",
    "config.providers",
    PROVIDERS_CONFIG_KEYS
  );
  const vercelAiSdkConfigValue = providersConfig["vercelAiSdk"];

  if (vercelAiSdkConfigValue !== undefined && !isObject(vercelAiSdkConfigValue)) {
    throw new OpenApiAgentToolsDiagnosticError({
      code: "E_CONFIG_INVALID_TYPE",
      message: "Expected an object section.",
      path: "config.providers.vercelAiSdk",
      expected: "object",
      received: vercelAiSdkConfigValue,
    });
  }

  const vercelAiSdkConfig = (vercelAiSdkConfigValue ?? {}) as Record<string, unknown>;
  assertKnownKeys(vercelAiSdkConfig, "config.providers.vercelAiSdk", VERCEL_AI_SDK_CONFIG_KEYS);

  return {
    name: PLUGIN_NAME,
    output: {
      file: readOutputFile(outputConfig["file"]),
    },
    operations: {
      includeIds: readStringArray(operationsConfig["includeIds"], "config.operations.includeIds"),
      excludeIds: readStringArray(operationsConfig["excludeIds"], "config.operations.excludeIds"),
      tags: readStringArray(operationsConfig["tags"], "config.operations.tags"),
      methods: readMethods(operationsConfig["methods"]),
    },
    metadata: {
      enabled: readBoolean(metadataConfig["enabled"], "config.metadata.enabled", false),
      include: readMetadataFields(metadataConfig["include"]),
      transform: readMetadataTransform(metadataConfig["transform"]),
    },
    providers: {
      vercelAiSdk: {
        enabled: readBoolean(
          vercelAiSdkConfig["enabled"],
          "config.providers.vercelAiSdk.enabled",
          false
        ),
      },
    },
  };
}

function readSpec(plugin: Plugin, context: HandlerContext["context"] | undefined): OpenAPISpecLike {
  const specCandidate = context?.spec ?? plugin.context?.spec;

  if (!isObject(specCandidate)) {
    throw new OpenApiAgentToolsDiagnosticError({
      code: "E_SPEC_PATHS_MISSING",
      message: "Could not find a valid OpenAPI spec object.",
      path: "spec",
      expected: "object",
      received: specCandidate,
    });
  }

  if (!isObject(specCandidate["paths"])) {
    throw new OpenApiAgentToolsDiagnosticError({
      code: "E_SPEC_PATHS_MISSING",
      message: "OpenAPI spec is missing a valid paths object.",
      path: "spec.paths",
      expected: "object",
      received: specCandidate["paths"],
    });
  }

  return specCandidate as OpenAPISpecLike;
}

function handler({ plugin, context }: HandlerContext): void {
  const config = resolveConfig(plugin);
  const spec = readSpec(plugin, context);

  const missingOperationIdCount = countOperationsMissingOperationId(spec);

  if (missingOperationIdCount > 0) {
    throw new OpenApiAgentToolsDiagnosticError({
      code: "E_SPEC_OPERATION_ID_MISSING",
      message: "All operations must define operationId in strict mode.",
      path: "spec.paths",
      count: missingOperationIdCount,
      hint: "Add operationId to every operation before generating descriptors.",
    });
  }

  const operations = extractOperations(spec, config);

  if (operations.length === 0) {
    throw new OpenApiAgentToolsDiagnosticError({
      code: "E_SPEC_NO_OPERATIONS_MATCHED",
      message: "No operations matched the configured filters.",
      path: "config.operations",
      hint: "Adjust includeIds/excludeIds/tags/methods filters.",
    });
  }

  const descriptorsCode = generateToolDescriptorsCode(operations, config);

  const outputFile = plugin.createFile({
    id: config.output.file,
    path: config.output.file,
  });

  outputFile.add(descriptorsCode);
}

const pluginConfig = {
  dependencies: [] as const,
  handler,
  handlerLegacy: () => {},
  name: PLUGIN_NAME,
  output: "tool-descriptors",
};

export default pluginConfig;
