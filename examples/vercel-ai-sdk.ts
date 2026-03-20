// Example: Vercel AI SDK integration with generated tools

import { tools as generatedTools } from "./generated/tool-descriptors.gen";

export const tools = {
  ...generatedTools,
  get_user_by_id: {
    ...generatedTools.get_user_by_id,
    execute: async (input: Record<string, unknown>) => {
      return { ok: true, input };
    },
  },
};
