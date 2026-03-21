import { PluginError, PLUGIN_NAME } from "./errors.js";
import { parseOperations, generateDescriptors } from "./generator.js";
import type {
  HttpMethod,
  MetadataField,
  MetadataTransformer,
  ResolvedConfig,
} from "./types.js";

const METADATA_FIELDS: MetadataField[] = [
  "intentType",
  "entityNouns",
  "safetyLevel",
  "routingDescription",
];

const HTTP_METHODS: HttpMethod[] = ["get", "post", "put", "patch", "delete"];
const ROOT_KEYS = ["output", "operations", "metadata", "providers"] as const;
const OUTPUT_KEYS = ["file"] as const;
const OPERATIONS_KEYS = ["includeIds", "excludeIds", "tags", "methods"] as const;
const METADATA_KEYS = ["enabled", "include", "transform"] as const;
const PROVIDERS_KEYS = ["vercelAiSdk"] as const;
const VERCEL_SDK_KEYS = ["enabled"] as const;
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

function countMissingOperationIds(spec: OpenAPISpecLike): number {
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

function validateKeys(
  value: Record<string, unknown>,
  path: string,
  allowedKeys: readonly string[]
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      throw new PluginError({
        code: "E_CONFIG_UNKNOWN_KEY",
        message: `Unknown configuration key "${key}".`,
        path: `${path}.${key}`,
        allowed: allowedKeys,
      });
    }
  }
}

function parseStringArray(value: unknown, path: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new PluginError({
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
      throw new PluginError({
        code: "E_CONFIG_INVALID_ARRAY_ITEM",
        message: "Array item must be a string.",
        path: `${path}[${index}]`,
        expected: "string",
        received: item,
      });
    }

    const trimmed = item.trim();

    if (trimmed.length === 0) {
      throw new PluginError({
        code: "E_CONFIG_EMPTY_STRING",
        message: "String values cannot be empty.",
        path: `${path}[${index}]`,
      });
    }

    normalized.push(trimmed);
  }

  return normalized;
}

