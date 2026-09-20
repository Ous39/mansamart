import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, ActivityIndicator, Image } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";
import { getProductMainImage } from "@/lib/product-media";

interface ApiProduct {
  id: string; name: string; brand: string; price: number; originalPrice?: number;
  category: string; subcategory: string; description: string; rating: number;
  reviewCount: number; inStock: boolean; isFeatured?: boolean; isNew?: boolean;
  isSale?: boolean; soldCount?: number; freeShipping?: boolean; location?: string;
  images?: string[]; placeholderColor?: string; placeholderIcon?: string; vendorId?: string;
}

export default function VendorProductsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const queryClient = useQueryClient();

  const { data: myProducts = [], isLoading } = useQuery<ApiProduct[]>({
    queryKey: ["/api/products/vendor/mine"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/products/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/products/vendor/mine"] }),
  });

  const toggleStock = useMutation({
    mutationFn: ({ id, inStock }: { id: string; inStock: boolean }) =>
      apiRequest("PUT", `/api/products/${id}`, { inStock }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/products/vendor/mine"] }),
  });

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>My Products</Text>
        <Pressable
          style={styles.addBtn}
          onPress={() => router.push("/(vendor)/add-product")}
          hitSlop={8}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Text style={styles.statNum}>{myProducts.length}</Text>
          <Text style={styles.statLbl}>Total</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={[styles.statNum, { color: Colors.success }]}>{myProducts.filter(p => p.inStock).length}</Text>
          <Text style={styles.statLbl}>In Stock</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={[styles.statNum, { color: Colors.accent }]}>{myProducts.filter(p => p.isSale).length}</Text>
          <Text style={styles.statLbl}>On Sale</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={[styles.statNum, { color: Colors.primary }]}>{myProducts.filter(p => p.isNew).length}</Text>
          <Text style={styles.statLbl}>New</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {myProducts.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={48} color={Colors.border} />
              <Text style={styles.emptyText}>No products yet</Text>
              <Text style={styles.emptySub}>Tap + to add your first product</Text>
              <Pressable style={styles.emptyBtn} onPress={() => router.push("/(vendor)/add-product")}>
                <Text style={styles.emptyBtnText}>Add Product</Text>
              </Pressable>
            </View>
          )}
          {myProducts.map(p => {
            const mainImage = getProductMainImage(p);
            return (
            <View key={p.id} style={styles.productCard}>
              {mainImage ? (
                <Image source={mainImage} style={styles.productImg} resizeMode="cover" />
              ) : (
                <View style={[styles.productImg, { backgroundColor: p.placeholderColor ?? Colors.primary, alignItems: "center", justifyContent: "center" }]}>
                  <Ionicons name={(p.placeholderIcon ?? "bag-outline") as any} size={24} color="rgba(255,255,255,0.8)" />
                </View>
              )}
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={2}>{p.name}</Text>
                <Text style={styles.productCategory}>{p.category}</Text>
                <Text style={styles.productPrice}>D {p.price.toLocaleString()}</Text>
                <View style={styles.stockRow}>
                  <View style={[styles.stockBadge, { backgroundColor: p.inStock ? Colors.primaryLight : "#FEF2F2" }]}>
                    <Text style={[styles.stockText, { color: p.inStock ? Colors.primary : Colors.error }]}>
                      {p.inStock ? "In Stock" : "Out of Stock"}
                    </Text>
                  </View>
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={11} color="#F59E0B" />
                    <Text style={styles.ratingText}>{p.rating?.toFixed(1)}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.actions}>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: "#EFF6FF" }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({ pathname: "/(vendor)/edit-product", params: { id: p.id } });
                  }}
                >
                  <Ionicons name="pencil-outline" size={18} color="#2563EB" />
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    toggleStock.mutate({ id: p.id, inStock: !p.inStock });
                  }}
                >
                  <Ionicons name={p.inStock ? "pause-circle-outline" : "play-circle-outline"} size={20} color={Colors.primary} />
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: "#FEF2F2" }]}
                  onPress={() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    deleteMutation.mutate(p.id);
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color={Colors.error} />
                </Pressable>
              </View>
            </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  addBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 20, paddingVertical: 12, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  statChip: { alignItems: "center" },
  statNum: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  statLbl: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  list: { padding: 16, gap: 12, paddingBottom: 80 + (Platform.OS === "web" ? 34 : 0) },
  productCard: { flexDirection: "row", gap: 12, backgroundColor: Colors.surface, borderRadius: 14, padding: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  productImg: { width: 70, height: 70, borderRadius: 10 },
  productInfo: { flex: 1, gap: 3 },
  productName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  productCategory: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, textTransform: "capitalize" },
  productPrice: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.primary },
  stockRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  stockBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  stockText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  ratingText: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  actions: { gap: 8, justifyContent: "center" },
  actionBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  emptyBtn: { marginTop: 12, backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
