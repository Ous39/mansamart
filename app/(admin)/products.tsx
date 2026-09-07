import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, Platform, Image, TextInput } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { getProductMainImage } from "@/lib/product-media";

export default function AdminProductsScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const { data: products = [] } = useQuery<any[]>({ queryKey: ["/api/products"] });

  const filtered = products.filter((p: any) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.brand ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>All Products</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{filtered.length}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.stat, { backgroundColor: Colors.primaryLight }]}>
          <Text style={[styles.statNum, { color: Colors.primary }]}>{products.length}</Text>
          <Text style={styles.statLbl}>Total</Text>
        </View>
        <View style={[styles.stat, { backgroundColor: "#D1FAE5" }]}>
          <Text style={[styles.statNum, { color: Colors.success }]}>{products.filter(p => p.inStock).length}</Text>
          <Text style={styles.statLbl}>In Stock</Text>
        </View>
        <View style={[styles.stat, { backgroundColor: Colors.accentLight }]}>
          <Text style={[styles.statNum, { color: Colors.accent }]}>{products.filter(p => p.isSale).length}</Text>
          <Text style={styles.statLbl}>On Sale</Text>
        </View>
        <View style={[styles.stat, { backgroundColor: "#EFF6FF" }]}>
          <Text style={[styles.statNum, { color: "#2563EB" }]}>{products.filter(p => p.isNew).length}</Text>
          <Text style={styles.statLbl}>New</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={17} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search products..."
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={p => p.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 + (Platform.OS === "web" ? 34 : 0) }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: p }) => {
          const mainImage = getProductMainImage(p);
          return (
          <View style={styles.productRow}>
            {mainImage ? (
              <Image source={mainImage} style={styles.productImg} resizeMode="cover" />
            ) : (
              <View style={[styles.productImg, { backgroundColor: p.placeholderColor ?? Colors.primary, alignItems: "center", justifyContent: "center" }]}>
                <Ionicons name={(p.placeholderIcon ?? "bag-outline") as any} size={22} color="rgba(255,255,255,0.8)" />
              </View>
            )}
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={2}>{p.name}</Text>
              <Text style={styles.productBrand}>{p.brand}</Text>
              <View style={styles.productMeta}>
                <Text style={styles.productPrice}>D {p.price.toLocaleString()}</Text>
                {p.isSale && (
                  <View style={styles.saleBadge}><Text style={styles.saleBadgeText}>SALE</Text></View>
                )}
              </View>
            </View>
            <View style={styles.productActions}>
              <View style={[styles.stockDot, { backgroundColor: p.inStock ? Colors.success : Colors.error }]} />
              <Pressable style={styles.editBtn} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
                <Ionicons name="create-outline" size={16} color={Colors.primary} />
              </Pressable>
              <Pressable style={styles.deleteBtn} onPress={() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)}>
                <Ionicons name="trash-outline" size={16} color={Colors.error} />
              </Pressable>
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
  countBadge: { backgroundColor: "#2563EB", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
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
  productRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.surface, borderRadius: 14, padding: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  productImg: { width: 70, height: 80, borderRadius: 10, backgroundColor: Colors.borderLight },
  productInfo: { flex: 1, gap: 3 },
  productName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text, lineHeight: 18 },
  productBrand: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  productMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  productPrice: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text },
  saleBadge: { backgroundColor: Colors.accentLight, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 },
  saleBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", color: Colors.accent },
  productActions: { gap: 8, alignItems: "center" },
  stockDot: { width: 8, height: 8, borderRadius: 4 },
  editBtn: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  deleteBtn: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: "#FEF2F2",
    alignItems: "center", justifyContent: "center",
  },
});
