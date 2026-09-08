import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, Platform, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";

interface OrderItem { productId: string; name: string; price: number; quantity: number; image?: string }
interface ApiOrder {
  id: string; userId: string; items: OrderItem[]; subtotal: number; shipping: number;
  total: number; address: string; city: string; phone: string; paymentMethod: string;
  status: string; notes?: string; createdAt: string;
}

const FILTER_OPTIONS = ["All", "Pending", "Processing", "Shipped", "Delivered", "Cancelled"];

function getStatusStyle(status: string) {
  const map: Record<string, { bg: string; text: string }> = {
    pending: { bg: "#FFFBEB", text: "#D97706" },
    processing: { bg: "#EFF6FF", text: "#2563EB" },
    shipped: { bg: "#F0FDF4", text: "#16A34A" },
    delivered: { bg: "#D1FAE5", text: "#059669" },
    cancelled: { bg: "#FEF2F2", text: "#DC2626" },
  };
  return map[status] ?? { bg: Colors.borderLight, text: Colors.textSecondary };
}

export default function VendorOrdersScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState("All");
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const queryClient = useQueryClient();

  const { data: allOrders = [], isLoading } = useQuery<ApiOrder[]>({
    queryKey: ["/api/orders"],
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/orders/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/orders"] }),
  });

  const filtered = filter === "All"
    ? allOrders
    : allOrders.filter(o => o.status.toLowerCase() === filter.toLowerCase());

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>Orders</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{allOrders.length}</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {FILTER_OPTIONS.map(f => (
          <Pressable
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setFilter(f);
            }}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={o => o.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 + (Platform.OS === "web" ? 34 : 0) }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color={Colors.border} />
              <Text style={styles.emptyText}>No orders yet</Text>
            </View>
          }
          renderItem={({ item: o }) => {
            const ss = getStatusStyle(o.status);
            const firstItem = Array.isArray(o.items) ? o.items[0] : null;
            return (
              <View style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={styles.orderId}>#{o.id.slice(0, 8).toUpperCase()}</Text>
                    <Text style={styles.orderDate}>{new Date(o.createdAt).toLocaleDateString()}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: ss.bg }]}>
                    <Text style={[styles.statusText, { color: ss.text }]}>{o.status}</Text>
                  </View>
                </View>
                {firstItem && (
                  <View style={styles.itemRow}>
                    <Ionicons name="bag-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.itemText} numberOfLines={1}>
                      {firstItem.name} × {firstItem.quantity}
                      {Array.isArray(o.items) && o.items.length > 1 ? ` +${o.items.length - 1} more` : ""}
                    </Text>
                  </View>
                )}
                <View style={styles.orderFooter}>
                  <View style={styles.buyerRow}>
                    <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
                    <Text style={styles.buyerText}>{o.city} · {o.paymentMethod}</Text>
                  </View>
                  <Text style={styles.orderAmount}>D {o.total.toLocaleString()}</Text>
                </View>
                {o.status === "pending" && (
                  <View style={styles.actionRow}>
                    <Pressable
                      style={[styles.actionBtn, { backgroundColor: Colors.primaryLight }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        updateStatus.mutate({ id: o.id, status: "processing" });
                      }}
                    >
                      <Text style={[styles.actionText, { color: Colors.primary }]}>Accept</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionBtn, { backgroundColor: "#FEF2F2" }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        updateStatus.mutate({ id: o.id, status: "cancelled" });
                      }}
                    >
                      <Text style={[styles.actionText, { color: Colors.error }]}>Decline</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text, flex: 1, marginLeft: 16 },
  countBadge: { backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  countText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10, flexWrap: "wrap" },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.borderLight },
  filterChipActive: { backgroundColor: Colors.primary },
  filterText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  filterTextActive: { color: "#fff" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  orderCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 14, gap: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  orderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  orderId: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.text },
  orderDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  itemText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, flex: 1 },
  orderFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  buyerRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  buyerText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  orderAmount: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text },
  actionRow: { flexDirection: "row", gap: 8, paddingTop: 4 },
  actionBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10 },
  actionText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 16, fontFamily: "Inter_500Medium", color: Colors.textMuted },
});
