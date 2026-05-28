"use client";

import { useMemo, useState } from "react";
import { GooglePlacesAutocomplete } from "@/components/maps/GooglePlacesAutocomplete";
import { TextInput } from "@/components/ui/text-input";
import type { GoogleMapsPublicConfig } from "@/server/maps/google-maps-config";
import type { NormalizedGooglePlaceSelection } from "@/lib/google-maps";

type LocationFieldNames = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  countryCode: string;
  postalCode: string;
  latitude: string;
  longitude: string;
  providerPlaceId: string;
};

type Props = {
  label: string;
  mapsConfig: GoogleMapsPublicConfig;
  fieldNames: LocationFieldNames;
  defaultValue?: Partial<NormalizedGooglePlaceSelection>;
  hint?: string;
};

export function LocationPicker({ label, mapsConfig, fieldNames, defaultValue, hint }: Props) {
  const [value, setValue] = useState({
    addressLine1: defaultValue?.addressLine1 ?? "",
    addressLine2: defaultValue?.addressLine2 ?? "",
    city: defaultValue?.city ?? "",
    region: defaultValue?.region ?? "",
    countryCode: defaultValue?.countryCode ?? mapsConfig.defaultCountry ?? "",
    postalCode: defaultValue?.postalCode ?? "",
    latitude: defaultValue?.latitude?.toString() ?? "",
    longitude: defaultValue?.longitude?.toString() ?? "",
    providerPlaceId: defaultValue?.providerPlaceId ?? "",
    formattedAddress: defaultValue?.formattedAddress ?? "",
  });

  const allowedCountries = useMemo(
    () => (mapsConfig.allowedCountries.length > 0 ? mapsConfig.allowedCountries : mapsConfig.defaultCountry ? [mapsConfig.defaultCountry] : []),
    [mapsConfig.allowedCountries, mapsConfig.defaultCountry],
  );

  function applyPlaceSelection(place: NormalizedGooglePlaceSelection) {
    setValue({
      addressLine1: place.addressLine1 ?? "",
      addressLine2: place.addressLine2 ?? "",
      city: place.city ?? "",
      region: place.region ?? "",
      countryCode: place.countryCode ?? mapsConfig.defaultCountry ?? "",
      postalCode: place.postalCode ?? "",
      latitude: place.latitude != null ? String(place.latitude) : "",
      longitude: place.longitude != null ? String(place.longitude) : "",
      providerPlaceId: place.providerPlaceId ?? "",
      formattedAddress: place.formattedAddress ?? "",
    });
  }

  return (
    <div className="space-y-4 rounded-3xl border border-[var(--color-border)] bg-slate-50 p-4">
      <div>
        <p className="text-sm font-semibold text-[var(--color-ink)]">{label}</p>
        {hint ? <p className="mt-1 text-xs text-[var(--color-muted)]">{hint}</p> : null}
      </div>

      <GooglePlacesAutocomplete
        browserApiKey={mapsConfig.enabled ? mapsConfig.browserApiKey : null}
        disabledReason={mapsConfig.enabled ? null : mapsConfig.reason}
        defaultValue={value.formattedAddress}
        placeholder="Search for an address or place"
        countryCodes={allowedCountries}
        onPlaceSelected={applyPlaceSelection}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <TextInput
          label="Address line 1"
          name={fieldNames.addressLine1}
          value={value.addressLine1}
          onChange={(event) => setValue((current) => ({ ...current, addressLine1: event.target.value }))}
        />
        <TextInput
          label="Address line 2"
          name={fieldNames.addressLine2}
          value={value.addressLine2}
          onChange={(event) => setValue((current) => ({ ...current, addressLine2: event.target.value }))}
        />
        <TextInput
          label="City"
          name={fieldNames.city}
          value={value.city}
          onChange={(event) => setValue((current) => ({ ...current, city: event.target.value }))}
        />
        <TextInput
          label="Region / state"
          name={fieldNames.region}
          value={value.region}
          onChange={(event) => setValue((current) => ({ ...current, region: event.target.value }))}
        />
        <TextInput
          label="Postal code"
          name={fieldNames.postalCode}
          value={value.postalCode}
          onChange={(event) => setValue((current) => ({ ...current, postalCode: event.target.value }))}
        />
        <TextInput
          label="Country code"
          name={fieldNames.countryCode}
          value={value.countryCode}
          onChange={(event) => setValue((current) => ({ ...current, countryCode: event.target.value.toUpperCase() }))}
          maxLength={2}
        />
      </div>

      <input type="hidden" name={fieldNames.latitude} value={value.latitude} />
      <input type="hidden" name={fieldNames.longitude} value={value.longitude} />
      <input type="hidden" name={fieldNames.providerPlaceId} value={value.providerPlaceId} />
    </div>
  );
}
