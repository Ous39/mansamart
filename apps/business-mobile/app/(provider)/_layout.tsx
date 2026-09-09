import { Stack, router } from "expo-router";
import React, { useEffect } from "react";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { getDefaultRouteForRole, normalizeRole } from "@/lib/role-routes";

export default function RoleLayout() {
  const { user, isLoading } = useAuth();
  const role = normalizeRole(user?.role);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace("/(auth)/login"); return; }
    if (role !== "service_provider") router.replace(getDefaultRouteForRole(role) as any);
  }, [isLoading, user, role]);

  if (isLoading || !user || role !== "service_provider") return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="services" />
      <Stack.Screen name="add-service" />
      <Stack.Screen name="bookings" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