function parseEnumArray<T extends string>(
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
    throw new PluginError({
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
      throw new PluginError({
        code: "E_CONFIG_INVALID_ARRAY_ITEM",
        message: "Array item must be a string.",
        path: `${options.path}[${index}]`,
        expected: "string",
        received: item,
      });
    }

    const trimmed = item.trim();
    if (trimmed.length === 0) {
      throw new PluginError({
        code: "E_CONFIG_EMPTY_STRING",
        message: "String values cannot be empty.",
        path: `${options.path}[${index}]`,
      });
    }

    const normalizedItem = (options.normalize ? options.normalize(trimmed) : trimmed) as T;

    if (!options.allowedValues.includes(normalizedItem)) {
      throw new PluginError({
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

function parseMethods(value: unknown): HttpMethod[] | undefined {
  return parseEnumArray(value, {
    path: "config.operations.methods",
    allowedValues: HTTP_METHODS,
    normalize: (method) => method.toLowerCase(),
  });
}

function parseMetadataFields(value: unknown): MetadataField[] | undefined {
  return parseEnumArray(value, {
    path: "config.metadata.include",
    allowedValues: METADATA_FIELDS,
  });
}

function parseBoolean(value: unknown, path: string, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "boolean") {
    throw new PluginError({
      code: "E_CONFIG_INVALID_TYPE",
      message: "Expected a boolean.",
      path,
      expected: "boolean",
      received: value,
    });
  }

  return value;
}

function parseMetadataTransform(value: unknown): MetadataTransformer | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "function") {
    throw new PluginError({
      code: "E_CONFIG_INVALID_TYPE",
      message: "Expected a function.",
      path: "config.metadata.transform",
      expected: "function",
      received: value,
    });
  }

  return value as MetadataTransformer;
}

function parseOutputFile(value: unknown): string {
  if (value === undefined) {
    return DEFAULT_OUTPUT_FILE;
  }

  if (typeof value !== "string") {
    throw new PluginError({
      code: "E_CONFIG_INVALID_TYPE",
      message: "Expected a string output filename.",
      path: "config.output.file",
      expected: "string",
      received: value,
    });
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new PluginError({
      code: "E_CONFIG_EMPTY_STRING",
      message: "Output filename cannot be empty.",
      path: "config.output.file",
    });
  }

  return trimmed;
}

function parseRootConfig(config: unknown): PluginConfigInput {
  if (config === undefined) {
    return {};
  }

  if (!isObject(config)) {
    throw new PluginError({
      code: "E_CONFIG_INVALID_TYPE",
      message: "Plugin config must be an object.",
      path: "config",
      expected: "object",
      received: config,
    });
  }

  const rootConfig = config as PluginConfigInput;
  validateKeys(rootConfig, "config", ROOT_KEYS);
  return rootConfig;
}

function parseSection(
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
    throw new PluginError({
      code: "E_CONFIG_INVALID_TYPE",
      message: "Expected an object section.",
      path,
      expected: "object",
      received: value,
    });
  }

  validateKeys(value, path, allowedKeys);
  return value;
}

function resolveConfig(plugin: Plugin): ResolvedConfig {
  const config = parseRootConfig(plugin.config);
  const outputConfig = parseSection(config, "output", "config.output", OUTPUT_KEYS);
  const operationsConfig = parseSection(
    config,
    "operations",
    "config.operations",
    OPERATIONS_KEYS
  );
  const metadataConfig = parseSection(config, "metadata", "config.metadata", METADATA_KEYS);
  const providersConfig = parseSection(
    config,
    "providers",
    "config.providers",
    PROVIDERS_KEYS
  );
  const vercelAiSdkConfigValue = providersConfig["vercelAiSdk"];

  if (vercelAiSdkConfigValue !== undefined && !isObject(vercelAiSdkConfigValue)) {
    throw new PluginError({
      code: "E_CONFIG_INVALID_TYPE",
      message: "Expected an object section.",
      path: "config.providers.vercelAiSdk",
      expected: "object",
      received: vercelAiSdkConfigValue,
    });
  }

  const vercelAiSdkConfig = (vercelAiSdkConfigValue ?? {}) as Record<string, unknown>;
  validateKeys(vercelAiSdkConfig, "config.providers.vercelAiSdk", VERCEL_SDK_KEYS);

  return {
    name: PLUGIN_NAME,
    output: {
      file: parseOutputFile(outputConfig["file"]),
    },
    operations: {
      includeIds: parseStringArray(operationsConfig["includeIds"], "config.operations.includeIds"),
      excludeIds: parseStringArray(operationsConfig["excludeIds"], "config.operations.excludeIds"),
      tags: parseStringArray(operationsConfig["tags"], "config.operations.tags"),
      methods: parseMethods(operationsConfig["methods"]),
    },
    metadata: {
      enabled: parseBoolean(metadataConfig["enabled"], "config.metadata.enabled", false),
      include: parseMetadataFields(metadataConfig["include"]),
      transform: parseMetadataTransform(metadataConfig["transform"]),
    },
    providers: {
      vercelAiSdk: {
        enabled: parseBoolean(
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
    throw new PluginError({
      code: "E_SPEC_PATHS_MISSING",
      message: "Could not find a valid OpenAPI spec object.",
      path: "spec",
      expected: "object",
      received: specCandidate,
    });
  }

  if (!isObject(specCandidate["paths"])) {
    throw new PluginError({
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

  const missingCount = countMissingOperationIds(spec);

  if (missingCount > 0) {
    throw new PluginError({
      code: "E_SPEC_OPERATION_ID_MISSING",
      message: "All operations must define operationId in strict mode.",
      path: "spec.paths",
      count: missingCount,
      hint: "Add operationId to every operation before generating descriptors.",
    });
  }

  const operations = parseOperations(spec, config);

  if (operations.length === 0) {
    throw new PluginError({
      code: "E_SPEC_NO_OPERATIONS_MATCHED",
      message: "No operations matched the configured filters.",
      path: "config.operations",
      hint: "Adjust includeIds/excludeIds/tags/methods filters.",
    });
  }

  const descriptorsCode = generateDescriptors(operations, config);

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
