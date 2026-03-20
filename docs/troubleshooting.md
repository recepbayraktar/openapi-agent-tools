# Troubleshooting

## `E_SPEC_PATHS_MISSING`

The plugin could not find a valid OpenAPI `paths` object.

Check:

- `input` points to the intended spec file
- The file is valid JSON/YAML
- The spec includes `paths`

## `E_SPEC_OPERATION_ID_MISSING`

One or more operations are missing `operationId`.

Fix:

- Add `operationId` to every operation used by generation

## `E_SPEC_NO_OPERATIONS_MATCHED`

Your `operations` filters excluded every operation.

Fix:

- Remove or relax `includeIds`, `excludeIds`, `tags`, `methods`

## `E_CONFIG_UNKNOWN_KEY`

An unsupported key exists in plugin config.

Fix:

- Use only: `output`, `operations`, `metadata`, `providers` at root level

## `E_CONFIG_INVALID_TYPE`

A config value type is wrong.

Examples:

- `operations.methods` must be an array
- `metadata.enabled` must be a boolean
- `output.file` must be a string

## `E_CONFIG_INVALID_ENUM`

A config value is outside allowed enum values.

Examples:

- method `"gett"` instead of `"get"`
- unknown metadata field

## `E_CONFIG_INVALID_ARRAY_ITEM`

A non-string item appears in string array options.

Examples:

- `includeIds: ["getUser", 1]`

## `E_CONFIG_EMPTY_STRING`

A required string is empty after trim.

Examples:

- `output.file: "   "`
