"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { type ServiceFormState, upsertChefServiceAction } from "../actions";

const serviceTypeOptions = [
  { value: "daily_cooking", label: "Daily cooking" },
  { value: "weekly_cooking", label: "Weekly cooking" },
  { value: "occasion", label: "Occasion" },
  { value: "meal_prep", label: "Meal prep" },
  { value: "recipe_specific", label: "Recipe specific" },
  { value: "custom", label: "Custom" },
];

const priceUnitOptions = [
  { value: "per_visit", label: "Per visit" },
  { value: "per_day", label: "Per day" },
  { value: "per_week", label: "Per week" },
  { value: "per_event", label: "Per event" },
  { value: "per_guest", label: "Per guest" },
  { value: "custom", label: "Custom" },
];

const INITIAL_STATE: ServiceFormState = {};

type ServiceData = {
  id: string;
  name: string;
  description: string | null;
  serviceType: string;
  basePriceAmount: number | null;
  currencyCode: string;
  priceUnit: string;
  minGuests: number | null;
  maxGuests: number | null;
  isActive: boolean;
};

export function ServiceForm({
  className,
  orgCurrencyCode,
  service,
  submitLabel,
}: {
  className?: string;
  orgCurrencyCode: string;
  service?: ServiceData;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(upsertChefServiceAction, INITIAL_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  // Focus the first field with an error after a failed submission.
  useEffect(() => {
    if (state.fieldErrors && formRef.current) {
      const firstErrorKey = Object.keys(state.fieldErrors)[0];
      if (firstErrorKey) {
        const el = formRef.current.querySelector<HTMLElement>(`[name="${firstErrorKey}"]`);
        el?.focus();
      }
    }
  }, [state.fieldErrors]);

  // After an error, state.values holds the raw form values the user submitted.
  // Fall back to the saved service props (for edit forms) then to empty string.
  const v = {
    name: state.values?.name ?? service?.name ?? "",
    serviceType: state.values?.serviceType ?? service?.serviceType ?? "daily_cooking",
    basePriceAmount: state.values?.basePriceAmount ?? (service?.basePriceAmount != null ? String(service.basePriceAmount) : ""),
    currencyCode: state.values?.currencyCode ?? service?.currencyCode ?? orgCurrencyCode,
    priceUnit: state.values?.priceUnit ?? service?.priceUnit ?? "per_visit",
    minGuests: state.values?.minGuests ?? (service?.minGuests != null ? String(service.minGuests) : ""),
    maxGuests: state.values?.maxGuests ?? (service?.maxGuests != null ? String(service.maxGuests) : ""),
    description: state.values?.description ?? service?.description ?? "",
    isActive: state.values !== undefined ? state.values.isActive : (service?.isActive ?? true),
  };

  const fe = state.fieldErrors ?? {};

  return (
    <form ref={formRef} action={formAction} className={`grid gap-4 md:grid-cols-2 ${className ?? "mt-5"}`}>
      {service ? <input type="hidden" name="serviceId" value={service.id} /> : null}

      {state.error && (
        <div
          role="alert"
          className="md:col-span-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
        >
          {state.error}
        </div>
      )}

      <TextInput
        label="Service name"
        name="name"
        defaultValue={v.name}
        error={fe.name}
        required
      />
      <SelectInput
        label="Service type"
        name="serviceType"
        options={serviceTypeOptions}
        defaultValue={v.serviceType}
        error={fe.serviceType}
      />
      <TextInput
        label="Base price"
        name="basePriceAmount"
        type="number"
        min={0}
        step="0.01"
        defaultValue={v.basePriceAmount}
        error={fe.basePriceAmount}
      />
      <TextInput
        label="Currency"
        name="currencyCode"
        defaultValue={v.currencyCode}
        maxLength={3}
        error={fe.currencyCode}
      />
      <SelectInput
        label="Price unit"
        name="priceUnit"
        options={priceUnitOptions}
        defaultValue={v.priceUnit}
        error={fe.priceUnit}
      />
      <TextInput
        label="Min guests"
        name="minGuests"
        type="number"
        min={1}
        defaultValue={v.minGuests}
        error={fe.minGuests}
      />
      <TextInput
        label="Max guests"
        name="maxGuests"
        type="number"
        min={1}
        defaultValue={v.maxGuests}
        error={fe.maxGuests}
      />
      <label className="flex items-end gap-2 pb-3 text-sm font-medium text-[var(--color-ink)]">
        <input type="checkbox" name="isActive" defaultChecked={v.isActive} />
        Active
      </label>
      <div className="md:col-span-2">
        <TextArea label="Description" name="description" defaultValue={v.description} />
      </div>
      <div className="md:col-span-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
