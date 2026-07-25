import type {
  ContactProxySession,
  HomeChefPrivacyPolicy,
  HomeChefRequest,
  HomeChefRequestAccessGrant,
  HomeChefRequestMessage,
  HomeChefRequestOffer,
  HomeChefRequestStatusHistory,
  Organization,
  Recipe,
  User,
} from "@prisma/client";

type MinimalRecipe = Pick<Recipe, "id" | "name" | "slug"> | null;
type MinimalUser = Pick<User, "id" | "fullName" | "email">;
type MinimalOrganization = Pick<Organization, "id" | "name" | "countryCode">;

export type HomeChefRequestWithPrivacyRelations = HomeChefRequest & {
  recipe?: MinimalRecipe;
  mealPlan?: { id: string; name: string } | null;
  organization: MinimalOrganization;
  createdBy: MinimalUser;
  currentOffer?: (HomeChefRequestOffer & { chefProfile?: { id: string; displayName: string; organizationId: string } }) | null;
  offers?: Array<HomeChefRequestOffer & { chefProfile?: { id: string; displayName: string; organizationId: string } }>;
  messages?: Array<HomeChefRequestMessage & { senderUser: MinimalUser }>;
  statusHistory?: Array<HomeChefRequestStatusHistory & { changedBy: MinimalUser }>;
  accessGrants?: HomeChefRequestAccessGrant[];
  contactProxySessions?: ContactProxySession[];
};

export type HomeChefVisibilityStage =
  | "admin_full"
  | "household_full"
  | "chef_limited"
  | "chef_accepted_pending_lock"
  | "chef_logistics"
  | "cancelled_limited";

function firstName(fullName: string | null | undefined) {
  return fullName?.trim().split(/\s+/)[0] || "NizamKitchen customer";
}

export function redactCustomerName(params: {
  fullName?: string | null;
  policy?: Pick<HomeChefPrivacyPolicy, "allowFirstNameBeforeAcceptance"> | null;
  requestType?: string | null;
  canRevealFullName?: boolean;
}) {
  if (params.canRevealFullName) return params.fullName || "NizamKitchen customer";
  const highValueRequest = params.requestType === "custom" || params.requestType === "occasion";
  if (params.policy?.allowFirstNameBeforeAcceptance && highValueRequest) return firstName(params.fullName);
  return "NizamKitchen customer";
}

export function redactPhone(phone?: string | null, canReveal = false) {
  return canReveal ? phone ?? null : null;
}

export function redactEmail(email?: string | null, canReveal = false) {
  return canReveal ? email ?? null : null;
}

export function toGeneralLocation(request: Pick<HomeChefRequest, "city" | "region" | "postalCode" | "countryCode">) {
  const cityRegion = [request.city, request.region].filter(Boolean).join(", ");
  if (cityRegion && request.postalCode) return `${cityRegion} · ${request.postalCode} area`;
  if (cityRegion) return cityRegion;
  if (request.postalCode) return `${request.postalCode} area`;
  return request.countryCode;
}

export function toChefPreviewLocation(request: Pick<HomeChefRequest, "city" | "countryCode">) {
  return request.city || request.countryCode;
}

export function redactAddress(
  request: Pick<HomeChefRequest, "serviceAddressLine1" | "serviceAddressLine2" | "city" | "region" | "postalCode" | "countryCode">,
  canReveal = false,
) {
  if (!canReveal) {
    return {
      exactAddressLine1: null,
      exactAddressLine2: null,
      city: request.city,
      region: request.region,
      postalCode: request.postalCode,
      countryCode: request.countryCode,
      generalLocation: toGeneralLocation(request),
    };
  }

  return {
    exactAddressLine1: request.serviceAddressLine1,
    exactAddressLine2: request.serviceAddressLine2,
    city: request.city,
    region: request.region,
    postalCode: request.postalCode,
    countryCode: request.countryCode,
    generalLocation: toGeneralLocation(request),
  };
}

function publicMessages(
  request: HomeChefRequestWithPrivacyRelations,
  customerDisplayName: string,
  revealStaffNames: boolean,
) {
  return (request.messages ?? [])
    .filter((message) => !message.isInternal)
    .map((message) => ({
      id: message.id,
      senderRole: message.senderRole,
      senderDisplayName:
        message.senderRole === "household"
          ? customerDisplayName
          : revealStaffNames
            ? message.senderUser.fullName
            : message.senderRole === "chef"
              ? "Chef"
              : "NizamKitchen",
      message: message.message,
      createdAt: message.createdAt,
    }));
}

