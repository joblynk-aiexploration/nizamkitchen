import { PaymentEnvironment, PaymentGatewayStatus, PaymentProvider } from "@prisma/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { savePaymentGatewayAction } from "../actions";

export const dynamic = "force-dynamic";

const environmentOptions = Object.values(PaymentEnvironment).map((environment) => ({ value: environment, label: environment }));
const providerOptions = Object.values(PaymentProvider).map((provider) => ({ value: provider, label: provider.replace(/_/g, " ") }));
const gatewayStatusOptions = Object.values(PaymentGatewayStatus).map((status) => ({ value: status, label: status.replace(/_/g, " ") }));

export default async function NewPaymentGatewayPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager"]);

  return (
    <AdminShell session={session} title="Create payment gateway" description="Register a gateway for hosted checkout. Credentials are added after the gateway exists.">
      <Card>
        <form action={savePaymentGatewayAction} className="grid gap-4 md:grid-cols-2">
          <TextInput label="Display name" name="displayName" required placeholder="Stripe US sandbox" />
          <SelectInput label="Provider" name="provider" options={providerOptions} />
          <SelectInput label="Environment" name="environment" options={environmentOptions} />
          <SelectInput label="Status" name="status" options={gatewayStatusOptions} />
          <TextInput label="Primary country code" name="countryCode" placeholder="US" maxLength={2} />
          <TextInput label="Priority" name="priority" type="number" defaultValue="100" />
          <TextArea label="Supported countries" name="supportedCountries" hint="Comma-separated country codes. Leave blank for global/platform gateway." />
          <TextArea label="Supported currencies" name="supportedCurrencies" hint="Comma-separated currency codes such as USD, INR, GBP." />
          <label className="flex items-center gap-3 text-sm font-medium text-[var(--color-ink)]">
            <input type="checkbox" name="isDefault" className="h-4 w-4" /> Default gateway
          </label>
          <label className="flex items-center gap-3 text-sm font-medium text-[var(--color-ink)]">
            <input type="checkbox" name="isPlatformGateway" defaultChecked className="h-4 w-4" /> Platform gateway
          </label>
          <div className="md:col-span-2">
            <Button type="submit">Create gateway</Button>
          </div>
        </form>
      </Card>
    </AdminShell>
  );
}
