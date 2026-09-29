import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { getApiUrl } from "@/lib/query-client";
import { getToken, loadToken } from "@/lib/auth-token";

const TASK_NAME = "mansamart-active-delivery-location";
const ACTIVE_DELIVERY_KEY = "mansamart:active-delivery-id";
const PENDING_LOCATION_KEY = "mansamart:pending-delivery-location";

export type DeliveryLocationPayload = {
  deliveryId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  recordedAt: string;
};

let syncInFlight: Promise<boolean> | null = null;

async function send(payload: DeliveryLocationPayload) {
  await loadToken();
  const token = getToken();
  if (!token) throw new Error("Rider is not signed in");
  const response = await fetch(new URL("/api/rider/location", getApiUrl()).toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-MansaMart-App": process.env.EXPO_PUBLIC_APP_AUDIENCE || "rider",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Location sync failed (${response.status})`);
}

export async function flushPendingDeliveryLocation(): Promise<boolean> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    const raw = await AsyncStorage.getItem(PENDING_LOCATION_KEY);
    if (!raw) return true;
    const payload = JSON.parse(raw) as DeliveryLocationPayload;
    try {
      await send(payload);
      const latest = await AsyncStorage.getItem(PENDING_LOCATION_KEY);
      if (latest === raw) await AsyncStorage.removeItem(PENDING_LOCATION_KEY);
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

export async function queueDeliveryLocation(payload: DeliveryLocationPayload) {
  await AsyncStorage.setItem(PENDING_LOCATION_KEY, JSON.stringify(payload));
  return flushPendingDeliveryLocation();
}

export function payloadFromLocation(deliveryId: string, location: Location.LocationObject): DeliveryLocationPayload {
  const { coords } = location;
  return {
    deliveryId,
    latitude: coords.latitude,
    longitude: coords.longitude,
    ...(typeof coords.accuracy === "number" ? { accuracy: coords.accuracy } : {}),
    ...(typeof coords.heading === "number" ? { heading: coords.heading } : {}),
    ...(typeof coords.speed === "number" ? { speed: coords.speed } : {}),
    recordedAt: new Date(location.timestamp).toISOString(),
  };
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TASK_NAME, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const deliveryId = await AsyncStorage.getItem(ACTIVE_DELIVERY_KEY);
  if (!deliveryId) return;
  const latest = data.locations[data.locations.length - 1];
  await queueDeliveryLocation(payloadFromLocation(deliveryId, latest));
});

export async function startBackgroundDeliveryTracking(deliveryId: string): Promise<boolean> {
  await AsyncStorage.setItem(ACTIVE_DELIVERY_KEY, deliveryId);
  const foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== "granted") return false;
  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== "granted") return false;
  const running = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
  if (running) return true;
  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 15_000,
    distanceInterval: 25,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "MansaMart delivery active",
      notificationBody: "Sharing your route with the customer during this delivery.",
      notificationColor: "#0EA47A",
    },
  });
  return true;
}

export async function stopBackgroundDeliveryTracking() {
  await AsyncStorage.removeItem(ACTIVE_DELIVERY_KEY);
  await AsyncStorage.removeItem(PENDING_LOCATION_KEY);
  const running = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
  if (running) await Location.stopLocationUpdatesAsync(TASK_NAME);
}
