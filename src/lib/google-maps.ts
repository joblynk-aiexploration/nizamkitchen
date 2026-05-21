export type GoogleMapsLoaderLibrary = "maps" | "places" | "marker";

type AddressComponent = {
  long_name?: string;
  short_name?: string;
  types?: string[];
};

type GooglePlaceGeometry = {
  location?: {
    lat?: () => number;
    lng?: () => number;
  };
};

type GoogleAutocompletePlace = {
  address_components?: AddressComponent[];
  name?: string;
  formatted_address?: string;
  geometry?: GooglePlaceGeometry;
  place_id?: string;
  url?: string;
};

export type GoogleMarkerInstance = {
  addListener: (eventName: string, handler: () => void) => void;
  setMap?: (map: null) => void;
};

export type GoogleMapInstance = {
  fitBounds: (bounds: GoogleLatLngBoundsInstance, padding?: number) => void;
};

export type GoogleLatLngBoundsInstance = {
  extend: (location: { lat: number; lng: number }) => void;
};

export type GoogleMapsNamespace = {
  maps: {
    Map: new (
      element: HTMLElement,
      options: Record<string, unknown>,
    ) => GoogleMapInstance;
    Marker: new (options: Record<string, unknown>) => GoogleMarkerInstance;
    InfoWindow: new (options: Record<string, unknown>) => {
      open: (options: { anchor: GoogleMarkerInstance; map: GoogleMapInstance | null }) => void;
    };
    LatLngBounds: new () => GoogleLatLngBoundsInstance;
    places: {
      Autocomplete: new (
        element: HTMLInputElement,
        options: Record<string, unknown>,
      ) => {
        addListener: (
          eventName: string,
          handler: () => void,
        ) => { remove: () => void };
        getPlace: () => GoogleAutocompletePlace;
      };
    };
  };
};

export type NormalizedGooglePlaceSelection = {
  displayName: string;
  formattedAddress: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  countryCode: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  providerPlaceId: string | null;
  googleMapsUrl: string | null;
};

let googleMapsLoaderPromise: Promise<void> | null = null;

function ensureBrowser() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Google Maps can only load in the browser.");
  }
}

function addressComponent(
  components: AddressComponent[] | undefined,
  type: string,
) {
  const match = components?.find((component) => component.types?.includes(type));
  return {
    longName: match?.long_name ?? null,
    shortName: match?.short_name ?? null,
  };
}

export function buildGoogleMapsUrl(params: {
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
  query?: string | null;
}) {
  if (params.placeId) {
    return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(params.placeId)}`;
  }
  if (params.latitude != null && params.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${params.latitude},${params.longitude}`;
  }
  if (params.query) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(params.query)}`;
  }
  return null;
}

export function normalizeGoogleAutocompletePlace(place: GoogleAutocompletePlace): NormalizedGooglePlaceSelection {
  const streetNumber = addressComponent(place?.address_components, "street_number").longName;
  const route = addressComponent(place?.address_components, "route").longName;
  const subpremise = addressComponent(place?.address_components, "subpremise").longName;
  const locality = addressComponent(place?.address_components, "locality").longName;
  const sublocality =
    addressComponent(place?.address_components, "sublocality").longName ??
    addressComponent(place?.address_components, "sublocality_level_1").longName;
  const administrativeArea = addressComponent(place?.address_components, "administrative_area_level_1").longName;
  const countryCode = addressComponent(place?.address_components, "country").shortName;
  const postalCode = addressComponent(place?.address_components, "postal_code").longName;

  return {
    displayName: place?.name ?? place?.formatted_address ?? "Selected place",
    formattedAddress: place?.formatted_address ?? null,
    addressLine1: [streetNumber, route].filter(Boolean).join(" ") || null,
    addressLine2: subpremise ?? sublocality ?? null,
    city: locality ?? sublocality ?? null,
    region: administrativeArea,
    countryCode,
    postalCode,
    latitude: place?.geometry?.location?.lat?.() ?? null,
    longitude: place?.geometry?.location?.lng?.() ?? null,
    providerPlaceId: place?.place_id ?? null,
    googleMapsUrl: place?.url ?? buildGoogleMapsUrl({ placeId: place?.place_id }),
  };
}

export async function loadGoogleMapsApi(params: {
  apiKey: string;
  libraries?: GoogleMapsLoaderLibrary[];
  language?: string;
  region?: string;
}) {
  ensureBrowser();
  const globalWindow = window as unknown as Window & typeof globalThis & {
    google?: GoogleMapsNamespace;
    [key: string]: unknown;
  };

  if (globalWindow.google?.maps) {
    return globalWindow.google;
  }

  if (!googleMapsLoaderPromise) {
    googleMapsLoaderPromise = new Promise<void>((resolve, reject) => {
      const callbackName = `__nkGoogleMapsInit_${Date.now()}`;
      const script = document.createElement("script");
      const url = new URL("https://maps.googleapis.com/maps/api/js");

      url.searchParams.set("key", params.apiKey);
      url.searchParams.set("loading", "async");
      url.searchParams.set("callback", callbackName);
      if (params.libraries?.length) {
        url.searchParams.set("libraries", params.libraries.join(","));
      }
      if (params.language) {
        url.searchParams.set("language", params.language);
      }
      if (params.region) {
        url.searchParams.set("region", params.region);
      }

      globalWindow[callbackName] = () => {
        delete globalWindow[callbackName];
        resolve();
      };

      script.async = true;
      script.defer = true;
      script.src = url.toString();
      script.onerror = () => {
        delete globalWindow[callbackName];
        googleMapsLoaderPromise = null;
        reject(new Error("Google Maps failed to load."));
      };

      document.head.appendChild(script);
    });
  }

  await googleMapsLoaderPromise;
  if (!globalWindow.google?.maps) {
    throw new Error("Google Maps did not initialize correctly.");
  }
  return globalWindow.google;
}
