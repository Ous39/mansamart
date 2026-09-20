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
    if (role !== "vendor") router.replace(getDefaultRouteForRole(role) as any);
  }, [isLoading, user?.id, role]);

  if (isLoading || !user || role !== "vendor") return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="products" />
      <Stack.Screen name="add-product" />
      <Stack.Screen name="edit-product" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="tools" />
      <Stack.Screen name="whatsapp" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
