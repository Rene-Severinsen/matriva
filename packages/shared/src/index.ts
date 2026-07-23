import { z } from "zod";

export const MATRIVA_FOUNDATION_VERSION = "0.1.0";

type Brand<Value, Name extends string> = Value & { readonly __brand: Name };

export type UserId = Brand<string, "UserId">;
export type MagicLinkTokenId = Brand<string, "MagicLinkTokenId">;
export type AuthSessionId = Brand<string, "AuthSessionId">;
export type HouseId = Brand<string, "HouseId">;
export type HomeCardId = Brand<string, "HomeCardId">;
export type TaskId = Brand<string, "TaskId">;
export type MaintenanceRecommendationId = Brand<string, "MaintenanceRecommendationId">;
export type MaintenanceCompletionId = Brand<string, "MaintenanceCompletionId">;
export type DocumentId = Brand<string, "DocumentId">;
export type ImprovementId = Brand<string, "ImprovementId">;
export type MediaId = Brand<string, "MediaId">;
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

export const maintenanceRecommendationIdSchema = z
  .string()
  .regex(new RegExp(`^mrec_${opaqueSuffixPattern}$`))
  .transform((value): MaintenanceRecommendationId => value as MaintenanceRecommendationId);

export const maintenanceCompletionIdSchema = z
  .string()
  .regex(new RegExp(`^mcomp_${opaqueSuffixPattern}$`))
  .transform((value): MaintenanceCompletionId => value as MaintenanceCompletionId);

export const documentIdSchema = z
  .string()
  .regex(new RegExp(`^doc_${opaqueSuffixPattern}$`))
  .transform((value): DocumentId => value as DocumentId);

export const improvementIdSchema = z
  .string()
  .regex(new RegExp(`^impr_${opaqueSuffixPattern}$`))
  .transform((value): ImprovementId => value as ImprovementId);

export const mediaIdSchema = z
  .string()
  .regex(new RegExp(`^media_${opaqueSuffixPattern}$`))
  .transform((value): MediaId => value as MediaId);

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

export const adminRoleSchema = z.enum(["SUPER_ADMIN"]);

export type AdminRole = z.infer<typeof adminRoleSchema>;

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

export const adminBootstrapResponseSchema = z.object({
  admin: z.object({
    userId: userIdSchema,
    email: z.string().email(),
    displayName: z.string().min(1).nullable(),
    roles: z.array(adminRoleSchema).min(1)
  }),
  generatedAt: z.string().datetime()
});

export type AdminBootstrapResponse = z.infer<
  typeof adminBootstrapResponseSchema
>;

export const adminDashboardPeriodKeySchema = z.enum([
  "7d",
  "30d",
  "90d",
  "365d"
]);

export type AdminDashboardPeriodKey = z.infer<
  typeof adminDashboardPeriodKeySchema
>;

const adminDashboardCountSchema = z.number().int().nonnegative();
const adminDashboardRatioSchema = z.number().min(0).max(1);

export const adminDashboardSeriesPointSchema = z.object({
  bucketStart: z.string().datetime(),
  value: adminDashboardCountSchema
});

export type AdminDashboardSeriesPoint = z.infer<
  typeof adminDashboardSeriesPointSchema
>;

export const adminDashboardResponseSchema = z.object({
  period: z.object({
    key: adminDashboardPeriodKeySchema,
    from: z.string().datetime(),
    to: z.string().datetime()
  }),
  totals: z.object({
    users: adminDashboardCountSchema,
    houses: adminDashboardCountSchema,
    maintenanceTasks: adminDashboardCountSchema,
    maintenanceCompletions: adminDashboardCountSchema,
    publicDataWarnings: adminDashboardCountSchema
  }),
  periodMetrics: z.object({
    newUsers: adminDashboardCountSchema,
    activeUsers: adminDashboardCountSchema,
    newHouses: adminDashboardCountSchema,
    createdTasks: adminDashboardCountSchema,
    completedTasks: adminDashboardCountSchema,
    acceptedRecommendations: adminDashboardCountSchema,
    permanentRecommendationHides: adminDashboardCountSchema
  }),
  ratios: z.object({
    usersWithHouseRate: adminDashboardRatioSchema,
    completedTaskRate: adminDashboardRatioSchema
  }),
  funnel: z.object({
    registeredUsers: adminDashboardCountSchema,
    usersWithCompletedProfile: adminDashboardCountSchema,
    usersWithHouse: adminDashboardCountSchema,
    usersWithTask: adminDashboardCountSchema,
    usersWithCompletion: adminDashboardCountSchema
  }),
  series: z.object({
    newUsers: z.array(adminDashboardSeriesPointSchema),
    newHouses: z.array(adminDashboardSeriesPointSchema),
    completedTasks: z.array(adminDashboardSeriesPointSchema),
    acceptedRecommendations: z.array(adminDashboardSeriesPointSchema)
  }),
  dataQuality: z.object({
    acceptedRecommendations: z.literal("estimated")
  }),
  generatedAt: z.string().datetime()
});

export type AdminDashboardResponse = z.infer<
  typeof adminDashboardResponseSchema
>;

export const adminListCountSchema = z.number().int().nonnegative();
export const adminRatioSchema = z.number().min(0).max(1);

export const adminPaginationSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive().max(100),
  total: adminListCountSchema,
  pageCount: adminListCountSchema
});

export type AdminPagination = z.infer<typeof adminPaginationSchema>;

export const adminSortOrderSchema = z.enum(["asc", "desc"]);
export type AdminSortOrder = z.infer<typeof adminSortOrderSchema>;

export const adminUserSortSchema = z.enum([
  "created_at",
  "last_login_at",
  "latest_session_activity",
  "email",
  "display_name",
  "house_count",
  "task_count",
  "completion_count"
]);
export type AdminUserSort = z.infer<typeof adminUserSortSchema>;

export const adminUserStatusFilterSchema = z.enum(["all", "active", "disabled"]);
export type AdminUserStatusFilter = z.infer<
  typeof adminUserStatusFilterSchema
>;

export const adminSavedHouseStatusSchema = z.enum(["saved"]);
export const adminSavedHouseDataConfidenceSchema = z.enum(["not_verified"]);
export const adminMaintenanceSeasonSchema = z.enum([
  "spring",
  "summer",
  "autumn",
  "winter",
  "all_year"
]);
export const adminRecommendationPrioritySchema = z.enum([
  "low",
  "normal",
  "high"
]);
export const adminRecommendationDisclaimerClassSchema = z.enum([
  "general",
  "safety",
  "professional_review"
]);
export const adminRecommendationPeriodSchema = z.union([
  z.object({ type: z.literal("all_year") }),
  z.object({
    type: z.literal("season"),
    season: z.enum(["spring", "autumn"])
  }),
  z.object({
    type: z.literal("month_range"),
    startMonth: z.number().int().min(1).max(12),
    endMonth: z.number().int().min(1).max(12)
  })
]);
export const adminPublicDataWarningSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  path: z.string().min(1).optional()
});

export const adminUserListItemSchema = z.object({
  id: userIdSchema,
  displayName: z.string().min(1).nullable(),
  email: z.string().email(),
  status: userStatusSchema,
  createdAt: z.string().datetime(),
  lastLoginAt: z.string().datetime().nullable(),
  latestSessionActivityAt: z.string().datetime().nullable(),
  houseCount: adminListCountSchema,
  taskCount: adminListCountSchema,
  completionCount: adminListCountSchema,
  roles: z.array(adminRoleSchema),
  onboardingState: onboardingStateSchema
});

export type AdminUserListItem = z.infer<typeof adminUserListItemSchema>;

export const adminUsersResponseSchema = z.object({
  users: z.array(adminUserListItemSchema),
  pagination: adminPaginationSchema,
  generatedAt: z.string().datetime()
});

export type AdminUsersResponse = z.infer<typeof adminUsersResponseSchema>;

