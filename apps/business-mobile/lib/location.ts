import * as Location from "expo-location";
import { apiRequest } from "@/lib/query-client";

export type DeviceLocationPayload = {
  latitude: number;
  longitude: number;
  locationAccuracy?: number;
  city?: string;
  region?: string;
  district?: string;
  area?: string;
};

export async function requestCurrentLocation(): Promise<DeviceLocationPayload | null> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") return null;

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  let place: Location.LocationGeocodedAddress | undefined;
  try {
    const places = await Location.reverseGeocodeAsync(position.coords);
    place = places?.[0];
  } catch {
    place = undefined;
  }

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    locationAccuracy: position.coords.accuracy ?? undefined,
    city: place?.city || place?.subregion || undefined,
    region: place?.region || undefined,
    district: place?.district || undefined,
    area: place?.name || place?.street || place?.district || place?.city || undefined,
  };
}

export async function syncMyLocation(payload: DeviceLocationPayload) {
  const res = await apiRequest("PUT", "/api/location/me", payload);
  return res.json();
}

export async function requestAndSyncMyLocation() {
  const location = await requestCurrentLocation();
  if (!location) return null;
  return syncMyLocation(location);
}
