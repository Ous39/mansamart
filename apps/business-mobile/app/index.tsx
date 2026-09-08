import React, { useEffect } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { getDefaultRouteForRole } from "@/lib/role-routes";

export default function BusinessWelcome() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace(getDefaultRouteForRole(user?.role) as any);
  }, [isAuthenticated, isLoading, user?.role]);

  if (isLoading) return <View style={styles.loading}><ActivityIndicator color="#0EA47A" /></View>;

  return (
    <LinearGradient colors={["#073D35", "#0EA47A"]} style={[styles.page, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 }]}>
      <View style={styles.brand}>
        <View style={styles.icon}><Ionicons name="storefront" size={34} color="#0EA47A" /></View>
        <Text style={styles.name}>MansaMart Business</Text>
        <Text style={styles.tagline}>One workspace for Gambian vendors and service providers.</Text>
      </View>
      <View style={styles.cards}>
        <View style={styles.card}><Ionicons name="cube-outline" size={25} color="#0EA47A" /><Text style={styles.cardTitle}>Sell products</Text><Text style={styles.cardText}>Manage stock, orders, promotions and earnings.</Text></View>
        <View style={styles.card}><Ionicons name="construct-outline" size={25} color="#D8843B" /><Text style={styles.cardTitle}>Offer services</Text><Text style={styles.cardText}>Publish services and manage customer bookings.</Text></View>
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.primary} onPress={() => router.push("/(auth)/login")}><Text style={styles.primaryText}>Sign in to your business</Text></Pressable>
        <Pressable style={styles.secondary} onPress={() => router.push("/(auth)/register")}><Text style={styles.secondaryText}>Create business account</Text></Pressable>
        <Text style={styles.note}>Customer and rider accounts use their dedicated MansaMart apps.</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 24, justifyContent: "space-between" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  brand: { alignItems: "center", marginTop: 20 },
  icon: { width: 72, height: 72, borderRadius: 22, backgroundColor: "white", alignItems: "center", justifyContent: "center", marginBottom: 18 },
  name: { color: "white", fontSize: 30, fontFamily: "Inter_700Bold", textAlign: "center" },
  tagline: { color: "rgba(255,255,255,.78)", fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 10, maxWidth: 340 },
  cards: { gap: 12 }, card: { backgroundColor: "white", borderRadius: 18, padding: 18 },
  cardTitle: { color: "#172321", fontSize: 17, fontFamily: "Inter_700Bold", marginTop: 10 },
  cardText: { color: "#66726F", fontSize: 13, lineHeight: 19, marginTop: 4 }, actions: { gap: 12 },
  primary: { height: 54, borderRadius: 15, backgroundColor: "white", alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#08785A", fontFamily: "Inter_700Bold", fontSize: 15 },
  secondary: { height: 54, borderRadius: 15, borderWidth: 1, borderColor: "rgba(255,255,255,.45)", alignItems: "center", justifyContent: "center" },
  secondaryText: { color: "white", fontFamily: "Inter_600SemiBold", fontSize: 15 },
  note: { color: "rgba(255,255,255,.65)", textAlign: "center", fontSize: 12, lineHeight: 17, marginTop: 2 },
});
