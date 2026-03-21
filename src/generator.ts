import type {
  HttpMethod,
  IntentType,
  JsonSchema,
  MetadataField,
  OperationInfo,
  ParameterGroups,
  PluginResolvedConfig,
  SafetyLevel,
  ToolDescriptor,
  ToolDescriptorMetadata,
} from "./types.js";

const SUPPORTED_METHODS = ["get", "post", "put", "patch", "delete"] as const;

const GENERIC_PATH_SEGMENTS = new Set(["api", "v1", "v2", "v3", "v4", "v5"]);

const WORKFLOW_VERBS = new Set([
  "import",
  "export",
  "trigger",
  "schedule",
  "confirm",
  "cancel",
  "activate",
  "deactivate",
  "parse",
  "upload",
  "download",
  "decommission",
  "release",
  "takeover",
  "assign",
  "toggle",
  "claim",
  "apply",
  "retry",
  "complete",
  "force",
  "clear",
  "render",
  "print",
  "generate",
  "recompute",
  "receive",
  "pack",
]);

const DANGEROUS_VERBS = new Set([
  "delete",
  "remove",
  "decommission",
  "cancel",
  "clear",
  "forceclose",
  "force",
]);

const ALL_METADATA_FIELDS: MetadataField[] = [
  "intentType",
  "entityNouns",
  "safetyLevel",
  "routingDescription",
];

interface OpenAPISpec {
  openapi?: string;
  paths?: Record<string, Record<string, unknown>>;
  components?: {
    parameters?: Record<string, unknown>;
    requestBodies?: Record<string, unknown>;
    schemas?: Record<string, unknown>;
  };
  parameters?: Record<string, unknown>;
  definitions?: Record<string, unknown>;
}

interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: unknown[];
  requestBody?: unknown;
}

interface OpenAPIPathItem {
  parameters?: unknown[];
}

interface OpenAPIRef {
  $ref: string;
}

interface OpenAPIParameter {
  name?: string;
  in?: string;
  required?: boolean;
  description?: string;
  schema?: unknown;
  type?: string;
  format?: string;
  enum?: unknown[];
  default?: unknown;
  items?: unknown;
}

interface OpenAPIMediaType {
  schema?: unknown;
}

