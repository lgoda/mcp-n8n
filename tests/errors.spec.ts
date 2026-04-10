import { describe, expect, it } from "vitest";

import { AppError, sanitizeErrorMessage, toPublicError } from "../src/utils/errors.js";

describe("error utilities", () => {
  it("sanitizes api key patterns", () => {
    const message = "upstream failed with n8n_api_123456 and authorization=Bearer abc";
    const sanitized = sanitizeErrorMessage(message);

    expect(sanitized).not.toContain("n8n_api_123456");
    expect(sanitized).toContain("[REDACTED]");
  });

  it("maps AppError into public error", () => {
    const error = new AppError("NOT_FOUND", "Workflow not found", 404, { workflowId: "wf_1" });
    const mapped = toPublicError(error);

    expect(mapped.code).toBe("NOT_FOUND");
    expect(mapped.statusCode).toBe(404);
    expect(mapped.details).toEqual({ workflowId: "wf_1" });
  });

  it("maps unknown errors to INTERNAL_ERROR", () => {
    const mapped = toPublicError({ unexpected: true });

    expect(mapped.code).toBe("INTERNAL_ERROR");
    expect(mapped.statusCode).toBe(500);
  });
});
