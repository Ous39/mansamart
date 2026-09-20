import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";

type Payment = {
  id: string;
  orderId: string;
  status: "pending" | "processing" | "succeeded" | "failed" | "expired" | "refunded";
  amount: number;
  currency: string;
  failureMessage?: string | null;
};

const terminalStatuses = new Set(["succeeded", "failed", "expired", "refunded"]);

export default function PaymentStatusScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ paymentId?: string; orderId?: string }>();
  const [paymentId, setPaymentId] = useState(params.paymentId || "");
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!paymentId) return;
    try {
      const response = await apiRequest("GET", `/api/payments/${paymentId}`);
      setPayment(await response.json());
      setError("");
    } catch (cause: any) {
      setError(cause?.message || "Unable to check the payment");
    }
  }, [paymentId]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (!payment || !terminalStatuses.has(payment.status)) void refresh();
    }, 3_000);
    return () => clearInterval(timer);
  }, [payment, refresh]);

  const retry = async () => {
    const orderId = payment?.orderId || params.orderId;
    if (!orderId) return;
    setBusy(true);
    setError("");
    try {
      const response = await apiRequest("POST", "/api/payments/wave/checkout", { orderId });
      const next = await response.json();
      setPaymentId(next.id);
      setPayment(next);
      await WebBrowser.openBrowserAsync(next.launchUrl);
      await refresh();
    } catch (cause: any) {
      setError(cause?.message || "Unable to restart Wave payment");
    } finally {
      setBusy(false);
    }
  };

  const status = payment?.status || "processing";
  const succeeded = status === "succeeded";
  const failed = status === "failed" || status === "expired";
  const refunded = status === "refunded";
  const icon = succeeded ? "checkmark" : failed ? "close" : refunded ? "return-down-back" : "time-outline";
  const accent = succeeded ? Colors.success : failed ? Colors.error : refunded ? Colors.accent : Colors.primary;
  const title = succeeded ? "Payment confirmed" : failed ? "Payment not completed" : refunded ? "Payment refunded" : "Confirming your payment";
  const message = succeeded
    ? "Wave confirmed your payment. The business can now process your order."
    : failed
      ? payment?.failureMessage || "The Wave payment failed or expired. You can safely try again."
      : refunded
        ? "This Wave payment has been returned."
        : "Complete the payment in Wave, then return here. Confirmation may take a few seconds.";

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 50 : 20), paddingBottom: insets.bottom + 20 }]}>
      <View style={[styles.icon, { backgroundColor: `${accent}18`, borderColor: accent }]}>
        {payment ? <Ionicons name={icon as any} size={52} color={accent} /> : <ActivityIndicator size="large" color={accent} />}
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {payment && <View style={styles.receipt}>
        <View><Text>Order</Text><Text>{payment.orderId.slice(0, 8).toUpperCase()}</Text></View>
        <View><Text>Amount</Text><Text>D {payment.amount.toLocaleString()}</Text></View>
        <View><Text>Status</Text><Text style={{ color: accent }}>{payment.status}</Text></View>
      </View>}
      {!!error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.actions}>
        {!succeeded && !refunded && <Pressable style={styles.primary} onPress={failed ? retry : refresh} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{failed ? "Try Wave again" : "Check payment again"}</Text>}
        </Pressable>}
        <Pressable
          style={styles.secondary}
          onPress={() => {
            const orderId = payment?.orderId || params.orderId;
            if (orderId) router.replace({ pathname: "/order/[id]", params: { id: orderId } });
            else router.replace("/(tabs)");
          }}
        >
          <Text style={styles.secondaryText}>{payment ? "View order" : "Back to MansaMart"}</Text>
        </Pressable>
      </View>
      <Text style={styles.security}>Payment confirmation comes directly from Wave. A browser redirect alone cannot mark an order as paid.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 24, alignItems: "center", justifyContent: "center" },
  icon: { width: 104, height: 104, borderRadius: 52, borderWidth: 2, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  title: { fontFamily: "Inter_700Bold", fontSize: 27, color: Colors.text, textAlign: "center" },
  message: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 23, color: Colors.textSecondary, textAlign: "center", maxWidth: 430, marginTop: 10 },
  receipt: { width: "100%", maxWidth: 430, backgroundColor: Colors.surface, borderRadius: 16, padding: 18, marginTop: 26, gap: 14 },
  actions: { width: "100%", maxWidth: 430, gap: 10, marginTop: 22 },
  primary: { minHeight: 52, borderRadius: 13, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
  secondary: { minHeight: 50, borderRadius: 13, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center", backgroundColor: Colors.surface },
  secondaryText: { color: Colors.text, fontFamily: "Inter_600SemiBold" },
  error: { color: Colors.error, marginTop: 14, textAlign: "center" },
  security: { maxWidth: 430, color: Colors.textMuted, fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 22 },
});
