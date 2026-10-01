import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiRequest, queryClient } from "@/lib/query-client";
import { readableError } from "@/lib/errors";
import { safeBack } from "@/lib/navigation";

function money(value?: number) { return `D ${(Number(value) || 0).toLocaleString()}`; }

export default function RiderWalletScreen() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/rider/finance"], refetchInterval: 15000 });
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"mobile_money" | "bank_transfer">("mobile_money");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  useEffect(() => {
    if (!data?.payoutProfile) return;
    if (data.payoutProfile.method === "bank_transfer") setMethod("bank_transfer");
    setAccountName(data.payoutProfile.accountName || "");
    setAccountNumber(data.payoutProfile.accountNumber || "");
  }, [data]);

  const requestPayout = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/payouts", { amount: Math.round(Number(amount)), method, accountName: accountName.trim(), accountNumber: accountNumber.trim() })).json(),
    onSuccess: () => { setAmount(""); queryClient.invalidateQueries({ queryKey: ["/api/rider/finance"] }); Alert.alert("Payout requested", "Operations will review the payout before sending it."); },
    onError: (error) => Alert.alert("Payout not submitted", readableError(error, "Check your balance and payout details.")),
  });
  const available = Number(data?.summary?.availableForPayout || 0);
  const requested = Math.round(Number(amount));
  const valid = requested >= 50 && requested <= available && accountName.trim().length >= 2 && accountNumber.trim().length >= 5;

  return <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><Pressable style={styles.iconBtn} onPress={() => safeBack("/(rider)/earnings")}><Ionicons name="chevron-back" size={23} color={Colors.text} /></Pressable><View style={styles.flex}><Text style={styles.eyebrow}>RIDER FINANCE</Text><Text style={styles.title}>Wallet & payouts</Text></View><Pressable style={styles.iconBtn} onPress={() => router.push("/(rider)/settings" as any)}><Ionicons name="settings-outline" size={21} color={Colors.primary} /></Pressable></View>

    {isLoading ? <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View> : <>
      <View style={styles.balanceCard}><Text style={styles.balanceLabel}>Available for payout</Text><Text style={styles.balance}>{money(available)}</Text><View style={styles.balanceRow}><Text style={styles.balanceSub}>Pending {money(data?.summary?.pendingPayout)}</Text><Text style={styles.balanceSub}>Paid out {money(data?.summary?.totalPaidOut)}</Text></View></View>
      {data?.payoutProfile?.verificationStatus !== "verified" && <Pressable style={styles.warning} onPress={() => router.push("/(rider)/settings" as any)}><Ionicons name="shield-outline" size={21} color="#92400E" /><View style={styles.flex}><Text style={styles.warningTitle}>Verification required</Text><Text style={styles.warningText}>Your rider identity must be approved before requesting a payout.</Text></View></Pressable>}

      <View style={styles.card}><Text style={styles.cardTitle}>Request a payout</Text><View style={styles.methodRow}><Method active={method === "mobile_money"} icon="phone-portrait-outline" label="Mobile money" onPress={() => setMethod("mobile_money")} /><Method active={method === "bank_transfer"} icon="business-outline" label="Bank transfer" onPress={() => setMethod("bank_transfer")} /></View><Text style={styles.label}>Amount (minimum D 50)</Text><TextInput style={styles.input} value={amount} onChangeText={(value) => setAmount(value.replace(/[^0-9]/g, ""))} keyboardType="number-pad" placeholder="0" placeholderTextColor={Colors.textMuted} /><Text style={styles.label}>Account name</Text><TextInput style={styles.input} value={accountName} onChangeText={setAccountName} placeholder="Name on account" placeholderTextColor={Colors.textMuted} /><Text style={styles.label}>{method === "mobile_money" ? "Mobile money number" : "Bank account number"}</Text><TextInput style={styles.input} value={accountNumber} onChangeText={setAccountNumber} placeholder={method === "mobile_money" ? "220…" : "Account number"} placeholderTextColor={Colors.textMuted} /><Text style={styles.note}>Payout requests reserve the amount immediately but require operations approval. Save your preferred provider and account in Rider Profile.</Text><Pressable disabled={!valid || requestPayout.isPending || data?.payoutProfile?.verificationStatus !== "verified"} style={[styles.payoutButton, (!valid || requestPayout.isPending || data?.payoutProfile?.verificationStatus !== "verified") && { opacity: .45 }]} onPress={() => requestPayout.mutate()}>{requestPayout.isPending ? <ActivityIndicator color="#fff" /> : <><Ionicons name="arrow-up-circle-outline" size={19} color="#fff" /><Text style={styles.payoutText}>Request {requested > 0 ? money(requested) : "payout"}</Text></>}</Pressable></View>

      <Text style={styles.sectionTitle}>Payout history</Text>
      {(data?.payouts ?? []).map((payout: any) => <View key={payout.id} style={styles.row}><View style={styles.rowIcon}><Ionicons name="cash-outline" size={19} color={Colors.primary} /></View><View style={styles.flex}><Text style={styles.rowTitle}>{money(payout.amount)}</Text><Text style={styles.rowSub}>{String(payout.method).replace(/_/g, " ")} · {payout.createdAt ? new Date(payout.createdAt).toLocaleDateString() : ""}</Text></View><Text style={[styles.status, payout.status === "completed" && styles.completed]}>{payout.status}</Text></View>)}
      {(!data?.payouts || data.payouts.length === 0) && <Text style={styles.empty}>No payout requests yet.</Text>}
    </>}
  </ScrollView>;
}

