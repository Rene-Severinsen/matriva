import { z } from "zod";

export const MATRIVA_FOUNDATION_VERSION = "0.1.0";

type Brand<Value, Name extends string> = Value & { readonly __brand: Name };

export type UserId = Brand<string, "UserId">;
export type MagicLinkTokenId = Brand<string, "MagicLinkTokenId">;
export type AuthSessionId = Brand<string, "AuthSessionId">;
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

export const magicLinkTokenIdSchema = z
  .string()
  .regex(new RegExp(`^mlt_${opaqueSuffixPattern}$`))
  .transform((value): MagicLinkTokenId => value as MagicLinkTokenId);

export const authSessionIdSchema = z
  .string()
  .regex(new RegExp(`^sess_${opaqueSuffixPattern}$`))
  .transform((value): AuthSessionId => value as AuthSessionId);

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


export const emailInputSchema = z.string().trim().email().max(320);

export const userStatusSchema = z.enum(["active", "disabled"]);

export type UserStatus = z.infer<typeof userStatusSchema>;

export const userProfileSchema = z.object({
  displayName: z.string().min(1).nullable(),
  preferredLocale: z.literal("da-DK")
});

export type UserProfile = z.infer<typeof userProfileSchema>;

export const currentUserSchema = z.object({
  id: userIdSchema,
  email: z.string().email(),
  emailVerifiedAt: z.string().datetime().nullable(),
  status: userStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastLoginAt: z.string().datetime().nullable()
});

export type CurrentUser = z.infer<typeof currentUserSchema>;

export const sessionTokensSchema = z.object({
  accessToken: z.string().min(32),
  accessTokenExpiresAt: z.string().datetime(),
  refreshToken: z.string().min(32),
  refreshTokenExpiresAt: z.string().datetime()
});

export type SessionTokens = z.infer<typeof sessionTokensSchema>;

export const onboardingStateSchema = z.enum([
  "profile_required",
  "house_required",
  "complete"
]);

export type OnboardingState = z.infer<typeof onboardingStateSchema>;

export const requestMagicLinkRequestSchema = z.object({
  email: emailInputSchema
});

export type RequestMagicLinkRequest = z.infer<typeof requestMagicLinkRequestSchema>;

export const requestMagicLinkResponseSchema = z.object({
  ok: z.literal(true),
  message: z.string().min(1),
  cooldownSeconds: z.number().int().positive(),
  devMagicLink: z.string().url().optional()
});

export type RequestMagicLinkResponse = z.infer<
  typeof requestMagicLinkResponseSchema
>;

export const consumeMagicLinkRequestSchema = z.object({
  token: z.string().min(32).max(512)
});

export type ConsumeMagicLinkRequest = z.infer<typeof consumeMagicLinkRequestSchema>;

export const authSessionResponseSchema = z.object({
  user: currentUserSchema,
  profile: userProfileSchema,
  tokens: sessionTokensSchema
});

export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;

export const refreshSessionRequestSchema = z.object({
  refreshToken: z.string().min(32).max(512)
});

export type RefreshSessionRequest = z.infer<typeof refreshSessionRequestSchema>;

export const logoutRequestSchema = z.object({
  refreshToken: z.string().min(32).max(512).optional()
});

export type LogoutRequest = z.infer<typeof logoutRequestSchema>;

export const logoutResponseSchema = z.object({
  ok: z.literal(true)
});

export type LogoutResponse = z.infer<typeof logoutResponseSchema>;

export const currentUserResponseSchema = z.object({
  user: currentUserSchema,
  profile: userProfileSchema
});

export type CurrentUserResponse = z.infer<typeof currentUserResponseSchema>;

export const updateProfileRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  preferredLocale: z.literal("da-DK").optional()
});

export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

export const updateProfileResponseSchema = z.object({
  profile: userProfileSchema
});

export type UpdateProfileResponse = z.infer<typeof updateProfileResponseSchema>;

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

