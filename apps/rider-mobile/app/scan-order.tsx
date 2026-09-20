import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { apiRequest, queryClient } from "@/lib/query-client";
import { safeBack } from "@/lib/navigation";

export default function ScanOrderScreen() {
  const { orderId, purpose } = useLocalSearchParams<{ orderId?: string; purpose?: "pickup" | "delivery" }>();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const verify = async () => {
    const cleanCode = code.trim();
    if (!cleanCode) {
      Alert.alert("QR code required", "Enter or paste the order QR code first.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const endpoint = orderId && purpose
        ? `/api/orders/${orderId}/confirm-${purpose}-qr`
        : "/api/orders/verify-qr";
      const res = await apiRequest("POST", endpoint, { code: cleanCode });
      const data = await res.json();
      setResult(data);
      setCode("");
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rider/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      const message = purpose === "pickup"
        ? "Vendor pickup confirmed. Customer navigation is now unlocked."
        : purpose === "delivery"
          ? "Customer delivery confirmed."
          : data.message || "Order QR verification completed.";
      Alert.alert("Verified", message);
    } catch (err: any) {
      Alert.alert("Verification failed", err?.message || "Invalid, expired, or already used QR code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => safeBack("/")} hitSlop={8} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={23} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>{purpose === "pickup" ? "Confirm Pickup" : purpose === "delivery" ? "Confirm Delivery" : "Scan Order"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.hero}>
        <View style={styles.scanCircle}>
          <Ionicons name="scan-outline" size={54} color={Colors.primary} />
        </View>
        <Text style={styles.heroTitle}>{purpose === "pickup" ? "Vendor Handover" : purpose === "delivery" ? "Customer Handover" : "Order QR Verification"}</Text>
        <Text style={styles.heroText}>{purpose === "pickup" ? "Enter the vendor's pickup code. Customer navigation unlocks only after successful confirmation." : purpose === "delivery" ? "Enter the customer's delivery code to confirm the order arrived safely." : "Use this for vendor-to-rider pickup and rider-to-shopper delivery confirmation."}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Order QR Code</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder={purpose === "pickup" ? "Enter vendor pickup code" : purpose === "delivery" ? "Enter customer delivery code" : "Paste or type QR code"}
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="characters"
        />
        <Pressable style={[styles.primaryBtn, loading && { opacity: 0.7 }]} onPress={verify} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <><Ionicons name="shield-checkmark-outline" size={18} color="#fff" /><Text style={styles.primaryText}>Verify Order</Text></>}
        </Pressable>
      </View>

      {result?.order?.id ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>{result.message || "Order verified"}</Text>
          <Text style={styles.resultText}>Status: {String(result.order.status || "updated").replace(/_/g, " ")}</Text>
          <Pressable style={styles.secondaryBtn} onPress={() => router.push(`/order/${result.order.id}` as any)}>
            <Text style={styles.secondaryText}>{purpose === "pickup" ? "Continue to customer map" : "Open Order Tracking"}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 20, paddingTop: 58 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  iconBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text },
  hero: { alignItems: "center", marginTop: 10, marginBottom: 22 },
  scanCircle: { width: 120, height: 120, borderRadius: 36, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  heroTitle: { fontFamily: "Inter_700Bold", fontSize: 24, color: Colors.text, textAlign: "center" },
  heroText: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 21, marginTop: 8, paddingHorizontal: 10 },
  card: { backgroundColor: Colors.surface, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: Colors.border },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontFamily: "Inter_500Medium", color: Colors.text, marginBottom: 14 },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: 14, minHeight: 50, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  primaryText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
  resultCard: { marginTop: 18, backgroundColor: "#ECFDF5", borderColor: "#A7F3D0", borderWidth: 1, borderRadius: 18, padding: 16 },
  resultTitle: { fontFamily: "Inter_700Bold", color: "#065F46", fontSize: 16 },
  resultText: { fontFamily: "Inter_500Medium", color: "#047857", marginTop: 6 },
  secondaryBtn: { marginTop: 12, alignSelf: "flex-start", backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  secondaryText: { color: Colors.primary, fontFamily: "Inter_700Bold" },
});
