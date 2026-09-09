import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { apiRequest, queryClient } from "@/lib/query-client";
import { safeBack } from "@/lib/navigation";

export default function ScanOrderScreen() {
  const { stage, orderId } = useLocalSearchParams<{ stage?: "pickup" | "delivery"; orderId?: string }>();
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
      const res = await apiRequest("POST", "/api/orders/verify-qr", { code: cleanCode });
      const data = await res.json();
      setResult(data);
      setCode("");
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rider/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      Alert.alert("Verified", data.message || "Order QR verification completed.");
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
        <Text style={styles.title}>{stage === "pickup" ? "Verify Pickup" : stage === "delivery" ? "Verify Delivery" : "Verify Handover"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.hero}>
        <View style={styles.scanCircle}>
          <Ionicons name="scan-outline" size={54} color={Colors.primary} />
        </View>
        <Text style={styles.heroTitle}>{stage === "pickup" ? "Vendor handover" : stage === "delivery" ? "Customer handover" : "One-time QR verification"}</Text>
        <Text style={styles.heroText}>{stage === "pickup" ? "Enter the pickup code shown by the seller. Only the assigned rider can use it." : stage === "delivery" ? "Ask the customer for their delivery code after handing over the order. This releases the delivery payment." : "Enter the one-time code shown by the correct handover party. The code cannot be reused."}</Text>
      </View>

      <View style={styles.card}>
        {orderId && <Text style={styles.orderHint}>Order #{String(orderId).slice(0, 8).toUpperCase()}</Text>}
        <Text style={styles.label}>One-time verification code</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="Enter the code from the QR"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="characters"
        />
        <Pressable style={[styles.primaryBtn, loading && { opacity: 0.7 }]} onPress={verify} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <><Ionicons name="shield-checkmark-outline" size={18} color="#fff" /><Text style={styles.primaryText}>Verify handover</Text></>}
        </Pressable>
      </View>

      {result?.order?.id ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>{result.message || "Order verified"}</Text>
          <Text style={styles.resultText}>Status: {String(result.order.status || "updated").replace(/_/g, " ")}</Text>
          <Pressable style={styles.secondaryBtn} onPress={() => router.push(`/order/${result.order.id}` as any)}>
            <Text style={styles.secondaryText}>Open Order Tracking</Text>
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
  orderHint: { alignSelf: "flex-start", backgroundColor: Colors.primaryLight, color: Colors.primary, borderRadius: 10, overflow: "hidden", paddingHorizontal: 10, paddingVertical: 6, fontFamily: "Inter_700Bold", fontSize: 11, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontFamily: "Inter_500Medium", color: Colors.text, marginBottom: 14 },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: 14, minHeight: 50, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  primaryText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
  resultCard: { marginTop: 18, backgroundColor: "#ECFDF5", borderColor: "#A7F3D0", borderWidth: 1, borderRadius: 18, padding: 16 },
  resultTitle: { fontFamily: "Inter_700Bold", color: "#065F46", fontSize: 16 },
  resultText: { fontFamily: "Inter_500Medium", color: "#047857", marginTop: 6 },
  secondaryBtn: { marginTop: 12, alignSelf: "flex-start", backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  secondaryText: { color: Colors.primary, fontFamily: "Inter_700Bold" },
});