export const adminUserDetailSchema = adminUserListItemSchema.extend({
  emailVerifiedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
  houses: z.array(
    z.object({
      id: houseIdSchema,
      addressLabel: z.string().min(1),
      status: adminSavedHouseStatusSchema,
      createdAt: z.string().datetime()
    })
  ),
  taskSummary: z.object({
    total: adminListCountSchema,
    planned: adminListCountSchema,
    due: adminListCountSchema,
    overdue: adminListCountSchema,
    done: adminListCountSchema
  }),
  completionSummary: z.object({
    total: adminListCountSchema,
    latestCompletedAt: z.string().datetime().nullable()
  }),
  recommendationSummary: z.object({
    total: adminListCountSchema,
    pending: adminListCountSchema,
    accepted: adminListCountSchema,
    dismissed: adminListCountSchema,
    permanentHidden: adminListCountSchema
  }),
  latestActivityAt: z.string().datetime().nullable()
});

export const adminUserResponseSchema = z.object({
  user: adminUserDetailSchema,
  generatedAt: z.string().datetime()
});

export type AdminUserResponse = z.infer<typeof adminUserResponseSchema>;

export const adminHousePublicDataStatusFilterSchema = z.enum([
  "all",
  "not_started",
  "fetching",
  "success",
  "partial",
  "not_found",
  "ambiguous",
  "temporarily_unavailable",
  "failed",
  "with_warnings"
]);
export type AdminHousePublicDataStatusFilter = z.infer<
  typeof adminHousePublicDataStatusFilterSchema
>;

export const adminHouseSortSchema = z.enum([
  "created_at",
  "address",
  "owner",
  "public_data_status",
  "warning_count",
  "task_count",
  "completion_count",
  "active_recommendation_count",
  "latest_activity_at"
]);
export type AdminHouseSort = z.infer<typeof adminHouseSortSchema>;

export const adminPublicDataStatusSchema = z.enum([
  "not_started",
  "fetching",
  "success",
  "partial",
  "not_found",
  "ambiguous",
  "temporarily_unavailable",
  "failed"
]);

export const adminHouseOwnerSchema = z.object({
  id: userIdSchema,
  displayName: z.string().min(1).nullable(),
  email: z.string().email()
});

export const adminHouseListItemSchema = z.object({
  id: houseIdSchema,
  addressLabel: z.string().min(1),
  owner: adminHouseOwnerSchema,
  status: adminSavedHouseStatusSchema,
  dataConfidence: adminSavedHouseDataConfidenceSchema,
  createdAt: z.string().datetime(),
  publicDataStatus: adminPublicDataStatusSchema,
  warningCount: adminListCountSchema,
  taskCount: adminListCountSchema,
  completionCount: adminListCountSchema,
  activeRecommendationCount: adminListCountSchema,
  latestActivityAt: z.string().datetime().nullable()
});

export type AdminHouseListItem = z.infer<typeof adminHouseListItemSchema>;

export const adminHouseBbrSummarySchema = z.object({
  contract: z.literal("house_public_data_summary.v1"),
  houseId: houseIdSchema,
  status: adminPublicDataStatusSchema,
  sourceLabel: z.literal("Registreret i BBR"),
  fetchedAt: z.string().datetime().nullable(),
  primary: z.object({
    bbrBuildingId: z.string().min(1).nullable(),
    title: z.string().min(1).nullable(),
    values: z.array(
      z.object({
        key: z.string().min(1),
        label: z.string().min(1),
        value: z.string().min(1),
        unit: z.string().min(1).nullable()
      })
    )
  }),
  otherBuildings: z.array(
    z.object({
      bbrBuildingId: z.string().min(1),
      title: z.string().min(1),
      values: z.array(
        z.object({
          key: z.string().min(1),
          label: z.string().min(1),
          value: z.string().min(1),
          unit: z.string().min(1).nullable()
        })
      )
    })
  ),
  existingOtherBuildingCount: adminListCountSchema,
  projectedBuildingCount: adminListCountSchema,
  missingDataNotice: z.string().min(1).nullable(),
  warnings: z.array(adminPublicDataWarningSchema)
});

export const adminHousesResponseSchema = z.object({
  houses: z.array(adminHouseListItemSchema),
  pagination: adminPaginationSchema,
  generatedAt: z.string().datetime()
});

export type AdminHousesResponse = z.infer<typeof adminHousesResponseSchema>;

export const adminHouseDetailSchema = adminHouseListItemSchema.extend({
  updatedAt: z.string().datetime(),
  sourceReferences: z.object({
    dawaAddressId: z.string().min(1).nullable(),
    sourceAccessAddressId: z.string().min(1).nullable()
  }),
  bbr: z.object({
    source: z.object({
      provider: z.string().min(1).nullable(),
      register: z.string().min(1).nullable(),
      fetchedAt: z.string().datetime().nullable(),
      effectiveAt: z.string().datetime().nullable(),
      mappingVersion: z.string().min(1).nullable(),
      codebookVersion: z.string().min(1).nullable()
    }),
    summary: adminHouseBbrSummarySchema.nullable(),
    warnings: z.array(adminPublicDataWarningSchema),
    buildings: z.array(
      z.object({
        id: z.string().min(1),
        bbrBuildingId: z.string().min(1),
        buildingNumber: z.number().int().nullable(),
        includedInProductView: z.boolean(),
        lifecycleCode: z.string().min(1),
        useCode: z.string().min(1).nullable(),
        constructionYear: z.number().int().nullable(),
        residentialAreaM2: z.number().int().nonnegative().nullable(),
        totalBuildingAreaM2: z.number().int().nonnegative().nullable()
      })
    ),
    unitCount: adminListCountSchema,
    floorCount: adminListCountSchema,
    parcelCount: adminListCountSchema
  }),
  taskSummary: z.object({
    total: adminListCountSchema,
    planned: adminListCountSchema,
    due: adminListCountSchema,
    overdue: adminListCountSchema,
    done: adminListCountSchema
  }),
  completionSummary: z.object({
    total: adminListCountSchema,
    latestCompletedAt: z.string().datetime().nullable()
  }),
  recommendationSummary: z.object({
    total: adminListCountSchema,
    pending: adminListCountSchema,
    accepted: adminListCountSchema,
    dismissed: adminListCountSchema,
    active: adminListCountSchema,
    permanentHidden: adminListCountSchema
  }),
  assetCounts: z.object({
    documents: adminListCountSchema,
    improvements: adminListCountSchema,
    media: adminListCountSchema
  })
});

export const adminHouseResponseSchema = z.object({
  house: adminHouseDetailSchema,
  generatedAt: z.string().datetime()
});

export type AdminHouseResponse = z.infer<typeof adminHouseResponseSchema>;

export const adminRecommendationCatalogSortSchema = z.enum([
  "catalog_key",
  "title",
  "category",
  "active",
  "priority",
  "instance_count",
  "accepted_count",
  "permanent_hide_count",
  "acceptance_rate"
]);
export type AdminRecommendationCatalogSort = z.infer<
  typeof adminRecommendationCatalogSortSchema
>;

export const adminRecommendationActiveFilterSchema = z.enum([
  "all",
  "active",
  "inactive"
]);
export type AdminRecommendationActiveFilter = z.infer<
  typeof adminRecommendationActiveFilterSchema
>;

export const adminRecommendationCatalogItemSchema = z.object({
  catalogKey: z.string().min(1),
  catalogVersion: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  active: z.boolean(),
  priority: adminRecommendationPrioritySchema,
  recurrenceInterval: z.string().min(1),
  season: adminMaintenanceSeasonSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  instanceCount: adminListCountSchema,
  pendingCount: adminListCountSchema,
  acceptedCount: adminListCountSchema,
  dismissedCount: adminListCountSchema,
  acceptedTaskCount: adminListCountSchema,
  permanentHideCount: adminListCountSchema,
  acceptanceRate: adminRatioSchema,
  hideRate: adminRatioSchema
});

export type AdminRecommendationCatalogItem = z.infer<
  typeof adminRecommendationCatalogItemSchema
>;

export const adminRecommendationCatalogResponseSchema = z.object({
  items: z.array(adminRecommendationCatalogItemSchema),
  filters: z.object({
    categories: z.array(z.string().min(1))
  }),
  pagination: adminPaginationSchema,
  generatedAt: z.string().datetime()
});