export const houseDraftOverviewPreviewDataConfidenceSchema =
  z.literal("not_verified");

export type HouseDraftOverviewPreviewDataConfidence = z.infer<
  typeof houseDraftOverviewPreviewDataConfidenceSchema
>;

export const maintenanceTaskSourceSchema = z.enum([
  "user_created",
  "matriva_recommended"
]);

export type MaintenanceTaskSource = z.infer<
  typeof maintenanceTaskSourceSchema
>;

export const maintenanceTaskStatusSchema = z.enum([
  "suggested",
  "planned",
  "due",
  "overdue",
  "done",
  "dismissed",
  "rescheduled"
]);

export type MaintenanceTaskStatus = z.infer<
  typeof maintenanceTaskStatusSchema
>;

export const maintenanceTimingTypeSchema = z.enum([
  "specific_deadline",
  "seasonal_window",
  "none"
]);

export type MaintenanceTimingType = z.infer<
  typeof maintenanceTimingTypeSchema
>;

export const maintenanceSeasonSchema = z.enum([
  "spring",
  "summer",
  "autumn",
  "winter",
  "all_year"
]);

export type MaintenanceSeason = z.infer<typeof maintenanceSeasonSchema>;

export const maintenanceTaskTimingSchema = z
  .object({
    type: maintenanceTimingTypeSchema,
    dueDate: z.string().date().optional(),
    season: maintenanceSeasonSchema.optional(),
    daysUntilDue: z.number().int().nonnegative().optional(),
    daysOverdue: z.number().int().positive().optional()
  })
  .superRefine((timing, context) => {
    if (timing.type === "seasonal_window") {
      if (!timing.season) {
        context.addIssue({
          code: "custom",
          path: ["season"],
          message: "seasonal maintenance tasks must include season"
        });
      }

      if (timing.dueDate) {
        context.addIssue({
          code: "custom",
          path: ["dueDate"],
          message: "seasonal maintenance tasks must not include dueDate"
        });
      }
    }

    if (timing.type === "specific_deadline" && !timing.dueDate) {
      context.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "specific deadline maintenance tasks should include dueDate"
      });
    }

    if (timing.type === "none") {
      if (timing.dueDate) {
        context.addIssue({
          code: "custom",
          path: ["dueDate"],
          message: "maintenance tasks without timing must not include dueDate"
        });
      }

      if (timing.season) {
        context.addIssue({
          code: "custom",
          path: ["season"],
          message: "maintenance tasks without timing must not include season"
        });
      }
    }
  });

export type MaintenanceTaskTiming = z.infer<
  typeof maintenanceTaskTimingSchema
>;

export const recommendedMaintenanceTaskMetadataSchema = z.object({
  recommendationKey: z.string().min(1),
  componentKey: z.string().min(1).optional(),
  housingTypeKey: z.string().min(1).optional(),
  season: maintenanceSeasonSchema.optional(),
  reason: z.string().min(1).optional()
});

export type RecommendedMaintenanceTaskMetadata = z.infer<
  typeof recommendedMaintenanceTaskMetadataSchema
>;

export const maintenanceTaskSchema = z
  .object({
    id: taskIdSchema,
    houseId: houseIdSchema,
    title: z.string().min(1),
    description: z.string().min(1).optional(),
    source: maintenanceTaskSourceSchema,
    status: maintenanceTaskStatusSchema,
    timing: maintenanceTaskTimingSchema,
    recommendation: recommendedMaintenanceTaskMetadataSchema.optional(),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
    completedAt: z.string().datetime().optional()
  })
  .superRefine((task, context) => {
    if (
      task.timing.daysOverdue !== undefined &&
      task.status !== "overdue"
    ) {
      context.addIssue({
        code: "custom",
        path: ["timing", "daysOverdue"],
        message: "daysOverdue is only allowed for overdue maintenance tasks"
      });
    }

    if (task.completedAt && task.status !== "done") {
      context.addIssue({
        code: "custom",
        path: ["completedAt"],
        message: "completedAt is only allowed for done maintenance tasks"
      });
    }

    if (task.recommendation && task.source !== "matriva_recommended") {
      context.addIssue({
        code: "custom",
        path: ["recommendation"],
        message:
          "recommendation metadata is only allowed for Matriva-recommended maintenance tasks"
      });
    }
  });

