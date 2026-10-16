import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  API_URL: z.url().default("http://localhost:5011"),
  // Public origin of this app (e.g. https://app.example.com). Only needed when a reverse proxy does not
  // forward the original host; see resolveExpectedOrigin and next.config.ts.
  APP_ORIGIN: z
    .url()
    .transform((value) => new URL(value).origin)
    .optional(),
  // Set to "true" only behind a reverse proxy that overwrites X-Forwarded-For: the client address is then
  // passed on to the API, which uses it for rate limiting. Otherwise the header could be forged.
  FORWARD_CLIENT_IP: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

// Parsed once at import time: a bad value fails the first request with a clear message.
export const env = serverEnvSchema.parse({
  API_URL: process.env.API_URL || undefined,
  APP_ORIGIN: process.env.APP_ORIGIN || undefined,
  FORWARD_CLIENT_IP: process.env.FORWARD_CLIENT_IP || undefined,
});
