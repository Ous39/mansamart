import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { safeBack } from "@/lib/navigation";

function money(value?: number) {
  return `D ${(Number(value) || 0).toLocaleString()}`;
}

function shortId(id?: string) {
  return String(id || "").slice(0, 8).toUpperCase() || "—";
}

export default function RiderEarningsScreen() {
  const { data, isLoading, refetch, isFetching } = useQuery<any>({ queryKey: ["/api/rider/dashboard"], refetchInterval: 15000 });
  const earnings = data?.earnings ?? [];
  const total = Number(data?.totalEarnings || 0);
  const completed = Number(data?.metrics?.completed || earnings.length || 0);
  const average = completed > 0 ? Math.round(total / completed) : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={Colors.primary} />}
    >
      <View style={styles.header}>
        <Pressable onPress={() => safeBack("/(rider)")} style={styles.iconBtn}><Ionicons name="chevron-back" size={24} color={Colors.text} /></Pressable>
        <Text style={styles.title}>Earnings</Text>
        <Pressable onPress={() => router.push("/wallet" as any)} style={styles.iconBtn}><Ionicons name="wallet-outline" size={22} color={Colors.primary} /></Pressable>
      </View>

      {isLoading ? <ActivityIndicator color={Colors.primary} /> : (
        <>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Total rider earnings</Text>
            <Text style={styles.balance}>{money(total)}</Text>
            <Text style={styles.balanceHint}>Released after delivery confirmation and escrow completion.</Text>
          </View>

          <View style={styles.metricGrid}>
            <Metric label="Completed" value={String(completed)} icon="checkmark-done-outline" />
            <Metric label="Average fee" value={money(average)} icon="analytics-outline" />
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.primaryBtn} onPress={() => router.push("/wallet" as any)}><Ionicons name="wallet-outline" size={18} color="#fff" /><Text style={styles.primaryText}>Open wallet</Text></Pressable>
            <Pressable style={styles.secondaryBtn} onPress={() => router.push("/(rider)/deliveries" as any)}><Ionicons name="bicycle-outline" size={18} color={Colors.primary} /><Text style={styles.secondaryText}>Deliveries</Text></Pressable>
          </View>

          <Text style={styles.sectionTitle}>Recent payouts</Text>
          {earnings.map((item: any) => (
            <View key={item.id} style={styles.row}>
              <View style={styles.rowIcon}><Ionicons name="cash-outline" size={18} color={Colors.primary} /></View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>Order #{shortId(item.orderId)}</Text>
                <Text style={styles.rowSub}>{item.status || "completed"} • {item.paidAt ? new Date(item.paidAt).toLocaleDateString() : "Pending payout date"}</Text>
              </View>
              <Text style={styles.amount}>{money(item.amount)}</Text>
            </View>
          ))}
          {earnings.length === 0 && <Text style={styles.empty}>No rider earnings yet. Completed deliveries will appear here.</Text>}
        </>
      )}
    </ScrollView>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.metricCard}>
      <Ionicons name={icon} size={20} color={Colors.primary} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingTop: 60, paddingBottom: 36 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.text },
  balanceCard: { backgroundColor: Colors.text, borderRadius: 26, padding: 22, marginBottom: 16 },
  balanceLabel: { color: "rgba(255,255,255,0.72)", fontFamily: "Inter_600SemiBold" },
  balance: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 34, marginTop: 6 },
  balanceHint: { color: "rgba(255,255,255,0.68)", fontFamily: "Inter_400Regular", marginTop: 8, lineHeight: 20 },
  metricGrid: { flexDirection: "row", gap: 12, marginBottom: 14 },
  metricCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: Colors.borderLight },
  metricValue: { color: Colors.text, fontFamily: "Inter_700Bold", fontSize: 20, marginTop: 8 },
  metricLabel: { color: Colors.textMuted, fontFamily: "Inter_500Medium", marginTop: 4 },
  actions: { flexDirection: "row", gap: 12, marginBottom: 18 },
  primaryBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: 14, padding: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  primaryText: { color: "#fff", fontFamily: "Inter_700Bold" },
  secondaryBtn: { flex: 1, backgroundColor: Colors.primaryLight, borderRadius: 14, padding: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  secondaryText: { color: Colors.primary, fontFamily: "Inter_700Bold" },
  sectionTitle: { fontFamily: "Inter_700Bold", color: Colors.text, fontSize: 16, marginBottom: 10 },
  row: { backgroundColor: Colors.surface, borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: Colors.borderLight },
  rowIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center", marginRight: 12 },
  rowBody: { flex: 1 },
  rowTitle: { fontFamily: "Inter_700Bold", color: Colors.text },
  rowSub: { fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 3, fontSize: 12 },
  amount: { fontFamily: "Inter_700Bold", color: Colors.primary },
  empty: { color: Colors.textMuted, textAlign: "center", marginTop: 18, fontFamily: "Inter_500Medium" },
});
