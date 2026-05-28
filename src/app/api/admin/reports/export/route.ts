import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import {
  exportOrganizationsCSV,
  exportHomeChefRequestsCSV,
  exportChefProfilesCSV,
  exportRestaurantSearchesCSV,
  exportGroceryUsageCSV,
} from "@/server/reports/admin-reports";
import { AccessDeniedError } from "@/lib/auth";

const EXPORT_TYPES = {
  organizations: {
    fn: exportOrganizationsCSV,
    filename: "organizations.csv",
  },
  home_chef_requests: {
    fn: exportHomeChefRequestsCSV,
    filename: "home-chef-requests.csv",
  },
  chef_profiles: {
    fn: exportChefProfilesCSV,
    filename: "chef-profiles.csv",
  },
  restaurant_searches: {
    fn: exportRestaurantSearchesCSV,
    filename: "restaurant-searches.csv",
  },
  grocery_usage: {
    fn: exportGroceryUsageCSV,
    filename: "grocery-usage.csv",
  },
} as const;

type ExportType = keyof typeof EXPORT_TYPES;

export async function GET(request: Request) {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as ExportType | null;

  if (!type || !(type in EXPORT_TYPES)) {
    return NextResponse.json(
      { error: `Invalid type. Valid values: ${Object.keys(EXPORT_TYPES).join(", ")}` },
      { status: 400 },
    );
  }

  const { fn, filename } = EXPORT_TYPES[type];

  try {
    const csv = await fn(session);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }
    return NextResponse.json({ error: "Export failed." }, { status: 500 });
  }
}
