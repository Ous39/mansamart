import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiRequest, queryClient } from "@/lib/query-client";

function money(v?: number) { return `D ${(Number(v) || 0).toLocaleString()}`; }
function sum(rows: any[] | undefined, field: string) { return (rows ?? []).reduce((t, r) => t + Number(r?.[field] || 0), 0); }
function date(v?: string) { return v ? new Date(v).toLocaleDateString() : "—"; }

export default function AdminFinanceScreen() {
  const { data: deposits, isLoading, refetch, isFetching } = useQuery<any[]>({ queryKey: ["/api/admin/wallet/deposits"] });
  const { data: commissions } = useQuery<any[]>({ queryKey: ["/api/admin/commissions"] });
  const { data: settlements } = useQuery<any[]>({ queryKey: ["/api/admin/settlements"] });
  const { data: payouts } = useQuery<any[]>({ queryKey: ["/api/admin/payouts"] });

  const confirm = useMutation({
    mutationFn: async (id: string) => apiRequest("PUT", `/api/admin/wallet/deposits/${id}/confirm`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/wallet/deposits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/commissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settlements"] });
    },
  });

  return <ScrollView
    style={styles.container}
    contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={Colors.primary} />}
  >
    <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="chevron-back" size={24} color={Colors.text} /></Pressable><Text style={styles.title}>Finance</Text><View style={{ width: 40 }} /></View>

    <View style={styles.summaryGrid}>
      <Summary label="Pending deposits" value={money(sum(deposits, "amount"))} icon="wallet-outline" />
      <Summary label="Commissions" value={money(sum(commissions, "commissionAmount"))} icon="trending-up-outline" />
      <Summary label="Settlements" value={money(sum(settlements, "amount"))} icon="checkmark-done-outline" />
      <Summary label="Payout requests" value={money(sum(payouts, "amount"))} icon="cash-outline" />
    </View>

    <Text style={styles.section}>Pending wallet deposits</Text>
    {isLoading ? <ActivityIndicator color={Colors.primary} /> : (deposits ?? []).map((d: any) => <View key={d.id} style={styles.card}>
      <View style={styles.rowTop}><Text style={styles.name}>{money(d.amount)}</Text><Text style={styles.badge}>Pending</Text></View>
      <Text style={styles.meta}>{d.method || "manual"} • {d.reference || "No reference"} • {date(d.createdAt)}</Text>
      <Pressable disabled={confirm.isPending} style={styles.approve} onPress={() => confirm.mutate(d.id)}><Text style={styles.btnText}>{confirm.isPending ? "Confirming..." : "Confirm deposit"}</Text></Pressable>
    </View>)}
    {(!deposits || deposits.length === 0) && <Text style={styles.empty}>No pending deposits.</Text>}

    <Text style={styles.section}>Recent settlements</Text>
    {(settlements ?? []).slice(0, 30).map((s: any) => <View key={s.id} style={styles.card}>
      <View style={styles.rowTop}><Text style={styles.name}>{money(s.amount)}</Text><Text style={styles.badge}>{s.beneficiaryType || "seller"}</Text></View>
      <Text style={styles.meta}>{s.note || "Settlement released"} • {s.status || "completed"} • {date(s.createdAt)}</Text>
    </View>)}
    {(!settlements || settlements.length === 0) && <Text style={styles.empty}>No settlements released yet.</Text>}

    <Text style={styles.section}>Recent commissions</Text>
    {(commissions ?? []).slice(0, 30).map((c: any) => <View key={c.id} style={styles.card}><Text style={styles.name}>{money(c.commissionAmount)} commission</Text><Text style={styles.meta}>Gross {money(c.grossAmount)} • Seller gets {money(c.sellerAmount)} • {c.sellerType} • {date(c.createdAt)}</Text></View>)}

    <Text style={styles.section}>Payout requests</Text>
    {(payouts ?? []).slice(0, 30).map((p: any) => <View key={p.id} style={styles.card}>
      <View style={styles.rowTop}><Text style={styles.name}>{money(p.amount)}</Text><Text style={styles.badge}>{p.status || "pending"}</Text></View>
      <Text style={styles.meta}>{p.method || "method"} • {p.accountName || "No account name"} • {date(p.createdAt)}</Text>
    </View>)}
  </ScrollView>;
}

function Summary({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  return <View style={styles.summaryCard}><Ionicons name={icon} size={20} color={Colors.primary} /><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:Colors.background}, content:{padding:20,paddingTop:60,paddingBottom:36},
  header:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:20}, iconBtn:{width:40,height:40,borderRadius:20,backgroundColor:Colors.surface,alignItems:"center",justifyContent:"center"},
  title:{fontFamily:"Inter_700Bold",fontSize:22,color:Colors.text},
  summaryGrid:{flexDirection:"row",flexWrap:"wrap",gap:12,marginBottom:18}, summaryCard:{width:"47%",flexGrow:1,backgroundColor:Colors.surface,borderRadius:18,padding:16,borderWidth:1,borderColor:Colors.borderLight}, summaryValue:{fontFamily:"Inter_700Bold",fontSize:18,color:Colors.text,marginTop:8}, summaryLabel:{fontFamily:"Inter_500Medium",fontSize:12,color:Colors.textMuted,marginTop:4},
  section:{fontFamily:"Inter_700Bold",fontSize:16,color:Colors.text,marginBottom:10,marginTop:10}, card:{backgroundColor:Colors.surface,borderRadius:16,padding:16,marginBottom:12,borderWidth:1,borderColor:Colors.borderLight}, rowTop:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:10}, name:{fontFamily:"Inter_700Bold",fontSize:16,color:Colors.text}, meta:{fontFamily:"Inter_400Regular",fontSize:12,color:Colors.textMuted,marginTop:6,lineHeight:18}, badge:{backgroundColor:Colors.primaryLight,color:Colors.primary,fontFamily:"Inter_700Bold",fontSize:11,paddingHorizontal:10,paddingVertical:5,borderRadius:999,overflow:"hidden",textTransform:"capitalize"}, approve:{backgroundColor:Colors.primary,borderRadius:12,padding:12,alignItems:"center",marginTop:12}, btnText:{color:"#fff",fontFamily:"Inter_700Bold"}, empty:{color:Colors.textMuted,textAlign:"center",marginVertical:12,fontFamily:"Inter_500Medium"}
});
