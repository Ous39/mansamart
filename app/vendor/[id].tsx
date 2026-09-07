import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, FlatList,
  ActivityIndicator, Platform, Dimensions, Linking, Image,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { ProductCard } from "@/components/ProductCard";
import { toImageSource } from "@/lib/product-media";

const { width } = Dimensions.get("window");

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons
          key={i}
          name={i <= Math.round(rating) ? "star" : "star-outline"}
          size={size}
          color="#F59E0B"
        />
      ))}
    </View>
  );
}

export default function VendorStoreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [activeTab, setActiveTab] = useState<"products" | "reviews" | "info">("products");

  const { data: vendor, isLoading } = useQuery<any>({
    queryKey: ["/api/vendors", id],
  });

  if (isLoading) return (
    <View style={styles.center}>
      <Stack.Screen options={{ headerShown: false }} />
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={{ marginTop: 12, color: "#999" }}>Loading store...</Text>
    </View>
  );

  if (!vendor) return (
    <View style={styles.center}>
      <Stack.Screen options={{ headerShown: false }} />
      <Ionicons name="storefront-outline" size={60} color="#ccc" />
      <Text style={styles.notFoundText}>Store not found</Text>
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backBtnText}>Go Back</Text>
      </Pressable>
    </View>
  );

  const verified = vendor.verificationStatus === "verified";
  const coverSource = toImageSource(vendor.coverImage);
  const logoSource = toImageSource(vendor.logo);

  return (
    <View style={{ flex: 1, backgroundColor: "#F7F8FA" }}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover + Back */}
        <View style={{ position: "relative" }}>
          <LinearGradient
            colors={["#0EA47A", "#2563EB"]}
            style={[styles.cover, { paddingTop: topPad + 10 }]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            {coverSource ? <Image source={coverSource as any} style={styles.coverImage} resizeMode="cover" /> : null}
            <View style={styles.coverShade} />
            <Pressable onPress={() => router.back()} style={styles.backPress}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
            <View style={styles.coverContent}>
              <Ionicons name="storefront" size={60} color="rgba(255,255,255,0.3)" />
            </View>
          </LinearGradient>

          {/* Store logo */}
          <View style={styles.storeLogoWrap}>
            <View style={styles.storeLogo}>
              {logoSource ? <Image source={logoSource as any} style={styles.storeLogoImage} resizeMode="cover" /> : <Text style={styles.storeLogoText}>{vendor.storeName?.[0]?.toUpperCase() || "S"}</Text>}
            </View>
            {verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
              </View>
            )}
          </View>
        </View>

        {/* Store Info */}
        <View style={styles.storeInfo}>
          <View style={styles.storeNameRow}>
            <Text style={styles.storeName}>{vendor.storeName}</Text>
            {verified && <View style={styles.verifiedChip}><Text style={styles.verifiedChipText}>Verified</Text></View>}
          </View>
          {vendor.location && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color="#888" />
              <Text style={styles.locationText}>{vendor.location}</Text>
            </View>
          )}
          {vendor.description && <Text style={styles.description}>{vendor.description}</Text>}

          {/* Stats */}
          <View style={styles.statsRow}>
            <StatBox label="Products" value={vendor.productCount || 0} icon="cube-outline" />
            <StatBox label="Sales" value={(vendor.totalSales || 0).toLocaleString()} icon="bag-outline" />
            <StatBox label="Rating" value={(vendor.rating || 4.5).toFixed(1)} icon="star" iconColor="#F59E0B" />
            <StatBox label="Reviews" value={vendor.reviewCount || 0} icon="chatbubble-outline" />
          </View>

          {/* Contact buttons */}
          <View style={styles.contactBtns}>
            {vendor.whatsapp && (
              <Pressable style={[styles.contactBtn, { backgroundColor: "#25D366" }]} onPress={() => Linking.openURL(`https://wa.me/${vendor.whatsapp.replace(/\D/g, "")}`)}>
                <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                <Text style={styles.contactBtnText}>WhatsApp</Text>
              </Pressable>
            )}
            <Pressable style={[styles.contactBtn, { backgroundColor: Colors.primary }]} onPress={() => router.push("/(tabs)/browse")}>
              <Ionicons name="bag-add-outline" size={18} color="#fff" />
              <Text style={styles.contactBtnText}>Shop Now</Text>
            </Pressable>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {(["products", "reviews", "info"] as const).map(tab => (
            <Pressable key={tab} onPress={() => setActiveTab(tab)} style={[styles.tab, activeTab === tab && styles.tabActive]}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === "products" && ` (${vendor.products?.length || 0})`}
                {tab === "reviews" && ` (${vendor.reviews?.length || 0})`}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tab Content */}
        {activeTab === "products" && (
          <View style={styles.productsGrid}>
            {(vendor.products || []).length === 0 ? (
              <View style={styles.emptyTab}>
                <Ionicons name="cube-outline" size={40} color="#ccc" />
                <Text style={styles.emptyTabText}>No products yet</Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {(vendor.products || []).map((p: any) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onPress={() => router.push(`/product/${p.id}`)}
                    style={{ width: (width - 36) / 2 }}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {activeTab === "reviews" && (
          <View style={styles.reviewsSection}>
            {(vendor.reviews || []).length === 0 ? (
              <View style={styles.emptyTab}>
                <Ionicons name="chatbubble-outline" size={40} color="#ccc" />
                <Text style={styles.emptyTabText}>No reviews yet</Text>
              </View>
            ) : (
              (vendor.reviews || []).map((rev: any) => (
                <View key={rev.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewAvatar}><Text style={styles.reviewAvatarText}>{rev.name?.[0]}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reviewName}>{rev.name}</Text>
                      <StarRating rating={rev.rating} />
                    </View>
                    {rev.verified && <View style={styles.verifiedChip}><Text style={styles.verifiedChipText}>Verified</Text></View>}
                  </View>
                  <Text style={styles.reviewText}>{rev.text}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === "info" && (
          <View style={styles.infoSection}>
            <InfoRow icon="arrow-undo-outline" label="Return Policy" value={vendor.returnPolicy || "7-day return policy"} />
            <InfoRow icon="car-outline" label="Shipping" value={vendor.shippingPolicy || "2-5 business days"} />
            {vendor.whatsapp && <InfoRow icon="logo-whatsapp" label="WhatsApp" value={vendor.whatsapp} />}
            {vendor.facebook && <InfoRow icon="logo-facebook" label="Facebook" value={vendor.facebook} />}
            {vendor.instagram && <InfoRow icon="logo-instagram" label="Instagram" value={vendor.instagram} />}
          </View>
        )}

        <View style={{ height: Platform.OS === "web" ? 34 : insets.bottom + 16 }} />
      </ScrollView>
    </View>
  );
}

function StatBox({ label, value, icon, iconColor }: any) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon} size={18} color={iconColor || Colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }: any) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={Colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F8FA" },
  coverImage: { ...(StyleSheet.absoluteFillObject as any), width: "100%", height: "100%" },
  coverShade: { ...(StyleSheet.absoluteFillObject as any), backgroundColor: "rgba(0,0,0,0.34)" },
  storeLogoImage: { width: "100%", height: "100%", borderRadius: 41 },
  cover: { height: 245, alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 24, overflow: "hidden" },
  backPress: { padding: 4 },
  coverContent: { alignSelf: "center" },
  storeLogoWrap: { position: "absolute", bottom: -38, left: 20 },
  storeLogo: { width: 82, height: 82, borderRadius: 41, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: "#fff", overflow: "hidden" },
  storeLogoText: { color: "#fff", fontSize: 28, fontWeight: "800" },
  verifiedBadge: { position: "absolute", bottom: 0, right: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: "#0EA47A", alignItems: "center", justifyContent: "center" },
  storeInfo: { backgroundColor: "#fff", marginTop: 46, paddingHorizontal: 16, paddingBottom: 18 },
  storeNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  storeName: { fontSize: 20, fontWeight: "800", color: "#1A1A2E" },
  verifiedChip: { backgroundColor: "#E6FAF3", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  verifiedChipText: { fontSize: 11, color: "#0EA47A", fontWeight: "700" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  locationText: { fontSize: 13, color: "#888" },
  description: { fontSize: 14, color: "#555", lineHeight: 20, marginBottom: 12 },
  statsRow: { flexDirection: "row", gap: 8, marginVertical: 12, justifyContent: "space-between" },
  statBox: { flex: 1, alignItems: "center", gap: 4, backgroundColor: "#F7F8FA", borderRadius: 12, paddingVertical: 10 },
  statValue: { fontSize: 16, fontWeight: "800", color: "#1A1A2E" },
  statLabel: { fontSize: 10, color: "#888", textAlign: "center" },
  contactBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  contactBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, paddingVertical: 11 },
  contactBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  tabBar: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  tab: { flex: 1, alignItems: "center", paddingVertical: 14 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText: { fontSize: 13, color: "#888", fontWeight: "600" },
  tabTextActive: { color: Colors.primary, fontWeight: "700" },
  productsGrid: { padding: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reviewsSection: { padding: 16, gap: 12 },
  reviewCard: { backgroundColor: "#fff", borderRadius: 16, padding: 14 },
  reviewHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  reviewAvatarText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  reviewName: { fontSize: 14, fontWeight: "700", color: "#1A1A2E" },
  reviewText: { fontSize: 13, color: "#555", lineHeight: 18 },
  infoSection: { padding: 16, gap: 2 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F5F5F5" },
  infoLabel: { fontSize: 12, color: "#888", marginBottom: 2 },
  infoValue: { fontSize: 14, color: "#1A1A2E" },
  emptyTab: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyTabText: { fontSize: 15, color: "#aaa" },
  notFoundText: { fontSize: 18, fontWeight: "700", color: "#1A1A2E", marginTop: 12 },
  backBtn: { marginTop: 16, backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  backBtnText: { color: "#fff", fontWeight: "700" },
});
