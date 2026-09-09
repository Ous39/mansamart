import { useEffect, useRef } from "react";
import { Alert, Platform } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getProfileRouteForRole } from "@/lib/role-routing";

const TEN_MINUTES = 10 * 60 * 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export function IncompleteProfileReminder() {
  const { user, isAuthenticated } = useAuth();
  const lastShownRef = useRef(0);
  const isSellerRole = user?.role === "vendor" || user?.role === "service_provider" || user?.role === "delivery_rider";
  const { data } = useQuery<any>({
    queryKey: ["/api/profile/completion"],
    enabled: isAuthenticated && !!isSellerRole,
    refetchInterval: TEN_MINUTES,
  });
  const missingItems = data?.missingItems;

  useEffect(() => {
    if (!user || !isSellerRole || !data?.restricted) return;
    const created = user.createdAt ? new Date(user.createdAt).getTime() : Date.now();
    const olderThan24h = Date.now() - created >= TWENTY_FOUR_HOURS;
    if (!olderThan24h) return;
    if (Date.now() - lastShownRef.current < TEN_MINUTES) return;
    lastShownRef.current = Date.now();
    const missing = Array.isArray(missingItems) ? missingItems.slice(0, 5).join(", ") : "profile details";
    const openProfile = () => router.push(getProfileRouteForRole(user.role) as any);
    if (Platform.OS === "web") {
      // Alert works on web too, but this keeps the logic simple and consistent.
      Alert.alert("Complete your MansaMart profile", `Missing: ${missing}. Some features stay restricted until your profile is completed and approved.`, [{ text: "Later" }, { text: "Complete now", onPress: openProfile }]);
    } else {
      Alert.alert("Complete your MansaMart profile", `Missing: ${missing}. Some features stay restricted until your profile is completed and approved.`, [{ text: "Later" }, { text: "Complete now", onPress: openProfile }]);
    }
  }, [user, isSellerRole, data?.restricted, missingItems]);

  return null;
}