export type AdminRecommendationCatalogResponse = z.infer<
  typeof adminRecommendationCatalogResponseSchema
>;

export const adminRecommendationCatalogDetailSchema =
  adminRecommendationCatalogItemSchema.extend({
    shortDescription: z.string().min(1),
    componentKey: z.string().min(1),
    recommendedPeriod: adminRecommendationPeriodSchema,
    eligibilityRules: z.unknown(),
    disclaimerClass: adminRecommendationDisclaimerClassSchema,
    lineage: z.object({
      catalogKey: z.string().min(1),
      catalogVersion: z.string().min(1)
    }),
    statusDistribution: z.object({
      pending: adminListCountSchema,
      accepted: adminListCountSchema,
      dismissed: adminListCountSchema
    }),
    distinctHouseCount: adminListCountSchema,
    distinctUserCount: adminListCountSchema,
    acceptedOverTime: z.array(adminDashboardSeriesPointSchema),
    dataQuality: z.object({
      acceptedOverTime: z.literal("estimated_from_updated_at"),
      notNow: z.literal("not_available")
    })
  });

export const adminRecommendationCatalogItemResponseSchema = z.object({
  item: adminRecommendationCatalogDetailSchema,
  generatedAt: z.string().datetime()
});

export type AdminRecommendationCatalogItemResponse = z.infer<
  typeof adminRecommendationCatalogItemResponseSchema
>;

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
  "matriva_recommended",
  "recommendation_accepted"
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

export const maintenanceRecurrenceIntervalSchema = z.enum([
  "monthly",
  "quarterly",
  "half_yearly",
  "yearly",
  "every_2_years",
  "every_3_years",
  "every_5_years",
  "every_10_years"
]);

export type MaintenanceRecurrenceInterval = z.infer<
  typeof maintenanceRecurrenceIntervalSchema
>;

export const maintenanceRecurrenceAnchorSchema = z.enum([
  "completed_date",
  "fixed_calendar"
]);

export type MaintenanceRecurrenceAnchor = z.infer<
  typeof maintenanceRecurrenceAnchorSchema
>;

export const maintenanceRecurrenceSchema = z.object({
  interval: maintenanceRecurrenceIntervalSchema,
  anchor: maintenanceRecurrenceAnchorSchema.default("completed_date")
});

export type MaintenanceRecurrence = z.infer<typeof maintenanceRecurrenceSchema>;

export const maintenanceRecommendationPrioritySchema = z.enum([
  "low",
  "normal",
  "high"
]);

export type MaintenanceRecommendationPriority = z.infer<
  typeof maintenanceRecommendationPrioritySchema
>;

export const maintenanceRecommendationDismissModeSchema = z.enum([
  "not_now",
  "hide_forever"
]);

export type MaintenanceRecommendationDismissMode = z.infer<
  typeof maintenanceRecommendationDismissModeSchema
>;

export const maintenanceRecommendationDisclaimerClassSchema = z.enum([
  "general",
  "safety",
  "professional_review"
]);

export type MaintenanceRecommendationDisclaimerClass = z.infer<
  typeof maintenanceRecommendationDisclaimerClassSchema
>;

export const maintenanceRecommendationPeriodSchema = z.union([
  z.object({
    type: z.literal("all_year")
  }),
  z.object({
    type: z.literal("season"),
    season: z.enum(["spring", "autumn"])
  }),
  z.object({
    type: z.literal("month_range"),
    startMonth: z.number().int().min(1).max(12),
    endMonth: z.number().int().min(1).max(12)
  })
]);

export type MaintenanceRecommendationPeriod = z.infer<
  typeof maintenanceRecommendationPeriodSchema
>;

export const maintenanceCatalogEligibilityRuleSchema = z.object({
  type: z.literal("universal_house")
});

export type MaintenanceCatalogEligibilityRule = z.infer<
  typeof maintenanceCatalogEligibilityRuleSchema
>;

export const maintenanceRecommendationOriginSnapshotSchema = z.object({
  title: z.string().min(1),
  shortDescription: z.string().min(1),
  componentKey: z.string().min(1),
  season: maintenanceSeasonSchema,
  recommendedPeriod: maintenanceRecommendationPeriodSchema,
  defaultRecurrence: maintenanceRecurrenceSchema.nullable(),
  priority: maintenanceRecommendationPrioritySchema,
  disclaimerClass: maintenanceRecommendationDisclaimerClassSchema,
  catalogKey: z.string().min(1),
  catalogVersion: z.string().min(1),
  recommendationInstanceId: maintenanceRecommendationIdSchema
});

export type MaintenanceRecommendationOriginSnapshot = z.infer<
  typeof maintenanceRecommendationOriginSnapshotSchema
>;

export const dkkCurrencySchema = z.literal("DKK");

export type DkkCurrency = z.infer<typeof dkkCurrencySchema>;

export const priceAmountMinorSchema = z
  .number()
  .int()
  .nonnegative()
  .max(999_999_999_999);

export function formatDkkPrice(amountMinor: number, currency: DkkCurrency = "DKK") {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency
  }).format(amountMinor / 100);
}

export type DanishPriceParseResult =
  | { ok: true; amountMinor: number | null }
  | { ok: false; code: "negative" | "invalid" | "too_many_decimals" | "too_large" };

