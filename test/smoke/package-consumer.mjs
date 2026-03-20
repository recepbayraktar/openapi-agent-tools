import assert from "node:assert/strict";

const packageExports = await import("../../dist/index.js");

assert.equal(typeof packageExports.default, "object");
assert.equal(typeof packageExports.extractOperations, "function");
assert.equal(typeof packageExports.generateToolDescriptorsCode, "function");
assert.equal(typeof packageExports.deriveIntentType, "function");
assert.equal(typeof packageExports.deriveSafetyLevel, "function");
assert.equal(typeof packageExports.extractEntityNouns, "function");
assert.equal(typeof packageExports.buildRoutingDescription, "function");

console.log("Package consumer smoke test passed");
