import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Platform } from "react-native";
import { Stack, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { getShopCategoryConfig } from "@/data/vendor-categories";

type VendorRow = {
  id: string;
  userId: string;
  storeName: string;
  shopCategory: string;
  verificationStatus: string;
  location?: string;
  supportPhone?: string;
  whatsapp?: string;
  productCount?: number;
  activeProductCount?: number;
  lowStockCount?: number;
  totalStock?: number;
  totalRevenue?: number;
  totalSales?: number;
  rating?: number;
  completenessScore?: number;
  profileHealth?: string;
  user?: { name?: string; email?: string; phone?: string; isVerified?: boolean } | null;
};

function statusColor(status?: string) {
  if (status === "approved" || status === "verified") return Colors.success;
  if (status === "rejected") return Colors.deal;
  if (status === "pending") return "#F59E0B";
  return Colors.textMuted;
}

function VendorCard({ vendor }: { vendor: VendorRow }) {
  const config = getShopCategoryConfig(vendor.shopCategory as any);
  const score = Number(vendor.completenessScore || 0);
  return (
    <Pressable style={styles.card} onPress={() => router.push(`/vendor/${vendor.userId}` as any)}>
      <View style={styles.cardTop}>
        <View style={[styles.iconBox, { backgroundColor: config.color + "20" }]}>
          <Ionicons name={config.icon as any} size={22} color={config.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.storeName}>{vendor.storeName || vendor.user?.name || "Unnamed vendor"}</Text>
          <Text style={styles.meta}>{config.name} • {vendor.location || "No location"}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: statusColor(vendor.verificationStatus) + "18" }]}>
          <Text style={[styles.statusText, { color: statusColor(vendor.verificationStatus) }]}>{vendor.verificationStatus || "unknown"}</Text>
        </View>
      </View>

      <View style={styles.scoreWrap}>
        <View style={styles.scoreLabelRow}>
          <Text style={styles.scoreLabel}>Profile completeness</Text>
          <Text style={styles.scoreValue}>{score}%</Text>
        </View>
        <View style={styles.scoreTrack}><View style={[styles.scoreFill, { width: `${Math.min(100, score)}%`, backgroundColor: score >= 80 ? Colors.success : score >= 55 ? "#F59E0B" : Colors.deal }]} /></View>
        <Text style={styles.health}>{vendor.profileHealth || "Needs setup"}</Text>
      </View>

      <View style={styles.statsGrid}>
        <MiniStat label="Products" value={vendor.productCount || 0} icon="cube-outline" />
        <MiniStat label="Low Stock" value={vendor.lowStockCount || 0} icon="alert-circle-outline" danger={(vendor.lowStockCount || 0) > 0} />
        <MiniStat label="Revenue" value={`D${Number(vendor.totalRevenue || 0).toLocaleString()}`} icon="wallet-outline" />
        <MiniStat label="Rating" value={(vendor.rating || 0).toFixed(1)} icon="star-outline" />
      </View>

      <View style={styles.contactRow}>
        <Text style={styles.contactText}>{vendor.user?.email || "No email"}</Text>
        <Text style={styles.contactText}>{vendor.supportPhone || vendor.whatsapp || vendor.user?.phone || "No phone"}</Text>
      </View>
    </Pressable>
  );
}

function MiniStat({ label, value, icon, danger }: any) {
  return (
    <View style={styles.miniStat}>
      <Ionicons name={icon} size={15} color={danger ? Colors.deal : Colors.primary} />
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

export default function AdminVendorsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const { data = [], isLoading } = useQuery<VendorRow[]>({ queryKey: ["/api/admin/vendors"] });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const vendors = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter(v => {
      const matchesSearch = !q || [v.storeName, v.user?.name, v.user?.email, v.shopCategory, v.location].filter(Boolean).some(x => String(x).toLowerCase().includes(q));
      const matchesFilter = filter === "all" || v.verificationStatus === filter || (filter === "low_stock" && (v.lowStockCount || 0) > 0) || (filter === "incomplete" && (v.completenessScore || 0) < 70);
      return matchesSearch && matchesFilter;
    });
  }, [data, search, filter]);

  const totalLowStock = data.reduce((sum, v) => sum + Number(v.lowStockCount || 0), 0);
  const avgScore = data.length ? Math.round(data.reduce((sum, v) => sum + Number(v.completenessScore || 0), 0) / data.length) : 0;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: topPad + 16 }]}> 
        <Pressable onPress={() => router.back()} hitSlop={8}><Ionicons name="arrow-back" size={24} color={Colors.text} /></Pressable>
        <View style={{ flex: 1 }}><Text style={styles.title}>Vendor Tracking</Text><Text style={styles.subtitle}>Monitor shops, categories, stock and profile quality</Text></View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryRow}>
          <Summary label="Vendors" value={data.length} icon="storefront-outline" />
          <Summary label="Low Stock" value={totalLowStock} icon="alert-circle-outline" danger />
          <Summary label="Avg Setup" value={`${avgScore}%`} icon="analytics-outline" />
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
          <TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Search vendor, email, category, location..." placeholderTextColor={Colors.textMuted} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {["all", "pending", "approved", "rejected", "low_stock", "incomplete"].map(x => <Pressable key={x} style={[styles.filterChip, filter === x && styles.filterChipActive]} onPress={() => setFilter(x)}><Text style={[styles.filterText, filter === x && styles.filterTextActive]}>{x.replace("_", " ")}</Text></Pressable>)}
        </ScrollView>

        {isLoading ? <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} /> : vendors.length === 0 ? (
          <View style={styles.empty}><Ionicons name="storefront-outline" size={36} color={Colors.textMuted} /><Text style={styles.emptyText}>No vendors found</Text></View>
        ) : vendors.map(v => <VendorCard key={v.id || v.userId} vendor={v} />)}
      </ScrollView>
    </View>
  );
}

function Summary({ label, value, icon, danger }: any) {
  return <View style={styles.summaryCard}><Ionicons name={icon} size={18} color={danger ? Colors.deal : Colors.primary} /><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  summaryRow: { flexDirection: "row", gap: 10 },
  summaryCard: { flex: 1, backgroundColor: Colors.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  summaryValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textMuted },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.card, borderRadius: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border, minHeight: 48 },
  searchInput: { flex: 1, color: Colors.text, fontFamily: "Inter_400Regular" },
  filters: { gap: 8, paddingVertical: 2 },
  filterChip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.textSecondary, textTransform: "capitalize" },
  filterTextActive: { color: "#fff" },
  card: { backgroundColor: Colors.card, borderRadius: 20, padding: 15, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  storeName: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text },
  meta: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusText: { fontSize: 10, fontFamily: "Inter_800ExtraBold", textTransform: "uppercase" },
  scoreWrap: { gap: 6 },
  scoreLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  scoreLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  scoreValue: { fontSize: 12, fontFamily: "Inter_800ExtraBold", color: Colors.text },
  scoreTrack: { height: 8, borderRadius: 999, backgroundColor: Colors.borderLight, overflow: "hidden" },
  scoreFill: { height: "100%", borderRadius: 999 },
  health: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textMuted },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  miniStat: { flexGrow: 1, minWidth: "46%", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.background, borderRadius: 12, padding: 10 },
  miniValue: { fontSize: 13, fontFamily: "Inter_800ExtraBold", color: Colors.text },
  miniLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textMuted },
  contactRow: { borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: 10, gap: 3 },
  contactText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 10 },
  emptyText: { color: Colors.textMuted, fontFamily: "Inter_600SemiBold" },
});
