import { z } from "zod";

export const MATRIVA_FOUNDATION_VERSION = "0.1.0";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("matriva-api"),
  timestamp: z.string().datetime()
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
