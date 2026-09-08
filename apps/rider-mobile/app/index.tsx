import React, { useEffect } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";

export default function RiderWelcome() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isLoading } = useAuth();
  useEffect(() => { if (!isLoading && isAuthenticated) router.replace("/(rider)"); }, [isAuthenticated, isLoading]);
  if (isLoading) return <View style={styles.loading}><ActivityIndicator color="#2563EB" /></View>;
  return (
    <LinearGradient colors={["#071B3B", "#174EA6", "#2563EB"]} style={[styles.page, { paddingTop: insets.top + 34, paddingBottom: insets.bottom + 28 }]}>
      <View style={styles.hero}>
        <View style={styles.icon}><Ionicons name="bicycle" size={38} color="#2563EB" /></View>
        <Text style={styles.name}>MansaMart Rider</Text>
        <Text style={styles.tagline}>Deliver safely. Earn clearly. Keep The Gambia moving.</Text>
      </View>
      <View style={styles.list}>
        {["Receive nearby delivery offers", "Navigate to pickup and drop-off", "Verify handovers with secure QR codes", "Track earnings and payouts"].map((item) => (
          <View style={styles.row} key={item}><Ionicons name="checkmark-circle" size={21} color="#93C5FD" /><Text style={styles.rowText}>{item}</Text></View>
        ))}
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.primary} onPress={() => router.push("/(auth)/login")}><Text style={styles.primaryText}>Rider sign in</Text></Pressable>
        <Pressable style={styles.secondary} onPress={() => router.push("/(auth)/register")}><Text style={styles.secondaryText}>Apply as a rider</Text></Pressable>
        <Text style={styles.note}>Only approved delivery-rider accounts can access delivery operations.</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 26, justifyContent: "space-between" }, loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: { alignItems: "center", marginTop: 24 }, icon: { width: 78, height: 78, borderRadius: 24, backgroundColor: "white", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  name: { color: "white", fontSize: 30, fontFamily: "Inter_700Bold" }, tagline: { color: "rgba(255,255,255,.78)", fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 10, maxWidth: 330 },
  list: { gap: 12 }, row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(255,255,255,.1)", borderRadius: 14, padding: 15 },
  rowText: { color: "white", fontFamily: "Inter_500Medium", fontSize: 14, flex: 1 }, actions: { gap: 12 },
  primary: { height: 54, borderRadius: 15, backgroundColor: "white", alignItems: "center", justifyContent: "center" }, primaryText: { color: "#174EA6", fontFamily: "Inter_700Bold", fontSize: 15 },
  secondary: { height: 54, borderRadius: 15, borderWidth: 1, borderColor: "rgba(255,255,255,.5)", alignItems: "center", justifyContent: "center" }, secondaryText: { color: "white", fontFamily: "Inter_600SemiBold", fontSize: 15 },
  note: { color: "rgba(255,255,255,.65)", textAlign: "center", fontSize: 12, lineHeight: 17 },
});
