import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, Platform, TextInput } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { serviceCategories } from "@/data/services";

export default function AdminServicesScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const { data: services = [] } = useQuery<any[]>({ queryKey: ["/api/services"] });

  const filtered = services.filter((s: any) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.providerName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>All Services</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{filtered.length}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.stat, { backgroundColor: "#F3E8FF" }]}>
          <Text style={[styles.statNum, { color: "#7B4FA3" }]}>{services.length}</Text>
          <Text style={styles.statLbl}>Total</Text>
        </View>
        <View style={[styles.stat, { backgroundColor: "#D1FAE5" }]}>
          <Text style={[styles.statNum, { color: Colors.success }]}>{services.filter(s => s.isAvailable).length}</Text>
          <Text style={styles.statLbl}>Active</Text>
        </View>
        <View style={[styles.stat, { backgroundColor: Colors.primaryLight }]}>
          <Text style={[styles.statNum, { color: Colors.primary }]}>{services.filter(s => s.isFeatured).length}</Text>
          <Text style={styles.statLbl}>Featured</Text>
        </View>
        <View style={[styles.stat, { backgroundColor: "#EFF6FF" }]}>
          <Text style={[styles.statNum, { color: "#2563EB" }]}>{serviceCategories.length}</Text>
          <Text style={styles.statLbl}>Categories</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={17} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search services..."
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={s => s.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 + (Platform.OS === "web" ? 34 : 0) }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: s }) => {
          const cat = serviceCategories.find(c => c.id === s.category);
          return (
            <View style={styles.serviceRow}>
              <View style={[styles.serviceIcon, { backgroundColor: cat?.bgColor ?? Colors.primaryLight }]}>
                <Ionicons name={(cat?.icon ?? "construct-outline") as any} size={20} color={cat?.color ?? Colors.primary} />
              </View>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceName} numberOfLines={2}>{s.name}</Text>
                <Text style={styles.providerName}>{s.providerName ?? s.category}</Text>
                <View style={styles.serviceMeta}>
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={11} color="#F59E0B" />
                    <Text style={styles.ratingText}>{s.rating}</Text>
                  </View>
                  <Text style={styles.reviewCount}>({s.reviewCount} reviews)</Text>
                </View>
              </View>
              <View style={styles.serviceActions}>
                <Text style={styles.price}>
                  D {s.price}{s.priceType === "hourly" ? "/hr" : s.priceType === "per_room" ? "/room" : ""}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: s.isAvailable ? "#D1FAE5" : "#FEF2F2" }]}>
                  <Text style={[styles.statusText, { color: s.isAvailable ? Colors.success : Colors.error }]}>
                    {s.isAvailable ? "Active" : "Off"}
                  </Text>
                </View>
                <View style={styles.actionBtns}>
                  <Pressable style={styles.editBtn} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
                    <Ionicons name="create-outline" size={15} color={Colors.primary} />
                  </Pressable>
                  <Pressable style={styles.deleteBtn} onPress={() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)}>
                    <Ionicons name="trash-outline" size={15} color={Colors.error} />
                  </Pressable>
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
  countBadge: { backgroundColor: "#7B4FA3", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  countText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },
  statsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  stat: { flex: 1, borderRadius: 10, padding: 8, alignItems: "center" },
  statNum: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statLbl: { fontSize: 9, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 1 },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 20, marginBottom: 10,
    backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.text },
  serviceRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.surface, borderRadius: 14, padding: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  serviceIcon: { width: 50, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  serviceInfo: { flex: 1, gap: 3 },
  serviceName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text, lineHeight: 18 },
  providerName: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  serviceMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.text },
  reviewCount: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  serviceActions: { alignItems: "flex-end", gap: 6 },
  price: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.text },
  statusBadge: { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 },
  statusText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  actionBtns: { flexDirection: "row", gap: 5 },
  editBtn: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  deleteBtn: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: "#FEF2F2",
    alignItems: "center", justifyContent: "center",
  },
});
