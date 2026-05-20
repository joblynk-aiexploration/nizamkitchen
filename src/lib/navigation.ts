import type { Membership, Organization, PlatformRole } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";

export type NavSessionLike = {
  user: { platformRole: PlatformRole | null };
  activeMembership?: Pick<Membership, "role"> | null;
  activeOrganization?: Pick<Organization, "organizationType"> | null;
};

export type NavItem = {
  href: string;
  label: string;
};

const platformAdminHrefs = [
  "/admin",
  "/admin/countries",
  "/admin/organizations",
  "/admin/users",
  "/admin/roles",
  "/admin/permissions",
  "/admin/access-control",
  "/admin/feature-flags",
  "/admin/audit-logs",
  "/admin/reports",
  "/admin/notifications",
  "/admin/billing",
  "/admin/payments",
  "/admin/payments/operations",
  "/admin/payments/gateways",
  "/admin/payments/configurations",
  "/admin/payments/transactions",
  "/admin/payments/refunds",
  "/admin/payments/disputes",
  "/admin/payments/payouts",
  "/admin/payments/commissions",
  "/admin/payments/webhooks",
  "/admin/payments/settings",
  "/admin/billing/plans",
  "/admin/billing/subscriptions",
  "/admin/recipe-library",
  "/admin/ingredients",
  "/admin/units",
  "/admin/cuisines",
  "/admin/youtube-discovery",
  "/admin/home-chef-requests",
  "/admin/chefs",
  "/admin/verifications",
  "/admin/verifications/requirements",
  "/admin/kyc",
  "/admin/kyc/providers",
  "/admin/kyc/background-checks",
  "/admin/kyc/identity-verifications",
  "/admin/home-catering",
  "/admin/restaurants",
  "/admin/menus",
  "/admin/menu-items",
  "/admin/food-orders",
  "/admin/grocery-engine",
  "/admin/meal-planner",
  "/admin/restaurant-fallback",
  "/admin/grocery-partners",
  "/admin/system",
  "/admin/storage",
  "/admin/storage/configuration",
  "/admin/storage/files",
  "/admin/storage/tests",
  "/admin/dropbox",
  "/admin/dropbox/files",
  "/admin/dropbox/uploads",
  "/admin/dropbox/folders",
  "/admin/dropbox/settings",
  "/admin/system-settings",
  "/admin/support",
  "/admin/leads",
] as const;

const countryManagerHrefs = [
  "/admin",
  "/admin/my-countries",
  "/admin/countries",
  "/admin/organizations",
  "/admin/users",
  "/admin/audit-logs",
  "/admin/reports",
  "/admin/payments",
  "/admin/payments/operations",
  "/admin/payments/configurations",
  "/admin/payments/transactions",
  "/admin/payments/commissions",
  "/admin/home-chef-requests",
  "/admin/chefs",
  "/admin/verifications",
  "/admin/verifications/requirements",
  "/admin/kyc",
  "/admin/kyc/background-checks",
  "/admin/kyc/identity-verifications",
  "/admin/home-catering",
  "/admin/food-orders",
  "/admin/restaurant-fallback",
  "/admin/grocery-partners",
  "/admin/dropbox",
  "/admin/dropbox/files",
  "/admin/dropbox/folders",
] as const;

const supportAdminHrefs = [
  "/admin",
  "/admin/organizations",
  "/admin/users",
  "/admin/audit-logs",
  "/admin/home-chef-requests",
  "/admin/chefs",
  "/admin/verifications",
  "/admin/kyc",
  "/admin/support",
  "/admin/dropbox",
  "/admin/dropbox/files",
  "/admin/dropbox/folders",
] as const;

const auditorHrefs = [
  "/admin",
  "/admin/audit-logs",
  "/admin/organizations",
  "/admin/users",
] as const;

export function getWorkspaceNavItems(session: NavSessionLike): NavItem[] {
  const organizationType = session.activeOrganization?.organizationType;
  const membershipRole = session.activeMembership?.role;
  const platformRole = session.user.platformRole;

  if (platformRole && !membershipRole) {
    return [];
  }

  if (organizationType === "chef_business") {
    return [
      { href: "/chef", label: "Chef Dashboard" },
      { href: "/chef/profile", label: "Profile" },
      { href: "/chef/services", label: "Services" },
      { href: "/chef/verification", label: "Verification" },
      { href: "/chef/availability", label: "Availability" },
      { href: "/chef/requests", label: "Assigned Requests" },
      { href: "/chef/reviews", label: "Reviews" },
      { href: "/settings", label: "Settings" },
    ];
  }

  if (organizationType === "restaurant") {
    return [
      { href: "/restaurant", label: "Restaurant Dashboard" },
      { href: "/restaurant/profile", label: "Profile" },
      { href: "/restaurant/menu", label: "Menus" },
      { href: "/restaurant/menu-items", label: "Menu Items" },
      { href: "/restaurant/orders", label: "Order Requests" },
      { href: "/restaurant/verification", label: "Verification" },
      { href: "/restaurant/settings", label: "Settings" },
    ];
  }

  if (organizationType === "home_catering") {
    return [
      { href: "/catering", label: "Catering Dashboard" },
      { href: "/catering/profile", label: "Profile" },
      { href: "/catering/menu", label: "Menus" },
      { href: "/catering/menu-items", label: "Menu Items" },
      { href: "/catering/orders", label: "Order Requests" },
      { href: "/catering/verification", label: "Verification" },
      { href: "/catering/settings", label: "Settings" },
    ];
  }

  if (organizationType === "grocery_partner") {
    return [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/settings", label: "Settings" },
    ];
  }

  const items: NavItem[] = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/recipes", label: "Recipes" },
    { href: "/meal-plans", label: "Meal Plans" },
    { href: "/grocery-lists", label: "Grocery Lists" },
    { href: "/household", label: "Household" },
    { href: "/home-chef", label: "Home Chef" },
    { href: "/chefs", label: "Browse Chefs" },
    { href: "/caterers", label: "Browse Caterers" },
    { href: "/restaurants", label: "Restaurant Menus" },
    { href: "/orders", label: "My Orders" },
    { href: "/order-instead", label: "Order Instead" },
    { href: "/saved-restaurants", label: "Saved Restaurants" },
    { href: "/reports", label: "Reports" },
    { href: "/billing", label: "Billing" },
    { href: "/support", label: "Support" },
    { href: "/settings", label: "Settings" },
  ];

  if (hasPermission({ platformRole, membershipRole, permission: "audit:view" })) {
    items.push({ href: "/audit-logs", label: "Audit Logs" });
  }

  return items;
}