export type MaintenanceTask = z.infer<typeof maintenanceTaskSchema>;

export const devUserSchema = z.object({
  id: userIdSchema,
  email: z.string().email(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type DevUser = z.infer<typeof devUserSchema>;

export const currentDevUserResponseSchema = z.object({
  user: devUserSchema
});

export type CurrentDevUserResponse = z.infer<
  typeof currentDevUserResponseSchema
>;

export const savedHouseStatusSchema = z.enum(["saved"]);

export type SavedHouseStatus = z.infer<typeof savedHouseStatusSchema>;

export const savedHouseDataConfidenceSchema = z.enum(["not_verified"]);

export type SavedHouseDataConfidence = z.infer<
  typeof savedHouseDataConfidenceSchema
>;

export const savedHouseSchema = z.object({
  id: houseIdSchema,
  ownerUserId: userIdSchema,
  addressLabel: z.string().min(1),
  dawaAddressId: z.string().min(1).optional(),
  status: savedHouseStatusSchema,
  dataConfidence: savedHouseDataConfidenceSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type SavedHouse = z.infer<typeof savedHouseSchema>;

export const createSavedHouseRequestSchema = z.object({
  houseDraftId: houseDraftIdSchema.optional(),
  selectedAddress: selectedAddressInputSchema
});

export type CreateSavedHouseRequest = z.infer<
  typeof createSavedHouseRequestSchema
>;

export const savedHouseResponseSchema = z.object({
  house: savedHouseSchema
});

export type SavedHouseResponse = z.infer<typeof savedHouseResponseSchema>;

export const savedHousesResponseSchema = z.object({
  houses: z.array(savedHouseSchema),
  generatedAt: z.string().datetime()
});

export type SavedHousesResponse = z.infer<typeof savedHousesResponseSchema>;

export const createMaintenanceTaskTimingSchema = z
  .object({
    type: maintenanceTimingTypeSchema,
    dueDate: z.string().date().optional(),
    season: maintenanceSeasonSchema.optional()
  })
  .superRefine((timing, context) => {
    if (timing.type === "seasonal_window") {
      if (!timing.season) {
        context.addIssue({
          code: "custom",
          path: ["season"],
          message: "seasonal maintenance tasks must include season"
        });
      }

      if (timing.dueDate) {
        context.addIssue({
          code: "custom",
          path: ["dueDate"],
          message: "seasonal maintenance tasks must not include dueDate"
        });
      }
    }

    if (timing.type === "specific_deadline" && !timing.dueDate) {
      context.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "specific deadline maintenance tasks should include dueDate"
      });
    }

    if (timing.type === "none") {
      if (timing.dueDate) {
        context.addIssue({
          code: "custom",
          path: ["dueDate"],
          message: "maintenance tasks without timing must not include dueDate"
        });
      }

      if (timing.season) {
        context.addIssue({
          code: "custom",
          path: ["season"],
          message: "maintenance tasks without timing must not include season"
        });
      }
    }
  });

export type CreateMaintenanceTaskTiming = z.infer<
  typeof createMaintenanceTaskTimingSchema
>;

export const createMaintenanceTaskRequestSchema = z
  .object({
    title: z.string().trim().min(1),
    description: z.string().trim().min(1).optional(),
    source: maintenanceTaskSourceSchema.optional(),
    status: maintenanceTaskStatusSchema.optional(),
    timing: createMaintenanceTaskTimingSchema,
    recommendation: recommendedMaintenanceTaskMetadataSchema.optional()
  })
  .superRefine((task, context) => {
    if (task.recommendation && task.source !== "matriva_recommended") {
      context.addIssue({
        code: "custom",
        path: ["recommendation"],
        message:
          "recommendation metadata is only allowed for Matriva-recommended maintenance tasks"
      });
    }
  });

export type CreateMaintenanceTaskRequest = z.infer<
  typeof createMaintenanceTaskRequestSchema
>;

export const maintenanceTaskResponseSchema = z.object({
  task: maintenanceTaskSchema
});

export type MaintenanceTaskResponse = z.infer<
  typeof maintenanceTaskResponseSchema
>;

export const maintenanceTasksResponseSchema = z.object({
  tasks: z.array(maintenanceTaskSchema),
  generatedAt: z.string().datetime()
});

export type MaintenanceTasksResponse = z.infer<
  typeof maintenanceTasksResponseSchema
>;

export const updateMaintenanceTaskStatusRequestSchema = z.object({
  status: maintenanceTaskStatusSchema
});

export type UpdateMaintenanceTaskStatusRequest = z.infer<
  typeof updateMaintenanceTaskStatusRequestSchema
>;

export const houseDraftOverviewPreviewSectionKindSchema = z.enum([
  "overview",
  "documents",
  "maintenance",
  "next_actions"
]);

export type HouseDraftOverviewPreviewSectionKind = z.infer<
  typeof houseDraftOverviewPreviewSectionKindSchema
>;

export const houseDraftOverviewPreviewMaintenanceSourceSchema =
  maintenanceTaskSourceSchema;

export type HouseDraftOverviewPreviewMaintenanceSource = z.infer<
  typeof houseDraftOverviewPreviewMaintenanceSourceSchema
>;

export const houseDraftOverviewPreviewMaintenanceStatusSchema = z.enum([
  "suggested",
  "coming_up",
  "due",
  "overdue",
  "done",
  "disabled_preview"
]);

export type HouseDraftOverviewPreviewMaintenanceStatus = z.infer<
  typeof houseDraftOverviewPreviewMaintenanceStatusSchema
>;

export const houseDraftOverviewPreviewMaintenanceTimingTypeSchema =
  maintenanceTimingTypeSchema;

export type HouseDraftOverviewPreviewMaintenanceTimingType = z.infer<
  typeof houseDraftOverviewPreviewMaintenanceTimingTypeSchema
>;

export const houseDraftOverviewPreviewMaintenanceSeasonSchema =
  maintenanceSeasonSchema;

export type HouseDraftOverviewPreviewMaintenanceSeason = z.infer<
  typeof houseDraftOverviewPreviewMaintenanceSeasonSchema
>;

export const houseDraftOverviewPreviewMaintenanceSchema = z
  .object({
    source: houseDraftOverviewPreviewMaintenanceSourceSchema,
    status: houseDraftOverviewPreviewMaintenanceStatusSchema,
    timingType: houseDraftOverviewPreviewMaintenanceTimingTypeSchema,
    dueDate: z.string().date().optional(),
    season: houseDraftOverviewPreviewMaintenanceSeasonSchema.optional(),
    daysUntilDue: z.number().int().nonnegative().optional(),
    daysOverdue: z.number().int().positive().optional()
  })
  .superRefine((maintenance, context) => {
    if (maintenance.timingType === "seasonal_window") {
      if (!maintenance.season) {
        context.addIssue({
          code: "custom",
          path: ["season"],
          message: "seasonal maintenance preview cards must include season"
        });
      }

      if (maintenance.dueDate) {
        context.addIssue({
          code: "custom",
          path: ["dueDate"],
          message: "seasonal maintenance preview cards must not require dueDate"
        });
      }
    }

    if (maintenance.timingType === "specific_deadline" && !maintenance.dueDate) {
      context.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "specific deadline maintenance preview cards must include dueDate"
      });
    }

    if (
      maintenance.daysOverdue !== undefined &&
      maintenance.status !== "overdue"
    ) {
      context.addIssue({
        code: "custom",
        path: ["daysOverdue"],
        message: "daysOverdue is only allowed for overdue maintenance previews"
      });
    }
  });

export type HouseDraftOverviewPreviewMaintenance = z.infer<
  typeof houseDraftOverviewPreviewMaintenanceSchema
>;

export const houseDraftOverviewPreviewCardSchema = z.object({
  id: z.string().regex(/^overview_card_[a-z0-9][a-z0-9_-]{7,63}$/),
  title: z.string().min(1),
  body: z.string().min(1),
  statusLabel: z.string().min(1).optional(),
  maintenance: houseDraftOverviewPreviewMaintenanceSchema.optional(),
  cta: z
    .object({
      label: z.string().min(1),
      enabled: z.literal(false),
      reason: z.string().min(1)
    })
    .optional()
});

export type HouseDraftOverviewPreviewCard = z.infer<
  typeof houseDraftOverviewPreviewCardSchema
>;

export const houseDraftOverviewPreviewSectionSchema = z.object({
  kind: houseDraftOverviewPreviewSectionKindSchema,
  title: z.string().min(1),
  intro: z.string().min(1).optional(),
  cards: z.array(houseDraftOverviewPreviewCardSchema).min(1)
});

export type HouseDraftOverviewPreviewSection = z.infer<
  typeof houseDraftOverviewPreviewSectionSchema
>;

export const houseDraftOverviewPreviewResponseSchema = z
  .object({
    version: z.literal("house_draft_overview_preview.v1"),
    houseDraftId: houseDraftIdSchema,
    draftStatus: houseDraftStatusSchema,
    dataConfidence: houseDraftOverviewPreviewDataConfidenceSchema,
    title: z.literal("Mit hus"),
    subtitle: z.string().min(1),
    warningTitle: z.literal("Ikke verificerede boligdata"),
    warningBody: z.string().min(1),
    sections: z
      .array(houseDraftOverviewPreviewSectionSchema)
      .length(4)
      .superRefine((sections, context) => {
        const expectedKinds: HouseDraftOverviewPreviewSectionKind[] = [
          "overview",
          "documents",
          "maintenance",
          "next_actions"
        ];
        const kinds = new Set(sections.map((section) => section.kind));

        for (const kind of expectedKinds) {
          if (!kinds.has(kind)) {
            context.addIssue({
              code: "custom",
              message: `overview preview must include ${kind} section`
            });
          }
        }
      }),
    generatedAt: z.string().datetime(),
    skeleton: z.literal(true)
  })
  .superRefine((preview, context) => {
    if (preview.dataConfidence !== "not_verified") {
      context.addIssue({
        code: "custom",
        path: ["dataConfidence"],
        message: "house draft overview preview data must not be verified"
      });
    }
  });

export type HouseDraftOverviewPreviewResponse = z.infer<
  typeof houseDraftOverviewPreviewResponseSchema
>;

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

export const publicDataEnrichmentStatusSchema = z.enum([
  "not_started",
  "fetching",
  "success",
  "partial",
  "not_found",
  "ambiguous",
  "temporarily_unavailable",
  "failed"
]);

export type PublicDataEnrichmentStatus = z.infer<
  typeof publicDataEnrichmentStatusSchema
>;

export const publicDataSelectionStatusSchema = z.enum([
  "automatic_address_relation",
  "automatic_unambiguous",
  "user_confirmation_required",
  "not_found"
]);

export type PublicDataSelectionStatus = z.infer<
  typeof publicDataSelectionStatusSchema
>;

export const publicDataWarningCodeSchema = z.enum([
  "unit_total_area_not_evaluable",
  "building_unit_residential_area_mismatch",
  "missing_primary_unit",
  "multiple_primary_unit_candidates",
  "unknown_code",
  "missing_ground_relation",
  "missing_bfe_number",
  "optional_field_unavailable",
  "partial_building_details",
  "provider_not_configured",
  "provider_not_found",
  "provider_temporarily_unavailable"
]);

export const publicDataWarningSchema = z.object({
  code: publicDataWarningCodeSchema,
  message: z.string().min(1),
  path: z.string().min(1).optional()
});

export type PublicDataWarning = z.infer<typeof publicDataWarningSchema>;

export const publicCodeValueSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1).nullable(),
  known: z.boolean(),
  codebookKey: z.string().min(1),
  deprecated: z.boolean().optional()
});

