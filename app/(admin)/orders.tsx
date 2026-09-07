import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, Platform } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useBookings } from "@/contexts/BookingContext";

const TABS = ["All", "Products", "Services"];

function statusStyle(s: string) {
  const map: Record<string, { bg: string; text: string }> = {
    pending: { bg: "#FFFBEB", text: "#D97706" },
    processing: { bg: "#EFF6FF", text: "#2563EB" },
    confirmed: { bg: "#EFF6FF", text: "#2563EB" },
    shipped: { bg: "#F0FDF4", text: "#16A34A" },
    delivered: { bg: "#D1FAE5", text: "#059669" },
    completed: { bg: "#D1FAE5", text: "#059669" },
    cancelled: { bg: "#FEF2F2", text: "#DC2626" },
  };
  return map[s] ?? { bg: Colors.borderLight, text: Colors.textSecondary };
}

export default function AdminOrdersScreen() {
  const insets = useSafeAreaInsets();
  const { getAllBookings } = useBookings();
  const [tab, setTab] = useState("All");
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const { data: apiOrders = [] } = useQuery<any[]>({ queryKey: ["/api/orders"] });

  const orderItems = apiOrders.map((o: any) => ({
    id: o.id.slice(0, 8).toUpperCase(),
    item: Array.isArray(o.items) && o.items.length > 0
      ? o.items[0].name + (o.items.length > 1 ? ` +${o.items.length - 1} more` : "")
      : "Order",
    type: "product" as const,
    buyer: "Customer",
    amount: o.totalAmount ?? 0,
    status: o.status ?? "pending",
    date: new Date(o.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
  }));

  const bookings = getAllBookings();
  const bookingItems = bookings.map(b => ({
    id: b.id,
    item: b.serviceName,
    type: "service" as const,
    buyer: b.userName,
    amount: b.price,
    status: b.status,
    date: b.date,
  }));
  const allItems = [...orderItems, ...bookingItems];
  const filtered = tab === "All" ? allItems : allItems.filter(i => i.type === tab.toLowerCase());
  const totalValue = allItems.reduce((s, i) => s + i.amount, 0);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>All Orders</Text>
        <Text style={styles.totalValue}>D {totalValue.toLocaleString()}</Text>
      </View>

      <View style={styles.tabRow}>
        {TABS.map(t => (
          <Pressable
            key={t}
            style={[styles.tabChip, tab === t && styles.tabChipActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setTab(t);
            }}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 + (Platform.OS === "web" ? 34 : 0) }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const ss = statusStyle(item.status);
          return (
            <View style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View style={[styles.typeIcon, { backgroundColor: item.type === "product" ? "#EFF6FF" : "#F3E8FF" }]}>
                  <Ionicons
                    name={item.type === "product" ? "cube-outline" : "construct-outline"}
                    size={16}
                    color={item.type === "product" ? "#2563EB" : "#7B4FA3"}
                  />
                </View>
                <Text style={styles.orderId}>#{item.id}</Text>
                <View style={[styles.statusBadge, { backgroundColor: ss.bg }]}>
                  <Text style={[styles.statusText, { color: ss.text }]}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </Text>
                </View>
                <Text style={styles.orderAmount}>D {item.amount.toLocaleString()}</Text>
              </View>
              <Text style={styles.itemName}>{item.item}</Text>
              <View style={styles.orderFooter}>
                <View style={styles.metaItem}>
                  <Ionicons name="person-outline" size={12} color={Colors.textMuted} />
                  <Text style={styles.metaText}>{item.buyer}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
                  <Text style={styles.metaText}>{item.date}</Text>
                </View>
                <View style={[styles.typePill, { backgroundColor: item.type === "product" ? "#EFF6FF" : "#F3E8FF" }]}>
                  <Text style={[styles.typePillText, { color: item.type === "product" ? "#2563EB" : "#7B4FA3" }]}>
                    {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                  </Text>
                </View>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingBottom: 12,
  },
  title: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  totalValue: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.primary },
  tabRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingBottom: 10 },
  tabChip: {
    flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: "center",
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  tabChipActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  tabText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  tabTextActive: { color: "#fff" },
  orderCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14, gap: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  orderHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  typeIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  orderId: { flex: 1, fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.textMuted, letterSpacing: 0.5 },
  statusBadge: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  orderAmount: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text },
  itemName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  orderFooter: { flexDirection: "row", alignItems: "center", gap: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  typePill: { marginLeft: "auto", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  typePillText: { fontSize: 10, fontFamily: "Inter_700Bold" },
});
