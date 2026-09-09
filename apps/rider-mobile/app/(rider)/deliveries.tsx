import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiRequest, queryClient } from "@/lib/query-client";
import { readableError } from "@/lib/errors";
import { shareForegroundLocation } from "@/lib/rider-location";
import { safeBack } from "@/lib/navigation";

function money(value?: number) { return `D ${(Number(value) || 0).toLocaleString()}`; }
function shortId(id?: string) { return String(id || "").slice(0, 8).toUpperCase() || "—"; }
function openMap(lat?: number, lng?: number, fallback?: string) {
  const query = lat != null && lng != null ? `${lat},${lng}` : fallback;
  if (query) Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
}

export default function RiderDeliveriesScreen() {
  const { data, isLoading, refetch, isFetching } = useQuery<any>({ queryKey: ["/api/rider/dashboard"], refetchInterval: 8000 });
  const [sharingDeliveryId, setSharingDeliveryId] = useState<string | null>(null);
  const offers = data?.offers ?? [];
  const active = data?.activeDeliveries ?? [];
  const history = data?.history ?? [];
  const current = active[0];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/rider/dashboard"] });

  const accept = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/delivery-requests/${id}/accept`)).json(),
    onSuccess: refresh,
    onError: (error) => Alert.alert("Could not accept", readableError(error, "This offer is no longer available.")),
  });
  const decline = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/delivery-requests/${id}/decline`)).json(),
    onSuccess: refresh,
    onError: (error) => Alert.alert("Could not decline", readableError(error, "Refresh and try again.")),
  });
  const startTrip = useMutation({
    mutationFn: async (deliveryId: string) => (await apiRequest("PUT", `/api/delivery/${deliveryId}/status`, { status: "in_transit" })).json(),
    onSuccess: refresh,
    onError: (error) => Alert.alert("Trip not started", readableError(error, "Pickup must be verified first.")),
  });

  useEffect(() => {
    if (!current?.id || !["picked_up", "in_transit"].includes(current.status)) return;
    let cancelled = false;
    const share = async () => {
      try { await shareForegroundLocation(current.id); if (!cancelled) setSharingDeliveryId(current.id); }
      catch { if (!cancelled) setSharingDeliveryId(null); }
    };
    share();
    const timer = setInterval(share, 30000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [current?.id, current?.status]);

  const openQr = (delivery: any, stage: "pickup" | "delivery") => router.push({ pathname: "/scan-order", params: { deliveryId: delivery.id, orderId: delivery.orderId, stage } } as any);

  return <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={Colors.primary} />}>
    <View style={styles.header}><Pressable onPress={() => safeBack("/(rider)")} style={styles.iconBtn}><Ionicons name="chevron-back" size={23} color={Colors.text} /></Pressable><View style={styles.headerMiddle}><Text style={styles.eyebrow}>RIDER OPERATIONS</Text><Text style={styles.title}>Deliveries</Text></View><Pressable onPress={() => router.push("/scan-order" as any)} style={styles.iconBtn}><Ionicons name="scan-outline" size={22} color={Colors.primary} /></Pressable></View>

    {isLoading ? <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View> : <>
      <View style={styles.summary}><SummaryItem label="Offers" value={String(offers.length)} /><View style={styles.summaryLine} /><SummaryItem label="Active" value={String(active.length)} /><View style={styles.summaryLine} /><SummaryItem label="Completed" value={String(data?.metrics?.completed ?? 0)} /></View>

      <Text style={styles.sectionTitle}>Active delivery</Text>
      {current ? <View style={styles.activeCard}>
        <View style={styles.activeTop}><View><Text style={styles.orderNumber}>Order #{shortId(current.orderId)}</Text><Text style={styles.status}>{String(current.status).replace(/_/g, " ")}</Text></View><Text style={styles.fee}>{money(current.deliveryFee)}</Text></View>
        <Stop icon="storefront-outline" label="PICKUP" address={current.pickupAddress} onMap={() => openMap(current.pickupLatitude, current.pickupLongitude, current.pickupAddress)} />
        <View style={styles.routeLine} />
        <Stop icon="location-outline" label="DROP-OFF" address={current.dropoffAddress} onMap={() => openMap(current.dropoffLatitude, current.dropoffLongitude, current.dropoffAddress)} />
        {["picked_up", "in_transit"].includes(current.status) && <View style={styles.locationBanner}><View style={[styles.liveDot, sharingDeliveryId === current.id && { backgroundColor: "#22C55E" }]} /><Text style={styles.locationText}>{sharingDeliveryId === current.id ? "Live foreground location sharing is active" : "Location permission is needed for live tracking"}</Text></View>}
        <View style={styles.actionGrid}>
          <Pressable style={styles.outlineButton} onPress={() => router.push(`/order/${current.orderId}` as any)}><Ionicons name="receipt-outline" size={18} color={Colors.primary} /><Text style={styles.outlineText}>Job details</Text></Pressable>
          {current.status === "assigned" && <Pressable style={styles.primaryButton} onPress={() => openQr(current, "pickup")}><Ionicons name="scan-outline" size={18} color="#fff" /><Text style={styles.primaryText}>Verify pickup</Text></Pressable>}
          {current.status === "picked_up" && <Pressable disabled={startTrip.isPending} style={styles.primaryButton} onPress={() => startTrip.mutate(current.id)}><Ionicons name="navigate-outline" size={18} color="#fff" /><Text style={styles.primaryText}>{startTrip.isPending ? "Starting…" : "Start trip"}</Text></Pressable>}
          {current.status === "in_transit" && <Pressable style={styles.primaryButton} onPress={() => openQr(current, "delivery")}><Ionicons name="shield-checkmark-outline" size={18} color="#fff" /><Text style={styles.primaryText}>Verify delivery</Text></Pressable>}
        </View>
      </View> : <View style={styles.empty}><Ionicons name="bicycle-outline" size={32} color={Colors.primary} /><Text style={styles.emptyTitle}>No active delivery</Text><Text style={styles.emptyText}>Accept one nearby offer at a time. Its route and verification steps will appear here.</Text></View>}

      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Delivery offers</Text><Text style={styles.countBadge}>{offers.length}</Text></View>
      {offers.map((offer: any) => <View key={offer.id} style={styles.offerCard}>
        <View style={styles.offerTop}><View><Text style={styles.offerFee}>{money(offer.delivery?.deliveryFee)}</Text><Text style={styles.subtle}>Delivery fee</Text></View><View style={styles.distance}><Ionicons name="navigate-outline" size={14} color={Colors.primary} /><Text style={styles.distanceText}>{offer.distanceKm ? `${Number(offer.distanceKm).toFixed(1)} km away` : "Distance pending"}</Text></View></View>
        <Text style={styles.offerLabel}>PICKUP LOCATION</Text><Text style={styles.offerAddress}>{offer.delivery?.pickupAddress || "Pickup location"}</Text>
        <Text style={styles.expiry}>Offer expires {offer.expiresAt ? new Date(offer.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "soon"}</Text>
        <View style={styles.offerActions}><Pressable disabled={decline.isPending} style={styles.declineButton} onPress={() => decline.mutate(offer.id)}><Text style={styles.declineText}>Decline</Text></Pressable><Pressable disabled={accept.isPending || active.length > 0} style={[styles.acceptButton, active.length > 0 && { opacity: .5 }]} onPress={() => accept.mutate(offer.id)}><Text style={styles.acceptText}>{active.length > 0 ? "Finish active job" : accept.isPending ? "Accepting…" : "Accept"}</Text></Pressable></View>
      </View>)}
      {offers.length === 0 && <Text style={styles.noRows}>No unexpired offers right now.</Text>}

      <Text style={styles.sectionTitle}>Recent delivery history</Text>
      {history.filter((delivery: any) => ["delivered", "completed", "cancelled", "failed"].includes(delivery.status)).slice(0, 12).map((delivery: any) => <Pressable key={delivery.id} style={styles.historyRow} onPress={() => router.push(`/order/${delivery.orderId}` as any)}><View style={[styles.historyIcon, { backgroundColor: ["delivered", "completed"].includes(delivery.status) ? "#ECFDF5" : "#FEF2F2" }]}><Ionicons name={["delivered", "completed"].includes(delivery.status) ? "checkmark" : "alert-outline"} size={18} color={["delivered", "completed"].includes(delivery.status) ? "#059669" : "#DC2626"} /></View><View style={styles.flex}><Text style={styles.historyTitle}>Order #{shortId(delivery.orderId)}</Text><Text style={styles.subtle}>{String(delivery.status).replace(/_/g, " ")} · {delivery.createdAt ? new Date(delivery.createdAt).toLocaleDateString() : ""}</Text></View><Text style={styles.historyFee}>{money(delivery.deliveryFee)}</Text></Pressable>)}
    </>}
  </ScrollView>;
}

function SummaryItem({ label, value }: { label: string; value: string }) { return <View style={styles.summaryItem}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>; }
function Stop({ icon, label, address, onMap }: { icon: keyof typeof Ionicons.glyphMap; label: string; address: string; onMap: () => void }) { return <View style={styles.stop}><View style={styles.stopIcon}><Ionicons name={icon} size={18} color={Colors.primary} /></View><View style={styles.flex}><Text style={styles.stopLabel}>{label}</Text><Text style={styles.stopAddress}>{address}</Text></View><Pressable onPress={onMap} style={styles.mapButton}><Ionicons name="navigate" size={17} color={Colors.primary} /></Pressable></View>; }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FB" }, content: { paddingHorizontal: 18, paddingTop: 58, paddingBottom: 40 }, loading: { paddingVertical: 80 }, flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 18 }, headerMiddle: { flex: 1, marginLeft: 12 }, iconBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E2E8F0" }, eyebrow: { color: Colors.primary, fontSize: 9, letterSpacing: 1.4, fontFamily: "Inter_700Bold" }, title: { color: Colors.text, fontSize: 23, fontFamily: "Inter_700Bold", marginTop: 1 },
  summary: { flexDirection: "row", alignItems: "center", backgroundColor: "#0F172A", borderRadius: 20, paddingVertical: 16, marginBottom: 22 }, summaryItem: { flex: 1, alignItems: "center" }, summaryValue: { color: "#fff", fontSize: 21, fontFamily: "Inter_700Bold" }, summaryLabel: { color: "#94A3B8", fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 3 }, summaryLine: { width: 1, height: 30, backgroundColor: "#334155" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 10 }, countBadge: { minWidth: 27, textAlign: "center", color: Colors.primary, backgroundColor: Colors.primaryLight, borderRadius: 12, paddingVertical: 4, marginBottom: 10, fontFamily: "Inter_700Bold" },
  activeCard: { backgroundColor: Colors.surface, borderRadius: 22, padding: 17, borderWidth: 1, borderColor: "#BFDBFE", marginBottom: 22 }, activeTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: "#EFF3F8" }, orderNumber: { color: Colors.text, fontSize: 17, fontFamily: "Inter_700Bold" }, status: { color: Colors.primary, textTransform: "capitalize", marginTop: 4, fontFamily: "Inter_600SemiBold", fontSize: 12 }, fee: { color: Colors.text, fontSize: 19, fontFamily: "Inter_700Bold" }, stop: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 13 }, stopIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" }, stopLabel: { color: Colors.textMuted, fontSize: 9, letterSpacing: 1, fontFamily: "Inter_700Bold" }, stopAddress: { color: Colors.text, fontSize: 13, lineHeight: 18, marginTop: 3, fontFamily: "Inter_500Medium" }, mapButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" }, routeLine: { width: 2, height: 12, backgroundColor: "#BFDBFE", marginLeft: 18 }, locationBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F1F5F9", borderRadius: 11, padding: 10, marginTop: 3 }, liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#F59E0B" }, locationText: { color: Colors.textSecondary, fontSize: 11, fontFamily: "Inter_500Medium" }, actionGrid: { flexDirection: "row", gap: 9, marginTop: 14 }, outlineButton: { flex: 1, height: 47, borderWidth: 1, borderColor: "#BFDBFE", borderRadius: 13, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" }, outlineText: { color: Colors.primary, fontFamily: "Inter_700Bold", fontSize: 12 }, primaryButton: { flex: 1, height: 47, borderRadius: 13, backgroundColor: Colors.primary, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" }, primaryText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 12 },
  empty: { alignItems: "center", backgroundColor: Colors.surface, borderRadius: 20, padding: 24, marginBottom: 22 }, emptyTitle: { color: Colors.text, fontFamily: "Inter_700Bold", fontSize: 15, marginTop: 8 }, emptyText: { color: Colors.textMuted, textAlign: "center", fontSize: 12, lineHeight: 18, marginTop: 5, maxWidth: 300 },
  offerCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 17, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 11 }, offerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }, offerFee: { color: Colors.text, fontSize: 23, fontFamily: "Inter_700Bold" }, subtle: { color: Colors.textMuted, fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 3, textTransform: "capitalize" }, distance: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.primaryLight, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 7 }, distanceText: { color: Colors.primary, fontSize: 11, fontFamily: "Inter_700Bold" }, offerLabel: { color: Colors.primary, fontSize: 9, letterSpacing: 1.1, fontFamily: "Inter_700Bold", marginTop: 14 }, offerAddress: { color: Colors.text, fontSize: 13, lineHeight: 19, fontFamily: "Inter_600SemiBold", marginTop: 3 }, expiry: { color: Colors.textMuted, fontSize: 11, marginTop: 7 }, offerActions: { flexDirection: "row", gap: 9, marginTop: 15 }, declineButton: { flex: 1, height: 45, borderRadius: 13, borderWidth: 1, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center" }, declineText: { color: Colors.textSecondary, fontFamily: "Inter_700Bold" }, acceptButton: { flex: 1.5, height: 45, borderRadius: 13, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" }, acceptText: { color: "#fff", fontFamily: "Inter_700Bold" }, noRows: { color: Colors.textMuted, textAlign: "center", backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 22 },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: Colors.surface, borderRadius: 16, padding: 14, marginBottom: 9 }, historyIcon: { width: 39, height: 39, borderRadius: 13, alignItems: "center", justifyContent: "center" }, historyTitle: { color: Colors.text, fontSize: 13, fontFamily: "Inter_700Bold" }, historyFee: { color: Colors.text, fontSize: 13, fontFamily: "Inter_700Bold" },
});
