import type { ToolResult } from "../types/mcp.js";
import { toPublicError } from "./errors.js";

export const okToolResult = (payload: Record<string, unknown>): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(payload) }],
  structuredContent: payload
});

export const errorToolResult = (error: unknown): ToolResult => {
  const publicError = toPublicError(error);
  const payload = {
    error: publicError
  };

  return {
    isError: true,
    content: [{ type: "text", text: `${publicError.code}: ${publicError.message}` }],
    structuredContent: payload
  };
};
