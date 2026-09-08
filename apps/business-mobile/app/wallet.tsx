import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiRequest, queryClient } from "@/lib/query-client";

function money(value?: number) { return `D ${(value ?? 0).toLocaleString()}`; }

export default function WalletScreen() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/wallet"] });
  const deposit = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/wallet/deposit/manual", { amount: 500, method: "manual_mobile_money", reference: `DEMO-${Date.now()}` }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/wallet"] }),
  });
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={Colors.text} /></Pressable>
        <Text style={styles.title}>Wallet</Text><View style={{ width: 24 }} />
      </View>
      {isLoading ? <ActivityIndicator color={Colors.primary} /> : (
        <>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <Text style={styles.balance}>{money(data?.wallet?.balance)}</Text>
            <Text style={styles.balanceSub}>Pending: {money(data?.wallet?.pendingBalance)} • Locked: {money(data?.wallet?.lockedBalance)}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable style={styles.primaryBtn} onPress={() => deposit.mutate()} disabled={deposit.isPending}>
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>{deposit.isPending ? "Submitting..." : "Demo Top-up D 500"}</Text>
            </Pressable>
          </View>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {(data?.transactions ?? []).map((tx: any) => (
            <View key={tx.id} style={styles.txRow}>
              <View style={[styles.txIcon, { backgroundColor: tx.direction === "credit" ? Colors.primaryLight : Colors.dealLight }]}>
                <Ionicons name={tx.direction === "credit" ? "arrow-down" : "arrow-up"} size={16} color={tx.direction === "credit" ? Colors.primary : Colors.deal} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txTitle}>{tx.description || tx.type}</Text>
                <Text style={styles.txMeta}>{tx.status} • {new Date(tx.createdAt).toLocaleDateString()}</Text>
              </View>
              <Text style={[styles.txAmount, { color: tx.direction === "credit" ? Colors.primary : Colors.deal }]}>
                {tx.direction === "credit" ? "+" : "-"}{money(tx.amount)}
              </Text>
            </View>
          ))}
          {(!data?.transactions || data.transactions.length === 0) && <Text style={styles.empty}>No wallet transactions yet.</Text>}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background }, content: { padding: 20, paddingTop: 60 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text },
  balanceCard: { backgroundColor: Colors.primary, borderRadius: 24, padding: 24, marginBottom: 18 },
  balanceLabel: { color: "rgba(255,255,255,0.75)", fontFamily: "Inter_500Medium", fontSize: 13 },
  balance: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 38, marginVertical: 8 },
  balanceSub: { color: "rgba(255,255,255,0.75)", fontFamily: "Inter_400Regular", fontSize: 12 },
  actions: { flexDirection: "row", gap: 10, marginBottom: 24 }, primaryBtn: { flex: 1, backgroundColor: Colors.text, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryBtnText: { color: "#fff", fontFamily: "Inter_700Bold" }, sectionTitle: { fontFamily: "Inter_700Bold", color: Colors.text, fontSize: 16, marginBottom: 10 },
  txRow: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface, borderRadius: 16, padding: 14, marginBottom: 10, gap: 12 },
  txIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" }, txTitle: { fontFamily: "Inter_600SemiBold", color: Colors.text, fontSize: 13 },
  txMeta: { fontFamily: "Inter_400Regular", color: Colors.textMuted, fontSize: 11, marginTop: 2 }, txAmount: { fontFamily: "Inter_700Bold", fontSize: 13 }, empty: { color: Colors.textMuted, textAlign: "center", marginTop: 24 },
});