function baseRequestSummary(request: HomeChefRequestWithPrivacyRelations) {
  return {
    id: request.id,
    title: request.title,
    description: request.description,
    requestType: request.requestType,
    status: request.status,
    matchingStatus: request.matchingStatus,
    bookingLockStatus: request.bookingLockStatus,
    countryCode: request.countryCode,
    requestedDate: request.requestedDate,
    requestedTimeWindow: request.requestedTimeWindow,
    guestCount: request.guestCount,
    householdSize: request.householdSize,
    preferredLanguage: request.preferredLanguage,
    genderPreference: request.genderPreference,
    budgetAmount: request.budgetAmount,
    budgetCurrency: request.budgetCurrency,
    currencyCode: request.currencyCode,
    recipe: request.recipe ? { id: request.recipe.id, name: request.recipe.name, slug: request.recipe.slug } : null,
    mealPlan: request.mealPlan ? { id: request.mealPlan.id, name: request.mealPlan.name } : null,
    generalLocation: toGeneralLocation(request),
    currentOffer: request.currentOffer
      ? {
          id: request.currentOffer.id,
          status: request.currentOffer.status,
          responseDeadlineAt: request.currentOffer.responseDeadlineAt,
          chefProfileId: request.currentOffer.chefProfileId,
        }
      : null,
  };
}

export function toChefLimitedRequestView(params: {
  request: HomeChefRequestWithPrivacyRelations;
  policy?: HomeChefPrivacyPolicy | null;
  accepted?: boolean;
}) {
  const customerDisplayName = redactCustomerName({
    fullName: params.request.createdBy.fullName,
    policy: params.policy,
    requestType: params.request.requestType,
    canRevealFullName: false,
  });

  return {
    ...baseRequestSummary(params.request),
    generalLocation: toChefPreviewLocation(params.request),
    visibilityStage: params.accepted ? "chef_accepted_pending_lock" as const : "chef_limited" as const,
    customerDisplayName,
    address: redactAddress(params.request, false),
    phone: null,
    email: null,
    notes: params.request.notes,
    adminNotes: null,
    secureMessagingAllowed: params.policy?.allowPreAcceptanceMessaging ?? true,
    communicationWarning: "Please keep communication on NizamKitchen until booking is confirmed.",
    messages: publicMessages(params.request, customerDisplayName, false),
    statusHistory: params.request.statusHistory ?? [],
  };
}

export function toChefLogisticsRequestView(params: {
  request: HomeChefRequestWithPrivacyRelations;
  policy?: HomeChefPrivacyPolicy | null;
}) {
  const proxy = params.request.contactProxySessions?.find((session) => session.status === "active") ?? null;
  const canRevealPhone = params.policy?.allowRealPhoneReveal === true;
  const canRevealEmail = params.policy?.allowEmailReveal === true;

  return {
    ...baseRequestSummary(params.request),
    visibilityStage: "chef_logistics" as const,
    customerDisplayName: redactCustomerName({ fullName: params.request.createdBy.fullName, canRevealFullName: true }),
    address: redactAddress(params.request, true),
    phone: redactPhone(params.request.phone, canRevealPhone),
    email: redactEmail(params.request.createdBy.email, canRevealEmail),
    contactProxy: proxy
      ? { status: proxy.status, provider: proxy.provider, proxyNumber: proxy.proxyNumber, expiresAt: proxy.expiresAt }
      : { status: "pending", provider: "manual_placeholder", proxyNumber: null, expiresAt: null },
    notes: params.request.notes,
    adminNotes: null,
    secureMessagingAllowed: true,
    communicationWarning: "Use NizamKitchen messaging or proxy contact for arrival coordination.",
    messages: publicMessages(params.request, params.request.createdBy.fullName, true),
    statusHistory: params.request.statusHistory ?? [],
  };
}

export function toHouseholdRequestView(request: HomeChefRequestWithPrivacyRelations) {
  return {
    ...baseRequestSummary(request),
    visibilityStage: "household_full" as const,
    customerDisplayName: request.createdBy.fullName,
    householdName: request.organization.name,
    address: redactAddress(request, true),
    phone: request.phone,
    email: request.createdBy.email,
    notes: request.notes,
    privacyNote: "Your exact address is shared with the chef only after the chef accepts the request.",
    communicationWarning: "Your exact address is shared with the chef only after the chef accepts the request.",
    messages: publicMessages(request, request.createdBy.fullName, true),
    statusHistory: request.statusHistory ?? [],
  };
}

export function toAdminRequestView(request: HomeChefRequestWithPrivacyRelations) {
  return {
    ...baseRequestSummary(request),
    visibilityStage: "admin_full" as const,
    customerDisplayName: request.createdBy.fullName,
    householdName: request.organization.name,
    address: redactAddress(request, true),
    phone: request.phone,
    email: request.createdBy.email,
    notes: request.notes,
    adminNotes: request.adminNotes,
    communicationWarning: "Admin full view. Do not disclose exact logistics before booking lock.",
    accessGrants: request.accessGrants ?? [],
    contactProxySessions: request.contactProxySessions ?? [],
    messages: (request.messages ?? []).map((message) => ({
      id: message.id,
      senderRole: message.senderRole,
      senderDisplayName: message.senderUser.fullName,
      isInternal: message.isInternal,
      message: message.message,
      createdAt: message.createdAt,
    })),
    statusHistory: request.statusHistory ?? [],
  };
}
