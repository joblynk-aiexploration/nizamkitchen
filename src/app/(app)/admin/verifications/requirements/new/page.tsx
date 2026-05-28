import { SellerRequirementType, SellerType, VerificationProvider } from "@prisma/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { upsertSellerRequirementAction } from "../../../../seller-verification-actions";

export default async function NewVerificationRequirementPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager"]);
  return (
    <AdminShell session={session} title="New verification requirement" description="Create a configurable requirement by country, region, and seller type.">
      <Card>
        <form action={upsertSellerRequirementAction} className="grid gap-4 md:grid-cols-2">
          <TextInput label="Title" name="title" required />
          <SelectInput label="Seller type" name="sellerType" options={Object.values(SellerType).map((value) => ({ value, label: value.replace(/_/g, " ") }))} />
          <SelectInput label="Requirement type" name="requirementType" options={Object.values(SellerRequirementType).map((value) => ({ value, label: value.replace(/_/g, " ") }))} />
          <SelectInput label="Provider" name="provider" options={Object.values(VerificationProvider).map((value) => ({ value, label: value.replace(/_/g, " ") }))} />
          <TextInput label="Country code (blank for global)" name="countryCode" maxLength={2} />
          <TextInput label="Region/state (optional)" name="region" />
          <TextInput label="Validity days (optional)" name="validityDays" type="number" min={1} />
          <TextInput label="Sort order" name="sortOrder" type="number" defaultValue={0} />
          <TextArea label="Description" name="description" />
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isRequired" defaultChecked /> Required</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked /> Active</label>
          </div>
          <div className="md:col-span-2"><Button type="submit">Create requirement</Button></div>
        </form>
      </Card>
    </AdminShell>
  );
}
