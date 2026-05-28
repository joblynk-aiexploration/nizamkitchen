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
  "/admin/settings",
  "/admin/countries",
  "/admin/organizations",
  "/admin/users",
  "/admin/roles",
  "/admin/permissions",
  "/admin/access-control",
  "/admin/feature-flags",
  "/admin/apis",
  "/admin/seo",
  "/admin/localization",
  "/admin/legal",
  "/admin/privacy",
  "/admin/policies",
  "/admin/audit-logs",
  "/admin/reports",
  "/admin/templates",
  "/admin/notifications",
  "/admin/billing",
  "/admin/accounting",
  "/admin/payments",
  "/admin/recipe-library",
  "/admin/ingredients",
  "/admin/units",
  "/admin/cuisines",
  "/admin/promotions",
  "/admin/credits",
  "/admin/referrals",
  "/admin/youtube-discovery",
  "/admin/home-chef-requests",
  "/admin/chefs",
  "/admin/verifications",
  "/admin/kyc",
  "/admin/home-catering",
  "/admin/restaurants",
  "/admin/menus",
  "/admin/menu-items",
  "/admin/food-orders",
  "/admin/fulfillment",
  "/admin/reviews",
  "/admin/grocery-engine",
  "/admin/meal-planner",
  "/admin/restaurant-fallback",
  "/admin/grocery-partners",
  "/admin/system",
  "/admin/storage",
  "/admin/dropbox",
  "/admin/system-settings",
  "/admin/support",
  "/admin/emails",
  "/admin/leads",
  "/admin/content",
] as const;

const countryManagerHrefs = [
  "/admin",
  "/admin/settings",
  "/admin/my-countries",
  "/admin/countries",
  "/admin/organizations",
  "/admin/users",
  "/admin/audit-logs",
  "/admin/reports",
  "/admin/payments",
  "/admin/home-chef-requests",
  "/admin/chefs",
  "/admin/verifications",
  "/admin/kyc",
  "/admin/home-catering",
  "/admin/food-orders",
  "/admin/restaurant-fallback",
  "/admin/grocery-partners",
  "/admin/dropbox",
  "/admin/dropbox/files",
  "/admin/dropbox/folders",
  "/admin/system",
] as const;

const supportAdminHrefs = [
  "/admin",
  "/admin/settings",
  "/admin/organizations",
  "/admin/users",
  "/admin/audit-logs",
  "/admin/home-chef-requests",
  "/admin/chefs",
  "/admin/verifications",
  "/admin/kyc",
  "/admin/support",
  "/admin/emails",
  "/admin/dropbox",
  "/admin/dropbox/files",
  "/admin/dropbox/folders",
  "/admin/system",
  "/admin/emails",
] as const;

const auditorHrefs = [
  "/admin",
  "/admin/settings",
  "/admin/audit-logs",
  "/admin/organizations",
  "/admin/users",
  "/admin/system",
] as const;

