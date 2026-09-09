import React from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

export default function BusinessReturnsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const { data: requests = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/business/returns"] });
  return <View style={styles.container}>
    <Stack.Screen options={{ headerShown: false }} />
    <View style={[styles.header, { paddingTop: topPad + 12 }]}><Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={Colors.text} /></Pressable><View style={{ flex: 1 }}><Text style={styles.title}>Returns & Refunds</Text><Text style={styles.subtitle}>Requests involving products from your store</Text></View><Text style={styles.count}>{requests.length}</Text></View>
    {isLoading ? <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View> : <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]}>
      <View style={styles.notice}><Ionicons name="information-circle-outline" size={22} color="#1D4ED8" /><Text style={styles.noticeText}>These requests are read-only for sellers. MansaMart support checks the payment, customer evidence, return policy, and item condition before approving a refund.</Text></View>
      {requests.length === 0 ? <View style={styles.empty}><Ionicons name="return-down-back-outline" size={42} color={Colors.textMuted} /><Text style={styles.emptyTitle}>No return requests</Text><Text style={styles.emptyText}>Requests for your products will appear here.</Text></View> : requests.map((request) => <View key={request.id} style={styles.card}>
        <View style={styles.row}><View><Text style={styles.order}>Order #{String(request.orderId).slice(0, 8).toUpperCase()}</Text><Text style={styles.meta}>{request.requestType} • D {Number(request.vendorSubtotal || 0).toLocaleString()}</Text></View><Status value={request.status} /></View>
        <Text style={styles.reason}>{request.reason}</Text>{request.details ? <Text style={styles.details}>{request.details}</Text> : null}
        {(request.items || []).map((item: any) => <Text key={`${item.productId}-${item.name}`} style={styles.item}>• {item.name} × {item.quantity}</Text>)}
        {request.resolution ? <Text style={styles.resolution}>Resolution: {request.resolution}</Text> : null}<Text style={styles.date}>{new Date(request.createdAt).toLocaleDateString("en-GB")}</Text>
      </View>)}
    </ScrollView>}
  </View>;
}

function Status({ value }: { value: string }) { const color = ["approved", "completed"].includes(value) ? Colors.success : ["rejected", "cancelled"].includes(value) ? Colors.error : "#D97706"; return <View style={[styles.status, { backgroundColor: `${color}18` }]}><Text style={[styles.statusText, { color }]}>{String(value).replace(/_/g, " ")}</Text></View>; }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background }, header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: Colors.surface }, title: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text }, subtitle: { fontSize: 11, color: Colors.textMuted, fontFamily: "Inter_400Regular" }, count: { color: Colors.primary, backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, fontFamily: "Inter_700Bold" }, center: { flex: 1, alignItems: "center", justifyContent: "center" }, content: { padding: 16, gap: 10 }, notice: { flexDirection: "row", gap: 10, backgroundColor: "#EFF6FF", borderRadius: 14, padding: 14 }, noticeText: { flex: 1, color: "#1E40AF", fontSize: 11, lineHeight: 17 }, empty: { alignItems: "center", gap: 8, backgroundColor: Colors.surface, borderRadius: 16, padding: 36 }, emptyTitle: { color: Colors.text, fontSize: 16, fontFamily: "Inter_700Bold" }, emptyText: { color: Colors.textMuted, fontSize: 12 }, card: { backgroundColor: Colors.surface, borderRadius: 15, padding: 15, gap: 7 }, row: { flexDirection: "row", justifyContent: "space-between", gap: 10 }, order: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.text }, meta: { marginTop: 2, fontSize: 11, color: Colors.textMuted, textTransform: "capitalize" }, reason: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text }, details: { fontSize: 12, lineHeight: 18, color: Colors.textSecondary }, item: { fontSize: 11, color: Colors.textSecondary }, resolution: { padding: 9, borderRadius: 9, backgroundColor: Colors.primaryLight, color: Colors.textSecondary, fontSize: 11 }, date: { fontSize: 10, color: Colors.textMuted }, status: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, alignSelf: "flex-start" }, statusText: { fontSize: 10, fontFamily: "Inter_700Bold", textTransform: "capitalize" },
});
