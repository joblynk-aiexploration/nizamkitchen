import type {
  MarketplacePolicyModule,
  MarketplacePolicyResult,
  OrganizationType,
  SellerType,
} from "@prisma/client";

export type PolicyAction =
  | "publish"
  | "accept"
  | "checkout"
  | "payout"
  | "view_public_profile"
  | "refund"
  | "cancel"
  | "assign"
  | "upload"
  | "manage";

export type PolicyRuleSet = {
  effect?: MarketplacePolicyResult;
  message?: string;
  requireSellerVerified?: boolean;
  requirePayoutOnboarding?: boolean;
  requireAdminApproval?: boolean;
  requireActiveMenuItem?: boolean;
  hideSuspendedSeller?: boolean;
  allowBeforeAcceptanceOnly?: boolean;
  privateByDefault?: boolean;
  minimumOrderAmount?: number;
  allowManualPayment?: boolean;
};

export type PolicyEvaluationInput = {
  module: MarketplacePolicyModule;
  action: PolicyAction | string;
  userId?: string | null;
  organizationId?: string | null;
  countryCode?: string | null;
  region?: string | null;
  sellerType?: SellerType | null;
  organizationType?: OrganizationType | null;
  metadata?: Record<string, unknown>;
};

export type PolicyEvaluation = {
  result: MarketplacePolicyResult;
  allowed: boolean;
  policyId: string | null;
  policyName: string | null;
  reason: string | null;
  overrideActive: boolean;
  rules: PolicyRuleSet;
};
