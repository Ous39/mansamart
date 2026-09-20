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
    if (role !== "delivery_rider") router.replace(getDefaultRouteForRole(role) as any);
  }, [isLoading, user?.id, role]);

  if (isLoading || !user || role !== "delivery_rider") return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="deliveries" />
      <Stack.Screen name="earnings" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
