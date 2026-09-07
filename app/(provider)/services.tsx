import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { serviceCategories } from "@/data/services";

export default function ProviderServicesScreen() {
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const { data: myServices = [] } = useQuery<any[]>({ queryKey: ["/api/services/provider/mine"] });

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>My Services</Text>
        <Pressable
          style={styles.addBtn}
          onPress={() => router.push("/(provider)/add-service")}
          hitSlop={8}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Text style={styles.statNum}>{myServices.length}</Text>
          <Text style={styles.statLbl}>Total</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={[styles.statNum, { color: Colors.success }]}>{myServices.filter(s => s.isAvailable).length}</Text>
          <Text style={styles.statLbl}>Active</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={[styles.statNum, { color: "#7B4FA3" }]}>{myServices.filter(s => s.isFeatured).length}</Text>
          <Text style={styles.statLbl}>Featured</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {myServices.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 40, gap: 8 }}>
            <Ionicons name="construct-outline" size={40} color={Colors.border} />
            <Text style={{ fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.textMuted }}>No services yet</Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted }}>Tap + to add your first service</Text>
          </View>
        ) : myServices.map(s => {
          const cat = serviceCategories.find(c => c.id === s.category);
          return (
            <View key={s.id} style={styles.serviceCard}>
              <View style={[styles.serviceIcon, { backgroundColor: cat?.bgColor ?? Colors.primaryLight }]}>
                <Ionicons name={(cat?.icon ?? "construct-outline") as any} size={22} color={cat?.color ?? Colors.primary} />
              </View>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceName} numberOfLines={2}>{s.name}</Text>
                <View style={styles.serviceMeta}>
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={11} color="#F59E0B" />
                    <Text style={styles.ratingText}>{s.rating}</Text>
                    <Text style={styles.reviewCount}>({s.reviewCount})</Text>
                  </View>
                  <Text style={styles.price}>
                    D {s.price}{s.priceType === "hourly" ? "/hr" : s.priceType === "per_room" ? "/room" : ""}
                  </Text>
                </View>
                <View style={styles.serviceActions}>
                  <View style={[styles.statusBadge, { backgroundColor: s.isAvailable ? "#D1FAE5" : "#FEE2E2" }]}>
                    <View style={[styles.statusDot, { backgroundColor: s.isAvailable ? Colors.success : Colors.error }]} />
                    <Text style={[styles.statusText, { color: s.isAvailable ? Colors.success : Colors.error }]}>
                      {s.isAvailable ? "Active" : "Paused"}
                    </Text>
                  </View>
                  <Pressable style={styles.editBtn} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
                    <Ionicons name="pencil-outline" size={14} color="#7B4FA3" />
                    <Text style={[styles.editBtnText, { color: "#7B4FA3" }]}>Edit</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 16,
  },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  addBtn: {
    width: 36, height: 36, borderRadius: 11, backgroundColor: "#7B4FA3",
    alignItems: "center", justifyContent: "center",
  },
  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 16 },
  statChip: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 12, padding: 10, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  statNum: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  statLbl: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  list: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  serviceCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 14,
    backgroundColor: Colors.surface, borderRadius: 16, padding: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  serviceIcon: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  serviceInfo: { flex: 1, gap: 5 },
  serviceName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text, lineHeight: 20 },
  serviceMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.text },
  reviewCount: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  price: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text },
  serviceActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  editBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#F3E8FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  editBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});
