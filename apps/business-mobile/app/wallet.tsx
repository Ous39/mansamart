import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Alert, RefreshControl, Platform } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { apiRequest, queryClient } from "@/lib/query-client";

function money(value?: number) { return `D ${Number(value || 0).toLocaleString()}`; }
function titleCase(value?: string) { return String(value || "").replace(/_/g, " "); }

export default function FinanceScreen() {
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState<"mobile_money" | "bank_transfer">("mobile_money");
  const [accountName, setAccountName] = React.useState("");
  const [accountNumber, setAccountNumber] = React.useState("");
  const { data, isLoading, refetch, isRefetching } = useQuery<any>({ queryKey: ["/api/business/finance"] });

  React.useEffect(() => {
    if (!data?.payoutProfile) return;
    if (["mobile_money", "bank_transfer"].includes(data.payoutProfile.method)) setMethod(data.payoutProfile.method);
    setAccountName(data.payoutProfile.accountName || "");
    setAccountNumber(data.payoutProfile.accountNumber || "");
  }, [data?.payoutProfile]);

  const payout = useMutation({
    mutationFn: async () => {
      const parsedAmount = Math.round(Number(amount));
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) throw new Error("Enter a valid payout amount.");
      if (!accountName.trim() || !accountNumber.trim()) throw new Error("Enter the account name and number.");
      const response = await apiRequest("POST", "/api/payouts", { amount: parsedAmount, method, accountName: accountName.trim(), accountNumber: accountNumber.trim() });
      return response.json();
    },
    onSuccess: async () => {
      setAmount("");
      await queryClient.invalidateQueries({ queryKey: ["/api/business/finance"] });
      Alert.alert("Payout request submitted", "MansaMart will review the request and update its status here.");
    },
    onError: (error: any) => Alert.alert("Payout not submitted", error?.message || "Please check your details and try again."),
  });

  const topPadding = insets.top + (Platform.OS === "web" ? 52 : 10);
  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: topPadding }]} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={Colors.text} /></Pressable>
        <Text style={styles.title}>Finance & Payouts</Text><View style={{ width: 24 }} />
      </View>
      {isLoading ? <ActivityIndicator color={Colors.primary} /> : <>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Internal Settlement Balance</Text>
          <Text style={styles.balance}>{money(data?.summary?.availableForPayout)}</Text>
          <Text style={styles.balanceSub}>Wallet: {money(data?.wallet?.balance)}  •  Pending payout: {money(data?.summary?.pendingPayout)}</Text>
        </View>
        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={19} color="#1D4ED8" />
          <Text style={styles.noticeText}>This is MansaMart&apos;s settlement record, not a bank account or legal escrow. A payout happens only after review and transfer confirmation.</Text>
        </View>

        <View style={styles.summaryRow}>
          <Summary label="Settled" value={money(data?.summary?.totalSettled)} icon="checkmark-circle-outline" />
          <Summary label="Paid out" value={money(data?.summary?.totalPaidOut)} icon="cash-outline" />
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Request a Payout</Text>
          {data?.payoutProfile?.verificationStatus !== "verified" && <Text style={styles.warning}>Your business must be verified before you can request a payout.</Text>}
          <View style={styles.methodRow}>
            {(["mobile_money", "bank_transfer"] as const).map((value) => <Pressable key={value} style={[styles.methodChip, method === value && styles.methodChipActive]} onPress={() => setMethod(value)}><Text style={[styles.methodText, method === value && styles.methodTextActive]}>{titleCase(value)}</Text></Pressable>)}
          </View>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="Amount in GMD" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
          <TextInput style={styles.input} value={accountName} onChangeText={setAccountName} placeholder="Account name" placeholderTextColor={Colors.textMuted} />
          <TextInput style={styles.input} value={accountNumber} onChangeText={setAccountNumber} placeholder={method === "mobile_money" ? "Mobile money number" : "Bank account number"} placeholderTextColor={Colors.textMuted} keyboardType={method === "mobile_money" ? "phone-pad" : "default"} />
          <Pressable style={[styles.primaryBtn, (payout.isPending || data?.payoutProfile?.verificationStatus !== "verified") && { opacity: 0.5 }]} onPress={() => payout.mutate()} disabled={payout.isPending || data?.payoutProfile?.verificationStatus !== "verified"}>
            {payout.isPending ? <ActivityIndicator color="#fff" /> : <Ionicons name="paper-plane-outline" size={18} color="#fff" />}
            <Text style={styles.primaryBtnText}>{payout.isPending ? "Submitting..." : "Submit Payout Request"}</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Payout Requests</Text>
        {(data?.payouts || []).map((item: any) => <HistoryRow key={item.id} icon="cash-outline" title={`${money(item.amount)} · ${titleCase(item.method)}`} meta={`${titleCase(item.status)} · ${new Date(item.createdAt).toLocaleDateString()}`} amount={titleCase(item.status)} />)}
        {(!data?.payouts || data.payouts.length === 0) && <Text style={styles.empty}>No payout requests yet.</Text>}

        <Text style={styles.sectionTitle}>Settlements</Text>
        {(data?.settlements || []).map((item: any) => <HistoryRow key={item.id} icon="receipt-outline" title={item.note || "Marketplace settlement"} meta={`${titleCase(item.status)} · ${new Date(item.createdAt).toLocaleDateString()}`} amount={money(item.amount)} />)}
        {(!data?.settlements || data.settlements.length === 0) && <Text style={styles.empty}>No settlements yet.</Text>}

        <Text style={styles.sectionTitle}>Transactions</Text>
        {(data?.transactions || []).map((item: any) => <HistoryRow key={item.id} icon={item.direction === "credit" ? "arrow-down-outline" : "arrow-up-outline"} title={item.description || titleCase(item.type)} meta={`${titleCase(item.status)} · ${new Date(item.createdAt).toLocaleDateString()}`} amount={`${item.direction === "credit" ? "+" : "-"}${money(item.amount)}`} />)}
        {(!data?.transactions || data.transactions.length === 0) && <Text style={styles.empty}>No transactions yet.</Text>}
      </>}
    </ScrollView>
  );
}

