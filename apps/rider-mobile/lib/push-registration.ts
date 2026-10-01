import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { apiRequest } from "@/lib/query-client";

let registeredForUser: string | null = null;

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
}

export function subscribeToNotificationNavigation(onRoute: (route: string) => void) {
  if (Platform.OS === "web") return () => {};
  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    const route = response.notification.request.content.data?.actionRoute;
    if (typeof route === "string" && route.startsWith("/")) onRoute(route);
  });
  return () => subscription.remove();
}

export async function registerPushDevice(userId: string): Promise<void> {
  if (registeredForUser === userId || Platform.OS === "web" || !Device.isDevice) return;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "MansaMart updates",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === "granted" ? current : await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") return;

  const projectId = Constants.easConfig?.projectId || (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;
  if (!projectId) return;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await apiRequest("POST", "/api/notifications/devices", {
    expoPushToken: token,
    platform: Platform.OS,
    deviceName: Device.modelName || Device.deviceName || `${Platform.OS} device`,
  });
  registeredForUser = userId;
}

export function resetPushRegistration(): void {
  registeredForUser = null;
}
