import type { PermissionAction, PlatformRole } from "@prisma/client";

export type PermissionDefinition = {
  key: string;
  name: string;
  description: string;
  module: string;
  action: PermissionAction;
  sensitive?: boolean;
};

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  { key: "admin.access", name: "Access admin", description: "Open the platform admin area.", module: "admin", action: "read" },
  { key: "rbac.manage", name: "Manage RBAC", description: "View and manage roles, permissions, and overrides.", module: "access_control", action: "manage", sensitive: true },
  { key: "users.manage", name: "Manage users", description: "View, update, suspend, and support users.", module: "users", action: "manage" },
  { key: "organizations.manage", name: "Manage organizations", description: "View and update organizations across the platform.", module: "organizations", action: "manage" },
  { key: "countries.manage", name: "Manage countries", description: "Configure countries and country-scoped operations.", module: "countries", action: "manage" },
  { key: "feature_flags.manage", name: "Manage feature flags", description: "Enable or disable platform features.", module: "feature_flags", action: "configure", sensitive: true },
  { key: "audit.read", name: "View audit logs", description: "View admin and tenant audit logs.", module: "audit", action: "read" },
  { key: "reports.read", name: "View reports", description: "View operational reports and dashboards.", module: "reports", action: "read" },
  { key: "recipes.manage", name: "Manage recipes", description: "Manage recipes, cuisines, ingredients, and units.", module: "food_library", action: "manage" },
  { key: "youtube.manage", name: "Manage YouTube discovery", description: "Run video discovery and manage recipe video references.", module: "youtube", action: "manage" },
  { key: "grocery.manage", name: "Manage grocery", description: "Manage grocery engine, exports, and partners.", module: "grocery", action: "manage" },
  { key: "meal_plans.manage", name: "Manage meal planning", description: "View meal planning reports and support workflows.", module: "meal_plans", action: "manage" },
  { key: "home_chefs.manage", name: "Manage home chef requests", description: "Manage home chef requests and assignment workflows.", module: "home_chefs", action: "manage" },
  { key: "chefs.manage", name: "Manage chef marketplace", description: "Manage chef profiles, services, reviews, and requests.", module: "chefs", action: "manage" },
  { key: "home_catering.manage", name: "Manage home catering", description: "Manage home catering profiles, menus, and orders.", module: "home_catering", action: "manage" },
  { key: "restaurants.manage", name: "Manage restaurants", description: "Manage restaurant profiles, menus, fallback, and orders.", module: "restaurants", action: "manage" },
  { key: "menus.manage", name: "Manage menus", description: "Moderate menus and menu items.", module: "menus", action: "moderate" },
  { key: "food_orders.manage", name: "Manage food orders", description: "View and resolve food order workflows.", module: "food_orders", action: "manage" },
  { key: "billing.manage", name: "Manage billing", description: "Manage plans, subscriptions, usage, and billing support.", module: "billing", action: "manage" },
  { key: "payments.manage", name: "Manage payments", description: "View transactions, refunds, disputes, and payouts.", module: "payments", action: "manage", sensitive: true },
  { key: "payments.configure", name: "Configure payment gateways", description: "Configure gateway settings and encrypted credentials.", module: "payments", action: "configure", sensitive: true },
  { key: "refunds.manage", name: "Manage refunds", description: "Issue and track refunds.", module: "payments", action: "refund", sensitive: true },
  { key: "payouts.manage", name: "Manage payouts", description: "View and manage seller payout operations.", module: "payments", action: "payout", sensitive: true },
  { key: "storage.manage", name: "Manage storage files", description: "View files, Dropbox, metadata, and storage maintenance.", module: "storage", action: "manage", sensitive: true },
  { key: "storage.configure", name: "Configure storage", description: "Configure S3/S3-compatible storage credentials.", module: "storage", action: "configure", sensitive: true },
  { key: "verification.manage", name: "Manage seller verification", description: "Review seller compliance, permits, certificates, and gates.", module: "verification", action: "verify", sensitive: true },
  { key: "kyc.manage", name: "Manage KYC", description: "Manage KYC providers, identity sessions, and background check status.", module: "kyc", action: "manage", sensitive: true },
  { key: "support.manage", name: "Manage support", description: "Manage support tickets, leads, and user replies.", module: "support", action: "manage" },
  { key: "notifications.manage", name: "Manage notifications", description: "View notification health and admin messaging.", module: "notifications", action: "manage" },
  { key: "settings.manage", name: "Manage system settings", description: "Configure platform-wide settings and system status.", module: "settings", action: "configure", sensitive: true },
];

export const PLATFORM_ROLE_ORDER: PlatformRole[] = [
  "platform_owner",
  "platform_admin",
  "country_manager",
  "support_admin",
  "auditor",
];

export const ROLE_PERMISSION_DEFAULTS: Record<PlatformRole, string[]> = {
  platform_owner: PERMISSION_DEFINITIONS.map((permission) => permission.key),
  platform_admin: PERMISSION_DEFINITIONS.filter(
    (permission) => !["rbac.manage", "payments.configure", "storage.configure"].includes(permission.key),
  ).map((permission) => permission.key),
  country_manager: [
    "admin.access",
    "countries.manage",
    "organizations.manage",
    "users.manage",
    "reports.read",
    "audit.read",
    "home_chefs.manage",
    "chefs.manage",
    "home_catering.manage",
    "restaurants.manage",
    "food_orders.manage",
    "payments.manage",
    "verification.manage",
    "kyc.manage",
    "storage.manage",
    "support.manage",
  ],
  support_admin: [
    "admin.access",
    "users.manage",
    "organizations.manage",
    "support.manage",
    "home_chefs.manage",
    "chefs.manage",
    "home_catering.manage",
    "verification.manage",
    "kyc.manage",
    "storage.manage",
    "audit.read",
  ],
  auditor: ["admin.access", "audit.read", "reports.read"],
};

export const ORGANIZATION_ROLE_PERMISSION_DEFAULTS: Record<string, string[]> = {
  org_owner: ["billing.manage"],
  org_admin: ["billing.manage"],
  household_member: [],
  member: [],
  chef_owner: ["billing.manage"],
  chef_staff: [],
  home_catering_owner: ["billing.manage"],
  home_catering_staff: [],
  restaurant_owner: ["billing.manage"],
  restaurant_staff: [],
  grocery_partner_admin: ["billing.manage"],
};
