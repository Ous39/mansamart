import React from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { apiRequest, queryClient } from "@/lib/query-client";
import { safeBack } from "@/lib/navigation";

function money(value?: number) {
  return `D ${(Number(value) || 0).toLocaleString()}`;
}

function shortId(value?: string) {
  return String(value || "").slice(0, 8).toUpperCase() || "—";
}

export default function DeliveryOfferDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/delivery-requests", id],
    enabled: Boolean(id),
    refetchInterval: 5000,
  });

  const accept = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/delivery-requests/${id}/accept`);
      return response.json();
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/rider/dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      router.replace(`/order/${result.order.id}` as any);
    },
    onError: (acceptError: any) => {
      Alert.alert("Offer unavailable", acceptError?.message || "Another rider may have accepted this delivery.");
    },
  });

  if (isLoading) {
    return <View style={styles.center}><Stack.Screen options={{ headerShown: false }} /><ActivityIndicator size="large" color={Colors.primary} /><Text style={styles.muted}>Loading the full order…</Text></View>;
  }

  if (error || !data?.order || !data?.delivery) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: false }} />
        <Ionicons name="alert-circle-outline" size={54} color={Colors.error} />
        <Text style={styles.errorTitle}>This offer is no longer available</Text>
        <Text style={styles.muted}>It may have expired or been accepted by another rider.</Text>
        <Pressable style={styles.outlineButton} onPress={() => safeBack("/(rider)/deliveries")}><Text style={styles.outlineText}>Back to deliveries</Text></Pressable>
      </View>
    );
  }

  const { request, delivery, order } = data;
  const expired = request.expiresAt ? new Date(request.expiresAt).getTime() <= Date.now() : false;
  const available = request.status === "offered" && delivery.status === "searching" && !expired;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Pressable onPress={() => safeBack("/(rider)/deliveries")} style={styles.backButton}><Ionicons name="arrow-back" size={23} color={Colors.text} /></Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Review delivery</Text>
          <Text style={styles.headerSubtitle}>Order #{shortId(order.id)}</Text>
        </View>
        <View style={[styles.offerBadge, !available && styles.closedBadge]}><Text style={[styles.offerBadgeText, !available && styles.closedBadgeText]}>{available ? "Available" : "Closed"}</Text></View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 130 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.notice}>
          <Ionicons name="information-circle" size={22} color="#1D4ED8" />
          <Text style={styles.noticeText}>Check every detail before accepting. Navigation becomes available after you accept.</Text>
        </View>

        <View style={styles.summaryRow}>
          <Summary icon="navigate-outline" label="Distance" value={request.distanceKm ? `${Number(request.distanceKm).toFixed(2)} km` : "Not calculated"} />
          <Summary icon="wallet-outline" label="Rider fee" value={money(delivery.deliveryFee)} />
          <Summary icon="cube-outline" label="Items" value={String(order.items?.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0) || 0)} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery route</Text>
          <RouteRow icon="storefront-outline" label="Vendor pickup" value={delivery.pickupAddress || "Vendor location"} color="#E8813A" />
          <View style={styles.routeLine} />
          <RouteRow icon="home-outline" label="Customer drop-off" value={delivery.dropoffAddress || `${order.address}, ${order.city}`} color="#E63946" />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order items</Text>
          {(order.items || []).map((item: any, index: number) => (
            <View key={`${item.productId || item.name}-${index}`} style={styles.itemRow}>
              <View style={styles.itemIcon}><Ionicons name="cube-outline" size={19} color={Colors.primary} /></View>
              <View style={styles.itemBody}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.muted}>Quantity: {item.quantity}{item.vendorName ? ` · ${item.vendorName}` : ""}</Text>
              </View>
              <Text style={styles.itemPrice}>{money(Number(item.price || 0) * Number(item.quantity || 0))}</Text>
            </View>
          ))}
          <View style={styles.totalRow}><Text style={styles.totalLabel}>Order total</Text><Text style={styles.totalValue}>{money(order.total)}</Text></View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Customer and payment</Text>
          <DetailRow icon="location-outline" label={`${order.address}, ${order.city}`} />
          <DetailRow icon="call-outline" label={order.phone || "No phone supplied"} />
          <DetailRow icon="card-outline" label={`${String(order.paymentMethod || "payment").replace(/_/g, " ")} · ${String(order.paymentStatus || "pending").replace(/_/g, " ")}`} />
          {order.notes ? <DetailRow icon="chatbubble-outline" label={order.notes} /> : null}
        </View>

        <Text style={styles.expiryText}>{request.expiresAt ? `Offer expires ${new Date(request.expiresAt).toLocaleTimeString()}` : "Accept while this offer is available."}</Text>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Pressable disabled={!available || accept.isPending} onPress={() => accept.mutate()} style={[styles.acceptButton, (!available || accept.isPending) && styles.acceptDisabled]}>
          {accept.isPending ? <ActivityIndicator color="#fff" /> : <><Ionicons name="checkmark-circle-outline" size={21} color="#fff" /><Text style={styles.acceptText}>{available ? "Accept this delivery" : "Offer unavailable"}</Text></>}
        </Pressable>
      </View>
    </View>
  );
}

function Summary({ icon, label, value }: { icon: string; label: string; value: string }) {
  return <View style={styles.summary}><Ionicons name={icon as any} size={19} color={Colors.primary} /><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
}

function RouteRow({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return <View style={styles.routeRow}><View style={[styles.routeIcon, { backgroundColor: `${color}18` }]}><Ionicons name={icon as any} size={19} color={color} /></View><View style={styles.itemBody}><Text style={styles.routeLabel}>{label}</Text><Text style={styles.routeValue}>{value}</Text></View></View>;
}

function DetailRow({ icon, label }: { icon: string; label: string }) {
  return <View style={styles.detailRow}><Ionicons name={icon as any} size={18} color={Colors.textMuted} /><Text style={styles.detailText}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, backgroundColor: Colors.background, alignItems: "center", justifyContent: "center", padding: 28, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingBottom: 14, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  backButton: { width: 40, height: 40, borderRadius: 13, backgroundColor: Colors.background, alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1, marginLeft: 12 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.text },
  headerSubtitle: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  offerBadge: { borderRadius: 999, backgroundColor: Colors.primaryLight, paddingHorizontal: 10, paddingVertical: 6 },
  offerBadgeText: { color: Colors.primary, fontFamily: "Inter_700Bold", fontSize: 11 },
  closedBadge: { backgroundColor: "#F1F5F9" },
  closedBadgeText: { color: Colors.textMuted },
  content: { padding: 18, gap: 14 },
  notice: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 16, backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE" },
  noticeText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 13, lineHeight: 19, color: "#1E3A8A" },
  summaryRow: { flexDirection: "row", gap: 9 },
  summary: { flex: 1, alignItems: "center", backgroundColor: Colors.surface, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 5, borderWidth: 1, borderColor: Colors.borderLight },
  summaryValue: { fontFamily: "Inter_700Bold", color: Colors.text, marginTop: 5, fontSize: 13, textAlign: "center" },
  summaryLabel: { fontFamily: "Inter_400Regular", color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  card: { backgroundColor: Colors.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: Colors.borderLight },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.text, marginBottom: 12 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  routeIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  routeLabel: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.textMuted },
  routeValue: { fontFamily: "Inter_600SemiBold", fontSize: 13, lineHeight: 18, color: Colors.text, marginTop: 2 },
  routeLine: { width: 2, height: 18, backgroundColor: Colors.border, marginLeft: 19, marginVertical: 2 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  itemIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" },
  itemBody: { flex: 1 },
  itemName: { fontFamily: "Inter_600SemiBold", color: Colors.text, fontSize: 13 },
  itemPrice: { fontFamily: "Inter_700Bold", color: Colors.text, fontSize: 13 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  totalLabel: { fontFamily: "Inter_600SemiBold", color: Colors.textMuted },
  totalValue: { fontFamily: "Inter_700Bold", color: Colors.primary, fontSize: 17 },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  detailText: { flex: 1, fontFamily: "Inter_500Medium", color: Colors.textSecondary, fontSize: 13, lineHeight: 19, textTransform: "capitalize" },
  expiryText: { fontFamily: "Inter_500Medium", color: Colors.textMuted, fontSize: 12, textAlign: "center" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  acceptButton: { minHeight: 52, borderRadius: 15, backgroundColor: Colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  acceptDisabled: { backgroundColor: "#94A3B8" },
  acceptText: { fontFamily: "Inter_700Bold", color: "#fff", fontSize: 15 },
  outlineButton: { marginTop: 10, borderWidth: 1, borderColor: Colors.border, borderRadius: 13, paddingHorizontal: 18, paddingVertical: 12 },
  outlineText: { fontFamily: "Inter_700Bold", color: Colors.text },
  errorTitle: { fontFamily: "Inter_700Bold", color: Colors.text, fontSize: 18, textAlign: "center" },
  muted: { fontFamily: "Inter_400Regular", color: Colors.textMuted, fontSize: 12, textAlign: "center" },
});
