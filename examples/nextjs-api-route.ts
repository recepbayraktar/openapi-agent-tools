// Example: Next.js API Route consuming descriptors
// File: app/api/tool-descriptors/route.ts

import { toolDescriptors } from "@/generated/tool-descriptors.gen";

export async function GET() {
  return Response.json({
    count: toolDescriptors.length,
    tools: toolDescriptors,
  });
}