export type PublicCodeValue = z.infer<typeof publicCodeValueSchema>;

export const publicAddressSchema = z.object({
  label: z.string().min(1),
  darAddressId: z.string().min(1),
  darAccessAddressId: z.string().min(1).nullable(),
  roadName: z.string().min(1).nullable(),
  houseNumberText: z.string().min(1).nullable(),
  postalCode: z.string().min(1).nullable(),
  postalDistrict: z.string().min(1).nullable()
});

export const publicPropertySchema = z.object({
  bfeNumber: z.string().min(1).nullable(),
  propertyType: publicCodeValueSchema.nullable(),
  status: publicCodeValueSchema.nullable(),
  municipalityCode: z.string().min(1).nullable(),
  assessmentPropertyNumber: z.string().min(1).nullable()
});

export const publicGroundSchema = z.object({
  bbrGroundId: z.string().min(1),
  waterSupply: publicCodeValueSchema.nullable(),
  sewer: publicCodeValueSchema.nullable()
});

export const publicParcelSchema = z.object({
  cadastralParcelId: z.string().min(1),
  cadastralNumber: z.string().min(1).nullable(),
  ownerDistrictId: z.string().min(1).nullable(),
  municipalityId: z.string().min(1).nullable()
});

const inclusionDecisionSchema = z.object({
  includedInProductView: z.boolean(),
  exclusionReason: z
    .enum([
      "projected",
      "non_constructed_lifecycle",
      "unsupported_lifecycle",
      "invalid_source_identity"
    ])
    .nullable()
});

