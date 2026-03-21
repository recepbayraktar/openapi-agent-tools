export { default } from "./plugin.js";
export {
  PluginError,
  type ErrorCode,
  type ErrorDetails,
  PLUGIN_NAME,
} from "./errors.js";

export type {
  HttpMethod,
  IntentType,
  JsonSchema,
  MetadataField,
  MetadataTransformer,
  Operation,
  ParamGroups,
  ResolvedConfig,
  PluginConfig,
  SafetyLevel,
  ToolDescriptor,
  ToolMetadata,
  ToolRegistry,
} from "./types.js";

export {
  buildRouteDescription,
  inferIntent,
  inferSafety,
  extractNouns,
  parseOperations,
  generateDescriptors,
} from "./generator.js";
