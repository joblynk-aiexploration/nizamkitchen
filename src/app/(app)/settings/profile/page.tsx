import { AvatarWithUpload, CoverPhotoUpload } from "@/components/storage/file-upload-field";
import { LocationPicker } from "@/components/maps/LocationPicker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { PageHeader } from "@/components/ui/page-header";
import { PhoneNumberInput } from "@/components/ui/phone-number-input";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requireUser } from "@/lib/auth/session";
import { RELIGION_OPTIONS } from "@/lib/religion";
import { getGoogleMapsPublicConfig } from "@/server/maps/google-maps-config";
import { getPrimaryLocation } from "@/server/maps/location-service";
import { listEnabledCountryPhoneOptions, listEnabledLanguageOptions } from "@/server/localization/localization-service";
import { updateUserProfileAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function UserProfileSettingsPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const [session, params] = await Promise.all([requireUser(), searchParams]);
  const [mapsConfig, primaryLocation, languageOptions, phoneOptions] = await Promise.all([
    getGoogleMapsPublicConfig(session.activeOrganization?.countryCode),
    getPrimaryLocation("user", session.user.id),
    listEnabledLanguageOptions(),
    listEnabledCountryPhoneOptions(),
  ]);
  const preferredLanguage = session.user.preferredLanguage ?? "";
  const selectedLanguage = languageOptions.find((option) => {
    const localeLanguageCode = option.localeCode.split("-")[0];
    return option.value === preferredLanguage
      || option.label === preferredLanguage
      || localeLanguageCode === preferredLanguage
      || option.value === preferredLanguage.replace(/\s*\([^)]*\)\s*$/, "").trim();
  })?.value ?? "";

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Profile" title="Edit your personal profile" description="Keep your LinkedIn-style NizamKitchen profile, contact details, photos, and address up to date." />
      <FormMessage message={params.message} />
      <Card>
        <form action={updateUserProfileAction} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Full name" name="fullName" defaultValue={session.user.fullName} required />
            <TextInput label="Email" name="email" type="email" defaultValue={session.user.email} required />
            <TextInput label="Headline" name="headline" defaultValue={session.user.headline ?? ""} />
            <TextInput label="Public location" name="locationText" defaultValue={session.user.locationText ?? session.user.location ?? ""} hint="Example: Dallas, TX. This is safe to show on your profile." />
            <PhoneNumberInput
              defaultValue={session.user.phone}
              defaultCountryCode={phoneOptions.find((option) => option.countryCode === session.activeOrganization?.countryCode)?.phoneCountryCode}
              options={phoneOptions}
            />
            <SelectInput
              label="Religion"
              name="religion"
              defaultValue={session.user.religion ?? ""}
              hint="Optional and private unless an authorized admin reviews your profile."
              options={[
                { value: "", label: "Select religion" },
                ...RELIGION_OPTIONS,
              ]}
            />
            <SelectInput
              label="Preferred language"
              name="preferredLanguage"
              defaultValue={selectedLanguage}
              options={[
                { value: "", label: "Select a language" },
                ...languageOptions.map((option) => ({ value: option.value, label: option.label })),
              ]}
            />
            <SelectInput
              label="Address visibility"
              name="locationVisibility"
              defaultValue={primaryLocation?.visibility ?? "private"}
              options={[
                { value: "private", label: "Private - only you and authorized admins" },
                { value: "organization", label: "Organization members" },
                { value: "public_city_only", label: "Public city only" },
                { value: "public_full", label: "Public full address" },
              ]}
            />
            <AvatarWithUpload label="Profile photo" name="profilePhotoFileId" module="users" entityType="user" entityId={session.user.id} defaultFileId={session.user.profilePhotoFileId ?? null} />
            <CoverPhotoUpload label="Cover photo" name="coverPhotoFileId" module="users" entityType="user" entityId={session.user.id} defaultFileId={session.user.coverPhotoFileId ?? null} />
          </div>
          <TextArea label="Bio" name="bio" defaultValue={session.user.bio ?? ""} />
          <LocationPicker
            label="Personal address"
            mapsConfig={mapsConfig}
            hint="Used for household, delivery, support, and account context. Keep visibility private unless you intentionally make it public."
            fieldNames={{
              addressLine1: "addressLine1",
              addressLine2: "addressLine2",
              city: "city",
              region: "region",
              countryCode: "countryCode",
              postalCode: "postalCode",
              latitude: "latitude",
              longitude: "longitude",
              providerPlaceId: "providerPlaceId",
            }}
            defaultValue={{
              addressLine1: primaryLocation?.addressLine1 ?? "",
              addressLine2: primaryLocation?.addressLine2 ?? "",
              city: primaryLocation?.city ?? "",
              region: primaryLocation?.region ?? "",
              countryCode: primaryLocation?.countryCode ?? session.activeOrganization?.countryCode ?? "US",
              postalCode: primaryLocation?.postalCode ?? "",
              latitude: primaryLocation?.latitude ?? undefined,
              longitude: primaryLocation?.longitude ?? undefined,
              providerPlaceId: primaryLocation?.providerPlaceId ?? "",
              formattedAddress: [primaryLocation?.addressLine1, primaryLocation?.city, primaryLocation?.region].filter(Boolean).join(", "),
            }}
          />
          <label className="flex items-start gap-3 rounded-2xl border border-[var(--color-border)] p-4 text-sm">
            <input type="checkbox" name="publicProfileEnabled" defaultChecked={session.user.publicProfileEnabled} className="mt-1" />
            <span>
              <span className="block font-semibold text-[var(--color-ink)]">Enable public/internal profile view</span>
              <span className="mt-1 block text-[var(--color-muted)]">Email, phone, and private address details stay hidden unless you choose a public address visibility or an authorized admin reviews the profile.</span>
            </span>
          </label>
          <Button type="submit">Save profile</Button>
        </form>
      </Card>
    </div>
  );
}
