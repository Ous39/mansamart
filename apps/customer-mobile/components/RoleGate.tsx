import React, { useEffect } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import { displayRoleLabel, getHomeRouteForRole } from "@/lib/role-routing";

interface RoleGateProps {
  allowed: UserRole[];
  children: React.ReactNode;
}

export function RoleGate({ allowed, children }: RoleGateProps) {
  const { user, isLoading } = useAuth();
  const isAllowed = !!user && allowed.includes(user.role);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/(auth)/login" as any);
      return;
    }
    if (!isAllowed) {
      router.replace(getHomeRouteForRole(user.role) as any);
    }
  }, [isLoading, user, isAllowed]);

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;
  }

  if (!user) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;
  }

  if (!isAllowed) {
    return (
      <View style={styles.center}>
        <Ionicons name="shield-half-outline" size={58} color={Colors.primary} />
        <Text style={styles.title}>Wrong panel</Text>
        <Text style={styles.body}>This account is {displayRoleLabel(user.role)}. It cannot open the {allowed.map(displayRoleLabel).join(" / ")} panel.</Text>
        <Pressable style={styles.btn} onPress={() => router.replace(getHomeRouteForRole(user.role) as any)}>
          <Text style={styles.btnText}>Open my correct dashboard</Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.background, padding: 24 },
  title: { marginTop: 14, fontSize: 20, fontWeight: "800", color: Colors.text },
  body: { marginTop: 8, textAlign: "center", color: Colors.textMuted, lineHeight: 20 },
  btn: { marginTop: 18, backgroundColor: Colors.primary, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 13 },
  btnText: { color: "#fff", fontWeight: "800" },
});