function Summary({ label, value, icon }: { label: string; value: string; icon: string }) {
  return <View style={styles.summaryCard}><Ionicons name={icon as any} size={20} color={Colors.primary} /><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
}

function HistoryRow({ icon, title, meta, amount }: { icon: string; title: string; meta: string; amount: string }) {
  return <View style={styles.txRow}><View style={styles.txIcon}><Ionicons name={icon as any} size={17} color={Colors.primary} /></View><View style={{ flex: 1 }}><Text style={styles.txTitle}>{title}</Text><Text style={styles.txMeta}>{meta}</Text></View><Text style={styles.txAmount}>{amount}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background }, content: { paddingHorizontal: 20, paddingBottom: 50 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }, title: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  balanceCard: { backgroundColor: Colors.primary, borderRadius: 24, padding: 22, marginBottom: 12 }, balanceLabel: { color: "rgba(255,255,255,0.78)", fontFamily: "Inter_500Medium", fontSize: 12 }, balance: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 34, marginVertical: 8 }, balanceSub: { color: "rgba(255,255,255,0.75)", fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 16 },
  notice: { flexDirection: "row", gap: 9, padding: 12, borderRadius: 12, backgroundColor: "#EFF6FF", marginBottom: 14 }, noticeText: { flex: 1, color: "#1E40AF", fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 16 },
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 16 }, summaryCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 14, padding: 14, gap: 4 }, summaryValue: { fontFamily: "Inter_700Bold", color: Colors.text, fontSize: 16 }, summaryLabel: { fontFamily: "Inter_400Regular", color: Colors.textMuted, fontSize: 11 },
  formCard: { backgroundColor: Colors.surface, borderRadius: 18, padding: 16, gap: 10, marginBottom: 22 }, sectionTitle: { fontFamily: "Inter_700Bold", color: Colors.text, fontSize: 16, marginTop: 10, marginBottom: 10 }, warning: { color: "#92400E", backgroundColor: "#FFFBEB", padding: 10, borderRadius: 9, fontFamily: "Inter_500Medium", fontSize: 11 },
  methodRow: { flexDirection: "row", gap: 8 }, methodChip: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingVertical: 9, alignItems: "center" }, methodChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary }, methodText: { color: Colors.textSecondary, fontFamily: "Inter_500Medium", fontSize: 12, textTransform: "capitalize" }, methodTextActive: { color: "#fff" },
  input: { minHeight: 48, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, borderRadius: 11, paddingHorizontal: 13, color: Colors.text, fontFamily: "Inter_400Regular" }, primaryBtn: { minHeight: 48, backgroundColor: Colors.text, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, primaryBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13 },
  txRow: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface, borderRadius: 14, padding: 13, marginBottom: 9, gap: 10 }, txIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: Colors.primaryLight }, txTitle: { fontFamily: "Inter_600SemiBold", color: Colors.text, fontSize: 12 }, txMeta: { fontFamily: "Inter_400Regular", color: Colors.textMuted, fontSize: 10, marginTop: 3, textTransform: "capitalize" }, txAmount: { fontFamily: "Inter_700Bold", fontSize: 12, color: Colors.primary, textTransform: "capitalize" }, empty: { color: Colors.textMuted, textAlign: "center", marginVertical: 14, fontFamily: "Inter_400Regular" },
});