export function getWorkspaceNavItems(session: NavSessionLike): NavItem[] {
  const organizationType = session.activeOrganization?.organizationType;
  const membershipRole = session.activeMembership?.role;
  const platformRole = session.user.platformRole;

  if (platformRole && !membershipRole) {
    return [];
  }

  if (organizationType === "chef_business") {
    if (membershipRole === "chef_staff") {
      return [
        { href: "/chef", label: "Chef Dashboard" },
        { href: "/chef/requests", label: "Orders" },
        { href: "/chef/profile", label: "Profile" },
        { href: "/chef/availability", label: "Availability" },
        { href: "/billing", label: "Billing" },
        { href: "/profile", label: "My Profile" },
        { href: "/notifications", label: "Notifications" },
        { href: "/support", label: "Support Tickets" },
        { href: "/settings", label: "Settings" },
      ];
    }

    return [
      { href: "/chef", label: "Chef Dashboard" },
      { href: "/chef/profile", label: "Profile" },
      { href: "/chef/services", label: "Services" },
      { href: "/chef/verification", label: "Verification" },
      { href: "/chef/availability", label: "Availability" },
      { href: "/chef/requests", label: "Orders" },
      { href: "/chef/reviews", label: "Reviews" },
      { href: "/billing", label: "Billing" },
      { href: "/profile", label: "My Profile" },
      { href: "/support", label: "Support Tickets" },
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
      { href: "/restaurant/fulfillment", label: "Fulfillment" },
      { href: "/restaurant/promotions", label: "Promotions" },
      { href: "/restaurant/verification", label: "Verification" },
      { href: "/billing", label: "Billing" },
      { href: "/profile", label: "My Profile" },
      { href: "/support", label: "Support Tickets" },
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
      { href: "/catering/fulfillment", label: "Fulfillment" },
      { href: "/catering/promotions", label: "Promotions" },
      { href: "/catering/verification", label: "Verification" },
      { href: "/billing", label: "Billing" },
      { href: "/profile", label: "My Profile" },
      { href: "/support", label: "Support Tickets" },
      { href: "/catering/settings", label: "Settings" },
    ];
  }

  if (organizationType === "grocery_partner") {
    return [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/profile", label: "My Profile" },
      { href: "/support", label: "Support Tickets" },
      { href: "/settings", label: "Settings" },
    ];
  }

  const items: NavItem[] = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/profile", label: "My Profile" },
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
    { href: "/privacy-center", label: "Privacy" },
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
    "/admin/settings": "My Settings",
    "/admin/countries": "Countries",
    "/admin/my-countries": "My Countries",
    "/admin/organizations": "Organizations",
    "/admin/users": "Users",
    "/admin/roles": "Roles",
    "/admin/permissions": "Permissions",
    "/admin/access-control": "Access Control",
    "/admin/feature-flags": "Feature Flags",
    "/admin/apis": "API Management",
    "/admin/configuration": "Configuration Vault",
    "/admin/configuration/integrations": "Integrations",
    "/admin/configuration/secrets": "Masked Secrets",
    "/admin/configuration/tests": "Integration Tests",
    "/admin/configuration/public-keys": "Public Keys",
    "/admin/legal": "Legal Center",
    "/admin/legal/documents": "Legal Documents",
    "/admin/legal/acceptances": "Legal Acceptances",
    "/admin/legal/consents": "Legal Consents",
    "/admin/privacy": "Privacy Center",
    "/admin/seo": "SEO / AEO",
    "/admin/localization": "Localization",
    "/admin/localization/locales": "Locales",
    "/admin/localization/translations": "Translations",
    "/admin/localization/countries": "Regional Countries",
    "/admin/localization/currencies": "Currencies",
    "/admin/localization/units": "Localized Units",
    "/admin/privacy/requests": "Privacy Requests",
    "/admin/privacy/retention": "Retention Policies",
    "/admin/policies": "Policies",
    "/admin/policies/overrides": "Policy Overrides",
    "/admin/policies/evaluation-logs": "Policy Logs",
    "/admin/audit-logs": "Audit Trail",
    "/admin/recipe-library": "Recipe Library",
    "/admin/ingredients": "Ingredients",
    "/admin/units": "Units",
    "/admin/cuisines": "Cuisines",
    "/admin/promotions": "Promotions",
    "/admin/credits": "Credits",
    "/admin/referrals": "Referrals",
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
    "/admin/fulfillment": "Fulfillment",
    "/admin/fulfillment/orders": "Fulfillment Orders",
    "/admin/fulfillment/zones": "Delivery Zones",
    "/admin/reviews": "Reviews",
    "/admin/reviews/reports": "Review Reports",
    "/admin/grocery-partners": "Grocery Partners",
    "/admin/grocery-engine": "Grocery Engine",
    "/admin/meal-planner": "Meal Planner",
    "/admin/system": "System Status",
    "/admin/system/health": "Health Checks",
    "/admin/system/integrations": "Integrations",
    "/admin/system/logs": "System Logs",
    "/admin/system/alerts": "System Alerts",
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
    "/admin/accounting": "Accounting",
    "/admin/accounting/taxes": "Taxes",
    "/admin/accounting/invoices": "Invoices",
    "/admin/accounting/receipts": "Receipts",
    "/admin/accounting/commissions": "Commissions",
    "/admin/accounting/settlements": "Settlements",
    "/admin/accounting/exports": "Accounting Exports",
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
    "/admin/content": "Content",
    "/admin/content/pages": "CMS Pages",
    "/admin/content/pages/new": "New CMS Page",
    "/admin/content/help": "Help Articles",
    "/admin/content/help/new": "New Help Article",
    "/admin/content/faqs": "FAQs",
    "/admin/content/faqs/new": "New FAQ",
    "/reports": "Reports",
  };

  return labels[href] ?? href;
}
