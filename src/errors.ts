export const PLUGIN_NAME = "@recepbayraktar/openapi-agent-tools" as const;

export type DiagnosticCode =
  | "E_CONFIG_INVALID_TYPE"
  | "E_CONFIG_INVALID_ARRAY_ITEM"
  | "E_CONFIG_INVALID_ENUM"
  | "E_CONFIG_EMPTY_STRING"
  | "E_CONFIG_UNKNOWN_KEY"
  | "E_SPEC_PATHS_MISSING"
  | "E_SPEC_OPERATION_ID_MISSING"
  | "E_SPEC_NO_OPERATIONS_MATCHED";

export interface DiagnosticDetails {
  code: DiagnosticCode;
  message: string;
  path?: string;
  expected?: string;
  received?: unknown;
  allowed?: readonly string[];
  count?: number;
  hint?: string;
}

function describeValue(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return `"${value}"`;
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  if (typeof value === "function") {
    return "[function]";
  }

  if (Array.isArray(value)) {
    return "[array]";
  }

  if (typeof value === "object") {
    return "[object]";
  }

  return typeof value;
}

function formatDiagnosticMessage(details: DiagnosticDetails): string {
  const context: string[] = [];

  if (details.path) {
    context.push(`path=${details.path}`);
  }

  if (details.expected) {
    context.push(`expected=${details.expected}`);
  }

  if (details.received !== undefined) {
    context.push(`received=${describeValue(details.received)}`);
  }

  if (details.allowed && details.allowed.length > 0) {
    context.push(`allowed=${details.allowed.join(", ")}`);
  }

  if (details.count !== undefined) {
    context.push(`count=${details.count}`);
  }

  if (details.hint) {
    context.push(`hint=${details.hint}`);
  }

  const suffix = context.length > 0 ? ` (${context.join("; ")})` : "";

  return `[${PLUGIN_NAME}] ${details.code}: ${details.message}${suffix}`;
}

export class OpenApiAgentToolsDiagnosticError extends Error {
  readonly code: DiagnosticCode;
  readonly path: string | undefined;
  readonly expected: string | undefined;
  readonly received: unknown;
  readonly allowed: readonly string[] | undefined;
  readonly count: number | undefined;
  readonly hint: string | undefined;

  constructor(details: DiagnosticDetails) {
    super(formatDiagnosticMessage(details));
    this.name = "OpenApiAgentToolsDiagnosticError";
    this.code = details.code;
    this.path = details.path;
    this.expected = details.expected;
    this.received = details.received;
    this.allowed = details.allowed;
    this.count = details.count;
    this.hint = details.hint;
  }
}
