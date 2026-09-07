import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { safeBack } from "@/lib/navigation";

const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B",
  paid: "#0EA47A",
  confirmed: "#2563EB",
  preparing: "#2563EB",
  ready_for_pickup: "#E8813A",
  searching_rider: "#E8813A",
  rider_assigned: "#7B4FA3",
  picked_up: "#7B4FA3",
  on_the_way: "#E8813A",
  delivered: "#0EA47A",
  completed: "#0EA47A",
  cancelled: "#E63946",
};

function fmtPrice(value?: number) { return `D ${(value ?? 0).toLocaleString()}`; }
function fmtDate(value?: string) {
  if (!value) return "No date";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "No date";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function OrderTrackingScreen() {
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const { data: orders = [], isLoading, refetch } = useQuery<any[]>({ queryKey: ["/api/orders"], refetchInterval: 10000 });

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 14 }]}> 
        <Pressable onPress={() => safeBack("/(tabs)")} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Track Orders</Text>
        <Pressable onPress={() => refetch()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="refresh-outline" size={20} color={Colors.text} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.muted}>Loading orders...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 24, gap: 14 }}>
          {orders.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="bag-check-outline" size={56} color={Colors.primary} />
              <Text style={styles.emptyTitle}>No active orders yet</Text>
              <Text style={styles.muted}>When you place or manage orders, live tracking will appear here.</Text>
            </View>
          ) : orders.map((order: any) => {
            const color = STATUS_COLORS[order.status] || Colors.primary;
            return (
              <Pressable key={order.id} style={styles.orderCard} onPress={() => router.push(`/order/${order.id}` as any)}>
                <View style={styles.orderRow}>
                  <View style={styles.orderIcon}><Ionicons name="receipt-outline" size={20} color={Colors.primary} /></View>
                  <View style={styles.orderBody}>
                    <Text style={styles.orderProduct}>Order #{String(order.id).slice(-8).toUpperCase()}</Text>
                    <Text style={styles.orderVendor}>{fmtDate(order.createdAt)} • {order.fulfillmentType === "pickup" ? "Pickup" : "Delivery"}</Text>
                  </View>
                  <Text style={styles.orderTotal}>{fmtPrice(order.total)}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.statusRow}>
                  <View style={[styles.statusPill, { backgroundColor: color + "20" }]}>
                    <Text style={[styles.statusText, { color }]}>{String(order.status || "pending").replace(/_/g, " ")}</Text>
                  </View>
                  <View style={styles.openRow}><Text style={styles.openText}>Open tracking</Text><Ionicons name="chevron-forward" size={16} color={Colors.primary} /></View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  muted: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted, textAlign: "center" },
  emptyCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 24, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  orderCard: { backgroundColor: Colors.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Colors.borderLight },
  orderRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  orderIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" },
  orderBody: { flex: 1 },
  orderProduct: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text },
  orderVendor: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  orderTotal: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text },
  divider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 14 },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { fontSize: 12, fontFamily: "Inter_700Bold", textTransform: "capitalize" },
  openRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  openText: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.primary },
});
