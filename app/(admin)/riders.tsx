import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { safeBack } from "@/lib/navigation";
import { apiRequest, queryClient } from "@/lib/query-client";
function money(v?: number) { return `D ${(v ?? 0).toLocaleString()}`; }

export default function AdminRidersScreen() {
  const { data, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/riders"] });
  const verify = useMutation({ mutationFn: async ({ userId, status }: any) => apiRequest("PUT", `/api/admin/riders/${userId}/verify`, { status }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/riders"] }) });
  return <ScrollView style={styles.container} contentContainerStyle={styles.content}>
    <View style={styles.header}><Pressable onPress={() => safeBack("/(admin)")}><Ionicons name="chevron-back" size={24} color={Colors.text} /></Pressable><Text style={styles.title}>Delivery Riders</Text><View style={{ width: 24 }} /></View>
    {isLoading ? <ActivityIndicator color={Colors.primary} /> : (data ?? []).map((r: any) => <View key={r.id} style={styles.card}>
      <Text style={styles.name}>{r.user?.name ?? "Rider"}</Text><Text style={styles.meta}>{r.user?.email} • {r.vehicleType} • {r.vehiclePlate || "No plate"}</Text>
      <Text style={styles.status}>Status: {r.verificationStatus} • Online: {r.isOnline ? "Yes" : "No"}</Text>
      <View style={styles.row}><Pressable style={styles.approve} onPress={() => verify.mutate({ userId: r.userId, status: "verified" })}><Text style={styles.btnText}>Approve</Text></Pressable><Pressable style={styles.reject} onPress={() => verify.mutate({ userId: r.userId, status: "rejected" })}><Text style={styles.btnText}>Reject</Text></Pressable></View>
    </View>)}
  </ScrollView>;
}
const styles = StyleSheet.create({ container:{flex:1,backgroundColor:Colors.background}, content:{padding:20,paddingTop:60}, header:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:20}, title:{fontFamily:"Inter_700Bold",fontSize:22,color:Colors.text}, card:{backgroundColor:Colors.surface,borderRadius:16,padding:16,marginBottom:12}, name:{fontFamily:"Inter_700Bold",fontSize:16,color:Colors.text}, meta:{fontFamily:"Inter_400Regular",fontSize:12,color:Colors.textMuted,marginTop:4}, status:{fontFamily:"Inter_600SemiBold",fontSize:12,color:Colors.textSecondary,marginTop:8}, row:{flexDirection:"row",gap:10,marginTop:14}, approve:{flex:1,backgroundColor:Colors.primary,borderRadius:12,padding:12,alignItems:"center"}, reject:{flex:1,backgroundColor:Colors.deal,borderRadius:12,padding:12,alignItems:"center"}, btnText:{color:"#fff",fontFamily:"Inter_700Bold"} });
