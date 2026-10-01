import React from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import Colors from "@/constants/colors";

export default function SettingsRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={Colors.primary} /></View>;
  if (!user) return <Redirect href="/(auth)/login" />;
  return user.role === "service_provider" ? <Redirect href="/(provider)/settings" /> : <Redirect href="/(vendor)/settings" />;
}
