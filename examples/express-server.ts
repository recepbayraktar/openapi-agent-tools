// Example: Express endpoint exposing descriptors
// File: server.ts

import express from "express";
import { toolDescriptorMap, toolDescriptors } from "./generated/tool-descriptors.gen";

const app = express();

app.get("/tool-descriptors", (_req, res) => {
  res.json({
    count: toolDescriptors.length,
    descriptors: toolDescriptors,
  });
});

app.get("/tool-descriptors/:toolName", (req, res) => {
  const descriptor = toolDescriptorMap[req.params.toolName];

  if (!descriptor) {
    res.status(404).json({ error: "Descriptor not found" });
    return;
  }

  res.json(descriptor);
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