function Method({ active, icon, label, onPress }: { active: boolean; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) { return <Pressable style={[styles.method, active && styles.methodActive]} onPress={onPress}><Ionicons name={icon} size={19} color={active ? Colors.primary : Colors.textMuted} /><Text style={[styles.methodText, active && { color: Colors.primary }]}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F7FB" }, content: { padding: 18, paddingTop: 58, paddingBottom: 40 }, flex: { flex: 1 }, loading: { paddingVertical: 80 }, header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 }, iconBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E2E8F0" }, eyebrow: { color: Colors.primary, fontSize: 9, letterSpacing: 1.3, fontFamily: "Inter_700Bold" }, title: { color: Colors.text, fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 2 },
  balanceCard: { backgroundColor: "#0F172A", borderRadius: 23, padding: 20, marginBottom: 13 }, balanceLabel: { color: "#94A3B8", fontFamily: "Inter_600SemiBold", fontSize: 12 }, balance: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 36, marginTop: 6 }, balanceRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 13 }, balanceSub: { color: "#CBD5E1", fontSize: 11, fontFamily: "Inter_500Medium" }, warning: { flexDirection: "row", gap: 10, backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#FDE68A", borderRadius: 15, padding: 13, marginBottom: 13 }, warningTitle: { color: "#92400E", fontFamily: "Inter_700Bold", fontSize: 13 }, warningText: { color: "#A16207", fontSize: 11, lineHeight: 16, marginTop: 2 },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 17, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 22 }, cardTitle: { color: Colors.text, fontFamily: "Inter_700Bold", fontSize: 17, marginBottom: 13 }, methodRow: { flexDirection: "row", gap: 9, marginBottom: 15 }, method: { flex: 1, height: 48, borderRadius: 13, borderWidth: 1, borderColor: "#E2E8F0", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }, methodActive: { backgroundColor: Colors.primaryLight, borderColor: "#93C5FD" }, methodText: { color: Colors.textMuted, fontFamily: "Inter_600SemiBold", fontSize: 12 }, label: { color: Colors.textSecondary, fontFamily: "Inter_600SemiBold", fontSize: 12, marginBottom: 6 }, input: { height: 48, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 13, paddingHorizontal: 13, color: Colors.text, fontFamily: "Inter_500Medium", marginBottom: 13 }, note: { color: Colors.textMuted, fontSize: 11, lineHeight: 17, marginBottom: 14 }, payoutButton: { height: 49, borderRadius: 13, backgroundColor: Colors.primary, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" }, payoutText: { color: "#fff", fontFamily: "Inter_700Bold" },
  sectionTitle: { color: Colors.text, fontFamily: "Inter_700Bold", fontSize: 17, marginBottom: 10 }, row: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 9 }, rowIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" }, rowTitle: { color: Colors.text, fontFamily: "Inter_700Bold", fontSize: 14 }, rowSub: { color: Colors.textMuted, fontSize: 11, textTransform: "capitalize", marginTop: 3 }, status: { color: "#B45309", backgroundColor: "#FEF3C7", overflow: "hidden", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5, fontFamily: "Inter_700Bold", fontSize: 10, textTransform: "capitalize" }, completed: { color: "#047857", backgroundColor: "#ECFDF5" }, empty: { color: Colors.textMuted, textAlign: "center", padding: 18 },
});
