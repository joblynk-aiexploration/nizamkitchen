export const GA4_TRACKED_EVENTS = [
  "sign_up",
  "login",
  "recipe_view",
  "add_to_my_recipes",
  "meal_plan_created",
  "grocery_list_generated",
  "home_chef_request_created",
  "home_chef_request_confirmed",
  "caterer_profile_view",
  "restaurant_profile_view",
  "checkout_started",
  "payment_completed",
  "subscription_purchased",
] as const;

export type Ga4TrackedEvent = (typeof GA4_TRACKED_EVENTS)[number];

const trackedEventSet = new Set<string>(GA4_TRACKED_EVENTS);

export function isGa4TrackedEvent(value: string | null | undefined): value is Ga4TrackedEvent {
  return Boolean(value && trackedEventSet.has(value));
}

export function withAnalyticsEvent(path: string, eventName: Ga4TrackedEvent) {
  const [pathAndQuery, hash = ""] = path.split("#", 2);
  const [pathname, query = ""] = pathAndQuery.split("?", 2);
  const params = new URLSearchParams(query);
  params.set("analytics_event", eventName);
  const nextQuery = params.toString();
  return `${pathname}${nextQuery ? `?${nextQuery}` : ""}${hash ? `#${hash}` : ""}`;
}
