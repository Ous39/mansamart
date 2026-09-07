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
    if (role !== "admin") router.replace(getDefaultRouteForRole(role) as any);
  }, [isLoading, user?.id, role]);

  if (isLoading || !user || role !== "admin") return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="users" />
      <Stack.Screen name="vendors" />
      <Stack.Screen name="products" />
      <Stack.Screen name="services" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="riders" />
      <Stack.Screen name="finance" />
      <Stack.Screen name="verification" />
    </Stack>
  );
}
