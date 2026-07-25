import {
  FeeCalculationType,
  FeePolicyStatus,
  FeeType,
  PricingFulfillmentType,
  PricingModule,
  PricingSellerType,
  type FeePolicy,
} from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { createFeePolicyAction, createFeeRuleAction, updateFeePolicyAction } from "./policies/actions";

const emptyOption = { value: "", label: "Any" };
const moduleOptions = Object.values(PricingModule).map((value) => ({ value, label: labelize(value) }));
const sellerTypeOptions = [emptyOption, ...Object.values(PricingSellerType).map((value) => ({ value, label: labelize(value) }))];
const fulfillmentOptions = [emptyOption, ...Object.values(PricingFulfillmentType).map((value) => ({ value, label: labelize(value) }))];
const statusOptions = Object.values(FeePolicyStatus).map((value) => ({ value, label: labelize(value) }));
const feeTypeOptions = Object.values(FeeType).map((value) => ({ value, label: labelize(value) }));
const calculationOptions = Object.values(FeeCalculationType).map((value) => ({ value, label: labelize(value) }));

export function FeePolicyForm({ policy }: { policy?: FeePolicy }) {
  return (
    <form action={policy ? updateFeePolicyAction : createFeePolicyAction} className="grid gap-4 md:grid-cols-2">
      {policy ? <input type="hidden" name="policyId" value={policy.id} /> : null}
      <TextInput label="Policy name" name="name" defaultValue={policy?.name ?? ""} placeholder="US food order fees" required />
      <TextInput label="Country" name="countryCode" maxLength={2} defaultValue={policy?.countryCode ?? "US"} placeholder="US" />
      <TextInput label="State/region" name="region" defaultValue={policy?.region ?? ""} placeholder="Optional" />
      <TextInput label="City" name="city" defaultValue={policy?.city ?? ""} placeholder="Optional" />
      <SelectInput label="Module" name="module" defaultValue={policy?.module ?? "food_order"} options={moduleOptions} required />
      <SelectInput label="Seller type" name="sellerType" defaultValue={policy?.sellerType ?? ""} options={sellerTypeOptions} />
      <SelectInput label="Fulfillment" name="fulfillmentType" defaultValue={policy?.fulfillmentType ?? ""} options={fulfillmentOptions} />
      <SelectInput label="Status" name="status" defaultValue={policy?.status ?? "draft"} options={statusOptions} />
      <TextInput label="Priority" name="priority" type="number" step="1" defaultValue={policy?.priority ?? 100} />
      <TextInput label="Effective from" name="effectiveFrom" type="datetime-local" />
      <TextInput label="Effective to" name="effectiveTo" type="datetime-local" />
      <div className="md:col-span-2">
        <TextArea label="Description" name="description" defaultValue={policy?.description ?? ""} />
      </div>
      <div className="md:col-span-2">
        <TextArea label="Advanced rules JSON" name="rulesJson" defaultValue={JSON.stringify(policy?.rulesJson ?? {}, null, 2)} rows={5} />
      </div>
      <div className="md:col-span-2">
        <Button type="submit">{policy ? "Save fee policy" : "Create fee policy"}</Button>
      </div>
    </form>
  );
}

export function FeeRuleForm({ policyId }: { policyId: string }) {
  return (
    <Card>
      <h2 className="text-lg font-semibold text-[var(--color-ink)]">Add fee rule</h2>
      <form action={createFeeRuleAction} className="mt-4 grid gap-4 md:grid-cols-3">
        <input type="hidden" name="feePolicyId" value={policyId} />
        <SelectInput label="Fee type" name="feeType" defaultValue="platform_service_fee" options={feeTypeOptions} required />
        <SelectInput label="Calculation" name="calculationType" defaultValue="percentage" options={calculationOptions} required />
        <TextInput label="Display name" name="displayName" defaultValue="Service fee" required />
        <TextInput label="Percentage" name="percentage" type="number" step="0.01" placeholder="10" />
        <TextInput label="Fixed amount" name="fixedAmount" type="number" step="0.01" placeholder="3.99" />
        <TextInput label="Minimum" name="minAmount" type="number" step="0.01" placeholder="2.50" />
        <TextInput label="Maximum" name="maxAmount" type="number" step="0.01" placeholder="6.50" />
        <TextInput label="Threshold" name="thresholdAmount" type="number" step="0.01" placeholder="15.00" />
        <TextInput label="Currency" name="currencyCode" maxLength={3} defaultValue="USD" required />
        <TextInput label="Sort order" name="sortOrder" type="number" step="1" defaultValue={100} />
        <label className="flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]">
          <input type="checkbox" name="taxable" /> Taxable
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]">
          <input type="checkbox" name="displayToCustomer" defaultChecked /> Display to customer
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]">
          <input type="checkbox" name="isActive" defaultChecked /> Active
        </label>
        <div className="md:col-span-3">
          <Button type="submit">Add rule</Button>
        </div>
      </form>
    </Card>
  );
}

export function labelize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
