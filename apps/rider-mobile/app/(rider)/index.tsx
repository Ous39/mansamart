import React from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, queryClient } from "@/lib/query-client";
import { readForegroundLocation } from "@/lib/rider-location";
import { readableError } from "@/lib/errors";

function money(value?: number) { return `D ${(Number(value) || 0).toLocaleString()}`; }
function shortId(id?: string) { return String(id || "").slice(0, 8).toUpperCase() || "—"; }

export default function RiderDashboard() {
  const { user } = useAuth();
  const { data, isLoading, refetch, isFetching } = useQuery<any>({ queryKey: ["/api/rider/dashboard"], refetchInterval: 10000 });
  const profile = data?.profile;
  const active = data?.activeDeliveries ?? [];
  const offers = data?.offers ?? [];
  const verified = profile?.verificationStatus === "verified";

  const refreshRider = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/rider/dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/rider/finance"] });
  };

  const toggleOnline = useMutation({
    mutationFn: async () => {
      const goingOnline = !profile?.isOnline;
      let location: { latitude?: number; longitude?: number; accuracy?: number; heading?: number; speed?: number } = {};
      if (goingOnline) {
        try { location = await readForegroundLocation(); }
        catch (error) { Alert.alert("Location unavailable", readableError(error, "You can add location access later from phone settings.")); }
      }
      return (await apiRequest("PUT", "/api/rider/status", { isOnline: goingOnline, isAvailable: goingOnline, ...location })).json();
    },
    onSuccess: refreshRider,
    onError: (error) => Alert.alert("Status not changed", readableError(error, "Complete verification before going online.")),
  });

  const accept = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/delivery-requests/${id}/accept`)).json(),
    onSuccess: () => { refreshRider(); router.push("/(rider)/deliveries" as any); },
    onError: (error) => Alert.alert("Offer unavailable", readableError(error, "Another rider may already have accepted this delivery.")),
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={Colors.primary} />}>
      <View style={styles.header}>
        <View><Text style={styles.eyebrow}>MANSA RIDE</Text><Text style={styles.title}>Hello, {user?.name?.split(" ")[0] || "Rider"}</Text></View>
        <Pressable style={styles.avatarBtn} onPress={() => router.push("/(rider)/settings")}><Ionicons name="person-outline" size={22} color={Colors.primary} /></Pressable>
      </View>

      {isLoading ? <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View> : <>
        <View style={styles.availabilityCard}>
          <View style={styles.availabilityTop}>
            <View style={[styles.statusDot, { backgroundColor: profile?.isOnline ? "#22C55E" : "#94A3B8" }]} />
            <View style={styles.flex}><Text style={styles.availabilityTitle}>{profile?.isOnline ? (profile?.isAvailable ? "Online and available" : "Online—delivery active") : "You are offline"}</Text><Text style={styles.availabilityText}>{profile?.isOnline ? "MansaMart can send eligible jobs to this phone." : "Go online when you are ready to receive nearby jobs."}</Text></View>
          </View>
          {!verified && <Pressable style={styles.verifyBanner} onPress={() => router.push("/(rider)/settings")}><Ionicons name="shield-outline" size={19} color="#92400E" /><View style={styles.flex}><Text style={styles.verifyTitle}>Approval required</Text><Text style={styles.verifyText}>Complete your rider profile and documents before going online.</Text></View><Ionicons name="chevron-forward" size={18} color="#92400E" /></Pressable>}
          <Pressable disabled={toggleOnline.isPending} style={[styles.onlineButton, profile?.isOnline && styles.offlineButton]} onPress={() => toggleOnline.mutate()}>
            {toggleOnline.isPending ? <ActivityIndicator color={profile?.isOnline ? Colors.primary : "#fff"} /> : <><Ionicons name={profile?.isOnline ? "power-outline" : "navigate-circle-outline"} size={20} color={profile?.isOnline ? Colors.primary : "#fff"} /><Text style={[styles.onlineButtonText, profile?.isOnline && { color: Colors.primary }]}>{profile?.isOnline ? "Go offline" : "Go online"}</Text></>}
          </Pressable>
        </View>

        <View style={styles.metrics}>
          <Metric icon="checkmark-done-outline" label="Completed" value={String(data?.metrics?.completed ?? 0)} />
          <Metric icon="star-outline" label="Rating" value={Number(data?.metrics?.rating || 0).toFixed(1)} />
          <Metric icon="cash-outline" label="Earned" value={money(data?.totalEarnings)} />
        </View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Current work</Text><Pressable onPress={() => router.push("/(rider)/deliveries" as any)}><Text style={styles.link}>See all</Text></Pressable></View>
        {active.slice(0, 1).map((delivery: any) => <Pressable key={delivery.id} style={styles.activeCard} onPress={() => router.push(`/order/${delivery.orderId}` as any)}>
          <View style={styles.jobIcon}><Ionicons name="bicycle" size={22} color="#fff" /></View><View style={styles.flex}><Text style={styles.jobTitle}>Order #{shortId(delivery.orderId)}</Text><Text style={styles.jobMeta}>{String(delivery.status).replace(/_/g, " ")} · {money(delivery.deliveryFee)}</Text><Text style={styles.jobAddress} numberOfLines={1}>{delivery.status === "assigned" ? delivery.pickupAddress : delivery.dropoffAddress}</Text></View><Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
        </Pressable>)}
        {active.length === 0 && <View style={styles.emptyCard}><Ionicons name="map-outline" size={26} color={Colors.primary} /><View style={styles.flex}><Text style={styles.emptyTitle}>No active delivery</Text><Text style={styles.emptyText}>Your accepted job will appear here.</Text></View></View>}

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Nearby offers</Text><Text style={styles.offerCount}>{offers.length}</Text></View>
        {offers.slice(0, 3).map((offer: any) => <View key={offer.id} style={styles.offerCard}>
          <View style={styles.offerTop}><View><Text style={styles.offerFee}>{money(offer.delivery?.deliveryFee)}</Text><Text style={styles.jobMeta}>Delivery fee</Text></View><View style={styles.distancePill}><Ionicons name="navigate-outline" size={14} color={Colors.primary} /><Text style={styles.distanceText}>{offer.distanceKm ? `${Number(offer.distanceKm).toFixed(1)} km` : "Nearby"}</Text></View></View>
          <Text style={styles.pickupLabel}>PICKUP</Text><Text style={styles.offerAddress} numberOfLines={2}>{offer.delivery?.pickupAddress || "Pickup address available after acceptance"}</Text>
          <Pressable disabled={accept.isPending || !verified} style={[styles.acceptButton, !verified && styles.disabled]} onPress={() => accept.mutate(offer.id)}><Text style={styles.acceptText}>{accept.isPending ? "Accepting…" : verified ? "Accept delivery" : "Verification required"}</Text></Pressable>
        </View>)}
        {offers.length === 0 && <View style={styles.emptyOffers}><Text style={styles.emptyTitle}>No new offers</Text><Text style={styles.emptyText}>{profile?.isOnline ? "Stay available—new requests refresh automatically." : "Go online to receive nearby delivery requests."}</Text></View>}

        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={styles.quickGrid}>
          <Quick icon="scan-outline" label="Verify QR" onPress={() => router.push("/scan-order")} />
          <Quick icon="wallet-outline" label="Earnings" onPress={() => router.push("/(rider)/earnings" as any)} />
          <Quick icon="notifications-outline" label="Alerts" onPress={() => router.push("/notifications")} />
          <Quick icon="person-outline" label="Rider profile" onPress={() => router.push("/(rider)/settings")} />
        </View>
      </>}
    </ScrollView>
  );
}

function Metric({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) { return <View style={styles.metric}><Ionicons name={icon} size={19} color={Colors.primary} /><Text style={styles.metricValue} numberOfLines={1}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function Quick({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) { return <Pressable style={styles.quick} onPress={onPress}><View style={styles.quickIcon}><Ionicons name={icon} size={21} color={Colors.primary} /></View><Text style={styles.quickText}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FB" }, content: { paddingHorizontal: 18, paddingTop: 58, paddingBottom: 40 }, flex: { flex: 1 }, loading: { paddingVertical: 80 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }, eyebrow: { color: Colors.primary, fontSize: 11, letterSpacing: 1.8, fontFamily: "Inter_700Bold" }, title: { color: Colors.text, fontSize: 26, fontFamily: "Inter_700Bold", marginTop: 3 }, avatarBtn: { width: 46, height: 46, borderRadius: 16, backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#DBEAFE" },
  availabilityCard: { backgroundColor: "#0F172A", borderRadius: 24, padding: 18, marginBottom: 14 }, availabilityTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 }, statusDot: { width: 11, height: 11, borderRadius: 6, marginTop: 5, borderWidth: 2, borderColor: "rgba(255,255,255,.5)" }, availabilityTitle: { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold" }, availabilityText: { color: "#CBD5E1", fontSize: 12, lineHeight: 18, marginTop: 4, fontFamily: "Inter_400Regular" }, verifyBanner: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#FEF3C7", borderRadius: 14, padding: 12, marginTop: 14 }, verifyTitle: { color: "#92400E", fontSize: 13, fontFamily: "Inter_700Bold" }, verifyText: { color: "#A16207", fontSize: 11, lineHeight: 16, marginTop: 2 }, onlineButton: { height: 50, marginTop: 16, borderRadius: 14, backgroundColor: Colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, offlineButton: { backgroundColor: "#fff" }, onlineButtonText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  metrics: { flexDirection: "row", gap: 9, marginBottom: 20 }, metric: { flex: 1, backgroundColor: Colors.surface, borderRadius: 17, padding: 13, borderWidth: 1, borderColor: "#E8EDF5" }, metricValue: { color: Colors.text, fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 8 }, metricLabel: { color: Colors.textMuted, fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }, sectionTitle: { color: Colors.text, fontSize: 17, fontFamily: "Inter_700Bold", marginTop: 2, marginBottom: 10 }, link: { color: Colors.primary, fontFamily: "Inter_700Bold", fontSize: 13 }, offerCount: { color: Colors.primary, backgroundColor: Colors.primaryLight, minWidth: 27, textAlign: "center", borderRadius: 12, paddingVertical: 4, fontFamily: "Inter_700Bold", fontSize: 12 },
  activeCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.surface, borderRadius: 18, padding: 15, borderWidth: 1, borderColor: "#BFDBFE", marginBottom: 20 }, jobIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" }, jobTitle: { color: Colors.text, fontFamily: "Inter_700Bold", fontSize: 14 }, jobMeta: { color: Colors.textMuted, fontFamily: "Inter_500Medium", fontSize: 12, textTransform: "capitalize", marginTop: 3 }, jobAddress: { color: Colors.textSecondary, fontSize: 12, marginTop: 5 },
  emptyCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.surface, borderRadius: 18, padding: 16, marginBottom: 20 }, emptyTitle: { color: Colors.text, fontFamily: "Inter_700Bold", fontSize: 14 }, emptyText: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  offerCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 17, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 11 }, offerTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }, offerFee: { fontSize: 22, color: Colors.text, fontFamily: "Inter_700Bold" }, distancePill: { flexDirection: "row", gap: 5, alignItems: "center", backgroundColor: Colors.primaryLight, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20 }, distanceText: { color: Colors.primary, fontSize: 12, fontFamily: "Inter_700Bold" }, pickupLabel: { color: Colors.primary, fontSize: 9, letterSpacing: 1.2, fontFamily: "Inter_700Bold", marginTop: 14 }, offerAddress: { color: Colors.text, fontSize: 13, lineHeight: 19, fontFamily: "Inter_500Medium", marginTop: 3 }, acceptButton: { height: 46, borderRadius: 13, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", marginTop: 15 }, acceptText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }, disabled: { opacity: .55 }, emptyOffers: { backgroundColor: Colors.surface, borderRadius: 18, padding: 18, marginBottom: 20 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, quick: { width: "48%", flexGrow: 1, backgroundColor: Colors.surface, borderRadius: 17, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#E8EDF5" }, quickIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" }, quickText: { color: Colors.text, fontFamily: "Inter_600SemiBold", fontSize: 13 },
});
