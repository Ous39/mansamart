import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { safeBack } from "@/lib/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface ApiOrder {
  id: string; items: any[]; total: number; status: string; city: string;
  paymentMethod: string; createdAt: string; vendorStatus?: string;
}
interface ApiProduct {
  id: string; name: string; price: number; rating: number; inStock: boolean;
  soldCount?: number; category: string; stock?: number;
}
interface VendorDashboardApi {
  profile?: { verificationStatus?: string };
  stats: { products: number; activeProducts: number; lowStock: number; orders: number; pendingOrders: number; preparingOrders?: number; revenue: number; avgRating: number };
  lowStock: ApiProduct[];
  recentOrders: ApiOrder[];
  recentProducts: ApiProduct[];
  categoryStats: { category: string; products: number; sold: number }[];
}

function StatCard({ label, value, icon, color, bg }: { label: string; value: string; icon: string; color: string; bg: string }) {
  return (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function statusColor(s: string) {
  if (s === "pending") return "#F59E0B";
  if (s === "shipped") return "#2563EB";
  if (s === "delivered") return Colors.success;
  return Colors.textMuted;
}

export default function VendorDashboard() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const { data: dashboard } = useQuery<VendorDashboardApi>({ queryKey: ["/api/vendor/dashboard"] });
  const myOrders = dashboard?.recentOrders ?? [];
  const myProducts = dashboard?.recentProducts ?? [];
  const lowStock = dashboard?.lowStock ?? [];
  const totalRevenue = dashboard?.stats?.revenue ?? 0;
  const pendingOrders = dashboard?.stats?.pendingOrders ?? 0;
  const recentOrders = myOrders.slice(0, 4);
  const avgRating = dashboard?.stats?.avgRating ? String(dashboard.stats.avgRating) : "—";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 + (Platform.OS === "web" ? 34 : 0) }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient colors={["#1F5C53", "#2B7A6E"]} style={[styles.headerBg, { paddingTop: topPad + 20 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerGreeting}>Vendor Dashboard</Text>
            <Text style={styles.headerName}>{user?.businessName ?? user?.name}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={() => router.push("/(vendor)/settings" as any)} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="settings-outline" size={22} color="#fff" />
            </Pressable>
            <Pressable onPress={() => safeBack("/")} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
          </View>
        </View>
        <View style={styles.revenueCard}>
          <Text style={styles.revenueLabel}>Paid Product Revenue</Text>
          <Text style={styles.revenueValue}>D {totalRevenue.toLocaleString()}</Text>
          <View style={styles.revenueRow}>
            <Ionicons name="trending-up" size={14} color={Colors.success} />
            <Text style={styles.revenueChange}>{myOrders.length} orders total</Text>
          </View>
        </View>
      </LinearGradient>

      {dashboard?.profile?.verificationStatus !== "verified" && (
        <Pressable style={styles.verificationCard} onPress={() => router.push("/(vendor)/settings" as any)}>
          <Ionicons name="shield-checkmark-outline" size={22} color="#B45309" />
          <View style={{ flex: 1 }}><Text style={styles.verificationTitle}>Verification required</Text><Text style={styles.verificationText}>Complete your store profile and documents before publishing or requesting payouts.</Text></View>
          <Ionicons name="chevron-forward" size={18} color="#B45309" />
        </Pressable>
      )}

      <View style={styles.statsGrid}>
        <StatCard label="Total Orders" value={String(dashboard?.stats?.orders ?? myOrders.length)} icon="bag-outline" color="#2563EB" bg="#EFF6FF" />
        <StatCard label="Pending" value={String(pendingOrders)} icon="time-outline" color="#F59E0B" bg="#FFFBEB" />
        <StatCard label="Products" value={String(dashboard?.stats?.products ?? myProducts.length)} icon="cube-outline" color={Colors.primary} bg={Colors.primaryLight} />
        <StatCard label="Avg Rating" value={String(avgRating)} icon="star-outline" color="#F59E0B" bg="#FFFBEB" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top Products</Text>
        {myProducts.slice(0, 3).length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 16 }}>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted }}>No products yet</Text>
          </View>
        ) : myProducts.slice(0, 3).map((p, i) => (
          <View key={p.id} style={styles.topProductRow}>
            <View style={styles.topProductRank}>
              <Text style={styles.topProductRankText}>#{i + 1}</Text>
            </View>
            <View style={styles.topProductInfo}>
              <Text style={styles.topProductName} numberOfLines={1}>{p.name}</Text>
              <Text style={styles.topProductSales}>{p.soldCount ?? 0} units sold · {p.category}</Text>
            </View>
            <Text style={styles.topProductRevenue}>D {p.price.toLocaleString()}</Text>
          </View>
        ))}
      </View>

      {lowStock.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Low Stock Alerts</Text>
          {lowStock.slice(0, 4).map(p => (
            <View key={p.id} style={styles.alertRow}>
              <View style={styles.alertIcon}><Ionicons name="warning-outline" size={18} color="#F59E0B" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.topProductName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.topProductSales}>Only {p.stock ?? 0} left · {p.category}</Text>
              </View>
              <Text style={styles.topProductRevenue}>D {p.price.toLocaleString()}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.quickActions}>
        {[
          { label: "My Products", icon: "cube-outline", route: "/(vendor)/products", color: Colors.primary },
          { label: "Orders", icon: "receipt-outline", route: "/(vendor)/orders", color: "#2563EB" },
          { label: "Add Product", icon: "add-circle-outline", route: "/(vendor)/add-product", color: Colors.accent },
          { label: "Vendor Tools", icon: "megaphone-outline", route: "/(vendor)/tools", color: "#7B4FA3" },
          { label: "Finance & Payouts", icon: "wallet-outline", route: "/wallet", color: Colors.success },
          { label: "Returns & Refunds", icon: "return-down-back-outline", route: "/business-returns", color: "#B45309" },
          { label: "Business Support", icon: "help-buoy-outline", route: "/business-support", color: "#0F766E" },
        ].map(a => (
          <Pressable
            key={a.label}
            style={({ pressed }) => [styles.quickAction, pressed && { opacity: 0.85 }]}
            onPress={() => router.push(a.route as any)}
          >
            <View style={[styles.qaIcon, { backgroundColor: a.color + "15" }]}>
              <Ionicons name={a.icon as any} size={24} color={a.color} />
            </View>
            <Text style={styles.qaLabel}>{a.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </Pressable>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          <Pressable onPress={() => router.push("/(vendor)/orders")}>
            <Text style={styles.seeAll}>View all</Text>
          </Pressable>
        </View>
        {recentOrders.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 20 }}>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted }}>No orders yet</Text>
          </View>
        ) : recentOrders.map(order => {
          const firstItem = Array.isArray(order.items) ? order.items[0] : null;
          const displayStatus = order.vendorStatus || order.status;
          return (
            <View key={order.id} style={styles.orderRow}>
              <View style={styles.orderLeft}>
                <Text style={styles.orderId}>#{order.id.slice(0, 8).toUpperCase()}</Text>
                <Text style={styles.orderProduct} numberOfLines={1}>
                  {firstItem?.name ?? "Order"}{Array.isArray(order.items) && order.items.length > 1 ? ` +${order.items.length - 1}` : ""}
                </Text>
                <Text style={styles.orderBuyer}>{order.city} · {new Date(order.createdAt).toLocaleDateString()}</Text>
              </View>
              <View style={styles.orderRight}>
                <Text style={styles.orderAmount}>D {order.total.toLocaleString()}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(displayStatus) + "20" }]}>
                  <Text style={[styles.statusText, { color: statusColor(displayStatus) }]}>
                    {displayStatus.replace(/_/g, " ")}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerBg: { paddingHorizontal: 20, paddingBottom: 32 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 },
  headerGreeting: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: 1 },
  headerName: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff", marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  revenueCard: { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 20, padding: 20, gap: 6 },
  revenueLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)" },
  revenueValue: { fontSize: 36, fontFamily: "Inter_700Bold", color: "#fff" },
  revenueRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  revenueChange: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#6EE7B7" },
  verificationCard: { marginHorizontal: 20, marginTop: 16, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFFBEB", borderWidth: 1, borderColor: "#FDE68A" },
  verificationTitle: { fontFamily: "Inter_700Bold", color: "#92400E", fontSize: 13 },
  verificationText: { fontFamily: "Inter_400Regular", color: "#A16207", fontSize: 11, lineHeight: 16, marginTop: 2 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, padding: 20, marginTop: -16 },
  statCard: { flex: 1, minWidth: "44%", borderRadius: 16, padding: 16, gap: 6, backgroundColor: Colors.surface, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  section: { paddingHorizontal: 20, paddingBottom: 8 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 14 },
  seeAll: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  chartCard: { backgroundColor: Colors.surface, borderRadius: 18, padding: 18, gap: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  chartHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  chartTotal: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text },
  chartSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  chartBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.success + "15", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  chartBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.success },
  topProductRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 10 },
  topProductRank: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" },
  topProductRankText: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.primary },
  topProductInfo: { flex: 1 },
  topProductName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  topProductSales: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  topProductRevenue: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text },
  quickActions: { backgroundColor: Colors.surface, borderRadius: 20, marginHorizontal: 20, marginBottom: 20, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  quickAction: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  qaIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  qaLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  orderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  orderLeft: { flex: 1, gap: 2 },
  orderId: { fontSize: 10, fontFamily: "Inter_700Bold", color: Colors.textMuted, letterSpacing: 0.5 },
  orderProduct: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  orderBuyer: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  orderRight: { alignItems: "flex-end", gap: 6 },
  orderAmount: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  alertRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFFBEB", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#FDE68A" },
  alertIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#FEF3C7", alignItems: "center", justifyContent: "center" },
});
