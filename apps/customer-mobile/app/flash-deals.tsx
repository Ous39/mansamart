import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
  Platform, Dimensions,
} from "react-native";
import { router, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { ProductCard } from "@/components/ProductCard";
import { getApiUrl } from "@/lib/query-client";

const { width } = Dimensions.get("window");

function useCountdown(endTime: string | null) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    if (!endTime) return;
    const update = () => {
      const diff = new Date(endTime).getTime() - Date.now();
      if (diff <= 0) { setRemaining("Ended"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [endTime]);
  return remaining;
}

export default function FlashDealsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: deals = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/flash-deals"],
  });

  const endTime = deals[0]?.endTime ?? null;
  const countdown = useCountdown(endTime);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Ionicons name="flash" size={22} color="#FFE66D" />
          <Text style={styles.headerTitle}>Flash Deals</Text>
        </View>
        <View style={styles.countdown}>
          <Ionicons name="time-outline" size={14} color="#FFE66D" />
          <Text style={styles.countdownText}>{countdown || "--:--:--"}</Text>
        </View>
      </View>

      {/* Banner */}
      <View style={styles.banner}>
        <Ionicons name="flash" size={18} color="#E63946" />
        <Text style={styles.bannerText}>
          Limited time prices — grab them before they're gone!
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading flash deals...</Text>
        </View>
      ) : deals.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="flash-off-outline" size={60} color="#ccc" />
          <Text style={styles.emptyTitle}>No Active Flash Deals</Text>
          <Text style={styles.emptyText}>Check back soon for amazing limited-time offers!</Text>
        </View>
      ) : (
        <FlatList
          data={deals}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <View style={styles.dealWrapper}>
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>-{item.discountPercent}%</Text>
              </View>
              {item.product && (
                <ProductCard
                  product={{
                    ...item.product,
                    price: item.dealPrice,
                    originalPrice: item.originalPrice,
                    isSale: true,
                  }}
                  onPress={() => router.push(`/product/${item.product.id}`)}
                  style={{ width: (width - 36) / 2 }}
                />
              )}
              {/* Stock bar */}
              <View style={styles.stockBar}>
                <View style={[styles.stockFill, { width: `${Math.round((item.sold / (item.stockLimit || 50)) * 100)}%` }]} />
              </View>
              <Text style={styles.stockText}>{item.sold}/{item.stockLimit} sold</Text>
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8FA" },
  header: {
    backgroundColor: "#E63946",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  back: { padding: 4 },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  countdown: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  countdownText: { color: "#FFE66D", fontSize: 13, fontWeight: "700" },
  banner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FFF0F0", paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#FFD0D0",
  },
  bannerText: { color: "#E63946", fontSize: 13, fontWeight: "600", flex: 1 },
  grid: { padding: 10, paddingBottom: 30 },
  row: { gap: 8, justifyContent: "space-between" },
  dealWrapper: { marginBottom: 12, position: "relative" },
  discountBadge: {
    position: "absolute", top: 8, left: 8, zIndex: 10,
    backgroundColor: "#E63946", borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  discountText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  stockBar: { height: 4, backgroundColor: "#eee", borderRadius: 4, marginTop: 6, marginHorizontal: 4, overflow: "hidden" },
  stockFill: { height: 4, backgroundColor: "#E63946", borderRadius: 4 },
  stockText: { fontSize: 10, color: "#999", textAlign: "center", marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  loadingText: { marginTop: 12, color: "#999", fontSize: 14 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1A1A2E", marginTop: 16 },
  emptyText: { fontSize: 14, color: "#888", textAlign: "center", marginTop: 8 },
});
