import React from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { safeBack } from "@/lib/navigation";
import { RiderDeliveryMap } from "@/components/RiderDeliveryMap";

const STATUS_STEPS = [
  { key: "pending", label: "Order Placed", icon: "checkmark-circle", desc: "We've received your order" },
  { key: "paid", label: "Payment Held", icon: "wallet-outline", desc: "Funds are held securely in escrow" },
  { key: "confirmed", label: "Confirmed", icon: "checkmark-done", desc: "Vendor confirmed your order" },
  { key: "ready_for_pickup", label: "Ready", icon: "cube-outline", desc: "Order is ready for pickup/delivery" },
  { key: "rider_assigned", label: "Rider Assigned", icon: "bicycle-outline", desc: "A rider has accepted the delivery" },
  { key: "picked_up", label: "Picked Up", icon: "archive-outline", desc: "QR handover confirmed" },
  { key: "on_the_way", label: "On The Way", icon: "navigate-outline", desc: "Rider is on the way" },
  { key: "delivered", label: "Delivered", icon: "home-outline", desc: "Delivery verified" },
  { key: "completed", label: "Completed", icon: "shield-checkmark", desc: "Payment released" },
];

const STATUS_ORDER = ["pending", "paid", "confirmed", "processing", "preparing", "ready_for_pickup", "searching_rider", "rider_assigned", "picked_up", "on_the_way", "shipped", "delivered", "completed"];
const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B",
  paid: "#0EA47A",
  confirmed: "#2563EB",
  processing: "#2563EB",
  preparing: "#2563EB",
  ready_for_pickup: "#E8813A",
  searching_rider: "#E8813A",
  rider_assigned: "#7B4FA3",
  picked_up: "#7B4FA3",
  on_the_way: "#E8813A",
  shipped: "#E8813A",
  delivered: "#0EA47A",
  completed: "#0EA47A",
  cancelled: "#E63946",
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtPrice(p: number) { return `D ${p.toLocaleString()}`; }

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: tracking, isLoading, error } = useQuery<any>({
    queryKey: ["/api/orders", id, "tracking"],
    refetchInterval: 10000,
  });
  const order = tracking?.order;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ marginTop: 12, color: "#999" }}>Loading order...</Text>
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: false }} />
        <Ionicons name="alert-circle-outline" size={60} color="#E63946" />
        <Text style={styles.errTitle}>Order not found</Text>
        <Pressable onPress={() => safeBack("/order-tracking")} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const currentIdx = order.status === "cancelled" ? -1 : STATUS_ORDER.indexOf(order.status);
  const statusColor = STATUS_COLORS[order.status] || Colors.primary;
  const deliveryStatus = tracking?.delivery?.status || order.status;
  const pickupConfirmed = ["picked_up", "on_the_way", "in_transit", "delivered", "completed"].includes(String(deliveryStatus));
  const deliveryFinished = ["delivered", "completed"].includes(String(deliveryStatus));
  return (
    <View style={{ flex: 1, backgroundColor: "#F7F8FA" }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Pressable onPress={() => safeBack("/order-tracking")} style={styles.backPress}>
          <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
        </Pressable>
        <Text style={styles.headerTitle}>Order #{order.id.slice(-8).toUpperCase()}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Tracking */}
        {order.status !== "cancelled" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Order Tracking</Text>
            {order.trackingCode && (
              <View style={styles.trackingCode}>
                <Ionicons name="barcode-outline" size={16} color="#666" />
                <Text style={styles.trackingText}>Tracking: {order.trackingCode}</Text>
              </View>
            )}
            <View style={styles.timeline}>
              {STATUS_STEPS.map((step, i) => {
                const done = i <= currentIdx;
                const active = i === currentIdx;
                return (
                  <View key={step.key} style={styles.timelineRow}>
                    <View style={styles.timelineLeft}>
                      <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]}>
                        <Ionicons
                          name={done ? "checkmark" : step.icon as any}
                          size={14}
                          color={done ? "#fff" : "#ccc"}
                        />
                      </View>
                      {i < STATUS_STEPS.length - 1 && (
                        <View style={[styles.line, done && styles.lineDone]} />
                      )}
                    </View>
                    <View style={styles.timelineContent}>
                      <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>{step.label}</Text>
                      <Text style={styles.stepDesc}>{step.desc}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
            {order.estimatedDelivery && (
              <View style={styles.eta}>
                <Ionicons name="calendar-outline" size={14} color={Colors.primary} />
                <Text style={styles.etaText}>Estimated delivery: {order.estimatedDelivery}</Text>
              </View>
            )}
          </View>
        )}

        {order.qrCode && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Order QR Verification</Text>
            <View style={styles.qrBox}>
              <Ionicons name="qr-code-outline" size={44} color={Colors.primary} />
              <Text style={styles.qrText}>{order.qrCode}</Text>
            </View>
            <Text style={styles.stepDesc}>Vendor, rider, or shopper can scan/enter this code to confirm pickup or delivery.</Text>
            <Pressable style={[styles.actionBtn, { marginTop: 12 }]} onPress={() => router.push("/scan-order")}>
              <Ionicons name="scan-outline" size={18} color={Colors.primary} />
              <Text style={styles.actionBtnText}>Open Scan Order</Text>
            </Pressable>
          </View>
        )}

        {tracking?.events?.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Live Tracking Events</Text>
            {tracking.events.map((ev: any) => (
              <View key={ev.id} style={styles.eventRow}>
                <Text style={styles.stepLabelDone}>{ev.title}</Text>
                <Text style={styles.stepDesc}>{ev.message || ev.status}</Text>
                <Text style={styles.itemQty}>{fmt(ev.createdAt)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Items */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Items ({order.items?.length ?? 0})</Text>
          {(order.items || []).map((item: any, i: number) => (
            <View key={i} style={styles.itemRow}>
              <View style={styles.itemIcon}>
                <Ionicons name="cube-outline" size={20} color={Colors.primary} />
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
              </View>
              <Text style={styles.itemPrice}>{fmtPrice(item.price * item.quantity)}</Text>
            </View>
          ))}

          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{fmtPrice(order.subtotal)}</Text>
          </View>
          {order.shipping > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Shipping</Text>
              <Text style={styles.totalValue}>{fmtPrice(order.shipping)}</Text>
            </View>
          )}
          {order.discount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount</Text>
              <Text style={[styles.totalValue, { color: Colors.primary }]}>-{fmtPrice(order.discount)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.grandTotal]}>
            <Text style={styles.grandLabel}>Total</Text>
            <Text style={styles.grandValue}>{fmtPrice(order.total)}</Text>
          </View>
        </View>


        {tracking?.delivery && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Map & Navigation</Text>
            <View style={styles.infoRow}>
              <Ionicons name="storefront-outline" size={16} color="#666" />
              <Text style={styles.infoText}>Pickup: {tracking.delivery.pickupAddress || "Vendor location"}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="home-outline" size={16} color="#666" />
              <Text style={styles.infoText}>Drop-off: {tracking.delivery.dropoffAddress || `${order.address}, ${order.city}`}</Text>
            </View>
            <RiderDeliveryMap
              pickupLatitude={tracking.delivery.pickupLatitude}
              pickupLongitude={tracking.delivery.pickupLongitude}
              pickupAddress={tracking.delivery.pickupAddress}
              dropoffLatitude={tracking.delivery.dropoffLatitude}
              dropoffLongitude={tracking.delivery.dropoffLongitude}
              dropoffAddress={tracking.delivery.dropoffAddress || `${order.address}, ${order.city}`}
              status={deliveryStatus}
            />
            {!pickupConfirmed ? (
              <View style={styles.stageCard}>
                <View style={styles.stageIcon}><Ionicons name="storefront-outline" size={20} color="#E8813A" /></View>
                <View style={styles.stageBody}>
                  <Text style={styles.stageTitle}>Stage 1 · Collect from vendor</Text>
                  <Text style={styles.stageText}>Navigate to the shop first. At pickup, confirm the vendor handover before travelling to the customer.</Text>
                  <Pressable style={styles.stageButton} onPress={() => router.push({ pathname: "/scan-order", params: { orderId: order.id, purpose: "pickup" } } as any)}>
                    <Ionicons name="scan-outline" size={17} color={Colors.primary} />
                    <Text style={styles.stageButtonText}>Confirm vendor pickup</Text>
                  </Pressable>
                </View>
              </View>
            ) : !deliveryFinished ? (
              <View style={[styles.stageCard, styles.customerStage]}>
                <View style={[styles.stageIcon, { backgroundColor: Colors.primaryLight }]}><Ionicons name="checkmark-circle" size={21} color={Colors.primary} /></View>
                <View style={styles.stageBody}>
                  <Text style={styles.stageTitle}>Stage 2 · Deliver to customer</Text>
                  <Text style={styles.stageText}>Vendor pickup is confirmed. The navigation button now takes you to the customer.</Text>
                  <Pressable style={styles.stageButton} onPress={() => router.push({ pathname: "/scan-order", params: { orderId: order.id, purpose: "delivery" } } as any)}>
                    <Ionicons name="shield-checkmark-outline" size={17} color={Colors.primary} />
                    <Text style={styles.stageButtonText}>Confirm customer delivery</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={[styles.stageCard, styles.customerStage]}>
                <Ionicons name="checkmark-circle" size={26} color={Colors.primary} />
                <View style={styles.stageBody}><Text style={styles.stageTitle}>Delivery completed</Text><Text style={styles.stageText}>The customer handover has been verified.</Text></View>
              </View>
            )}
          </View>
        )}

        {/* Delivery Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery Details</Text>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color="#666" />
            <Text style={styles.infoText}>{order.address}, {order.city}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={16} color="#666" />
            <Text style={styles.infoText}>{order.phone}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="wallet-outline" size={16} color="#666" />
            <Text style={styles.infoText}>{order.paymentMethod}</Text>
          </View>
          {order.notes && (
            <View style={styles.infoRow}>
              <Ionicons name="chatbubble-outline" size={16} color="#666" />
              <Text style={styles.infoText}>{order.notes}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={16} color="#666" />
            <Text style={styles.infoText}>Placed on {fmt(order.createdAt)}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.card}>
          <Pressable style={styles.actionBtn} onPress={() => router.push("/")}>
            <Ionicons name="bag-outline" size={18} color={Colors.primary} />
            <Text style={styles.actionBtnText}>Continue Shopping</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, { marginTop: 8 }]} onPress={() => router.push("/(tabs)/wishlist" as any)}>
            <Ionicons name="chatbubble-outline" size={18} color="#666" />
            <Text style={[styles.actionBtnText, { color: "#666" }]}>Contact Support</Text>
          </Pressable>
        </View>

        <View style={{ height: Platform.OS === "web" ? 34 : insets.bottom + 16 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F8FA" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
  },
  backPress: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#1A1A2E", flex: 1, marginLeft: 8 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: "700" },
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#1A1A2E", marginBottom: 12 },
  trackingCode: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12, backgroundColor: "#F7F8FA", borderRadius: 8, padding: 8 },
  trackingText: { fontSize: 12, color: "#666", fontWeight: "600" },
  timeline: { gap: 0 },
  timelineRow: { flexDirection: "row", gap: 12 },
  timelineLeft: { alignItems: "center", width: 28 },
  dot: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#eee", alignItems: "center", justifyContent: "center" },
  dotDone: { backgroundColor: Colors.primary },
  dotActive: { backgroundColor: Colors.primary, shadowColor: Colors.primary, shadowOpacity: 0.4, shadowRadius: 6, elevation: 4 },
  line: { width: 2, flex: 1, backgroundColor: "#eee", minHeight: 20, marginVertical: 2 },
  lineDone: { backgroundColor: Colors.primary },
  timelineContent: { flex: 1, paddingBottom: 16 },
  stepLabel: { fontSize: 14, fontWeight: "600", color: "#ccc" },
  stepLabelDone: { color: "#1A1A2E" },
  stepDesc: { fontSize: 12, color: "#999", marginTop: 2 },
  eta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, backgroundColor: "#E6FAF3", borderRadius: 8, padding: 8 },
  etaText: { fontSize: 12, color: Colors.primary, fontWeight: "600" },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F5F5F5" },
  itemIcon: { width: 40, height: 40, backgroundColor: "#F0FFF8", borderRadius: 10, alignItems: "center", justifyContent: "center" },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 13, fontWeight: "600", color: "#1A1A2E" },
  itemQty: { fontSize: 12, color: "#888", marginTop: 2 },
  itemPrice: { fontSize: 13, fontWeight: "700", color: "#1A1A2E" },
  divider: { height: 1, backgroundColor: "#F0F0F0", marginVertical: 10 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  totalLabel: { fontSize: 14, color: "#666" },
  totalValue: { fontSize: 14, color: "#1A1A2E", fontWeight: "600" },
  grandTotal: { marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F0F0F0" },
  grandLabel: { fontSize: 16, fontWeight: "700", color: "#1A1A2E" },
  grandValue: { fontSize: 18, fontWeight: "800", color: Colors.primary },
  qrBox: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 16, padding: 18, marginVertical: 12, backgroundColor: "#fff" },
  qrText: { marginTop: 10, fontWeight: "800", color: "#1A1A2E", textAlign: "center" },
  eventRow: { borderBottomWidth: 1, borderBottomColor: "#F1F5F9", paddingVertical: 10 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#F5F5F5" },
  infoText: { fontSize: 14, color: "#444", flex: 1 },
  errTitle: { fontSize: 18, fontWeight: "700", color: "#1A1A2E", marginTop: 12 },
  backBtn: { marginTop: 16, backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  backBtnText: { color: "#fff", fontWeight: "700" },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F7F8FA", borderRadius: 12, padding: 14 },
  actionBtnText: { fontSize: 14, fontWeight: "600", color: Colors.primary },
  stageCard: { flexDirection: "row", gap: 11, marginTop: 12, padding: 12, backgroundColor: "#FFF7ED", borderWidth: 1, borderColor: "#FED7AA", borderRadius: 14 },
  customerStage: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
  stageIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#FFEDD5", alignItems: "center", justifyContent: "center" },
  stageBody: { flex: 1 },
  stageTitle: { fontSize: 13, fontWeight: "800", color: Colors.text },
  stageText: { fontSize: 12, color: Colors.textMuted, lineHeight: 18, marginTop: 3 },
  stageButton: { minHeight: 40, marginTop: 10, paddingHorizontal: 12, borderRadius: 11, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderColor: Colors.borderLight },
  stageButtonText: { color: Colors.primary, fontWeight: "800", fontSize: 12 },
});