export function parseDanishPriceInput(input: string): DanishPriceParseResult {
  const trimmed = input.trim();

  if (!trimmed) {
    return { ok: true, amountMinor: null };
  }

  if (trimmed.startsWith("-")) {
    return { ok: false, code: "negative" };
  }

  const normalized = trimmed.replace(/\s/g, "").replace(",", ".");

  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) {
    if (/^\d+(?:\.\d{3,})$/.test(normalized)) {
      return { ok: false, code: "too_many_decimals" };
    }

    return { ok: false, code: "invalid" };
  }

  const [wholePart = "0", decimalPart = ""] = normalized.split(".");
  const amountMinor = Number(wholePart) * 100 + Number(decimalPart.padEnd(2, "0"));

  if (!Number.isSafeInteger(amountMinor)) {
    return { ok: false, code: "too_large" };
  }

  const parsed = priceAmountMinorSchema.safeParse(amountMinor);

  if (!parsed.success) {
    return { ok: false, code: "too_large" };
  }

  return { ok: true, amountMinor };
}

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
  recommendationId: maintenanceRecommendationIdSchema.optional(),
  catalogKey: z.string().min(1).optional(),
  catalogVersion: z.string().min(1).optional(),
  recommendationInstanceId: maintenanceRecommendationIdSchema.optional(),
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
    priceAmountMinor: priceAmountMinorSchema.nullable(),
    priceCurrency: dkkCurrencySchema,
    recommendation: recommendedMaintenanceTaskMetadataSchema.optional(),
    recurrence: maintenanceRecurrenceSchema.nullable().optional(),
    componentKey: z.string().min(1).nullable().optional(),
    originCatalogKey: z.string().min(1).nullable().optional(),
    originCatalogVersion: z.string().min(1).nullable().optional(),
    originRecommendationInstanceId: maintenanceRecommendationIdSchema.nullable().optional(),
    originSnapshot: maintenanceRecommendationOriginSnapshotSchema.nullable().optional(),
    archivedAt: z.string().datetime().nullable().optional(),
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

    if (
      task.recommendation &&
      task.source !== "matriva_recommended" &&
      task.source !== "recommendation_accepted"
    ) {
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
    source: z.enum(["user_created"]).optional(),
    status: maintenanceTaskStatusSchema.optional(),
    timing: createMaintenanceTaskTimingSchema,
    priceAmountMinor: priceAmountMinorSchema.nullable().optional(),
    priceCurrency: dkkCurrencySchema.optional(),
    recurrence: maintenanceRecurrenceSchema.nullable().optional(),
    componentKey: z.string().trim().min(1).max(80).optional()
  })
  .superRefine((input, context) => {
    if (input.priceAmountMinor !== undefined && input.priceAmountMinor !== null) {
      if (!input.priceCurrency) {
        context.addIssue({
          code: "custom",
          path: ["priceCurrency"],
          message: "Currency is required when price is provided."
        });
      }
    }

    if (input.priceCurrency !== undefined && input.priceCurrency !== "DKK") {
      context.addIssue({
        code: "custom",
        path: ["priceCurrency"],
        message: "Maintenance price currency must be DKK."
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

export function maintenanceSeasonForDateOnly(
  dateOnly: string
): MaintenanceSeason | null {
  const month = Number(dateOnly.slice(5, 7));

  if (month === 12 || month === 1 || month === 2) {
    return "winter";
  }

  if (month >= 3 && month <= 5) {
    return "spring";
  }

  if (month >= 6 && month <= 8) {
    return "summer";
  }

  if (month >= 9 && month <= 11) {
    return "autumn";
  }

  return null;
}

export function maintenanceTaskSeason(task: MaintenanceTask): MaintenanceSeason | null {
  if (task.timing.type === "specific_deadline" && task.timing.dueDate) {
    return maintenanceSeasonForDateOnly(task.timing.dueDate);
  }

  if (task.timing.type === "seasonal_window" && task.timing.season) {
    return task.timing.season;
  }

  return null;
}

export function maintenanceTaskMatchesSeason(
  task: MaintenanceTask,
  season: Exclude<MaintenanceSeason, "all_year">
) {
  return maintenanceTaskSeason(task) === season;
}

export const updateMaintenanceTaskStatusRequestSchema = z.object({
  status: maintenanceTaskStatusSchema
});

export type UpdateMaintenanceTaskStatusRequest = z.infer<
  typeof updateMaintenanceTaskStatusRequestSchema
>;

export const updateMaintenanceTaskRequestSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).nullable().optional(),
    timing: createMaintenanceTaskTimingSchema.optional(),
    priceAmountMinor: priceAmountMinorSchema.nullable().optional(),
    priceCurrency: dkkCurrencySchema.optional(),
    recurrence: maintenanceRecurrenceSchema.nullable().optional(),
    componentKey: z.string().trim().min(1).max(80).nullable().optional(),
    status: z.enum(["planned", "due", "overdue", "rescheduled"]).optional()
  })
  .superRefine((input, context) => {
    if (input.priceAmountMinor !== undefined && input.priceAmountMinor !== null) {
      if (!input.priceCurrency) {
        context.addIssue({
          code: "custom",
          path: ["priceCurrency"],
          message: "Currency is required when price is provided."
        });
      }
    }

    if (input.priceCurrency !== undefined && input.priceCurrency !== "DKK") {
      context.addIssue({
        code: "custom",
        path: ["priceCurrency"],
        message: "Maintenance price currency must be DKK."
      });
    }
  });

export type UpdateMaintenanceTaskRequest = z.infer<
  typeof updateMaintenanceTaskRequestSchema
>;

export const moveMaintenanceTaskRequestSchema = z.object({
  timing: createMaintenanceTaskTimingSchema
});

export type MoveMaintenanceTaskRequest = z.infer<
  typeof moveMaintenanceTaskRequestSchema
>;

export const completeMaintenanceTaskRequestSchema = z.object({
  completedDate: z.string().date().optional(),
  note: z.string().trim().max(1200).optional()
});

export type CompleteMaintenanceTaskRequest = z.infer<
  typeof completeMaintenanceTaskRequestSchema
>;

export const houseDocumentMimeTypeSchema = z.enum([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif"
]);

export type HouseDocumentMimeType = z.infer<typeof houseDocumentMimeTypeSchema>;

export const houseDocumentSchema = z.object({
  id: documentIdSchema,
  houseId: houseIdSchema,
  originalFilename: z.string().min(1),
  mimeType: houseDocumentMimeTypeSchema,
  sizeBytes: z.number().int().positive(),
  uploadStatus: z.enum(["uploaded", "archived"]),
  contentPath: z.string().min(1).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type HouseDocument = z.infer<typeof houseDocumentSchema>;

export const uploadHouseDocumentRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  mimeType: houseDocumentMimeTypeSchema,
  sizeBytes: z.number().int().positive().max(15 * 1024 * 1024),
  contentBase64: z.string().min(1)
});

export type UploadHouseDocumentRequest = z.infer<
  typeof uploadHouseDocumentRequestSchema
>;

export const houseDocumentResponseSchema = z.object({
  document: houseDocumentSchema
});

export type HouseDocumentResponse = z.infer<typeof houseDocumentResponseSchema>;

export const houseDocumentsResponseSchema = z.object({
  documents: z.array(houseDocumentSchema),
  generatedAt: z.string().datetime()
});

export type HouseDocumentsResponse = z.infer<typeof houseDocumentsResponseSchema>;

export const maintenanceRecommendationSourceTypeSchema = z.enum([
  "matriva_catalog",
  "document_extracted",
  "warranty_derived"
]);

export type MaintenanceRecommendationSourceType = z.infer<
  typeof maintenanceRecommendationSourceTypeSchema
>;

export const maintenanceRecommendationStatusSchema = z.enum([
  "pending",
  "accepted",
  "dismissed"
]);

export type MaintenanceRecommendationStatus = z.infer<
  typeof maintenanceRecommendationStatusSchema
>;

export const maintenanceRecommendationProvenanceSchema = z.object({
  sourceDocumentId: documentIdSchema.optional(),
  sourcePage: z.string().min(1).optional(),
  extractionMethod: z.string().min(1).optional(),
  extractedAt: z.string().datetime().optional(),
  confidence: z.number().min(0).max(1).optional(),
  originalTitle: z.string().min(1).optional(),
  originalDescription: z.string().min(1).optional(),
  originalTiming: z.string().min(1).optional(),
  sourceExcerptReference: z.string().min(1).optional()
});

export type MaintenanceRecommendationProvenance = z.infer<
  typeof maintenanceRecommendationProvenanceSchema
>;

export const maintenanceRecommendationSchema = z.object({
  id: maintenanceRecommendationIdSchema,
  houseId: houseIdSchema,
  sourceType: maintenanceRecommendationSourceTypeSchema,
  status: maintenanceRecommendationStatusSchema,
  catalogKey: z.string().min(1).optional(),
  catalogVersion: z.string().min(1).optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  recommendedTimingLabel: z.string().min(1),
  recommendedPeriod: maintenanceRecommendationPeriodSchema.optional(),
  periodKey: z.string().min(1).optional(),
  suggestedDueDate: z.string().date().optional(),
  defaultRecurrence: maintenanceRecurrenceSchema.nullable().optional(),
  priority: maintenanceRecommendationPrioritySchema.optional(),
  disclaimerClass: maintenanceRecommendationDisclaimerClassSchema.optional(),
  why: z.string().min(1).optional(),
  timing: createMaintenanceTaskTimingSchema,
  recurrence: maintenanceRecurrenceSchema.nullable(),
  componentKey: z.string().min(1).nullable(),
  provenance: maintenanceRecommendationProvenanceSchema,
  recommendationKey: z.string().min(1),
  acceptedTaskId: taskIdSchema.nullable(),
  dismissedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type MaintenanceRecommendation = z.infer<
  typeof maintenanceRecommendationSchema
>;

export const maintenanceRecommendationsResponseSchema = z.object({
  recommendations: z.array(maintenanceRecommendationSchema),
  generatedAt: z.string().datetime()
});

export type MaintenanceRecommendationsResponse = z.infer<
  typeof maintenanceRecommendationsResponseSchema
>;

export const acceptMaintenanceRecommendationRequestSchema = z.object({
  dueDate: z.string().date().optional(),
  recurrenceInterval: maintenanceRecurrenceIntervalSchema.nullable().optional(),
  timing: createMaintenanceTaskTimingSchema.optional(),
  description: z.string().trim().min(1).optional(),
  recurrence: maintenanceRecurrenceSchema.nullable().optional()
});

export type AcceptMaintenanceRecommendationRequest = z.infer<
  typeof acceptMaintenanceRecommendationRequestSchema
>;

export const dismissMaintenanceRecommendationRequestSchema = z.object({
  mode: maintenanceRecommendationDismissModeSchema.default("not_now")
});

export type DismissMaintenanceRecommendationRequest = z.infer<
  typeof dismissMaintenanceRecommendationRequestSchema
>;

export const dismissMaintenanceRecommendationResponseSchema = z.object({
  recommendation: maintenanceRecommendationSchema
});

export type DismissMaintenanceRecommendationResponse = z.infer<
  typeof dismissMaintenanceRecommendationResponseSchema
>;

export const maintenanceHistoryEntrySchema = z.object({
  id: maintenanceCompletionIdSchema,
  taskId: taskIdSchema,
  houseId: houseIdSchema,
  title: z.string().min(1),
  completedDate: z.string().date(),
  note: z.string().min(1).nullable(),
  priceAmountMinor: priceAmountMinorSchema.nullable(),
  priceCurrency: dkkCurrencySchema,
  componentKey: z.string().min(1).nullable(),
  source: maintenanceTaskSourceSchema,
  recurrence: maintenanceRecurrenceSchema.nullable(),
  createdAt: z.string().datetime()
});

export type MaintenanceHistoryEntry = z.infer<
  typeof maintenanceHistoryEntrySchema
>;

export const maintenanceHistoryResponseSchema = z.object({
  history: z.array(maintenanceHistoryEntrySchema),
  generatedAt: z.string().datetime()
});

export type MaintenanceHistoryResponse = z.infer<
  typeof maintenanceHistoryResponseSchema
>;

export const maintenanceHistoryQuerySchema = z.object({
  year: z.coerce.number().int().min(1900).max(2200).optional(),
  componentKey: z.string().trim().min(1).max(80).optional()
});

export type MaintenanceHistoryQuery = z.infer<
  typeof maintenanceHistoryQuerySchema
>;

export const maintenanceHistoryDetailSchema = maintenanceHistoryEntrySchema.extend({
  recommendation: maintenanceRecommendationSchema.nullable()
});

export type MaintenanceHistoryDetail = z.infer<
  typeof maintenanceHistoryDetailSchema
>;

export const maintenanceHistoryDetailResponseSchema = z.object({
  historyEntry: maintenanceHistoryDetailSchema
});

export type MaintenanceHistoryDetailResponse = z.infer<
  typeof maintenanceHistoryDetailResponseSchema
>;

export const houseImprovementCategorySchema = z.enum([
  "windows_doors",
  "roof",
  "heating_energy",
  "kitchen",
  "bathroom",
  "installations",
  "extension",
  "outdoor",
  "other"
]);

export type HouseImprovementCategory = z.infer<
  typeof houseImprovementCategorySchema
>;

export const houseImprovementStatusSchema = z.enum([
  "planned",
  "completed",
  "documented"
]);

export type HouseImprovementStatus = z.infer<
  typeof houseImprovementStatusSchema
>;

export const houseImprovementSchema = z.object({
  id: improvementIdSchema,
  houseId: houseIdSchema,
  title: z.string().min(1),
  description: z.string().min(1).nullable(),
  category: houseImprovementCategorySchema.nullable(),
  improvementDate: z.string().date().nullable(),
  improvementYear: z.number().int().min(1700).max(2200).nullable(),
  costAmountMinor: z.number().int().nonnegative().nullable(),
  costCurrency: z.string().length(3).nullable(),
  documentReference: z.string().min(1).nullable(),
  status: houseImprovementStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type HouseImprovement = z.infer<typeof houseImprovementSchema>;

export const createHouseImprovementRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(140),
    description: z.string().trim().max(1200).optional(),
    category: houseImprovementCategorySchema.optional(),
    improvementDate: z.string().date().optional(),
    improvementYear: z.number().int().min(1700).max(2200).optional(),
    costAmountMinor: z.number().int().nonnegative().optional(),
    costCurrency: z.string().length(3).optional(),
    documentReference: z.string().trim().max(240).optional(),
    status: houseImprovementStatusSchema.optional()
  })
  .superRefine((input, context) => {
    if (!input.improvementDate && input.improvementYear === undefined) {
      context.addIssue({
        code: "custom",
        path: ["improvementYear"],
        message: "An improvement requires either a date or a year."
      });
    }

    if (input.costAmountMinor !== undefined && !input.costCurrency) {
      context.addIssue({
        code: "custom",
        path: ["costCurrency"],
        message: "Currency is required when cost is provided."
      });
    }
  });

export type CreateHouseImprovementRequest = z.infer<
  typeof createHouseImprovementRequestSchema
>;

export const houseImprovementResponseSchema = z.object({
  improvement: houseImprovementSchema
});

export type HouseImprovementResponse = z.infer<
  typeof houseImprovementResponseSchema
>;

export const houseImprovementsResponseSchema = z.object({
  improvements: z.array(houseImprovementSchema),
  generatedAt: z.string().datetime()
});

export type HouseImprovementsResponse = z.infer<
  typeof houseImprovementsResponseSchema
>;

export const houseMediaKindSchema = z.enum(["house_photo"]);

export type HouseMediaKind = z.infer<typeof houseMediaKindSchema>;

export const houseMediaSchema = z.object({
  id: mediaIdSchema,
  houseId: houseIdSchema,
  mediaType: houseMediaKindSchema,
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  storageKey: z.string().min(1),
  contentPath: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type HouseMedia = z.infer<typeof houseMediaSchema>;

export const housePhotoResponseSchema = z.object({
  photo: houseMediaSchema.nullable()
});

export type HousePhotoResponse = z.infer<typeof housePhotoResponseSchema>;

export const uploadHousePhotoRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.enum(["image/jpeg", "image/png", "image/heic", "image/heif"]),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  contentBase64: z.string().min(1)
});

export type UploadHousePhotoRequest = z.infer<
  typeof uploadHousePhotoRequestSchema
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

export const publicDataAvailabilitySchema = z.enum([
  "value",
  "registered_empty",
  "source_unavailable",
  "fetch_failed",
  "not_relevant"
]);

export type PublicDataAvailability = z.infer<typeof publicDataAvailabilitySchema>;

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
  municipalityId: z.string().min(1).nullable(),
  availability: z
    .object({
      ownerDistrict: publicDataAvailabilitySchema,
      municipality: publicDataAvailabilitySchema
    })
    .optional()
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
  areaSource: publicCodeValueSchema.nullable().optional(),
  flexHomePermission: publicCodeValueSchema.nullable().optional(),
  addressFunction: publicCodeValueSchema.nullable().optional(),
  registeredAreaBreakdown: z
    .object({
      area1M2: z.number().int().nonnegative().nullable(),
      area2M2: z.number().int().nonnegative().nullable(),
      area3M2: z.number().int().nonnegative().nullable()
    })
    .optional(),
  availability: z
    .object({
      flushToiletCount: publicDataAvailabilitySchema,
      heating: publicDataAvailabilitySchema,
      floorType: publicDataAvailabilitySchema,
      accessArea: publicDataAvailabilitySchema
    })
    .optional(),
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
  commercialBasementAreaM2: z.number().int().nonnegative().nullable(),
  availability: z
    .object({
      type: publicDataAvailabilitySchema,
      accessArea: publicDataAvailabilitySchema
    })
    .optional()
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
    supplementaryOuterWall: publicCodeValueSchema.nullable().optional(),
    // Legacy compatibility for snapshots written before 2026-07-17.
    asbestos: publicCodeValueSchema.nullable().optional()
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
  availability: z
    .object({
      materials: publicDataAvailabilitySchema,
      coveredArea: publicDataAvailabilitySchema,
      heating: publicDataAvailabilitySchema
    })
    .optional(),
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

export const housePublicDataSummaryStatusSchema = z.enum([
  "not_started",
  "loading",
  "available",
  "partial",
  "ambiguous",
  "not_found",
  "temporarily_unavailable",
  "failed"
]);

export type HousePublicDataSummaryStatus = z.infer<
  typeof housePublicDataSummaryStatusSchema
>;

export const housePublicDataSummaryFieldSchema = z.enum([
  "use",
  "residential_area_m2",
  "construction_year",
  "room_count",
  "bathroom_count",
  "basement_area_m2",
  "heating_installation",
  "heating_source",
  "supplementary_heating",
  "other_existing_building_count",
  "area_m2"
]);

export type HousePublicDataSummaryField = z.infer<
  typeof housePublicDataSummaryFieldSchema
>;

export const housePublicDataSummaryValueSchema = z.object({
  key: housePublicDataSummaryFieldSchema,
  value: z.union([z.string().min(1), z.number().int().nonnegative()]),
  unit: z.literal("m2").optional()
});

export type HousePublicDataSummaryValue = z.infer<
  typeof housePublicDataSummaryValueSchema
>;

export const housePublicDataSummaryBuildingSchema = z.object({
  bbrBuildingId: z.string().min(1),
  title: z.string().min(1),
  values: z.array(housePublicDataSummaryValueSchema)
});

export type HousePublicDataSummaryBuilding = z.infer<
  typeof housePublicDataSummaryBuildingSchema
>;

export const housePublicDataSummarySchema = z.object({
  contract: z.literal("house_public_data_summary.v1"),
  houseId: houseIdSchema,
  status: housePublicDataSummaryStatusSchema,
  sourceLabel: z.literal("Registreret i BBR"),
  fetchedAt: z.string().datetime().nullable(),
  primary: z.object({
    bbrBuildingId: z.string().min(1).nullable(),
    title: z.string().min(1).nullable(),
    values: z.array(housePublicDataSummaryValueSchema)
  }),
  otherBuildings: z.array(housePublicDataSummaryBuildingSchema),
  existingOtherBuildingCount: z.number().int().nonnegative(),
  projectedBuildingCount: z.number().int().nonnegative(),
  missingDataNotice: z.string().min(1).nullable(),
  warnings: z.array(publicDataWarningSchema)
});

export type HousePublicDataSummary = z.infer<
  typeof housePublicDataSummarySchema
>;

function publicCodeLabel(value: PublicCodeValue | null | undefined) {
  return value?.label ?? null;
}

function firstNumber(values: Array<number | null | undefined>) {
  return values.find(
    (value): value is number => value !== null && value !== undefined
  ) ?? null;
}

function compactValues(
  values: Array<HousePublicDataSummaryValue | null>
): HousePublicDataSummaryValue[] {
  return values.filter(
    (value): value is HousePublicDataSummaryValue => value !== null
  );
}

function buildingDisplayTitle(building: PublicBuilding) {
  const useLabel = publicCodeLabel(building.use);

  if (useLabel) {
    return useLabel;
  }

  return building.number ? `Bygning ${building.number}` : "Bygning";
}

function buildingArea(building: PublicBuilding) {
  return (
    building.areas.residentialAreaM2 ??
    building.areas.totalBuildingAreaM2 ??
    null
  );
}

const minimumPresentedConstructionYear = 1100;

export function presentableConstructionYear(year: number | null | undefined) {
  return year !== null &&
    year !== undefined &&
    year >= minimumPresentedConstructionYear
    ? year
    : null;
}

export function buildHousePublicDataSummary(
  houseId: HouseId,
  publicData: HousePublicDataResponseV1
): HousePublicDataSummary {
  const primaryBuilding =
    publicData.selection.primaryBuildingStatus === "automatic_address_relation"
      ? publicData.productBuildings.find(
          (building) =>
            building.bbrBuildingId === publicData.selection.primaryBuildingId
        ) ?? null
      : null;
  const primaryUnit =
    primaryBuilding && publicData.selection.primaryUnitStatus === "automatic_unambiguous"
      ? primaryBuilding.units.find(
          (unit) => unit.bbrUnitId === publicData.selection.primaryUnitId
        ) ?? null
      : null;
  const displayBuilding =
    primaryBuilding ??
    (publicData.status === "ambiguous" ? null : publicData.productBuildings[0]) ??
    null;
  const basementArea = displayBuilding
    ? firstNumber(displayBuilding.floors.map((floor) => floor.basementAreaM2))
    : null;
  const existingOtherBuildings = publicData.productBuildings.filter(
    (building) => building.bbrBuildingId !== displayBuilding?.bbrBuildingId
  );
  const projectedBuildingCount = publicData.buildings.filter(
    (building) => building.inclusion.exclusionReason === "projected"
  ).length;
  const primaryValues = primaryBuilding
    ? compactValues([
        publicCodeLabel(displayBuilding?.use)
          ? { key: "use", value: publicCodeLabel(displayBuilding?.use) as string }
          : null,
        primaryUnit?.areas.residentialAreaM2 ??
        displayBuilding?.areas.residentialAreaM2
          ? {
              key: "residential_area_m2",
              value:
                (primaryUnit?.areas.residentialAreaM2 ??
                  displayBuilding?.areas.residentialAreaM2) as number,
              unit: "m2"
            }
          : null,
        presentableConstructionYear(displayBuilding?.constructionYear)
          ? {
              key: "construction_year",
              value: presentableConstructionYear(
                displayBuilding?.constructionYear
              ) as number
            }
          : null,
        primaryUnit?.roomCount !== null && primaryUnit?.roomCount !== undefined
          ? { key: "room_count", value: primaryUnit.roomCount }
          : null,
        primaryUnit?.facilities.bathroomCount !== null &&
        primaryUnit?.facilities.bathroomCount !== undefined
          ? {
              key: "bathroom_count",
              value: primaryUnit.facilities.bathroomCount
            }
          : null,
        basementArea !== null
          ? { key: "basement_area_m2", value: basementArea, unit: "m2" }
          : null,
        publicCodeLabel(primaryUnit?.heating.installation ?? displayBuilding?.heating.installation)
          ? {
              key: "heating_installation",
              value: publicCodeLabel(
                primaryUnit?.heating.installation ??
                  displayBuilding?.heating.installation
              ) as string
            }
          : null,
        publicCodeLabel(primaryUnit?.heating.source ?? displayBuilding?.heating.source)
          ? {
              key: "heating_source",
              value: publicCodeLabel(
                primaryUnit?.heating.source ?? displayBuilding?.heating.source
              ) as string
            }
          : null,
        publicCodeLabel(
          primaryUnit?.heating.supplementary ??
            displayBuilding?.heating.supplementary
        )
          ? {
              key: "supplementary_heating",
              value: publicCodeLabel(
                primaryUnit?.heating.supplementary ??
                  displayBuilding?.heating.supplementary
              ) as string
            }
          : null,
        {
          key: "other_existing_building_count",
          value: existingOtherBuildings.length
        }
      ])
    : [];
  const status =
    publicData.status === "success"
      ? "available"
      : publicData.status === "fetching"
        ? "loading"
      : publicData.status === "partial" || publicData.status === "ambiguous"
        ? publicData.status
        : publicData.status;

  return housePublicDataSummarySchema.parse({
    contract: "house_public_data_summary.v1",
    houseId,
    status,
    sourceLabel: "Registreret i BBR",
    fetchedAt: publicData.source.fetchedAt,
    primary: {
      bbrBuildingId: displayBuilding?.bbrBuildingId ?? null,
      title: displayBuilding ? buildingDisplayTitle(displayBuilding) : null,
      values: primaryValues
    },
    otherBuildings: existingOtherBuildings.map((building) => ({
      bbrBuildingId: building.bbrBuildingId,
      title: buildingDisplayTitle(building),
      values: compactValues([
        publicCodeLabel(building.use)
          ? { key: "use", value: publicCodeLabel(building.use) as string }
          : null,
        buildingArea(building) !== null
          ? { key: "area_m2", value: buildingArea(building) as number, unit: "m2" }
          : null,
        presentableConstructionYear(building.constructionYear)
          ? {
              key: "construction_year",
              value: presentableConstructionYear(building.constructionYear) as number
            }
          : null
      ])
    })),
    existingOtherBuildingCount: existingOtherBuildings.length,
    projectedBuildingCount,
    missingDataNotice:
      displayBuilding && primaryValues.length < 10
        ? "Nogle oplysninger er ikke registreret i BBR."
        : null,
    warnings: publicData.warnings
  });
}

export const housePublicDataProfileFactSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.union([z.string().min(1), z.number().int().nonnegative()]).nullable(),
  unit: z.literal("m2").optional(),
  availability: publicDataAvailabilitySchema
});

export type HousePublicDataProfileFact = z.infer<
  typeof housePublicDataProfileFactSchema
>;

export const housePublicDataProfileSectionSchema = z.object({
  key: z.enum([
    "location",
    "propertyIdentity",
    "primaryBuilding",
    "primaryUnit",
    "heating",
    "materials",
    "areas",
    "floorsAndBasement",
    "otherBuildings",
    "projectedBuildings",
    "groundAndParcels",
    "sourceAndQuality"
  ]),
  title: z.string().min(1),
  facts: z.array(housePublicDataProfileFactSchema),
  buildings: z
    .array(
      z.object({
        bbrBuildingId: z.string().min(1),
        title: z.string().min(1),
        facts: z.array(housePublicDataProfileFactSchema),
        units: z.array(
          z.object({
            bbrUnitId: z.string().min(1),
            title: z.string().min(1),
            facts: z.array(housePublicDataProfileFactSchema)
          })
        ),
        floors: z.array(
          z.object({
            bbrFloorId: z.string().min(1),
            title: z.string().min(1),
            facts: z.array(housePublicDataProfileFactSchema)
          })
        )
      })
    )
    .optional()
});

export const housePublicDataProfileV1Schema = z.object({
  contract: z.literal("house_public_data_profile.v1"),
  houseId: houseIdSchema,
  status: housePublicDataSummaryStatusSchema,
  sourceLabel: z.literal("Registreret i BBR"),
  fetchedAt: z.string().datetime().nullable(),
  title: z.string().min(1),
  subtitle: z.string().min(1).nullable(),
  topFacts: z.array(housePublicDataProfileFactSchema),
  sections: z.array(housePublicDataProfileSectionSchema),
  warnings: z.array(publicDataWarningSchema)
});

export type HousePublicDataProfileV1 = z.infer<
  typeof housePublicDataProfileV1Schema
>;

function availabilityForValue(
  value: string | number | null | undefined,
  fallback: PublicDataAvailability = "registered_empty"
): PublicDataAvailability {
  if (value !== null && value !== undefined && value !== "") {
    return "value";
  }

  return fallback;
}

function profileFact(
  key: string,
  label: string,
  value: string | number | null | undefined,
  unit?: "m2",
  fallbackAvailability: PublicDataAvailability = "registered_empty"
): HousePublicDataProfileFact {
  return {
    key,
    label,
    value: value ?? null,
    ...(unit ? { unit } : {}),
    availability: availabilityForValue(value, fallbackAvailability)
  };
}

function codeFact(
  key: string,
  label: string,
  value: PublicCodeValue | null | undefined,
  fallbackAvailability: PublicDataAvailability = "registered_empty"
) {
  return profileFact(
    key,
    label,
    value?.label ?? value?.code ?? null,
    undefined,
    fallbackAvailability
  );
}

function profileStatus(status: HousePublicDataResponseV1["status"]) {
  return status === "success"
    ? "available"
    : status === "fetching"
      ? "loading"
      : status === "partial" || status === "ambiguous"
        ? status
        : status;
}

function buildingProfileFacts(building: PublicBuilding) {
  return [
    codeFact("use", "Anvendelse", building.use),
    profileFact("building_number", "Bygningsnr.", building.number),
    profileFact(
      "construction_year",
      "Opført",
      presentableConstructionYear(building.constructionYear)
    ),
    profileFact(
      "remodel_year",
      "Om-/tilbygget",
      presentableConstructionYear(building.remodelOrExtensionYear)
    ),
    profileFact("area", "Areal", buildingArea(building), "m2"),
    profileFact("footprint_area", "Bebygget areal", building.areas.footprintAreaM2, "m2"),
    codeFact("outer_wall", "Ydervæg", building.materials.outerWall),
    codeFact("roof", "Tag", building.materials.roof),
    codeFact("heating", "Varme", building.heating.installation)
  ];
}

function unitProfileFacts(unit: PublicUnit) {
  return [
    codeFact("housing_type", "Boligtype", unit.housingType),
    codeFact("use", "Anvendelse", unit.use),
    profileFact("residential_area", "Boligareal", unit.areas.residentialAreaM2, "m2"),
    profileFact("total_area", "Samlet areal", unit.areas.totalAreaM2, "m2"),
    profileFact("commercial_area", "Erhvervsareal", unit.areas.commercialAreaM2, "m2"),
    profileFact(
      "physical_residential_area",
      "Fysisk boligareal",
      unit.areas.physicalResidentialAreaM2,
      "m2"
    ),
    profileFact(
      "physical_commercial_area",
      "Fysisk erhvervsareal",
      unit.areas.physicalCommercialAreaM2,
      "m2"
    ),
    profileFact("rooms", "Værelser", unit.roomCount),
    codeFact("toilet", "Toiletforhold", unit.facilities.toiletType),
    codeFact("bath", "Badeforhold", unit.facilities.bathType),
    profileFact("bathrooms", "Badeværelser", unit.facilities.bathroomCount),
    codeFact("kitchen", "Køkkenforhold", unit.facilities.kitchenType),
    codeFact("area_source", "Areal-kilde", unit.areaSource),
    codeFact("flex_home", "Flexbolig", unit.flexHomePermission),
    codeFact("address_function", "Adressefunktion", unit.addressFunction)
  ];
}

function floorProfileFacts(floor: PublicFloor) {
  return [
    profileFact("designation", "Betegnelse", floor.designation),
    codeFact("type", "Etagetype", floor.type, floor.availability?.type ?? "registered_empty"),
    profileFact("total_area", "Samlet etageareal", floor.totalFloorAreaM2, "m2"),
    profileFact("attic_area", "Udnyttet tagetage", floor.utilisedAtticAreaM2, "m2"),
    profileFact("basement_area", "Kælderareal", floor.basementAreaM2, "m2"),
    profileFact(
      "legal_basement_residential_area",
      "Lovligt boligareal i kælder",
      floor.legalResidentialBasementAreaM2,
      "m2"
    ),
    profileFact(
      "commercial_basement_area",
      "Erhverv i kælder",
      floor.commercialBasementAreaM2,
      "m2"
    ),
    profileFact(
      "access_area",
      "Adgangsareal",
      floor.accessAreaM2,
      "m2",
      floor.availability?.accessArea ?? "registered_empty"
    )
  ];
}

export function buildHousePublicDataProfile(
  houseId: HouseId,
  publicData: HousePublicDataResponseV1
): HousePublicDataProfileV1 {
  const primaryBuilding =
    publicData.selection.primaryBuildingStatus === "automatic_address_relation"
      ? publicData.productBuildings.find(
          (building) =>
            building.bbrBuildingId === publicData.selection.primaryBuildingId
        ) ?? null
      : null;
  const primaryUnit =
    primaryBuilding && publicData.selection.primaryUnitStatus === "automatic_unambiguous"
      ? primaryBuilding.units.find(
          (unit) => unit.bbrUnitId === publicData.selection.primaryUnitId
        ) ?? null
      : null;
  const displayBuilding = primaryBuilding ?? publicData.productBuildings[0] ?? null;
  const existingOtherBuildings = publicData.productBuildings.filter(
    (building) => building.bbrBuildingId !== displayBuilding?.bbrBuildingId
  );
  const projectedBuildings = publicData.buildings.filter(
    (building) => building.inclusion.exclusionReason === "projected"
  );
  const basementArea = displayBuilding
    ? firstNumber(displayBuilding.floors.map((floor) => floor.basementAreaM2))
    : null;

  const sections: HousePublicDataProfileV1["sections"] = [
    {
      key: "location",
      title: "Lokation",
      facts: [
        profileFact("address", "Adresse", publicData.address?.label ?? null),
        profileFact("postal_code", "Postnr.", publicData.address?.postalCode ?? null),
        profileFact("postal_district", "By", publicData.address?.postalDistrict ?? null)
      ]
    },
    {
      key: "propertyIdentity",
      title: "Ejendom",
      facts: [
        profileFact("bfe", "BFE", publicData.property?.bfeNumber ?? null),
        profileFact(
          "assessment_property_number",
          "Vurderingsejendomsnr.",
          publicData.property?.assessmentPropertyNumber ?? null
        ),
        codeFact("property_type", "Ejendomstype", publicData.property?.propertyType ?? null),
        profileFact("municipality", "Kommune", publicData.property?.municipalityCode ?? null)
      ]
    },
    {
      key: "primaryUnit",
      title: "Boligen",
      facts: primaryUnit ? unitProfileFacts(primaryUnit) : []
    },
    {
      key: "primaryBuilding",
      title: "Bygningen",
      facts: displayBuilding
        ? [
            ...buildingProfileFacts(displayBuilding),
            profileFact("commercial_area", "Erhvervsareal", displayBuilding.areas.commercialAreaM2, "m2"),
            profileFact("floor_count", "Etager", displayBuilding.registeredFloorCount),
            profileFact("garage", "Integreret garage", displayBuilding.areas.integratedGarageM2, "m2"),
            profileFact("carport", "Integreret carport", displayBuilding.areas.integratedCarportM2, "m2"),
            profileFact("outbuilding", "Integreret udhus", displayBuilding.areas.integratedOutbuildingM2, "m2"),
            profileFact("conservatory", "Integreret udestue", displayBuilding.areas.integratedConservatoryM2, "m2"),
            profileFact("covered_area", "Lukkede overdækninger", displayBuilding.areas.coveredAreaM2, "m2"),
            profileFact("other_area", "Øvrigt areal", displayBuilding.areas.otherAreaM2, "m2")
          ]
        : []
    },
    {
      key: "materials",
      title: "Materialer",
      facts: displayBuilding
        ? [
            codeFact("outer_wall", "Ydervæg", displayBuilding.materials.outerWall),
            codeFact("roof", "Tag", displayBuilding.materials.roof),
            codeFact("supplementary_outer_wall", "Supplerende ydervæg", (displayBuilding.materials.supplementaryOuterWall ?? displayBuilding.materials.asbestos ?? null))
          ]
        : []
    },
    {
      key: "heating",
      title: "Varme",
      facts: displayBuilding
        ? [
            codeFact("installation", "Varmeinstallation", displayBuilding.heating.installation),
            codeFact("source", "Opvarmningsmiddel", displayBuilding.heating.source),
            codeFact("supplementary", "Supplerende varme", displayBuilding.heating.supplementary)
          ]
        : []
    },
    {
      key: "areas",
      title: "Arealer",
      facts: [
        ...(primaryUnit ? unitProfileFacts(primaryUnit).filter((fact) => fact.key.includes("area")) : []),
        ...(displayBuilding
          ? [
              profileFact("building_total", "Samlet bygningsareal", displayBuilding.areas.totalBuildingAreaM2, "m2"),
              profileFact("building_residential", "Bygningens boligareal", displayBuilding.areas.residentialAreaM2, "m2"),
              profileFact("building_commercial", "Bygningens erhvervsareal", displayBuilding.areas.commercialAreaM2, "m2"),
              profileFact("footprint", "Bebygget areal", displayBuilding.areas.footprintAreaM2, "m2")
            ]
          : [])
      ]
    },
    {
      key: "floorsAndBasement",
      title: "Etager og kælder",
      facts: [profileFact("basement_area", "Kælderareal", basementArea, "m2")],
      buildings: displayBuilding
        ? [
            {
              bbrBuildingId: displayBuilding.bbrBuildingId,
              title: buildingDisplayTitle(displayBuilding),
              facts: [],
              units: [],
              floors: displayBuilding.floors.map((floor) => ({
                bbrFloorId: floor.bbrFloorId,
                title: floor.designation ?? "Etage",
                facts: floorProfileFacts(floor)
              }))
            }
          ]
        : []
    },
    {
      key: "otherBuildings",
      title: "Andre bygninger",
      facts: [profileFact("count", "Eksisterende bygninger", existingOtherBuildings.length)],
      buildings: existingOtherBuildings.map((building) => ({
        bbrBuildingId: building.bbrBuildingId,
        title: buildingDisplayTitle(building),
        facts: buildingProfileFacts(building),
        units: building.units.map((unit) => ({
          bbrUnitId: unit.bbrUnitId,
          title: unit.housingType?.label ?? unit.use?.label ?? "Enhed",
          facts: unitProfileFacts(unit)
        })),
        floors: building.floors.map((floor) => ({
          bbrFloorId: floor.bbrFloorId,
          title: floor.designation ?? "Etage",
          facts: floorProfileFacts(floor)
        }))
      }))
    },
    {
      key: "projectedBuildings",
      title: "Projekterede bygninger",
      facts: [profileFact("count", "Projekterede bygninger", projectedBuildings.length)],
      buildings: projectedBuildings.map((building) => ({
        bbrBuildingId: building.bbrBuildingId,
        title: buildingDisplayTitle(building),
        facts: buildingProfileFacts(building),
        units: [],
        floors: []
      }))
    },
    {
      key: "groundAndParcels",
      title: "Grund og matrikel",
      facts: [
        codeFact("water_supply", "Vandforsyning", publicData.ground?.waterSupply ?? null),
        codeFact("sewer", "Afløb", publicData.ground?.sewer ?? null),
        profileFact("ground_id", "BBR grund-id", publicData.ground?.bbrGroundId ?? null),
        ...publicData.parcels.flatMap((parcel, index) => [
          profileFact(`parcel_${index + 1}`, "Matrikelnummer", parcel.cadastralNumber),
          profileFact(
            `owner_district_${index + 1}`,
            "Ejerlav",
            parcel.ownerDistrictId,
            undefined,
            parcel.availability?.ownerDistrict ?? "registered_empty"
          ),
          profileFact(
            `municipality_${index + 1}`,
            "Kommune",
            parcel.municipalityId,
            undefined,
            parcel.availability?.municipality ?? "registered_empty"
          )
        ])
      ]
    },
    {
      key: "sourceAndQuality",
      title: "Datakilde og kvalitet",
      facts: [
        profileFact("source", "Kilde", "Registreret i BBR"),
        profileFact("status", "Status", publicData.status),
        profileFact("fetched_at", "Senest opdateret", publicData.source.fetchedAt),
        profileFact("warning_count", "Mangler/advarsler", publicData.warnings.length),
        profileFact(
          "source_unavailable_count",
          "Ikke tilgængeligt fra datakilden",
          publicData.warnings.filter((warning) => warning.code === "optional_field_unavailable").length
        ),
        profileFact(
          "note",
          "Bemærkning",
          "Registreringer kan afvige fra husets faktiske forhold."
        )
      ]
    }
  ];

  return housePublicDataProfileV1Schema.parse({
    contract: "house_public_data_profile.v1",
    houseId,
    status: profileStatus(publicData.status),
    sourceLabel: "Registreret i BBR",
    fetchedAt: publicData.source.fetchedAt,
    title: publicData.address?.label ?? "Husprofil",
    subtitle: displayBuilding ? buildingDisplayTitle(displayBuilding) : null,
    topFacts: [
      codeFact("housing_type", "Boligtype", primaryUnit?.housingType ?? displayBuilding?.use ?? null),
      profileFact(
        "residential_area",
        "Boligareal",
        primaryUnit?.areas.residentialAreaM2 ?? displayBuilding?.areas.residentialAreaM2,
        "m2"
      ),
      profileFact(
        "construction_year",
        "Byggeår",
        presentableConstructionYear(displayBuilding?.constructionYear)
      ),
      profileFact("rooms", "Værelser", primaryUnit?.roomCount),
      codeFact("heating", "Varme", displayBuilding?.heating.installation ?? null),
      profileFact("cadastral_number", "Matrikel", publicData.parcels[0]?.cadastralNumber ?? null)
    ],
    sections,
    warnings: publicData.warnings
  });
}

export const housePublicDataWithProfileResponseV1Schema =
  housePublicDataResponseV1Schema.extend({
    profile: housePublicDataProfileV1Schema
  });

export type HousePublicDataWithProfileResponseV1 = z.infer<
  typeof housePublicDataWithProfileResponseV1Schema
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
  publicDataSummaries: z.array(housePublicDataSummarySchema).default([]),
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
