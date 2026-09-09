import React from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { safeBack } from "@/lib/navigation";

function money(value?: number) { return `D ${(Number(value) || 0).toLocaleString()}`; }
function shortId(value?: string) { return String(value || "").slice(0, 8).toUpperCase() || "—"; }

export default function RiderEarningsScreen() {
  const { data, isLoading, isFetching, refetch } = useQuery<any>({ queryKey: ["/api/rider/finance"], refetchInterval: 15000 });
  const earnings = data?.earnings ?? [];
  return <ScrollView style={styles.page} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={Colors.primary} />}>
    <View style={styles.header}><Pressable style={styles.iconBtn} onPress={() => safeBack("/(rider)")}><Ionicons name="chevron-back" size={23} color={Colors.text} /></Pressable><View style={styles.flex}><Text style={styles.eyebrow}>RIDER FINANCE</Text><Text style={styles.title}>Earnings</Text></View><Pressable style={styles.iconBtn} onPress={() => router.push("/wallet" as any)}><Ionicons name="wallet-outline" size={21} color={Colors.primary} /></Pressable></View>
    {isLoading ? <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View> : <>
      <View style={styles.hero}><Text style={styles.heroLabel}>Total delivery earnings</Text><Text style={styles.heroValue}>{money(data?.summary?.totalEarned)}</Text><Text style={styles.heroText}>Earnings appear only after customer delivery verification releases the order payment.</Text></View>
      <View style={styles.metrics}><Metric label="Available" value={money(data?.summary?.availableForPayout)} icon="cash-outline" /><Metric label="Payout pending" value={money(data?.summary?.pendingPayout)} icon="time-outline" /></View>
      <Pressable style={styles.payoutButton} onPress={() => router.push("/wallet" as any)}><Ionicons name="arrow-up-circle-outline" size={19} color="#fff" /><Text style={styles.payoutText}>View wallet and request payout</Text></Pressable>
      <Text style={styles.sectionTitle}>Recent delivery earnings</Text>
      {earnings.map((earning: any) => <View key={earning.id} style={styles.row}><View style={styles.rowIcon}><Ionicons name="bicycle-outline" size={19} color={Colors.primary} /></View><View style={styles.flex}><Text style={styles.rowTitle}>Order #{shortId(earning.orderId)}</Text><Text style={styles.rowSub}>{earning.paidAt ? new Date(earning.paidAt).toLocaleDateString() : "Awaiting release"} · {earning.status}</Text></View><Text style={styles.amount}>+{money(earning.amount)}</Text></View>)}
      {earnings.length === 0 && <View style={styles.empty}><Ionicons name="receipt-outline" size={29} color={Colors.primary} /><Text style={styles.emptyTitle}>No earnings yet</Text><Text style={styles.emptyText}>Complete a delivery with the customer’s one-time code to release your delivery fee.</Text></View>}
    </>}
  </ScrollView>;
}

function Metric({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) { return <View style={styles.metric}><Ionicons name={icon} size={19} color={Colors.primary} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F7FB" }, content: { padding: 18, paddingTop: 58, paddingBottom: 40 }, flex: { flex: 1 }, loading: { paddingVertical: 80 }, header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 }, iconBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E2E8F0" }, eyebrow: { color: Colors.primary, fontSize: 9, letterSpacing: 1.3, fontFamily: "Inter_700Bold" }, title: { color: Colors.text, fontSize: 23, fontFamily: "Inter_700Bold", marginTop: 2 },
  hero: { backgroundColor: "#0F172A", borderRadius: 23, padding: 20, marginBottom: 12 }, heroLabel: { color: "#94A3B8", fontFamily: "Inter_600SemiBold", fontSize: 12 }, heroValue: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 35, marginTop: 6 }, heroText: { color: "#CBD5E1", fontSize: 11, lineHeight: 17, marginTop: 9 }, metrics: { flexDirection: "row", gap: 10, marginBottom: 12 }, metric: { flex: 1, backgroundColor: "#fff", borderRadius: 17, padding: 14, borderWidth: 1, borderColor: "#E2E8F0" }, metricValue: { color: Colors.text, fontFamily: "Inter_700Bold", fontSize: 16, marginTop: 8 }, metricLabel: { color: Colors.textMuted, fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 3 }, payoutButton: { height: 49, backgroundColor: Colors.primary, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 22 }, payoutText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13 }, sectionTitle: { color: Colors.text, fontFamily: "Inter_700Bold", fontSize: 17, marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 9 }, rowIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" }, rowTitle: { color: Colors.text, fontFamily: "Inter_700Bold", fontSize: 13 }, rowSub: { color: Colors.textMuted, fontSize: 11, marginTop: 3, textTransform: "capitalize" }, amount: { color: "#047857", fontFamily: "Inter_700Bold", fontSize: 13 }, empty: { alignItems: "center", backgroundColor: "#fff", borderRadius: 18, padding: 24 }, emptyTitle: { color: Colors.text, fontFamily: "Inter_700Bold", marginTop: 8 }, emptyText: { color: Colors.textMuted, textAlign: "center", fontSize: 12, lineHeight: 18, marginTop: 4 },
});