export const publicUnitSchema = z.object({
  bbrUnitId: z.string().min(1),
  buildingId: z.string().min(1),
  floorId: z.string().min(1).nullable(),
  lifecycle: publicCodeValueSchema,
  use: publicCodeValueSchema.nullable(),
  housingType: publicCodeValueSchema.nullable(),
  areas: z.object({
    totalAreaM2: z.number().int().nonnegative().nullable(),
    residentialAreaM2: z.number().int().nonnegative().nullable(),
    commercialAreaM2: z.number().int().nonnegative().nullable(),
    physicalResidentialAreaM2: z.number().int().nonnegative().nullable(),
    physicalCommercialAreaM2: z.number().int().nonnegative().nullable()
  }),
  roomCount: z.number().int().nonnegative().nullable(),
  facilities: z.object({
    toiletType: publicCodeValueSchema.nullable(),
    bathType: publicCodeValueSchema.nullable(),
    kitchenType: publicCodeValueSchema.nullable(),
    flushToiletCount: z.number().int().nonnegative().nullable(),
    bathroomCount: z.number().int().nonnegative().nullable()
  }),
  heating: z.object({
    installation: publicCodeValueSchema.nullable(),
    source: publicCodeValueSchema.nullable(),
    supplementary: publicCodeValueSchema.nullable(),
    sourceApplicability: z.enum(["applicable", "not_applicable", "unknown"])
  })
});

