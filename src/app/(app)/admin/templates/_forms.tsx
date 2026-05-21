import type React from "react";
import type { DishTemplate, DishTemplateIngredient, DishTemplateStep, MenuTemplate, MenuTemplateItem } from "@prisma/client";
import { Button } from "@/components/ui/button";

const categoryOptions = ["biryani", "curry", "salan", "rice", "bread", "snack", "dessert", "drink", "combo", "catering_tray", "special", "other"];
const statusOptions = ["draft", "active", "disabled", "archived"];
const visibilityOptions = ["internal_admin", "public", "seller_available", "household_available"];
const mealTypes = ["", "breakfast", "lunch", "dinner", "snack", "dessert", "side", "prep"];
const menuTemplateTypes = ["daily", "weekly", "monthly", "occasion", "ramadan", "eid", "wedding", "party", "custom"];
const sellerTypes = ["", "chef_business", "home_catering", "restaurant"];
const spiceLevels = ["", "mild", "medium", "hot", "extra_hot"];

type DishTemplateWithParts = DishTemplate & {
  ingredients?: DishTemplateIngredient[];
  steps?: DishTemplateStep[];
};

type MenuTemplateWithItems = MenuTemplate & {
  items?: MenuTemplateItem[];
};

export function DishTemplateForm({
  template,
  action,
}: {
  template?: DishTemplateWithParts | null;
  action: (formData: FormData) => Promise<void>;
}) {
  const ingredientsText = template?.ingredients
    ?.map((ingredient) => [ingredient.ingredientName, ingredient.quantity ?? "", ingredient.unitId ?? "", ingredient.preparationNote ?? ""].join("|"))
    .join("\n") ?? "";
  const stepsText = template?.steps
    ?.map((step) => [step.title ?? "", step.instruction, step.durationMinutes ?? ""].join("|"))
    .join("\n") ?? "";

  return (
    <form action={action} className="space-y-5">
      {template ? <input type="hidden" name="id" value={template.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Name" name="name" required defaultValue={template?.name} />
        <TextField label="Slug" name="slug" defaultValue={template?.slug} placeholder="chicken-dum-biryani" />
        <TextField label="Country" name="countryCode" defaultValue={template?.countryCode ?? ""} placeholder="US" />
        <TextField label="State/region" name="region" defaultValue={template?.region ?? ""} placeholder="TX" />
        <TextField label="City" name="city" defaultValue={template?.city ?? ""} placeholder="Dallas" />
        <TextField label="Cuisine ID" name="cuisineId" defaultValue={template?.cuisineId ?? ""} />
        <SelectField label="Meal type" name="mealType" defaultValue={template?.mealType ?? ""} options={mealTypes} />
        <SelectField label="Category" name="category" defaultValue={template?.category ?? "other"} options={categoryOptions} />
        <TextField label="Default servings" name="defaultServings" type="number" defaultValue={template?.defaultServings ?? ""} />
        <TextField label="Default price" name="defaultPriceAmount" type="number" step="0.01" defaultValue={template?.defaultPriceAmount ?? ""} />
        <TextField label="Currency" name="currencyCode" defaultValue={template?.currencyCode ?? ""} placeholder="USD" />
        <SelectField label="Spice level" name="spiceLevel" defaultValue={template?.spiceLevel ?? ""} options={spiceLevels} />
        <SelectField label="Status" name="status" defaultValue={template?.status ?? "draft"} options={statusOptions} />
        <SelectField label="Visibility" name="visibility" defaultValue={template?.visibility ?? "internal_admin"} options={visibilityOptions} />
      </div>
      <TextArea label="Description" name="description" defaultValue={template?.description ?? ""} />
      <TextArea label="Ingredients, one per line: name | quantity | unitId | note" name="ingredientsText" rows={8} defaultValue={ingredientsText} />
      <TextArea label="Steps, one per line: title | instruction | durationMinutes" name="stepsText" rows={8} defaultValue={stepsText} />
      <Button type="submit">Save dish template</Button>
    </form>
  );
}

export function MenuTemplateForm({
  template,
  action,
}: {
  template?: MenuTemplateWithItems | null;
  action: (formData: FormData) => Promise<void>;
}) {
  const itemsText = template?.items
    ?.map((item) => [item.nameSnapshot, item.dayOffset ?? "", item.mealSlot ?? "", item.category ?? "", item.priceAmount ?? "", item.currencyCode ?? "", item.dishTemplateId ?? "", item.recipeId ?? ""].join("|"))
    .join("\n") ?? "";

  return (
    <form action={action} className="space-y-5">
      {template ? <input type="hidden" name="id" value={template.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Name" name="name" required defaultValue={template?.name} />
        <TextField label="Slug" name="slug" defaultValue={template?.slug} placeholder="weekly-hyderabadi-family-plan" />
        <SelectField label="Template type" name="templateType" defaultValue={template?.templateType ?? "weekly"} options={menuTemplateTypes} />
        <SelectField label="Seller type" name="sellerType" defaultValue={template?.sellerType ?? ""} options={sellerTypes} />
        <TextField label="Country" name="countryCode" defaultValue={template?.countryCode ?? ""} placeholder="US" />
        <TextField label="State/region" name="region" defaultValue={template?.region ?? ""} placeholder="TX" />
        <TextField label="City" name="city" defaultValue={template?.city ?? ""} placeholder="Dallas" />
        <SelectField label="Status" name="status" defaultValue={template?.status ?? "draft"} options={statusOptions} />
        <SelectField label="Visibility" name="visibility" defaultValue={template?.visibility ?? "internal_admin"} options={visibilityOptions} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <CheckField name="householdUseEnabled" label="Household meal planner" defaultChecked={template?.householdUseEnabled ?? true} />
        <CheckField name="sellerUseEnabled" label="Seller menu builder" defaultChecked={template?.sellerUseEnabled ?? true} />
      </div>
      <TextArea label="Description" name="description" defaultValue={template?.description ?? ""} />
      <TextArea label="Items, one per line: name | dayOffset | mealSlot | category | price | currency | dishTemplateId | recipeId" name="itemsText" rows={10} defaultValue={itemsText} />
      <Button type="submit">Save menu template</Button>
    </form>
  );
}

function TextField({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="space-y-1 text-sm font-medium text-[var(--color-ink)]">
      {label}
      <input {...props} className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm" />
    </label>
  );
}

function SelectField({ label, options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: string[] }) {
  return (
    <label className="space-y-1 text-sm font-medium text-[var(--color-ink)]">
      {label}
      <select {...props} className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm">
        {options.map((option) => <option key={option || "empty"} value={option}>{option || "Any"}</option>)}
      </select>
    </label>
  );
}

function TextArea({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="space-y-1 text-sm font-medium text-[var(--color-ink)]">
      {label}
      <textarea {...props} className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm" />
    </label>
  );
}

function CheckField({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-ink)]">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}
