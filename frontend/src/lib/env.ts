import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  API_URL: z.url().default("http://localhost:5011"),
});

// Parsed once at import time: a bad API_URL fails the first request with a clear message.
export const env = serverEnvSchema.parse({ API_URL: process.env.API_URL || undefined });
