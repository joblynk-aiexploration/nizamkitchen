import { RobotsDirective, SeoScope, type SeoSetting } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { saveSeoSettingAction } from "./actions";

const scopeOptions = Object.values(SeoScope).map((value) => ({ value, label: value.replace(/_/g, " ") }));
const robotsOptions = Object.values(RobotsDirective).map((value) => ({ value, label: value.replace(/_/g, " ") }));

export function SeoSettingForm({ setting, defaultScope = SeoScope.page, defaultPath }: { setting?: SeoSetting | null; defaultScope?: SeoScope; defaultPath?: string }) {
  return (
    <Card>
      <h2 className="text-base font-semibold text-[var(--color-ink)]">{setting ? "Edit SEO setting" : "Create SEO setting"}</h2>
      <form action={saveSeoSettingAction} className="mt-5 space-y-5">
        {setting ? <input type="hidden" name="id" value={setting.id} /> : null}
        <div className="grid gap-4 md:grid-cols-3">
          <SelectInput label="Scope" name="scope" defaultValue={setting?.scope ?? defaultScope} options={scopeOptions} />
          <TextInput label="Path" name="path" defaultValue={setting?.path ?? defaultPath ?? ""} placeholder="/pricing" />
          <SelectInput label="Robots" name="robotsDirective" defaultValue={setting?.robotsDirective ?? RobotsDirective.index_follow} options={robotsOptions} />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <TextInput label="Entity type" name="entityType" defaultValue={setting?.entityType ?? ""} placeholder="recipe, chef, caterer" />
          <TextInput label="Entity ID" name="entityId" defaultValue={setting?.entityId ?? ""} />
          <TextInput label="Country code" name="countryCode" defaultValue={setting?.countryCode ?? ""} placeholder="US" />
        </div>
        <TextInput label="City" name="city" defaultValue={setting?.city ?? ""} placeholder="Dallas" />
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Meta title" name="metaTitle" maxLength={70} defaultValue={setting?.metaTitle ?? ""} />
          <TextInput label="Canonical URL" name="canonicalUrl" defaultValue={setting?.canonicalUrl ?? ""} />
        </div>
        <TextArea label="Meta description" name="metaDescription" maxLength={170} defaultValue={setting?.metaDescription ?? ""} />
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Open Graph title" name="ogTitle" defaultValue={setting?.ogTitle ?? ""} />
          <TextInput label="Twitter/X title" name="twitterTitle" defaultValue={setting?.twitterTitle ?? ""} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <TextArea label="Open Graph description" name="ogDescription" defaultValue={setting?.ogDescription ?? ""} />
          <TextArea label="Twitter/X description" name="twitterDescription" defaultValue={setting?.twitterDescription ?? ""} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="OG image file ID" name="ogImageFileId" defaultValue={setting?.ogImageFileId ?? ""} />
          <TextInput label="Twitter image file ID" name="twitterImageFileId" defaultValue={setting?.twitterImageFileId ?? ""} />
        </div>
        <TextArea label="AEO summary" name="aeoSummary" defaultValue={setting?.aeoSummary ?? ""} hint="Short answer-engine summary for this page or entity." />
        <TextArea
          label="AEO FAQ JSON"
          name="aeoFaqJson"
          defaultValue={JSON.stringify(setting?.aeoFaqJson ?? [], null, 2)}
          hint='Example: [{"question":"What is NizamKitchen?","answer":"NizamKitchen helps households plan, cook, hire, and order food."}]'
        />
        <TextArea
          label="Structured data JSON"
          name="structuredDataJson"
          defaultValue={JSON.stringify(setting?.structuredDataJson ?? {}, null, 2)}
          hint="Optional schema.org JSON-LD override. Do not add fake ratings or reviews."
        />
        <label className="flex items-center gap-3 text-sm font-medium text-[var(--color-ink)]">
          <input type="checkbox" name="isActive" defaultChecked={setting?.isActive ?? true} />
          Active
        </label>
        <Button type="submit">Save SEO setting</Button>
      </form>
    </Card>
  );
}
