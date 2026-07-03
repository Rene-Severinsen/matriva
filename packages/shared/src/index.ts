import { z } from "zod";

export const MATRIVA_FOUNDATION_VERSION = "0.1.0";

type Brand<Value, Name extends string> = Value & { readonly __brand: Name };

export type UserId = Brand<string, "UserId">;
export type HouseId = Brand<string, "HouseId">;
export type HomeCardId = Brand<string, "HomeCardId">;
export type TaskId = Brand<string, "TaskId">;
export type DocumentId = Brand<string, "DocumentId">;
export type SubscriptionId = Brand<string, "SubscriptionId">;
export type AddressSuggestionId = Brand<string, "AddressSuggestionId">;
export type HouseDraftId = Brand<string, "HouseDraftId">;

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

export const addressSuggestionIdSchema = z
  .string()
  .regex(new RegExp(`^addr_${opaqueSuffixPattern}$`))
  .transform((value): AddressSuggestionId => value as AddressSuggestionId);

export const houseDraftIdSchema = z
  .string()
  .regex(new RegExp(`^house_draft_${opaqueSuffixPattern}$`))
  .transform((value): HouseDraftId => value as HouseDraftId);

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

export const addressSourceSchema = z.enum(["DAWA"]);

export type AddressSource = z.infer<typeof addressSourceSchema>;

export const addressSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(120)
});

export type AddressSearchQuery = z.infer<typeof addressSearchQuerySchema>;

export const addressSuggestionSchema = z.object({
  id: addressSuggestionIdSchema,
  source: addressSourceSchema,
  sourceAddressId: z.string().min(1),
  sourceAccessAddressId: z.string().min(1).optional(),
  label: z.string().min(1),
  roadName: z.string().min(1).optional(),
  houseNumber: z.string().min(1).optional(),
  floor: z.string().min(1).optional(),
  door: z.string().min(1).optional(),
  postalCode: z.string().regex(/^\d{4}$/).optional(),
  city: z.string().min(1).optional()
});

export type AddressSuggestion = z.infer<typeof addressSuggestionSchema>;

export const selectedAddressInputSchema = z.object({
  source: addressSourceSchema,
  sourceAddressId: z.string().min(1),
  sourceAccessAddressId: z.string().min(1).optional(),
  label: z.string().min(1)
});

export type SelectedAddressInput = z.infer<typeof selectedAddressInputSchema>;

export const addressSearchResponseSchema = z.object({
  query: addressSearchQuerySchema.shape.q,
  source: addressSourceSchema,
  suggestions: z.array(addressSuggestionSchema),
  generatedAt: z.string().datetime()
});

export type AddressSearchResponse = z.infer<typeof addressSearchResponseSchema>;

export const houseDraftStatusSchema = z.enum(["draft"]);

export type HouseDraftStatus = z.infer<typeof houseDraftStatusSchema>;

export const houseSourceReferenceSchema = z.object({
  source: addressSourceSchema,
  sourceAddressId: z.string().min(1),
  sourceAccessAddressId: z.string().min(1).optional()
});

export type HouseSourceReference = z.infer<typeof houseSourceReferenceSchema>;

export const houseProfileBasisSchema = z.object({
  displayName: z.string().min(1),
  addressLabel: z.string().min(1),
  postalCode: z.string().regex(/^\d{4}$/).optional(),
  city: z.string().min(1).optional(),
  propertyType: z
    .enum([
      "DETACHED_HOUSE",
      "TOWNHOUSE",
      "APARTMENT",
      "SUMMER_HOUSE",
      "UNKNOWN"
    ])
    .optional(),
  heatingType: z.string().min(1).optional(),
  roofType: z.string().min(1).optional(),
  buildYear: z.number().int().min(1700).max(2200).optional(),
  livingAreaM2: z.number().int().positive().optional()
});

export type HouseProfileBasis = z.infer<typeof houseProfileBasisSchema>;

export const houseDraftSchema = z.object({
  id: houseDraftIdSchema,
  status: houseDraftStatusSchema,
  selectedAddress: selectedAddressInputSchema,
  profile: houseProfileBasisSchema,
  sourceReferences: z.array(houseSourceReferenceSchema).min(1),
  createdAt: z.string().datetime(),
  skeleton: z.literal(true)
});

