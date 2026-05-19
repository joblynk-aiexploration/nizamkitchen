import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { ImageUploadField } from "@/components/storage/file-upload-field";

const menuStatusOptions = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
];

const visibilityOptions = [
  { value: "private", label: "Private" },
  { value: "public", label: "Public" },
];

const categoryOptions = [
  { value: "biryani", label: "Biryani" },
  { value: "curry", label: "Curry" },
  { value: "salan", label: "Salan" },
  { value: "rice", label: "Rice" },
  { value: "bread", label: "Bread" },
  { value: "snack", label: "Snack" },
  { value: "dessert", label: "Dessert" },
  { value: "drink", label: "Drink" },
  { value: "combo", label: "Combo" },
  { value: "catering_tray", label: "Catering tray" },
  { value: "special", label: "Special" },
  { value: "other", label: "Other" },
];

const itemStatusOptions = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "sold_out", label: "Sold out" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
];

const spiceOptions = [
  { value: "", label: "Not specified" },
  { value: "mild", label: "Mild" },
  { value: "medium", label: "Medium" },
  { value: "hot", label: "Hot" },
  { value: "extra_hot", label: "Extra hot" },
];

const dayOptions = [
  { value: "0", label: "Sun" },
  { value: "1", label: "Mon" },
  { value: "2", label: "Tue" },
  { value: "3", label: "Wed" },
  { value: "4", label: "Thu" },
  { value: "5", label: "Fri" },
  { value: "6", label: "Sat" },
];

type MenuLike = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  visibility: string;
};

type MenuItemLike = {
  id: string;
  menuId?: string | null;
  name: string;
  description?: string | null;
  cuisine?: string | null;
  category: string;
  priceAmount?: number | null;
  currencyCode: string;
  servingSize?: string | null;
  spiceLevel?: string | null;
  preparationTimeMinutes?: number | null;
  minimumOrderQuantity?: number | null;
  maxDailyQuantity?: number | null;
  preorderRequired: boolean;
  minimumNoticeHours?: number | null;
  pickupAvailable: boolean;
  deliveryAvailable: boolean;
  photoUrl?: string | null;
  photoFileId?: string | null;
  allergensJson?: unknown;
  ingredientsSummary?: string | null;
  status: string;
  isFeatured: boolean;
  availability?: Array<{ dayOfWeek: number }>;
};

export function MenuForm({
  action,
  menu,
}: {
  action: (formData: FormData) => void | Promise<void>;
  menu?: MenuLike | null;
}) {
  return (
    <Card>
      <form action={action} className="space-y-5">
        {menu ? <input type="hidden" name="menuId" value={menu.id} /> : null}
        <TextInput label="Menu name" name="name" defaultValue={menu?.name ?? ""} required />
        <TextArea label="Description" name="description" defaultValue={menu?.description ?? ""} />
        <div className="grid gap-4 md:grid-cols-2">
          <SelectInput label="Status" name="status" defaultValue={menu?.status ?? "draft"} options={menuStatusOptions} />
          <SelectInput label="Visibility" name="visibility" defaultValue={menu?.visibility ?? "private"} options={visibilityOptions} />
        </div>
        <Button type="submit">Save menu</Button>
      </form>
    </Card>
  );
}

export function MenuItemForm({
  action,
  item,
  menus,
  currencyCode,
}: {
  action: (formData: FormData) => void | Promise<void>;
  item?: MenuItemLike | null;
  menus: Array<{ id: string; name: string }>;
  currencyCode: string;
}) {
  const selectedDays = new Set(item?.availability?.map((availability) => availability.dayOfWeek) ?? []);
  const allergens = Array.isArray(item?.allergensJson) ? item.allergensJson.join(", ") : "";

  return (
    <Card>
      <form action={action} className="space-y-5">
        {item ? <input type="hidden" name="menuItemId" value={item.id} /> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Dish name" name="name" defaultValue={item?.name ?? ""} required />
          <SelectInput
            label="Menu"
            name="menuId"
            defaultValue={item?.menuId ?? ""}
            options={[{ value: "", label: "No menu" }, ...menus.map((menu) => ({ value: menu.id, label: menu.name }))]}
          />
          <SelectInput label="Category" name="category" defaultValue={item?.category ?? "special"} options={categoryOptions} />
          <TextInput label="Cuisine" name="cuisine" defaultValue={item?.cuisine ?? "Hyderabadi"} />
          <TextInput label="Price" name="priceAmount" type="number" step="0.01" min={0} defaultValue={item?.priceAmount ?? ""} />
          <TextInput label="Currency" name="currencyCode" defaultValue={item?.currencyCode ?? currencyCode} required />
          <TextInput label="Serving size" name="servingSize" defaultValue={item?.servingSize ?? ""} />
          <SelectInput label="Spice level" name="spiceLevel" defaultValue={item?.spiceLevel ?? ""} options={spiceOptions} />
          <TextInput label="Preparation time minutes" name="preparationTimeMinutes" type="number" min={0} defaultValue={item?.preparationTimeMinutes ?? ""} />
          <TextInput label="Minimum order quantity" name="minimumOrderQuantity" type="number" min={1} defaultValue={item?.minimumOrderQuantity ?? ""} />
          <TextInput label="Max daily quantity" name="maxDailyQuantity" type="number" min={1} defaultValue={item?.maxDailyQuantity ?? ""} />
          <TextInput label="Minimum notice hours" name="minimumNoticeHours" type="number" min={0} defaultValue={item?.minimumNoticeHours ?? ""} />
          <ImageUploadField
            label="Dish photo"
            name="photoFileId"
            module="menus"
            purpose="menu_item_photo"
            visibility="public"
            entityType="menu_item"
            entityId={item?.id}
            defaultFileId={item?.photoFileId ?? null}
            hint="Stores the menu item image in S3 and attaches it to this dish."
          />
          <TextInput label="Legacy photo URL fallback" name="photoUrl" defaultValue={item?.photoUrl ?? ""} />
          <SelectInput label="Status" name="status" defaultValue={item?.status ?? "draft"} options={itemStatusOptions} />
        </div>
        <TextArea label="Description" name="description" defaultValue={item?.description ?? ""} />
        <TextArea label="Ingredients summary" name="ingredientsSummary" defaultValue={item?.ingredientsSummary ?? ""} />
        <TextInput label="Allergens" name="allergens" defaultValue={allergens} hint="Comma-separated, e.g. dairy, nuts, gluten" />
        <div className="grid gap-3 md:grid-cols-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="preorderRequired" defaultChecked={item?.preorderRequired ?? false} /> Preorder required</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="pickupAvailable" defaultChecked={item?.pickupAvailable ?? true} /> Pickup available</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="deliveryAvailable" defaultChecked={item?.deliveryAvailable ?? false} /> Delivery available</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isFeatured" defaultChecked={item?.isFeatured ?? false} /> Featured</label>
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--color-ink)]">Available days</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {dayOptions.map((day) => (
              <label key={day.value} className="rounded-2xl border border-[var(--color-border)] px-3 py-2 text-sm">
                <input className="mr-2" type="checkbox" name="availableDays" value={day.value} defaultChecked={selectedDays.has(Number(day.value))} />
                {day.label}
              </label>
            ))}
          </div>
        </div>
        <Button type="submit">Save menu item</Button>
      </form>
    </Card>
  );
}
