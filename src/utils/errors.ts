import { ZodError } from "zod";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR";

export interface PublicError {
  code: ErrorCode;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

const REDACTION_PATTERNS = [
  /n8n_api_[a-zA-Z0-9_\-]+/g,
  /api[-_ ]?key\s*[:=]\s*[^\s,;]+/gi,
  /authorization\s*[:=]\s*bearer\s+[^\s,;]+/gi
];

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  public constructor(code: ErrorCode, message: string, statusCode: number, details?: Record<string, unknown>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const sanitizeErrorMessage = (message: string): string => {
  let sanitized = message;

  for (const pattern of REDACTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }

  return sanitized;
};

export const toPublicError = (error: unknown): PublicError => {
  if (error instanceof ZodError) {
    return {
      code: "VALIDATION_ERROR",
      message: "Invalid input",
      statusCode: 400,
      details: {
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      }
    };
  }

  if (error instanceof AppError) {
    return {
      code: error.code,
      message: sanitizeErrorMessage(error.message),
      statusCode: error.statusCode,
      details: error.details
    };
  }

  if (error instanceof Error) {
    return {
      code: "INTERNAL_ERROR",
      message: sanitizeErrorMessage(error.message),
      statusCode: 500
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: "Unexpected error",
    statusCode: 500
  };
};

export const validationError = (message: string, details?: Record<string, unknown>): AppError =>
  new AppError("VALIDATION_ERROR", message, 400, details);

export const notFoundError = (entity: string, id: string): AppError =>
  new AppError("NOT_FOUND", `${entity} not found`, 404, { entity, id });

export const upstreamError = (
  message: string,
  statusCode: number,
  details?: Record<string, unknown>
): AppError => new AppError("UPSTREAM_ERROR", message, statusCode, details);
