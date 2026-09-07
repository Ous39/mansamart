import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { safeBack } from "@/lib/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useBookings } from "@/contexts/BookingContext";

function statusColor(s: string) {
  if (s === "pending") return "#F59E0B";
  if (s === "confirmed") return "#2563EB";
  if (s === "in_progress") return "#7B4FA3";
  if (s === "completed") return Colors.success;
  return Colors.textMuted;
}

function StatCard({ label, value, icon, color, bg }: { label: string; value: string; icon: string; color: string; bg: string }) {
  return (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <View style={[styles.statIcon, { backgroundColor: color + "25" }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function ProviderDashboard() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { getBookingsForProvider } = useBookings();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const myBookings = getBookingsForProvider(user?.id ?? "provider-001");
  const pending = myBookings.filter(b => b.status === "pending").length;
  const confirmed = myBookings.filter(b => b.status === "confirmed").length;
  const completed = myBookings.filter(b => b.status === "completed").length;
  const totalRevenue = myBookings.filter(b => b.status === "completed").reduce((s, b) => s + b.price, 0);
  const recentBookings = [...myBookings].reverse().slice(0, 4);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 + (Platform.OS === "web" ? 34 : 0) }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient colors={["#5B2D8A", "#7B4FA3"]} style={[styles.headerBg, { paddingTop: topPad + 20 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerLabel}>Service Provider</Text>
            <Text style={styles.headerName}>{user?.businessName ?? user?.name}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={() => router.push("/(provider)/settings" as any)} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="settings-outline" size={22} color="#fff" />
            </Pressable>
            <Pressable onPress={() => safeBack("/")} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
          </View>
        </View>
        <View style={styles.revenueCard}>
          <Text style={styles.revenueLabel}>Total Earnings</Text>
          <Text style={styles.revenueValue}>D {(totalRevenue + 8540).toLocaleString()}</Text>
          <View style={styles.revenueRow}>
            <Ionicons name="trending-up" size={14} color="#A78BFA" />
            <Text style={styles.revenueChange}>{myBookings.length + 48} total bookings</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.statsGrid}>
        <StatCard label="Pending" value={String(pending + 3)} icon="time-outline" color="#F59E0B" bg="#FFFBEB" />
        <StatCard label="Confirmed" value={String(confirmed + 5)} icon="calendar-outline" color="#2563EB" bg="#EFF6FF" />
        <StatCard label="Completed" value={String(completed + 40)} icon="checkmark-circle-outline" color={Colors.success} bg="#D1FAE5" />
        <StatCard label="Rating" value="4.8" icon="star-outline" color="#F59E0B" bg="#FFFBEB" />
      </View>

      <View style={styles.quickActions}>
        {[
          { label: "My Services", icon: "construct-outline", route: "/(provider)/services", color: "#7B4FA3" },
          { label: "Bookings", icon: "calendar-outline", route: "/(provider)/bookings", color: "#2563EB" },
          { label: "Add Service", icon: "add-circle-outline", route: "/(provider)/add-service", color: Colors.accent },
        ].map(a => (
          <Pressable
            key={a.label}
            style={({ pressed }) => [styles.quickAction, pressed && { opacity: 0.85 }]}
            onPress={() => router.push(a.route as any)}
          >
            <View style={[styles.qaIcon, { backgroundColor: a.color + "15" }]}>
              <Ionicons name={a.icon as any} size={22} color={a.color} />
            </View>
            <Text style={styles.qaLabel}>{a.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </Pressable>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Bookings</Text>
          <Pressable onPress={() => router.push("/(provider)/bookings")}>
            <Text style={styles.seeAll}>View all</Text>
          </Pressable>
        </View>
        {recentBookings.map(b => (
          <View key={b.id} style={styles.bookingRow}>
            <View style={[styles.bookingIcon, { backgroundColor: "#7B4FA310" }]}>
              <Ionicons name="calendar-outline" size={18} color="#7B4FA3" />
            </View>
            <View style={styles.bookingInfo}>
              <Text style={styles.bookingService} numberOfLines={1}>{b.serviceName}</Text>
              <Text style={styles.bookingClient}>{b.userName} · {b.date} at {b.time}</Text>
            </View>
            <View style={styles.bookingRight}>
              <Text style={styles.bookingPrice}>D {b.price}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor(b.status) + "20" }]}>
                <Text style={[styles.statusText, { color: statusColor(b.status) }]}>
                  {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                </Text>
              </View>
            </View>
          </View>
        ))}
        {recentBookings.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={40} color={Colors.border} />
            <Text style={styles.emptyText}>No bookings yet</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerBg: { paddingHorizontal: 20, paddingBottom: 32 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 },
  headerLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: 1 },
  headerName: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff", marginTop: 2 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center",
  },
  revenueCard: { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 20, padding: 20, gap: 6 },
  revenueLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)" },
  revenueValue: { fontSize: 36, fontFamily: "Inter_700Bold", color: "#fff" },
  revenueRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  revenueChange: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#A78BFA" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, padding: 20, marginTop: -16 },
  statCard: {
    flex: 1, minWidth: "44%", borderRadius: 16, padding: 16, gap: 6,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  quickActions: {
    backgroundColor: Colors.surface, borderRadius: 20, marginHorizontal: 20, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  quickAction: {
    flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  qaIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  qaLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  section: { padding: 20 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.text },
  seeAll: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#7B4FA3" },
  bookingRow: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.surface,
    borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  bookingIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  bookingInfo: { flex: 1, gap: 3 },
  bookingService: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  bookingClient: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  bookingRight: { alignItems: "flex-end", gap: 5 },
  bookingPrice: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  emptyState: { alignItems: "center", gap: 8, paddingTop: 20 },
  emptyText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textMuted },
});
