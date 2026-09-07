import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { safeBack } from "@/lib/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";

function StatCard({ label, value, sub, icon, color, bg, onPress }: any) {
  return (
    <Pressable
      style={({ pressed }) => [styles.statCard, { backgroundColor: bg }, pressed && { opacity: 0.9 }]}
      onPress={onPress}
    >
      <View style={[styles.statIconWrap, { backgroundColor: color + "25" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </Pressable>
  );
}

const MENU = [
  { label: "Manage Users", icon: "people-outline", route: "/(admin)/users", color: Colors.primary, bg: Colors.primaryLight },
  { label: "Vendor Tracking", icon: "storefront-outline", route: "/(admin)/vendors", color: "#2563EB", bg: "#EFF6FF" },
  { label: "Products", icon: "cube-outline", route: "/(admin)/products", color: "#2563EB", bg: "#EFF6FF" },
  { label: "Services", icon: "construct-outline", route: "/(admin)/services", color: "#7B4FA3", bg: "#F3E8FF" },
  { label: "All Orders", icon: "receipt-outline", route: "/(admin)/orders", color: Colors.accent, bg: Colors.accentLight },
  { label: "Verifications", icon: "shield-checkmark-outline", route: "/(admin)/verification", color: "#E63946", bg: "#FEF2F2" },
  { label: "Delivery Riders", icon: "bicycle-outline", route: "/(admin)/riders", color: Colors.accent, bg: Colors.accentLight },
  { label: "Finance & Wallet", icon: "wallet-outline", route: "/(admin)/finance", color: "#059669", bg: "#D1FAE5" },
];

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: stats } = useQuery<{
    users: number; vendors: number; providers: number;
    products: number; services: number; orders: number;
    bookings: number; revenue: number;
  }>({ queryKey: ["/api/admin/stats"] });
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const totalRevenue = stats?.revenue ?? 0;
  const RECENT_ACTIVITY = [
    { label: "New vendor registered", sub: "Sillah Electronics", time: "2m ago", icon: "storefront-outline", color: "#2563EB" },
    { label: "Service booked", sub: "Home Deep Cleaning", time: "15m ago", icon: "calendar-outline", color: "#7B4FA3" },
    { label: "Order placed", sub: "Samsung Galaxy A15 · D 8,500", time: "32m ago", icon: "bag-outline", color: Colors.accent },
    { label: "New user signed up", sub: "lamin@example.com", time: "1h ago", icon: "person-add-outline", color: Colors.primary },
    { label: "Service completed", sub: "AC Maintenance", time: "2h ago", icon: "checkmark-circle-outline", color: Colors.success },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 + (Platform.OS === "web" ? 34 : 0) }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient colors={["#0F172A", "#1E293B"]} style={[styles.headerBg, { paddingTop: topPad + 20 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerLabel}>Admin Panel</Text>
            <Text style={styles.headerTitle}>MansaMart Platform</Text>
          </View>
          <Pressable onPress={() => safeBack("/")} style={styles.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.revenueCard}>
          <Text style={styles.revLabel}>Platform Revenue</Text>
          <Text style={styles.revValue}>D {totalRevenue.toLocaleString()}</Text>
          <View style={styles.revRow}>
            <View style={styles.revBadge}>
              <Ionicons name="trending-up" size={12} color="#4ADE80" />
              <Text style={styles.revChange}>+18.4% this month</Text>
            </View>
            <Text style={styles.revSub}>{(stats?.orders ?? 0) + (stats?.bookings ?? 0)} total transactions</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.statsGrid}>
        <StatCard
          label="Users" value={stats?.users ?? "—"} icon="people-outline"
          color={Colors.primary} bg={Colors.primaryLight}
          sub="registered shoppers"
          onPress={() => router.push("/(admin)/users")}
        />
        <StatCard
          label="Vendors" value={stats?.vendors ?? "—"} icon="storefront-outline"
          color="#2563EB" bg="#EFF6FF"
          sub="active vendors"
          onPress={() => router.push("/(admin)/vendors" as any)}
        />
        <StatCard
          label="Providers" value={stats?.providers ?? "—"} icon="construct-outline"
          color="#7B4FA3" bg="#F3E8FF"
          sub="service providers"
          onPress={() => router.push("/(admin)/users")}
        />
        <StatCard
          label="Products" value={stats?.products ?? "—"} icon="cube-outline"
          color={Colors.accent} bg={Colors.accentLight}
          sub="listed products"
          onPress={() => router.push("/(admin)/products")}
        />
        <StatCard
          label="Services" value={stats?.services ?? "—"} icon="briefcase-outline"
          color="#059669" bg="#D1FAE5"
          sub="listed services"
          onPress={() => router.push("/(admin)/services")}
        />
        <StatCard
          label="Orders" value={stats?.orders ?? "—"} icon="calendar-outline"
          color="#DC2626" bg="#FEF2F2"
          sub="total orders"
          onPress={() => router.push("/(admin)/orders")}
        />
      </View>

      <View style={styles.menuSection}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        {MENU.map(m => (
          <Pressable
            key={m.label}
            style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.85 }]}
            onPress={() => router.push(m.route as any)}
          >
            <View style={[styles.menuIcon, { backgroundColor: m.bg }]}>
              <Ionicons name={m.icon as any} size={22} color={m.color} />
            </View>
            <Text style={styles.menuLabel}>{m.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </Pressable>
        ))}
      </View>

      <View style={styles.activitySection}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {RECENT_ACTIVITY.map((a, i) => (
          <View key={i} style={styles.activityRow}>
            <View style={[styles.activityIcon, { backgroundColor: a.color + "15" }]}>
              <Ionicons name={a.icon as any} size={16} color={a.color} />
            </View>
            <View style={styles.activityInfo}>
              <Text style={styles.activityLabel}>{a.label}</Text>
              <Text style={styles.activitySub}>{a.sub}</Text>
            </View>
            <Text style={styles.activityTime}>{a.time}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerBg: { paddingHorizontal: 20, paddingBottom: 32 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 },
  headerLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1 },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff", marginTop: 2 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center",
  },
  revenueCard: { backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 20, padding: 20, gap: 8 },
  revLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.5)" },
  revValue: { fontSize: 36, fontFamily: "Inter_700Bold", color: "#fff" },
  revRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  revBadge: { flexDirection: "row", alignItems: "center", gap: 5 },
  revChange: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#4ADE80" },
  revSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.4)" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, padding: 20, marginTop: -16 },
  statCard: {
    flex: 1, minWidth: "44%", borderRadius: 16, padding: 16, gap: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  statIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text },
  statLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  statSub: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  menuSection: { paddingHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 12 },
  menuItem: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: Colors.surface, borderRadius: 16, padding: 14, marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  menuIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  activitySection: { paddingHorizontal: 20 },
  activityRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  activityIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  activityInfo: { flex: 1 },
  activityLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text },
  activitySub: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 1 },
  activityTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted },
});
