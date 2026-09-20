import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiRequest, queryClient } from "@/lib/query-client";
import { safeBack } from "@/lib/navigation";
import { RiderDeliveryMap } from "@/components/RiderDeliveryMap";

function money(value?: number) {
  return `D ${(Number(value) || 0).toLocaleString()}`;
}

function shortId(id?: string) {
  return String(id || "").slice(0, 8).toUpperCase() || "—";
}

export default function RiderDeliveriesScreen() {
  const { data, isLoading, refetch, isFetching } = useQuery<any>({ queryKey: ["/api/rider/dashboard"], refetchInterval: 10000 });
  const accept = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/delivery-requests/${id}/accept`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/rider/dashboard"] }),
  });

  const offers = data?.offers ?? [];
  const active = data?.activeDeliveries ?? [];
  const history = data?.history ?? [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={Colors.primary} />}
    >
      <View style={styles.header}>
        <Pressable onPress={() => safeBack("/(rider)")} style={styles.iconBtn}><Ionicons name="chevron-back" size={24} color={Colors.text} /></Pressable>
        <Text style={styles.title}>Deliveries</Text>
        <Pressable onPress={() => router.push("/scan-order" as any)} style={styles.iconBtn}><Ionicons name="scan-outline" size={22} color={Colors.primary} /></Pressable>
      </View>

      {isLoading ? <ActivityIndicator color={Colors.primary} /> : (
        <>
          <View style={styles.hero}>
            <View>
              <Text style={styles.heroTitle}>{active.length} active</Text>
              <Text style={styles.heroText}>{offers.length} new offer{offers.length === 1 ? "" : "s"} waiting</Text>
            </View>
            <Ionicons name="bicycle-outline" size={34} color="#fff" />
          </View>

          <Text style={styles.sectionTitle}>New delivery offers</Text>
          {offers.map((offer: any) => (
            <View key={offer.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>Delivery request</Text>
                <Text style={styles.badge}>Offered</Text>
              </View>
              <Text style={styles.meta}>Distance: {offer.distanceKm ? `${Number(offer.distanceKm).toFixed(2)} km` : "Not calculated"}</Text>
              <Text style={styles.meta}>Expires: {offer.expiresAt ? new Date(offer.expiresAt).toLocaleString() : "Soon"}</Text>
              <Pressable disabled={accept.isPending} style={styles.acceptBtn} onPress={() => accept.mutate(offer.id)}>
                <Text style={styles.acceptText}>{accept.isPending ? "Accepting..." : "Accept delivery"}</Text>
              </Pressable>
            </View>
          ))}
          {offers.length === 0 && <Text style={styles.empty}>No delivery offers right now.</Text>}

          <Text style={styles.sectionTitle}>Active deliveries</Text>
          {active.map((d: any, index: number) => (
            <View key={d.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>Order #{shortId(d.orderId)}</Text>
                <Text style={styles.badge}>{String(d.status || "active").replace(/_/g, " ")}</Text>
              </View>
              <Text style={styles.meta}>Pickup: {d.pickupAddress || "Vendor location"}</Text>
              <Text style={styles.meta}>Drop-off: {d.dropoffAddress || "Shopper location"}</Text>
              <Text style={styles.meta}>Delivery fee: {money(d.deliveryFee)}</Text>
              <RiderDeliveryMap
                pickupLatitude={d.pickupLatitude}
                pickupLongitude={d.pickupLongitude}
                pickupAddress={d.pickupAddress}
                dropoffLatitude={d.dropoffLatitude}
                dropoffLongitude={d.dropoffLongitude}
                dropoffAddress={d.dropoffAddress}
                status={d.status}
                trackRider={index === 0}
              />
              <Pressable style={styles.secondaryBtn} onPress={() => router.push(`/order/${d.orderId}` as any)}><Text style={styles.secondaryText}>View order details</Text></Pressable>
            </View>
          ))}
          {active.length === 0 && <Text style={styles.empty}>No active deliveries.</Text>}

          <Text style={styles.sectionTitle}>Recent history</Text>
          {history.slice(0, 20).map((d: any) => (
            <View key={d.id} style={styles.historyRow}>
              <View>
                <Text style={styles.historyTitle}>Order #{shortId(d.orderId)}</Text>
                <Text style={styles.meta}>{String(d.status || "unknown").replace(/_/g, " ")} • {money(d.deliveryFee)}</Text>
              </View>
              <Text style={styles.dateText}>{d.createdAt ? new Date(d.createdAt).toLocaleDateString() : ""}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingTop: 60, paddingBottom: 36 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.text },
  hero: { backgroundColor: Colors.primary, borderRadius: 24, padding: 20, marginBottom: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroTitle: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 24 },
  heroText: { color: "rgba(255,255,255,0.82)", fontFamily: "Inter_500Medium", marginTop: 4 },
  sectionTitle: { fontFamily: "Inter_700Bold", color: Colors.text, fontSize: 16, marginBottom: 10, marginTop: 8 },
  card: { backgroundColor: Colors.surface, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.borderLight },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 8 },
  cardTitle: { fontFamily: "Inter_700Bold", color: Colors.text, fontSize: 16 },
  badge: { backgroundColor: Colors.primaryLight, color: Colors.primary, fontFamily: "Inter_700Bold", fontSize: 11, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: "hidden", textTransform: "capitalize" },
  meta: { fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 4, fontSize: 13 },
  acceptBtn: { backgroundColor: Colors.accent, borderRadius: 12, padding: 13, alignItems: "center", marginTop: 12 },
  acceptText: { color: "#fff", fontFamily: "Inter_700Bold" },
  secondaryBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12, alignItems: "center", marginTop: 10 },
  secondaryText: { color: Colors.text, fontFamily: "Inter_700Bold" },
  empty: { color: Colors.textMuted, textAlign: "center", marginBottom: 16, fontFamily: "Inter_500Medium" },
  historyRow: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  historyTitle: { fontFamily: "Inter_700Bold", color: Colors.text },
  dateText: { color: Colors.textMuted, fontFamily: "Inter_500Medium", fontSize: 12 },
});
