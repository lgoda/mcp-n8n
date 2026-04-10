import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  N8N_API_URL: z.string().url(),
  N8N_API_KEY: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  MCP_SERVER_NAME: z.string().min(1).default("n8n-mcp-server"),
  MCP_SERVER_VERSION: z.string().min(1).default("0.1.0"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info")
});

export type AppConfig = z.infer<typeof envSchema>;

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => {
  const parsedEnv = envSchema.safeParse(env);

  if (!parsedEnv.success) {
    const formatted = parsedEnv.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid environment configuration: ${formatted}`);
  }

  return {
    ...parsedEnv.data,
    N8N_API_URL: parsedEnv.data.N8N_API_URL.replace(/\/$/, "")
  };
};
