import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, Platform, Alert, ActivityIndicator, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useBookings } from "@/contexts/BookingContext";
import { useAuth } from "@/contexts/AuthContext";
import { Booking } from "@/data/services";

const FILTERS = ["All", "Pending", "Confirmed", "Completed"];

function statusStyle(s: string) {
  const map: Record<string, { bg: string; text: string }> = {
    pending: { bg: "#FFFBEB", text: "#D97706" },
    confirmed: { bg: "#EFF6FF", text: "#2563EB" },
    in_progress: { bg: "#F3E8FF", text: "#7B4FA3" },
    completed: { bg: "#D1FAE5", text: "#059669" },
    cancelled: { bg: "#FEF2F2", text: "#DC2626" },
  };
  return map[s] ?? { bg: Colors.borderLight, text: Colors.textSecondary };
}

export default function ProviderBookingsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { getBookingsForProvider, updateBookingStatus, refresh, isLoading } = useBookings();
  const [filter, setFilter] = useState("All");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const all = user?.id ? getBookingsForProvider(user.id) : [];
  const filtered = filter === "All" ? all : all.filter(b => b.status.toLowerCase() === filter.toLowerCase());

  const handleStatus = async (id: string, status: Booking["status"]) => {
    try {
      setUpdatingId(id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await updateBookingStatus(id, status);
    } catch (error: any) {
      Alert.alert("Booking not updated", error?.message || "Please try again.");
    } finally { setUpdatingId(null); }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>My Bookings</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{all.length}</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map(f => (
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

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 + (Platform.OS === "web" ? 34 : 0) }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
        renderItem={({ item }) => {
          const ss = statusStyle(item.status);
          return (
            <View style={styles.bookingCard}>
              <View style={styles.cardTop}>
                <View style={styles.cardTopLeft}>
                  <Text style={styles.bookingId}>#{item.id}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: ss.bg }]}>
                    <Text style={[styles.statusText, { color: ss.text }]}>
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.bookingPrice}>D {item.price}</Text>
              </View>
              <Text style={styles.serviceName}>{item.serviceName}</Text>
              <View style={styles.cardDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="person-outline" size={13} color={Colors.textMuted} />
                  <Text style={styles.detailText}>{item.userName}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
                  <Text style={styles.detailText}>{item.date} at {item.time}</Text>
                </View>
                {item.address && (
                  <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
                    <Text style={styles.detailText} numberOfLines={1}>{item.address}</Text>
                  </View>
                )}
              </View>
              {item.status === "pending" && (
                <View style={styles.actionRow}>
                  <Pressable style={styles.confirmBtn} disabled={updatingId === item.id} onPress={() => handleStatus(item.id, "confirmed")}>
                    {updatingId === item.id ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark" size={14} color="#fff" />}
                    <Text style={styles.confirmBtnText}>Confirm</Text>
                  </Pressable>
                  <Pressable style={styles.cancelBtn} onPress={() => handleStatus(item.id, "cancelled")}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                </View>
              )}
              {item.status === "confirmed" && (
                <Pressable style={styles.startBtn} onPress={() => handleStatus(item.id, "in_progress")}>
                  <Ionicons name="play-circle-outline" size={16} color="#7B4FA3" />
                  <Text style={styles.startBtnText}>Mark as In Progress</Text>
                </Pressable>
              )}
              {item.status === "in_progress" && (
                <Pressable style={[styles.startBtn, { backgroundColor: "#D1FAE5" }]} onPress={() => handleStatus(item.id, "completed")}>
                  <Ionicons name="checkmark-done-circle-outline" size={16} color={Colors.success} />
                  <Text style={[styles.startBtnText, { color: Colors.success }]}>Mark as Completed</Text>
                </Pressable>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color={Colors.border} />
            <Text style={styles.emptyText}>No bookings yet</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingBottom: 16,
  },
  title: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  countBadge: {
    backgroundColor: "#7B4FA3", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
  },
  countText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  filterChip: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: "#7B4FA3", borderColor: "#7B4FA3" },
  filterText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  filterTextActive: { color: "#fff" },
  bookingCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16, gap: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTopLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  bookingId: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.textMuted, letterSpacing: 0.5 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  bookingPrice: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  serviceName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  cardDetails: { gap: 5, backgroundColor: Colors.borderLight, borderRadius: 10, padding: 10 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  detailText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  actionRow: { flexDirection: "row", gap: 10 },
  confirmBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: "#7B4FA3", borderRadius: 10, paddingVertical: 10,
  },
  confirmBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  cancelBtn: {
    paddingHorizontal: 16, alignItems: "center", justifyContent: "center",
    borderRadius: 10, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border,
  },
  cancelBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  startBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#F3E8FF", borderRadius: 10, paddingVertical: 10,
  },
  startBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#7B4FA3" },
  emptyState: { alignItems: "center", gap: 12, paddingTop: 60 },
  emptyText: { fontSize: 16, fontFamily: "Inter_500Medium", color: Colors.textMuted },
});
