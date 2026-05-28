import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { listAdminMenuItems } from "@/server/menus";
import { moderateMenuItemAction } from "./actions";

export const dynamic = "force-dynamic";

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "sold_out", label: "Sold out" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
];

export default async function AdminMenuItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ countryCode?: string; status?: string }>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const params = await searchParams;
  const items = await listAdminMenuItems(session, params);
  const canMutate = session.user.platformRole !== "auditor";

  return (
    <AdminShell session={session} title="Menu item moderation" description="Review and moderate dishes published by home catering sellers and restaurants.">
      <Card>
        <form className="grid gap-4 md:grid-cols-3">
          <input name="countryCode" defaultValue={params.countryCode ?? ""} placeholder="Country code" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
          <SelectInput label="Status" name="status" defaultValue={params.status ?? ""} options={statusOptions} />
          <div className="flex items-end"><Button type="submit" className="w-full">Filter</Button></div>
        </form>
      </Card>
      <AdminDataTable
        data={items}
        emptyMessage="No menu items found."
        columns={[
          {
            key: "item",
            header: "Item",
            render: (item) => (
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="text-[var(--color-muted)]">{item.organization.name} · {item.organization.organizationType}</p>
              </div>
            ),
          },
          { key: "category", header: "Category", render: (item) => item.category },
          { key: "status", header: "Status", render: (item) => <Badge tone={item.status === "active" ? "success" : "warning"}>{item.status}</Badge> },
          { key: "price", header: "Price", render: (item) => item.priceAmount ? `${item.currencyCode} ${item.priceAmount}` : "Not set" },
          {
            key: "moderate",
            header: "Moderation",
            render: (item) => canMutate ? (
              <form action={moderateMenuItemAction} className="flex flex-wrap gap-2">
                <input type="hidden" name="menuItemId" value={item.id} />
                <select name="status" defaultValue={item.status} className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm">
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="sold_out">Sold out</option>
                  <option value="paused">Paused</option>
                  <option value="archived">Archived</option>
                </select>
                <Button type="submit" variant="secondary">Save</Button>
              </form>
            ) : "Read only",
          },
        ]}
      />
    </AdminShell>
  );
}