export function getPlatformNavItems(session: NavSessionLike): NavItem[] {
  const role = session.user.platformRole;

  if (role === "platform_owner" || role === "platform_admin") {
    return hrefsToItems(platformAdminHrefs);
  }

  if (role === "country_manager") {
    return hrefsToItems(countryManagerHrefs);
  }

  if (role === "support_admin") {
    return hrefsToItems(supportAdminHrefs);
  }

  if (role === "auditor") {
    return hrefsToItems(auditorHrefs);
  }

  return [];
}

function hrefsToItems(hrefs: readonly string[]): NavItem[] {
  return hrefs.map((href) => ({ href, label: labelForHref(href) }));
}

function labelForHref(href: string) {
  const labels: Record<string, string> = {
    "/admin": "Admin Overview",
    "/admin/countries": "Countries",
    "/admin/my-countries": "My Countries",
    "/admin/organizations": "Organizations",
    "/admin/users": "Users",
    "/admin/roles": "Roles",
    "/admin/permissions": "Permissions",
    "/admin/access-control": "Access Control",
    "/admin/feature-flags": "Feature Flags",
    "/admin/audit-logs": "Audit Trail",
    "/admin/recipe-library": "Recipe Library",
    "/admin/ingredients": "Ingredients",
    "/admin/units": "Units",
    "/admin/cuisines": "Cuisines",
    "/admin/youtube-discovery": "YouTube Discovery",
    "/admin/home-chef-requests": "Home Chef Requests",
    "/admin/chefs": "Chef Marketplace",
    "/admin/verifications": "Seller Verifications",
    "/admin/verifications/requirements": "Verification Requirements",
    "/admin/kyc": "KYC",
    "/admin/kyc/providers": "KYC Providers",
    "/admin/kyc/background-checks": "KYC Background Checks",
    "/admin/kyc/identity-verifications": "Identity Verifications",
    "/admin/home-catering": "Home Catering",
    "/admin/restaurants": "Restaurants",
    "/admin/menus": "Menus",
    "/admin/restaurant-fallback": "Restaurant Fallback",
    "/admin/menu-items": "Menu Items",
    "/admin/food-orders": "Food Orders",
    "/admin/grocery-partners": "Grocery Partners",
    "/admin/grocery-engine": "Grocery Engine",
    "/admin/meal-planner": "Meal Planner",
    "/admin/system": "System Status",
    "/admin/storage": "Storage",
    "/admin/storage/configuration": "Storage Config",
    "/admin/storage/files": "Storage Files",
    "/admin/storage/tests": "Storage Tests",
    "/admin/dropbox": "Drop Box",
    "/admin/dropbox/files": "Files",
    "/admin/dropbox/uploads": "Uploads",
    "/admin/dropbox/folders": "Folders",
    "/admin/dropbox/settings": "Dropbox Settings",
    "/admin/system-settings": "System Settings",
    "/admin/support": "Support",
    "/admin/notifications": "Notifications",
    "/admin/billing": "Billing",
    "/admin/payments": "Payments",
    "/admin/payments/operations": "Payment Operations",
    "/admin/payments/gateways": "Payment Gateways",
    "/admin/payments/configurations": "Payment Config",
    "/admin/payments/transactions": "Transactions",
    "/admin/payments/refunds": "Refunds",
    "/admin/payments/disputes": "Disputes",
    "/admin/payments/payouts": "Payouts",
    "/admin/payments/commissions": "Commissions",
    "/admin/payments/webhooks": "Webhooks",
    "/admin/payments/settings": "Payment Settings",
    "/admin/billing/plans": "Plans",
    "/admin/billing/subscriptions": "Subscriptions",
    "/admin/reports": "Reports",
    "/admin/leads": "Contact Leads",
    "/reports": "Reports",
  };

  return labels[href] ?? href;
}