export type HouseDraft = z.infer<typeof houseDraftSchema>;

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

export const houseDraftResponseSchema = z.object({
  houseDraft: houseDraftSchema,
  cards: z.array(homeCardSchema),
  generatedAt: z.string().datetime(),
  skeleton: z.literal(true)
});

export type HouseDraftResponse = z.infer<typeof houseDraftResponseSchema>;

export const houseEnrichmentStatusSchema = z.enum([
  "skeleton",
  "verified",
  "failed",
  "partial"
]);

export type HouseEnrichmentStatus = z.infer<
  typeof houseEnrichmentStatusSchema
>;

export const houseEnrichmentSourceKindSchema = z.literal("BBR_DATAFORDELER");

export type HouseEnrichmentSourceKind = z.infer<
  typeof houseEnrichmentSourceKindSchema
>;

export const houseEnrichmentVerificationStatusSchema = z.enum([
  "not_verified",
  "verified",
  "unavailable"
]);

export type HouseEnrichmentVerificationStatus = z.infer<
  typeof houseEnrichmentVerificationStatusSchema
>;

export const houseEnrichmentIntegrationStatusSchema = z.enum([
  "credentials_missing",
  "credentials_configured_not_implemented",
  "unsupported_auth_mode",
  "live_ready"
]);

export type HouseEnrichmentIntegrationStatus = z.infer<
  typeof houseEnrichmentIntegrationStatusSchema
>;

export const houseEnrichmentSourceSchema = z
  .object({
    source: houseEnrichmentSourceKindSchema,
    label: z.literal("BBR/Datafordeler"),
    sourceAccessAddressId: z.string().min(1).optional(),
    sourceAddressId: z.string().min(1).optional(),
    verificationStatus: houseEnrichmentVerificationStatusSchema,
    integrationStatus: houseEnrichmentIntegrationStatusSchema,
    fetchedAt: z.string().datetime().optional(),
    skeleton: z.boolean()
  })
  .superRefine((source, context) => {
    if (source.verificationStatus !== "verified") {
      return;
    }

    if (source.skeleton) {
      context.addIssue({
        code: "custom",
        path: ["skeleton"],
        message: "verified source must not be marked as skeleton"
      });
    }

    if (source.integrationStatus !== "live_ready") {
      context.addIssue({
        code: "custom",
        path: ["integrationStatus"],
        message: "verified source requires live_ready integration status"
      });
    }

    if (!source.fetchedAt) {
      context.addIssue({
        code: "custom",
        path: ["fetchedAt"],
        message: "verified source requires fetchedAt"
      });
    }
  });

export type HouseEnrichmentSource = z.infer<
  typeof houseEnrichmentSourceSchema
>;

export const bbrEnrichmentStatusSchema = z.enum([
  "not_requested",
  "skeleton",
  "available",
  "unavailable",
  "error"
]);

export type BbrEnrichmentStatus = z.infer<typeof bbrEnrichmentStatusSchema>;

export const bbrPropertySummarySchema = z.object({
  propertyType: houseProfileBasisSchema.shape.propertyType.optional(),
  buildYear: houseProfileBasisSchema.shape.buildYear.optional(),
  livingAreaM2: houseProfileBasisSchema.shape.livingAreaM2.optional(),
  heatedAreaM2: z.number().int().positive().optional(),
  heatingType: z.string().min(1).optional(),
  roofType: z.string().min(1).optional(),
  externalWallMaterial: z.string().min(1).optional(),
  usageCode: z.string().min(1).optional(),
  rawCodeNotes: z.array(z.string().min(1)).optional()
});

export type BbrPropertySummary = z.infer<typeof bbrPropertySummarySchema>;

export const bbrBuildingSummarySchema = z.object({
  buildingId: z.string().min(1).optional(),
  buildingNumber: z.string().min(1).optional(),
  buildYear: houseProfileBasisSchema.shape.buildYear.optional(),
  areaM2: z.number().int().positive().optional(),
  usage: z.string().min(1).optional(),
  heatingType: z.string().min(1).optional(),
  roofType: z.string().min(1).optional()
});

