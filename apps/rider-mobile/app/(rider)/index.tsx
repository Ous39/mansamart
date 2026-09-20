import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Linking } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiRequest, queryClient } from "@/lib/query-client";
import { safeBack } from "@/lib/navigation";

function money(value?: number) { return `D ${(value ?? 0).toLocaleString()}`; }

export default function RiderDashboard() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/rider/dashboard"], refetchInterval: 10000 });
  const toggleOnline = useMutation({
    mutationFn: async () => apiRequest("PUT", "/api/rider/status", { isOnline: !data?.profile?.isOnline, isAvailable: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/rider/dashboard"] }),
  });
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}><Pressable onPress={() => safeBack("/")}><Ionicons name="close" size={24} color={Colors.text} /></Pressable><Text style={styles.title}>Rider Dashboard</Text><Pressable onPress={() => router.push("/(rider)/settings")}><Ionicons name="person-circle-outline" size={26} color={Colors.primary} /></Pressable></View>
      {isLoading ? <ActivityIndicator color={Colors.primary} /> : <>
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>{data?.profile?.verificationStatus === "verified" ? "Ready for Deliveries" : "Awaiting Approval"}</Text>
          <Text style={styles.statusText}>Online: {data?.profile?.isOnline ? "Yes" : "No"} • Available: {data?.profile?.isAvailable ? "Yes" : "No"}</Text>
          <Text style={styles.statusText}>Earnings: {money(data?.totalEarnings)} • Completed: {data?.metrics?.completed ?? 0} • Rating: {data?.metrics?.rating ?? "—"}</Text>
          {data?.completion?.restricted && <Text style={styles.warning}>Complete profile: {(data?.completion?.missingItems || []).join(", ")}</Text>}
          <Pressable style={styles.primaryBtn} onPress={() => toggleOnline.mutate()}><Text style={styles.primaryBtnText}>{data?.profile?.isOnline ? "Go Offline" : "Go Online"}</Text></Pressable>
          <View style={styles.quickRow}>
            <Pressable style={styles.quickBtn} onPress={() => router.push("/(rider)/settings")}><Ionicons name="person-outline" size={16} color={Colors.primary} /><Text style={styles.quickText}>Profile</Text></Pressable>
            <Pressable style={styles.quickBtn} onPress={() => router.push("/scan-order")}><Ionicons name="scan-outline" size={16} color={Colors.primary} /><Text style={styles.quickText}>Scan Order</Text></Pressable>
            <Pressable style={styles.quickBtn} onPress={() => router.push("/(rider)/deliveries" as any)}><Ionicons name="bicycle-outline" size={16} color={Colors.primary} /><Text style={styles.quickText}>Deliveries</Text></Pressable>
            <Pressable style={styles.quickBtn} onPress={() => router.push("/(rider)/earnings" as any)}><Ionicons name="wallet-outline" size={16} color={Colors.primary} /><Text style={styles.quickText}>Earnings</Text></Pressable>
          </View>
        </View>
        <Text style={styles.sectionTitle}>Delivery Offers</Text>
        {(data?.offers ?? []).map((offer: any) => (
          <View key={offer.id} style={styles.card}>
            <Text style={styles.cardTitle}>New delivery request</Text>
            <Text style={styles.cardSub}>Distance: {offer.distanceKm ? offer.distanceKm.toFixed(2) : "—"} km</Text>
            <Pressable style={styles.acceptBtn} onPress={() => router.push(`/delivery-offer/${offer.id}` as any)}><Text style={styles.acceptText}>Review Order</Text></Pressable>
          </View>
        ))}
        {(!data?.offers || data.offers.length === 0) && <Text style={styles.empty}>No delivery offers right now.</Text>}
        <Text style={styles.sectionTitle}>My Deliveries</Text>
        {(data?.activeDeliveries ?? []).map((d: any) => (
          <View key={d.id} style={styles.card}>
            <Text style={styles.cardTitle}>Order #{String(d.orderId).slice(0,8).toUpperCase()}</Text>
            <Text style={styles.cardSub}>{d.status} • Fee {money(d.deliveryFee)}</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <Pressable style={styles.mapBtn} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${d.pickupLatitude || ""},${d.pickupLongitude || ""}`)}><Text style={styles.mapText}>Vendor Map</Text></Pressable>
              <Pressable style={styles.mapBtn} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${d.dropoffLatitude || ""},${d.dropoffLongitude || ""}`)}><Text style={styles.mapText}>Shopper Map</Text></Pressable>
            </View>
          </View>
        ))}
      </>}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background }, content: { padding: 20, paddingTop: 60 }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }, title: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.text },
  statusCard: { backgroundColor: Colors.text, borderRadius: 24, padding: 20, marginBottom: 20 }, statusTitle: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 20 }, statusText: { color: "rgba(255,255,255,0.7)", marginTop: 6, marginBottom: 14, fontFamily: "Inter_400Regular" },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: 14, padding: 14, alignItems: "center" }, primaryBtnText: { color: "#fff", fontFamily: "Inter_700Bold" }, sectionTitle: { fontFamily: "Inter_700Bold", color: Colors.text, fontSize: 16, marginBottom: 10, marginTop: 6 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 10 }, cardTitle: { fontFamily: "Inter_700Bold", color: Colors.text }, cardSub: { fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 4 }, acceptBtn: { backgroundColor: Colors.accent, borderRadius: 12, padding: 12, alignItems: "center", marginTop: 12 }, acceptText: { color: "#fff", fontFamily: "Inter_700Bold" }, empty: { color: Colors.textMuted, textAlign: "center", marginBottom: 16 }, warning: { color: "#FCA5A5", marginTop: 8, fontFamily: "Inter_600SemiBold" }, mapBtn: { flex: 1, backgroundColor: Colors.primaryLight, borderRadius: 12, padding: 10, alignItems: "center" }, mapText: { color: Colors.primary, fontFamily: "Inter_700Bold" }, quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 }, quickBtn: { minWidth: "47%", flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }, quickText: { color: Colors.primary, fontFamily: "Inter_700Bold" },
});
