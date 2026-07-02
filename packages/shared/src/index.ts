import { z } from "zod";

export const MATRIVA_FOUNDATION_VERSION = "0.1.0";

type Brand<Value, Name extends string> = Value & { readonly __brand: Name };

export type UserId = Brand<string, "UserId">;
export type HouseId = Brand<string, "HouseId">;
export type HomeCardId = Brand<string, "HomeCardId">;
export type TaskId = Brand<string, "TaskId">;
export type DocumentId = Brand<string, "DocumentId">;
export type SubscriptionId = Brand<string, "SubscriptionId">;

const opaqueSuffixPattern = "[a-z0-9][a-z0-9_-]{7,63}";

export const userIdSchema = z
  .string()
  .regex(new RegExp(`^usr_${opaqueSuffixPattern}$`))
  .transform((value): UserId => value as UserId);

export const houseIdSchema = z
  .string()
  .regex(new RegExp(`^house_${opaqueSuffixPattern}$`))
  .transform((value): HouseId => value as HouseId);

export const homeCardIdSchema = z
  .string()
  .regex(new RegExp(`^card_${opaqueSuffixPattern}$`))
  .transform((value): HomeCardId => value as HomeCardId);

export const taskIdSchema = z
  .string()
  .regex(new RegExp(`^task_${opaqueSuffixPattern}$`))
  .transform((value): TaskId => value as TaskId);

export const documentIdSchema = z
  .string()
  .regex(new RegExp(`^doc_${opaqueSuffixPattern}$`))
  .transform((value): DocumentId => value as DocumentId);

export const subscriptionIdSchema = z
  .string()
  .regex(new RegExp(`^sub_${opaqueSuffixPattern}$`))
  .transform((value): SubscriptionId => value as SubscriptionId);

export const userSummarySchema = z.object({
  id: userIdSchema,
  displayName: z.string().min(1).nullable(),
  email: z.string().email().nullable()
});

export type UserSummary = z.infer<typeof userSummarySchema>;

export const addressInputSchema = z.object({
  streetName: z.string().min(1),
  houseNumber: z.string().min(1),
  floor: z.string().min(1).optional(),
  door: z.string().min(1).optional(),
  postalCode: z.string().regex(/^\d{4}$/),
  city: z.string().min(1),
  countryCode: z.literal("DK")
});

export type AddressInput = z.infer<typeof addressInputSchema>;

export const houseSummarySchema = z.object({
  id: houseIdSchema,
  displayName: z.string().min(1),
  address: addressInputSchema,
  propertyType: z.enum([
    "DETACHED_HOUSE",
    "TOWNHOUSE",
    "APARTMENT",
    "SUMMER_HOUSE",
    "UNKNOWN"
  ])
});

export type HouseSummary = z.infer<typeof houseSummarySchema>;

export const homeCardTypeSchema = z.enum([
  "TASK_REMINDER",
  "MISSING_DOCUMENT",
  "SEASONAL_RECOMMENDATION",
  "LOCAL_WARNING",
  "LEGAL_UPDATE",
  "DOCUMENT_EXPIRY",
  "SUBSCRIPTION_LIMIT",
  "SYSTEM_NOTICE"
]);

export type HomeCardType = z.infer<typeof homeCardTypeSchema>;

export const homeCardSeveritySchema = z.enum(["info", "notice", "warning"]);

export type HomeCardSeverity = z.infer<typeof homeCardSeveritySchema>;

export const homeCardActionSchema = z.object({
  label: z.string().min(1),
  target: z.object({
    kind: z.enum(["screen", "external_url", "none"]),
    value: z.string().min(1).optional()
  })
});

export const homeCardSourceSchema = z.object({
  label: z.string().min(1),
  url: z.string().url().optional()
});

export const homeCardSchema = z.object({
  id: homeCardIdSchema,
  type: homeCardTypeSchema,
  title: z.string().min(1),
  shortExplanation: z.string().min(1),
  severity: homeCardSeveritySchema,
  action: homeCardActionSchema,
  source: homeCardSourceSchema.optional(),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime(),
  audience: z.object({
    countryCode: z.literal("DK"),
    propertyTypes: z.array(houseSummarySchema.shape.propertyType).optional()
  }),
  minAppVersion: z.string().min(1),
  fallbackText: z.string().min(1)
}).superRefine((card, context) => {
  const sourceRequiredTypes: ReadonlySet<HomeCardType> = new Set([
    "LOCAL_WARNING",
    "LEGAL_UPDATE"
  ]);

  if (sourceRequiredTypes.has(card.type) && !card.source) {
    context.addIssue({
      code: "custom",
      path: ["source"],
      message: "source is required for advisory card types"
    });
  }
});

export type HomeCard = z.infer<typeof homeCardSchema>;

export const featureKeySchema = z.enum([
  "documents.maxCount",
  "documents.maxStorageMb",
  "tasks.maxActive",
  "advisories.enabled",
  "legalUpdates.enabled",
  "sharing.enabled",
  "export.enabled",
  "advancedReminders.enabled"
]);

export type FeatureKey = z.infer<typeof featureKeySchema>;

export const entitlementValueSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("boolean"),
    value: z.boolean()
  }),
  z.object({
    kind: z.literal("limit"),
    value: z.number().int().nonnegative()
  })
]);

export const entitlementsSchema = z.object({
  plan: z.enum(["free", "pro"]),
  status: z.enum([
    "free",
    "trial",
    "active",
    "grace_period",
    "billing_issue",
    "expired",
    "cancelled",
    "refunded_revoked"
  ]),
  features: z.record(featureKeySchema, entitlementValueSchema),
  evaluatedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional()
});

export type Entitlements = z.infer<typeof entitlementsSchema>;

export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  requestId: z.string().min(1).optional()
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const apiResultSchema = <DataSchema extends z.ZodType>(dataSchema: DataSchema) =>
  z.discriminatedUnion("ok", [
    z.object({
      ok: z.literal(true),
      data: dataSchema
    }),
    z.object({
      ok: z.literal(false),
      error: apiErrorSchema
    })
  ]);

export type ApiResult<Data> =
  | {
      ok: true;
      data: Data;
    }
  | {
      ok: false;
      error: ApiError;
    };

export const homeBootstrapResponseSchema = z.object({
  user: userSummarySchema,
  house: houseSummarySchema.nullable(),
  entitlements: entitlementsSchema,
  cards: z.array(homeCardSchema),
  generatedAt: z.string().datetime(),
  skeleton: z.literal(true)
});

export type HomeBootstrapResponse = z.infer<typeof homeBootstrapResponseSchema>;

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("matriva-api"),
  timestamp: z.string().datetime()
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
