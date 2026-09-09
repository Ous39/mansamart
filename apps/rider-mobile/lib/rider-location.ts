import * as Location from "expo-location";
import { apiRequest } from "@/lib/query-client";

export async function readForegroundLocation() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") throw new Error("Location permission is required while you are online.");
  const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return {
    latitude: current.coords.latitude,
    longitude: current.coords.longitude,
    accuracy: current.coords.accuracy ?? undefined,
    heading: current.coords.heading != null && current.coords.heading >= 0 ? current.coords.heading : undefined,
    speed: current.coords.speed ?? undefined,
  };
}

export async function shareForegroundLocation(deliveryId?: string) {
  const location = await readForegroundLocation();
  const response = await apiRequest("POST", "/api/rider/location", { ...location, deliveryId });
  return response.json();
}
