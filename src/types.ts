export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

export type IntentType = "read" | "search" | "create" | "update" | "delete" | "workflow";

export type SafetyLevel = "safe" | "confirm" | "dangerous";

export type MetadataField = "intentType" | "entityNouns" | "safetyLevel" | "routingDescription";

export interface JsonSchema {
  type?: string;
  format?: string;
  description?: string;
  enum?: unknown[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number | boolean;
  exclusiveMaximum?: number | boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minProperties?: number;
  maxProperties?: number;
  title?: string;
  deprecated?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  allOf?: JsonSchema[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  nullable?: boolean;
  [key: string]: unknown;
}

export interface ParameterGroups {
  path: string[];
  query: string[];
  header: string[];
  cookie: string[];
  body: string[];
}

export interface OperationInfo {
  operationId: string;
  toolName: string;
  sdkFunctionName: string;
  method: HttpMethod;
  path: string;
  summary: string;
  description: string | undefined;
  tags: string[];
  inputSchema: JsonSchema;
  parameterGroups: ParameterGroups;
}

export interface ToolDescriptorMetadata {
  intentType?: IntentType;
  entityNouns?: string[];
  safetyLevel?: SafetyLevel;
  routingDescription?: string;
}

export type MetadataTransform = (
  metadata: ToolDescriptorMetadata | undefined,
  operation: OperationInfo
) => ToolDescriptorMetadata | undefined;

export interface ToolDescriptor {
  method: HttpMethod;
  path: string;
  operationId: string;
  toolName: string;
  sdkFunctionName: string;
  summary: string;
  description?: string;
  tags: string[];
  inputSchema: JsonSchema;
  parameterGroups: ParameterGroups;
  metadata?: ToolDescriptorMetadata;
}

export interface ToolDescriptorsFile {
  toolDescriptors: ToolDescriptor[];
  toolDescriptorMap: Record<string, ToolDescriptor>;
}

export interface PluginUserConfig {
  name: "@recepbayraktar/openapi-agent-tools";
  output?: {
    file?: string;
  };
  operations?: {
    includeIds?: string[];
    excludeIds?: string[];
    tags?: string[];
    methods?: HttpMethod[];
  };
  metadata?: {
    enabled?: boolean;
    include?: MetadataField[];
    transform?: MetadataTransform;
  };
}

export interface PluginResolvedConfig {
  name: "@recepbayraktar/openapi-agent-tools";
  output: {
    file: string;
  };
  operations: {
    includeIds: string[] | undefined;
    excludeIds: string[] | undefined;
    tags: string[] | undefined;
    methods: HttpMethod[] | undefined;
  };
  metadata: {
    enabled: boolean;
    include: MetadataField[] | undefined;
    transform: MetadataTransform | undefined;
  };
}