export type BbrBuildingSummary = z.infer<typeof bbrBuildingSummarySchema>;

export const bbrUnitSummarySchema = z.object({
  unitId: z.string().min(1).optional(),
  unitUsage: z.string().min(1).optional(),
  livingAreaM2: houseProfileBasisSchema.shape.livingAreaM2.optional()
});

export type BbrUnitSummary = z.infer<typeof bbrUnitSummarySchema>;

export const houseEnrichmentWarningCodeSchema = z.enum([
  "skeleton_not_verified",
  "credentials_missing",
  "credentials_configured_not_implemented",
  "unsupported_auth_mode"
]);

export type HouseEnrichmentWarningCode = z.infer<
  typeof houseEnrichmentWarningCodeSchema
>;

export const houseEnrichmentWarningSchema = z.object({
  code: houseEnrichmentWarningCodeSchema,
  message: z.string().min(1)
});

export type HouseEnrichmentWarning = z.infer<
  typeof houseEnrichmentWarningSchema
>;

export const houseEnrichmentSchema = z
  .object({
    status: houseEnrichmentStatusSchema,
    source: houseEnrichmentSourceSchema,
    property: bbrPropertySummarySchema.optional(),
    buildings: z.array(bbrBuildingSummarySchema),
    units: z.array(bbrUnitSummarySchema),
    warnings: z.array(z.string().min(1)),
    warningDetails: z.array(houseEnrichmentWarningSchema),
    generatedAt: z.string().datetime(),
    skeleton: z.boolean()
  })
  .superRefine((enrichment, context) => {
    if (enrichment.skeleton) {
      if (enrichment.status !== "skeleton") {
        context.addIssue({
          code: "custom",
          path: ["status"],
          message: "skeleton enrichment must use skeleton status"
        });
      }

      if (!enrichment.source.skeleton) {
        context.addIssue({
          code: "custom",
          path: ["source", "skeleton"],
          message: "skeleton enrichment requires skeleton source"
        });
      }

      if (enrichment.source.verificationStatus !== "not_verified") {
        context.addIssue({
          code: "custom",
          path: ["source", "verificationStatus"],
          message: "skeleton enrichment source must be not_verified"
        });
      }

      if (enrichment.source.integrationStatus === "live_ready") {
        context.addIssue({
          code: "custom",
          path: ["source", "integrationStatus"],
          message: "skeleton enrichment source must not be live_ready"
        });
      }

      if (enrichment.source.fetchedAt) {
        context.addIssue({
          code: "custom",
          path: ["source", "fetchedAt"],
          message: "skeleton enrichment source must not include fetchedAt"
        });
      }
    }

    if (enrichment.status !== "verified") {
      return;
    }

    if (enrichment.skeleton) {
      context.addIssue({
        code: "custom",
        path: ["skeleton"],
        message: "verified enrichment must not be marked as skeleton"
      });
    }

    if (enrichment.source.verificationStatus !== "verified") {
      context.addIssue({
        code: "custom",
        path: ["source", "verificationStatus"],
        message: "verified enrichment requires verified source"
      });
    }

    if (enrichment.source.integrationStatus !== "live_ready") {
      context.addIssue({
        code: "custom",
        path: ["source", "integrationStatus"],
        message: "verified enrichment requires live_ready integration status"
      });
    }
  });

export type HouseEnrichment = z.infer<typeof houseEnrichmentSchema>;

export const enrichHouseDraftRequestSchema = z.object({
  houseDraftId: houseDraftIdSchema,
  selectedAddress: selectedAddressInputSchema
});

export type EnrichHouseDraftRequest = z.infer<
  typeof enrichHouseDraftRequestSchema
>;

export const enrichHouseDraftResponseSchema = z.object({
  houseDraftId: houseDraftIdSchema,
  enrichment: houseEnrichmentSchema,
  profilePreview: houseProfileBasisSchema.optional(),
  cards: z.array(homeCardSchema),
  generatedAt: z.string().datetime(),
  skeleton: z.boolean()
});

export type EnrichHouseDraftResponse = z.infer<
  typeof enrichHouseDraftResponseSchema
>;

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