export type PublicUnit = z.infer<typeof publicUnitSchema>;

export const publicFloorSchema = z.object({
  bbrFloorId: z.string().min(1),
  buildingId: z.string().min(1),
  lifecycle: publicCodeValueSchema,
  designation: z.string().min(1).nullable(),
  type: publicCodeValueSchema.nullable(),
  totalFloorAreaM2: z.number().int().nonnegative().nullable(),
  utilisedAtticAreaM2: z.number().int().nonnegative().nullable(),
  basementAreaM2: z.number().int().nonnegative().nullable(),
  legalResidentialBasementAreaM2: z.number().int().nonnegative().nullable(),
  accessAreaM2: z.number().int().nonnegative().nullable(),
  commercialBasementAreaM2: z.number().int().nonnegative().nullable()
});

export type PublicFloor = z.infer<typeof publicFloorSchema>;

export const publicBuildingSchema = z.object({
  bbrBuildingId: z.string().min(1),
  number: z.number().int().nonnegative().nullable(),
  isAddressBuilding: z.boolean(),
  lifecycle: publicCodeValueSchema,
  use: publicCodeValueSchema.nullable(),
  inclusion: inclusionDecisionSchema,
  constructionYear: z.number().int().min(1000).max(3000).nullable(),
  remodelOrExtensionYear: z.number().int().min(1000).max(3000).nullable(),
  materials: z.object({
    outerWall: publicCodeValueSchema.nullable(),
    roof: publicCodeValueSchema.nullable(),
    asbestos: publicCodeValueSchema.nullable()
  }),
  areas: z.object({
    totalBuildingAreaM2: z.number().int().nonnegative().nullable(),
    residentialAreaM2: z.number().int().nonnegative().nullable(),
    commercialAreaM2: z.number().int().nonnegative().nullable(),
    footprintAreaM2: z.number().int().nonnegative().nullable(),
    integratedGarageM2: z.number().int().nonnegative().nullable(),
    integratedCarportM2: z.number().int().nonnegative().nullable(),
    integratedOutbuildingM2: z.number().int().nonnegative().nullable(),
    integratedConservatoryM2: z.number().int().nonnegative().nullable(),
    otherAreaM2: z.number().int().nonnegative().nullable(),
    coveredAreaM2: z.number().int().nonnegative().nullable()
  }),
  registeredFloorCount: z.number().int().nonnegative().nullable(),
  heating: z.object({
    installation: publicCodeValueSchema.nullable(),
    source: publicCodeValueSchema.nullable(),
    supplementary: publicCodeValueSchema.nullable(),
    sourceApplicability: z.enum(["applicable", "not_applicable", "unknown"])
  }),
  units: z.array(publicUnitSchema),
  floors: z.array(publicFloorSchema)
});

