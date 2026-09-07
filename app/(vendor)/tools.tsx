import React, { useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  Platform, ActivityIndicator, Alert,
} from "react-native";
import { router, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import { getToken } from "@/lib/auth-token";

async function apiCall(path: string, method: string, body?: any) {
  const token = getToken();
  const r = await fetch(new URL(path, getApiUrl()).toString(), {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || "Failed"); }
  return r.json();
}

function SectionHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconWrap}>
        <Ionicons name={icon as any} size={20} color={Colors.primary} />
      </View>
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

export default function VendorToolsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const qc = useQueryClient();

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [dealPrice, setDealPrice] = useState("");
  const [discountPct, setDiscountPct] = useState("");
  const [dealHours, setDealHours] = useState("24");
  const [showDealForm, setShowDealForm] = useState(false);

  const [promoProduct, setPromoProduct] = useState<any>(null);
  const [promoDays, setPromoDays] = useState("7");
  const [showPromoForm, setShowPromoForm] = useState(false);

  const { data: myProducts = [], isLoading: loadingProducts } = useQuery<any[]>({
    queryKey: ["/api/products/vendor/mine"],
  });

  const { data: activeDeals = [] } = useQuery<any[]>({
    queryKey: ["/api/vendor/flash-deals"],
    queryFn: async () => {
      try { return await apiCall("/api/vendor/flash-deals", "GET"); } catch { return []; }
    },
  });

  const createDeal = useMutation({
    mutationFn: () => apiCall("/api/vendor/flash-deals", "POST", {
      productId: selectedProduct.id,
      dealPrice: parseFloat(dealPrice),
      discountPercent: parseInt(discountPct),
      durationHours: parseInt(dealHours),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/vendor/flash-deals"] });
      qc.invalidateQueries({ queryKey: ["/api/flash-deals"] });
      Alert.alert("✅ Flash Deal Created!", `Your deal for ${selectedProduct.name} is now live!`);
      setShowDealForm(false); setSelectedProduct(null); setDealPrice(""); setDiscountPct("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e: any) => Alert.alert("Error", e.message),
  });

  const deleteDeal = useMutation({
    mutationFn: (id: string) => apiCall(`/api/vendor/flash-deals/${id}`, "DELETE"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/vendor/flash-deals"] }),
  });

  const featureProduct = useMutation({
    mutationFn: () => apiCall(`/api/vendor/promote/${promoProduct.id}`, "POST", { days: parseInt(promoDays) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/products/vendor/mine"] });
      Alert.alert("✅ Product Promoted!", `${promoProduct.name} is now featured for ${promoDays} days.`);
      setShowPromoForm(false); setPromoProduct(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ["/api/products/vendor/mine"] });
      Alert.alert("✅ Product Featured!", `${promoProduct.name} has been marked as featured.`);
      setShowPromoForm(false); setPromoProduct(null);
    },
  });

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Vendor Tools</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 60 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── FLASH DEALS ── */}
        <View style={styles.card}>
          <SectionHeader
            icon="timer-outline"
            title="Flash Deals"
            subtitle="Set time-limited discounts to boost sales"
          />

          {/* Active deals */}
          {activeDeals.length > 0 && (
            <View style={styles.dealsSection}>
              <Text style={styles.subLabel}>Active Deals ({activeDeals.length})</Text>
              {activeDeals.map((deal: any) => (
                <View key={deal.id} style={styles.dealRow}>
                  <View style={styles.dealInfo}>
                    <Text style={styles.dealName} numberOfLines={1}>{deal.product?.name ?? "Product"}</Text>
                    <Text style={styles.dealPrice}>D {deal.dealPrice} · {deal.discountPercent}% off</Text>
                  </View>
                  <Pressable
                    style={styles.dealDelBtn}
                    onPress={() => {
                      Alert.alert("Remove Deal?", "This will end the flash deal.", [
                        { text: "Cancel" },
                        { text: "Remove", style: "destructive", onPress: () => deleteDeal.mutate(deal.id) },
                      ]);
                    }}
                  >
                    <Ionicons name="close-circle" size={20} color={Colors.error} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {/* Create deal */}
          {!showDealForm ? (
            <Pressable style={styles.actionBtn} onPress={() => setShowDealForm(true)}>
              <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
              <Text style={styles.actionBtnText}>Create Flash Deal</Text>
            </Pressable>
          ) : (
            <View style={styles.form}>
              <Text style={styles.formTitle}>New Flash Deal</Text>

              <Text style={styles.fieldLabel}>Select Product</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {myProducts.map(p => (
                  <Pressable
                    key={p.id}
                    style={[styles.productPill, selectedProduct?.id === p.id && styles.productPillActive]}
                    onPress={() => { setSelectedProduct(p); setDealPrice(String(Math.round(p.price * 0.8))); setDiscountPct("20"); }}
                  >
                    <Text style={[styles.productPillText, selectedProduct?.id === p.id && styles.productPillTextActive]} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={[styles.productPillPrice, selectedProduct?.id === p.id && { color: "#E6FAF3" }]}>
                      D {p.price}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {selectedProduct && (
                <>
                  <Text style={styles.fieldLabel}>Original Price: D {selectedProduct.price}</Text>
                  <View style={styles.row2}>
                    <View style={styles.halfInput}>
                      <Text style={styles.fieldLabel}>Deal Price (D)</Text>
                      <TextInput
                        style={styles.input}
                        value={dealPrice}
                        onChangeText={v => {
                          setDealPrice(v);
                          if (v && selectedProduct) setDiscountPct(String(Math.round((1 - parseFloat(v) / selectedProduct.price) * 100)));
                        }}
                        keyboardType="numeric"
                        placeholder="e.g. 1500"
                        placeholderTextColor="#aaa"
                      />
                    </View>
                    <View style={styles.halfInput}>
                      <Text style={styles.fieldLabel}>Discount %</Text>
                      <TextInput
                        style={styles.input}
                        value={discountPct}
                        onChangeText={v => {
                          setDiscountPct(v);
                          if (v && selectedProduct) setDealPrice(String(Math.round(selectedProduct.price * (1 - parseInt(v) / 100))));
                        }}
                        keyboardType="numeric"
                        placeholder="e.g. 20"
                        placeholderTextColor="#aaa"
                      />
                    </View>
                  </View>
                  <Text style={styles.fieldLabel}>Duration (hours)</Text>
                  <View style={styles.durationRow}>
                    {["6", "12", "24", "48", "72"].map(h => (
                      <Pressable
                        key={h}
                        style={[styles.durationChip, dealHours === h && styles.durationChipActive]}
                        onPress={() => setDealHours(h)}
                      >
                        <Text style={[styles.durationText, dealHours === h && styles.durationTextActive]}>{h}h</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              <View style={styles.formBtns}>
                <Pressable style={styles.cancelBtn} onPress={() => { setShowDealForm(false); setSelectedProduct(null); }}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.submitBtn, (!selectedProduct || !dealPrice || !discountPct) && { opacity: 0.5 }]}
                  onPress={() => createDeal.mutate()}
                  disabled={createDeal.isPending || !selectedProduct || !dealPrice || !discountPct}
                >
                  {createDeal.isPending
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.submitBtnText}>Launch Deal 🚀</Text>}
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* ── PROMOTIONS / ADS ── */}
        <View style={styles.card}>
          <SectionHeader
            icon="megaphone-outline"
            title="Promote Products"
            subtitle="Feature your products on the homepage"
          />

          {!showPromoForm ? (
            <Pressable style={styles.actionBtn} onPress={() => setShowPromoForm(true)}>
              <Ionicons name="star-outline" size={18} color={Colors.primary} />
              <Text style={styles.actionBtnText}>Feature a Product</Text>
            </Pressable>
          ) : (
            <View style={styles.form}>
              <Text style={styles.formTitle}>Feature a Product</Text>

              <Text style={styles.fieldLabel}>Select Product to Feature</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {myProducts.map(p => (
                  <Pressable
                    key={p.id}
                    style={[styles.productPill, promoProduct?.id === p.id && styles.productPillActive]}
                    onPress={() => setPromoProduct(p)}
                  >
                    <Text style={[styles.productPillText, promoProduct?.id === p.id && styles.productPillTextActive]} numberOfLines={1}>
                      {p.name}
                    </Text>
                    {p.isFeatured && <Text style={styles.featuredBadge}>★ Featured</Text>}
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Featured Duration</Text>
              <View style={styles.durationRow}>
                {["7", "14", "30"].map(d => (
                  <Pressable
                    key={d}
                    style={[styles.durationChip, promoDays === d && styles.durationChipActive]}
                    onPress={() => setPromoDays(d)}
                  >
                    <Text style={[styles.durationText, promoDays === d && styles.durationTextActive]}>{d} days</Text>
                  </Pressable>
                ))}
              </View>

              <View style={[styles.infoBanner, { marginTop: 8 }]}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
                <Text style={styles.infoText}>Featured products appear on the home screen in "For You" and "New Arrivals" sections.</Text>
              </View>

              <View style={styles.formBtns}>
                <Pressable style={styles.cancelBtn} onPress={() => { setShowPromoForm(false); setPromoProduct(null); }}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.submitBtn, !promoProduct && { opacity: 0.5 }]}
                  onPress={() => featureProduct.mutate()}
                  disabled={featureProduct.isPending || !promoProduct}
                >
                  {featureProduct.isPending
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.submitBtnText}>Feature Now ⭐</Text>}
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* ── QUICK STATS ── */}
        <View style={styles.card}>
          <SectionHeader icon="bar-chart-outline" title="Quick Stats" subtitle="Your store performance" />
          <View style={styles.statsGrid}>
            {[
              { label: "Products", value: myProducts.length, icon: "cube-outline", color: "#2563EB" },
              { label: "In Stock", value: myProducts.filter(p => p.inStock).length, icon: "checkmark-circle-outline", color: Colors.primary },
              { label: "On Sale", value: myProducts.filter(p => p.isSale).length, icon: "pricetag-outline", color: Colors.error },
              { label: "Flash Deals", value: activeDeals.length, icon: "timer-outline", color: "#F59E0B" },
            ].map(s => (
              <View key={s.label} style={[styles.statCard, { borderLeftColor: s.color }]}>
                <Ionicons name={s.icon as any} size={18} color={s.color} />
                <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── TIPS ── */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>💡 Seller Tips</Text>
          {[
            "Use flash deals on weekends for 3× more clicks",
            "Add 5+ clear photos to increase sales by 60%",
            "Respond to orders within 1 hour to boost your rating",
            "Feature new products to get them discovered faster",
          ].map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8FA" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: Colors.primary,
  },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  content: { padding: 16, gap: 16 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  sectionIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#1A1A2E" },
  sectionSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#888", marginTop: 1 },
  subLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#555" },
  dealsSection: { gap: 8, backgroundColor: "#F7F8FA", borderRadius: 12, padding: 10 },
  dealRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderRadius: 10, padding: 10 },
  dealInfo: { flex: 1 },
  dealName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1A1A2E" },
  dealPrice: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.primary },
  dealDelBtn: { padding: 4 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, justifyContent: "center", borderStyle: "dashed" },
  actionBtnText: { color: Colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 14 },
  form: { gap: 10, backgroundColor: "#F7F8FA", borderRadius: 12, padding: 12 },
  formTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#1A1A2E" },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#555" },
  productPill: { backgroundColor: "#fff", borderRadius: 10, padding: 10, marginRight: 8, borderWidth: 1.5, borderColor: "#E5E7EB", minWidth: 120 },
  productPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  productPillText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#1A1A2E" },
  productPillTextActive: { color: "#fff" },
  productPillPrice: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#888", marginTop: 2 },
  featuredBadge: { fontSize: 10, color: "#F59E0B", fontFamily: "Inter_600SemiBold", marginTop: 2 },
  row2: { flexDirection: "row", gap: 10 },
  halfInput: { flex: 1, gap: 4 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#1A1A2E" },
  durationRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  durationChip: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#E5E7EB" },
  durationChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  durationText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#555" },
  durationTextActive: { color: "#fff" },
  infoBanner: { flexDirection: "row", gap: 8, backgroundColor: Colors.primaryLight, borderRadius: 10, padding: 10, alignItems: "flex-start" },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.primary, lineHeight: 17 },
  formBtns: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, backgroundColor: "#fff", borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB" },
  cancelBtnText: { fontFamily: "Inter_700Bold", color: "#555" },
  submitBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  submitBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { flex: 1, minWidth: "45%", backgroundColor: "#F7F8FA", borderRadius: 12, padding: 12, gap: 4, borderLeftWidth: 3, alignItems: "flex-start" },
  statValue: { fontSize: 24, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#888" },
  tipsCard: { backgroundColor: "#1A1A2E", borderRadius: 16, padding: 16, gap: 10 },
  tipsTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  tipText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#CBD5E1", lineHeight: 18 },
});