interface OpenAPIRequestBody {
  required?: boolean;
  content?: Record<string, OpenAPIMediaType>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRefObject(value: unknown): value is OpenAPIRef {
  return isObject(value) && typeof value["$ref"] === "string";
}

function decodeJsonPointer(part: string): string {
  return part.replaceAll("~1", "/").replaceAll("~0", "~");
}

function resolveRef(spec: OpenAPISpec, ref: string): unknown {
  if (!ref.startsWith("#/")) {
    return undefined;
  }

  const parts = ref.slice(2).split("/").map(decodeJsonPointer);
  let current: unknown = spec;

  for (const part of parts) {
    if (!isObject(current) || !(part in current)) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

function resolveParameter(
  spec: OpenAPISpec,
  parameterOrRef: unknown,
  depth = 0
): OpenAPIParameter | undefined {
  if (depth > 8) {
    return undefined;
  }

  if (isRefObject(parameterOrRef)) {
    return resolveParameter(spec, resolveRef(spec, parameterOrRef.$ref), depth + 1);
  }

  if (!isObject(parameterOrRef)) {
    return undefined;
  }

  return parameterOrRef as OpenAPIParameter;
}

function resolveRequestBody(
  spec: OpenAPISpec,
  requestBodyOrRef: unknown,
  depth = 0
): OpenAPIRequestBody | undefined {
  if (depth > 8 || requestBodyOrRef === undefined) {
    return undefined;
  }

  if (isRefObject(requestBodyOrRef)) {
    return resolveRequestBody(spec, resolveRef(spec, requestBodyOrRef.$ref), depth + 1);
  }

  if (!isObject(requestBodyOrRef)) {
    return undefined;
  }

  return requestBodyOrRef as OpenAPIRequestBody;
}

function schemaFromParameter(parameter: OpenAPIParameter): unknown {
  if (parameter.schema) {
    return parameter.schema;
  }

  if (!parameter.type) {
    return undefined;
  }

  const schema: JsonSchema = {
    type: parameter.type,
  };

  if (parameter.format) {
    schema.format = parameter.format;
  }
  if (parameter.enum) {
    schema.enum = parameter.enum;
  }
  if (parameter.default !== undefined) {
    schema.default = parameter.default;
  }
  if (parameter.items) {
    schema.items = parameter.items as JsonSchema;
  }

  return schema;
}

function normalizeNullable(schema: JsonSchema, nullable: unknown): JsonSchema {
  if (nullable !== true) {
    return schema;
  }

  return {
    anyOf: [schema, { type: "null" }],
  };
}

function toJsonSchema(spec: OpenAPISpec, schemaOrRef: unknown, depth = 0): JsonSchema {
  if (depth > 16) {
    return {};
  }

  if (isRefObject(schemaOrRef)) {
    return toJsonSchema(spec, resolveRef(spec, schemaOrRef.$ref), depth + 1);
  }

  if (!isObject(schemaOrRef)) {
    return {};
  }

  const schema = schemaOrRef as JsonSchema;

  const result: JsonSchema = {};

  const passthroughKeys = [
    "type",
    "format",
    "description",
    "enum",
    "default",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "minLength",
    "maxLength",
    "pattern",
    "minItems",
    "maxItems",
    "uniqueItems",
    "minProperties",
    "maxProperties",
    "title",
    "deprecated",
    "readOnly",
    "writeOnly",
  ] as const;

  const schemaRecord = schema as Record<string, unknown>;
  const resultRecord = result as Record<string, unknown>;

  for (const key of passthroughKeys) {
    if (schemaRecord[key] !== undefined) {
      resultRecord[key] = schemaRecord[key];
    }
  }

  if (Array.isArray(schema.oneOf)) {
    result.oneOf = schema.oneOf.map((item) => toJsonSchema(spec, item, depth + 1));
  }

  if (Array.isArray(schema.anyOf)) {
    result.anyOf = schema.anyOf.map((item) => toJsonSchema(spec, item, depth + 1));
  }

  if (Array.isArray(schema.allOf)) {
    result.allOf = schema.allOf.map((item) => toJsonSchema(spec, item, depth + 1));
  }

  if (schema.items !== undefined) {
    result.items = toJsonSchema(spec, schema.items, depth + 1);
  }

  if (isObject(schema.properties)) {
    const normalizedProperties: Record<string, JsonSchema> = {};

    for (const [name, value] of Object.entries(schema.properties)) {
      normalizedProperties[name] = toJsonSchema(spec, value, depth + 1);
    }

    result.properties = normalizedProperties;
  }

  if (Array.isArray(schema.required)) {
    result.required = schema.required.filter((item): item is string => typeof item === "string");
  }

  if (schema.additionalProperties !== undefined) {
    if (typeof schema.additionalProperties === "boolean") {
      result.additionalProperties = schema.additionalProperties;
    } else {
      result.additionalProperties = toJsonSchema(spec, schema.additionalProperties, depth + 1);
    }
  }

  return normalizeNullable(result, schema.nullable);
}

function pushUnique(list: string[], value: string): void {
  if (!list.includes(value)) {
    list.push(value);
  }
}

function buildUniqueParamName(
  properties: Record<string, JsonSchema>,
  location: keyof ParameterGroups,
  rawName: string
): string {
  if (!(rawName in properties)) {
    return rawName;
  }

  let candidate = `${location}_${rawName}`;
  let index = 2;

  while (candidate in properties) {
    candidate = `${location}_${rawName}_${index}`;
    index += 1;
  }

  return candidate;
}

function getBodySchemaFromContent(content: Record<string, OpenAPIMediaType> | undefined): unknown {
  if (!content || Object.keys(content).length === 0) {
    return undefined;
  }

  if (content["application/json"]?.schema) {
    return content["application/json"].schema;
  }

  const jsonLike = Object.entries(content).find(([contentType]) => contentType.includes("json"));
  if (jsonLike?.[1]?.schema) {
    return jsonLike[1].schema;
  }

  return Object.values(content)[0]?.schema;
}

function mergeParametersForOperation(
  spec: OpenAPISpec,
  pathParameters: unknown[],
  operationParameters: unknown[]
): unknown[] {
  const mergedParameters = [...pathParameters];
  const parameterIndexes = new Map<string, number>();

  for (const [index, parameterOrRef] of mergedParameters.entries()) {
    const parameter = resolveParameter(spec, parameterOrRef);

    if (!parameter?.name || !parameter.in) {
      continue;
    }

    parameterIndexes.set(`${parameter.in}:${parameter.name}`, index);
  }

  for (const parameterOrRef of operationParameters) {
    const parameter = resolveParameter(spec, parameterOrRef);

    if (!parameter?.name || !parameter.in) {
      mergedParameters.push(parameterOrRef);
      continue;
    }

    const key = `${parameter.in}:${parameter.name}`;
    const existingIndex = parameterIndexes.get(key);

    if (existingIndex !== undefined) {
      mergedParameters[existingIndex] = parameterOrRef;
      continue;
    }

    parameterIndexes.set(key, mergedParameters.length);
    mergedParameters.push(parameterOrRef);
  }

  return mergedParameters;
}

function buildInputShape(
  spec: OpenAPISpec,
  pathItem: OpenAPIPathItem,
  operation: OpenAPIOperation
): {
  inputSchema: JsonSchema;
  parameterGroups: ParameterGroups;
} {
  const properties: Record<string, JsonSchema> = {};
  const required = new Set<string>();
  const parameterGroups: ParameterGroups = {
    path: [],
    query: [],
    header: [],
    cookie: [],
    body: [],
  };

  const allParameters = mergeParametersForOperation(
    spec,
    pathItem.parameters ?? [],
    operation.parameters ?? []
  );

  for (const parameterOrRef of allParameters) {
    const parameter = resolveParameter(spec, parameterOrRef);

    if (!parameter || !parameter.name) {
      continue;
    }

    const location = parameter.in;
    if (
      location !== "path" &&
      location !== "query" &&
      location !== "header" &&
      location !== "cookie"
    ) {
      continue;
    }

    const schema = schemaFromParameter(parameter);
    if (!schema) {
      continue;
    }

    const normalizedSchema = toJsonSchema(spec, schema);
    const finalName = buildUniqueParamName(properties, location, parameter.name);

    properties[finalName] = normalizedSchema;
    pushUnique(parameterGroups[location], finalName);

    if (parameter.required) {
      required.add(finalName);
    }
  }

  const requestBody = resolveRequestBody(spec, operation.requestBody);
  const requestBodySchema = getBodySchemaFromContent(requestBody?.content);

  if (requestBodySchema) {
    const normalizedBodySchema = toJsonSchema(spec, requestBodySchema);

    const isObjectBody =
      normalizedBodySchema.type === "object" &&
      isObject(normalizedBodySchema.properties) &&
      Object.keys(normalizedBodySchema.properties).length > 0;

    if (isObjectBody && requestBody?.required === true) {
      const bodyProperties = normalizedBodySchema.properties as Record<string, JsonSchema>;
      const bodyRequired = new Set(
        Array.isArray(normalizedBodySchema.required)
          ? normalizedBodySchema.required.filter((item): item is string => typeof item === "string")
          : []
      );

      for (const [name, bodyPropertySchema] of Object.entries(bodyProperties)) {
        const finalName = buildUniqueParamName(properties, "body", name);
        properties[finalName] = bodyPropertySchema;
        pushUnique(parameterGroups.body, finalName);

        if (bodyRequired.has(name)) {
          required.add(finalName);
        }
      }
    } else {
      const finalName = buildUniqueParamName(properties, "body", "body");
      properties[finalName] = normalizedBodySchema;
      pushUnique(parameterGroups.body, finalName);

      if (requestBody?.required) {
        required.add(finalName);
      }
    }
  }

  const inputSchema: JsonSchema = {
    type: "object",
    properties,
    additionalProperties: false,
  };

  if (required.size > 0) {
    inputSchema.required = Array.from(required);
  }

  return {
    inputSchema,
    parameterGroups,
  };
}

export function deriveIntentType(method: HttpMethod, operationId: string): IntentType {
  const lowerOpId = operationId.toLowerCase();

  if (method === "delete") {
    return "delete";
  }

  if (method === "put" || method === "patch") {
    return "update";
  }

  if (method === "post") {
    if (lowerOpId.startsWith("create") || lowerOpId.includes("create")) {
      return "create";
    }

    for (const verb of WORKFLOW_VERBS) {
      if (lowerOpId.includes(verb)) {
        return "workflow";
      }
    }

    return "create";
  }

  if (method === "get") {
    const hasListPattern =
      /^(list|search|find|get).*s$/i.test(operationId) || /^(list|search|find)/.test(lowerOpId);

    if (hasListPattern) {
      return "search";
    }

    return "read";
  }

  return "read";
}

function singularize(word: string): string {
  if (word.endsWith("ies")) {
    return `${word.slice(0, -3)}y`;
  }

  if (
    word.endsWith("xes") ||
    word.endsWith("ches") ||
    word.endsWith("shes") ||
    word.endsWith("sses") ||
    word.endsWith("zzes")
  ) {
    return word.slice(0, -2);
  }

  if (word.endsWith("s") && !word.endsWith("ss")) {
    return word.slice(0, -1);
  }

  return word;
}

function extractNounsFromOperationId(operationId: string): string[] {
  const withoutVerb = operationId.replace(
    /^(get|list|search|find|create|update|delete|remove|add|set|patch|put|post)/i,
    ""
  );

  const segments = withoutVerb
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[\s_-]+/)
    .map((segment) => segment.toLowerCase())
    .filter((segment) => segment.length > 1);

  const nouns: string[] = [];

  for (const segment of segments) {
    if (segment === "by" || segment === "id" || segment === "ids" || segment === "all") {
      continue;
    }

    nouns.push(singularize(segment));
  }

  return nouns;
}

export function extractEntityNouns(path: string, operationId: string): string[] {
  const nouns = new Set<string>();

  const pathSegments = path.split("/").filter((segment) => segment && !segment.startsWith("{"));

  for (const segment of pathSegments) {
    const normalized = segment.toLowerCase();

    if (GENERIC_PATH_SEGMENTS.has(normalized)) {
      continue;
    }

    nouns.add(singularize(normalized));
  }

  for (const noun of extractNounsFromOperationId(operationId)) {
    nouns.add(noun);
  }

  return Array.from(nouns);
}

export function deriveSafetyLevel(method: HttpMethod, operationId: string): SafetyLevel {
  const lowerOpId = operationId.toLowerCase();

  if (method === "get") {
    return "safe";
  }

  if (method === "delete") {
    return "dangerous";
  }

  for (const verb of DANGEROUS_VERBS) {
    if (lowerOpId.includes(verb)) {
      return "dangerous";
    }
  }

  return "confirm";
}

export function buildRoutingDescription(
  intentType: IntentType,
  summary: string,
  entityNouns: string[],
  tags: string[]
): string {
  const entitiesStr = entityNouns.length > 0 ? entityNouns.join(", ") : "general";
  const tagsStr = tags.length > 0 ? tags.join(", ") : "untagged";

  return `[${intentType}] ${summary}. Entities: ${entitiesStr}. Tags: ${tagsStr}.`;
}

function normalizeToolName(operationId: string): string {
  return operationId
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function toSdkFunctionName(operationId: string): string {
  const parts = operationId.split(/[_-]/).filter(Boolean);

  if (parts.length <= 1) {
    return operationId;
  }

  const [firstPart, ...restParts] = parts;
  if (!firstPart) {
    return operationId;
  }

  return firstPart + restParts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
}

function hasIntersection(left: string[] | undefined, right: string[]): boolean {
  if (!left || left.length === 0) {
    return true;
  }

  return right.some((value) => left.includes(value));
}

export function extractOperations(
  spec: OpenAPISpec,
  config: PluginResolvedConfig
): OperationInfo[] {
  const operations: OperationInfo[] = [];

  for (const [path, pathItemRaw] of Object.entries(spec.paths ?? {})) {
    const pathItem = (pathItemRaw ?? {}) as OpenAPIPathItem & Record<string, unknown>;

    for (const method of SUPPORTED_METHODS) {
      const operation = pathItem[method] as OpenAPIOperation | undefined;

      if (!operation || typeof operation.operationId !== "string") {
        continue;
      }

      if (config.operations.methods && !config.operations.methods.includes(method)) {
        continue;
      }

      if (
        config.operations.includeIds &&
        !config.operations.includeIds.includes(operation.operationId)
      ) {
        continue;
      }

      if (config.operations.excludeIds?.includes(operation.operationId)) {
        continue;
      }

      const tags = Array.isArray(operation.tags)
        ? operation.tags.filter((tag): tag is string => typeof tag === "string")
        : [];

      if (!hasIntersection(config.operations.tags, tags)) {
        continue;
      }

      const summary =
        typeof operation.summary === "string" && operation.summary.trim().length > 0
          ? operation.summary
          : operation.operationId;

      const description =
        typeof operation.description === "string" && operation.description.trim().length > 0
          ? operation.description
          : undefined;

      const { inputSchema, parameterGroups } = buildInputShape(spec, pathItem, operation);

      operations.push({
        operationId: operation.operationId,
        toolName: normalizeToolName(operation.operationId),
        sdkFunctionName: toSdkFunctionName(operation.operationId),
        method,
        path,
        summary,
        description,
        tags,
        inputSchema,
        parameterGroups,
      });
    }
  }

  return operations;
}

function pickMetadataFields(config: PluginResolvedConfig): MetadataField[] {
  if (!config.metadata.enabled) {
    return [];
  }

  return config.metadata.include && config.metadata.include.length > 0
    ? config.metadata.include
    : ALL_METADATA_FIELDS;
}

function buildDescriptorMetadata(
  operation: OperationInfo,
  config: PluginResolvedConfig
): ToolDescriptorMetadata | undefined {
  const metadataFields = pickMetadataFields(config);
  let metadata: ToolDescriptorMetadata | undefined;

  if (metadataFields.length > 0) {
    metadata = {};

    if (metadataFields.includes("intentType")) {
      metadata.intentType = deriveIntentType(operation.method, operation.operationId);
    }

    if (metadataFields.includes("entityNouns")) {
      metadata.entityNouns = extractEntityNouns(operation.path, operation.operationId);
    }

    if (metadataFields.includes("safetyLevel")) {
      metadata.safetyLevel = deriveSafetyLevel(operation.method, operation.operationId);
    }

    if (metadataFields.includes("routingDescription")) {
      const intentType =
        metadata.intentType ?? deriveIntentType(operation.method, operation.operationId);
      const entityNouns =
        metadata.entityNouns ?? extractEntityNouns(operation.path, operation.operationId);
      metadata.routingDescription = buildRoutingDescription(
        intentType,
        operation.summary,
        entityNouns,
        operation.tags
      );
    }
  }

  const transformedMetadata = config.metadata.transform?.(metadata, operation) ?? metadata;

  if (!transformedMetadata || Object.keys(transformedMetadata).length === 0) {
    return undefined;
  }

  return transformedMetadata;
}

function buildToolDescriptor(
  operation: OperationInfo,
  config: PluginResolvedConfig
): ToolDescriptor {
  const descriptor: ToolDescriptor = {
    method: operation.method,
    path: operation.path,
    operationId: operation.operationId,
    toolName: operation.toolName,
    sdkFunctionName: operation.sdkFunctionName,
    summary: operation.summary,
    tags: operation.tags,
    inputSchema: operation.inputSchema,
    parameterGroups: operation.parameterGroups,
  };

  if (operation.description) {
    descriptor.description = operation.description;
  }

  const metadata = buildDescriptorMetadata(operation, config);
  if (metadata) {
    descriptor.metadata = metadata;
  }

  return descriptor;
}

function assertUniqueToolNames(descriptors: ToolDescriptor[]): void {
  const seenToolNames = new Map<string, string>();

  for (const descriptor of descriptors) {
    const existingOperationId = seenToolNames.get(descriptor.toolName);

    if (existingOperationId) {
      throw new Error(
        `Duplicate normalized toolName "${descriptor.toolName}" for operationIds "${existingOperationId}" and "${descriptor.operationId}".`
      );
    }

    seenToolNames.set(descriptor.toolName, descriptor.operationId);
  }
}

function generateVercelAiSdkToolsCode(): string {
  return `export function createTool(descriptor: ToolDescriptor, sdkFn: (input: never) => Promise<unknown>) {
  return tool({
    description: descriptor.description ?? descriptor.summary,
    parameters: jsonSchema(descriptor.inputSchema),
    execute: async (input) => sdkFn(input as never),
  });
}

export function createToolsFromSdk(sdk: Record<string, (input: never) => Promise<unknown>>) {
  return Object.fromEntries(
    toolDescriptors.map((d) => [
      d.sdkFunctionName,
      createTool(d, sdk[d.sdkFunctionName] as (input: never) => Promise<unknown>),
    ])
  ) as Record<string, ReturnType<typeof createTool>>;
}
`;
}

export function generateToolDescriptorsCode(
  operations: OperationInfo[],
  config: PluginResolvedConfig
): string {
  const descriptors = operations.map((operation) => buildToolDescriptor(operation, config));

  assertUniqueToolNames(descriptors);

  const descriptorEntries = descriptors
    .map((descriptor) => `  ${JSON.stringify(descriptor, null, 2).split("\n").join("\n  ")}`)
    .join(",\n");

  const mapEntries = descriptors
    .map(
      (descriptor, index) => `  ${JSON.stringify(descriptor.toolName)}: toolDescriptors[${index}],`
    )
    .join("\n");

  const providerHelpers = config.providers.vercelAiSdk.enabled
    ? `\n${generateVercelAiSdkToolsCode()}`
    : "";

  const aiImport = config.providers.vercelAiSdk.enabled
    ? 'import { tool, jsonSchema } from "ai";\n\n'
    : "";

  return `// AUTO-GENERATED - DO NOT EDIT\n// Generated by @recepbayraktar/openapi-agent-tools\n${aiImport}export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";\n\nexport type IntentType = "read" | "search" | "create" | "update" | "delete" | "workflow";\n\nexport type SafetyLevel = "safe" | "confirm" | "dangerous";\n\nexport interface JsonSchema {\n  [key: string]: unknown;\n}\n\nexport interface ParameterGroups {\n  path: string[];\n  query: string[];\n  header: string[];\n  cookie: string[];\n  body: string[];\n}\n\nexport interface ToolDescriptorMetadata {\n  intentType?: IntentType;\n  entityNouns?: string[];\n  safetyLevel?: SafetyLevel;\n  routingDescription?: string;\n}\n\nexport interface ToolDescriptor {\n  method: HttpMethod;\n  path: string;\n  operationId: string;\n  toolName: string;\n  sdkFunctionName: string;\n  summary: string;\n  description?: string;\n  tags: string[];\n  inputSchema: JsonSchema;\n  parameterGroups: ParameterGroups;\n  metadata?: ToolDescriptorMetadata;\n}\n\nexport const toolDescriptors: ToolDescriptor[] = [\n${descriptorEntries}\n];\n\nexport const toolDescriptorMap: Record<string, ToolDescriptor> = {\n${mapEntries}\n};\n${providerHelpers}\nexport type ToolDescriptorsFile = {\n  toolDescriptors: typeof toolDescriptors;\n  toolDescriptorMap: typeof toolDescriptorMap;\n};\n`;
}