export type PublicBuilding = z.infer<typeof publicBuildingSchema>;

export const housePublicDataResponseV1Schema = z.object({
  contract: z.literal("house_public_data.v1"),
  status: publicDataEnrichmentStatusSchema,
  source: z.object({
    provider: z.literal("datafordeler"),
    register: z.literal("bbr"),
    fetchedAt: z.string().datetime().nullable(),
    effectiveAt: z.string().datetime().nullable(),
    mappingVersion: z.string().min(1),
    codebookVersion: z.string().min(1)
  }),
  selection: z.object({
    primaryBuildingId: z.string().min(1).nullable(),
    primaryBuildingStatus: publicDataSelectionStatusSchema,
    primaryUnitId: z.string().min(1).nullable(),
    primaryUnitStatus: publicDataSelectionStatusSchema
  }),
  address: publicAddressSchema.nullable(),
  property: publicPropertySchema.nullable(),
  ground: publicGroundSchema.nullable(),
  parcels: z.array(publicParcelSchema),
  buildings: z.array(publicBuildingSchema),
  productBuildings: z.array(publicBuildingSchema),
  warnings: z.array(publicDataWarningSchema)
});

export type HousePublicDataResponseV1 = z.infer<
  typeof housePublicDataResponseV1Schema
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

export const appBootstrapResponseSchema = z.object({
  user: currentUserSchema,
  profile: userProfileSchema,
  onboarding: z.object({
    state: onboardingStateSchema
  }),
  houses: z.array(savedHouseSchema),
  activeHouseId: houseIdSchema.nullable(),
  entitlements: entitlementsSchema,
  cards: z.array(homeCardSchema),
  generatedAt: z.string().datetime()
});

export type AppBootstrapResponse = z.infer<typeof appBootstrapResponseSchema>;

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
