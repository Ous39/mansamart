import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  FlatList,
  Platform,
  Dimensions,
  Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { products as localProducts, categories, getSaleProducts } from "@/data/products";
import { ProductCard } from "@/components/ProductCard";
import { FixedHeader, getHeaderHeight } from "@/components/FixedHeader";
import { useAuth } from "@/contexts/AuthContext";

const { width } = Dimensions.get("window");

const BANNERS = [
  { id: "1", title: "MansaMart", subtitle: "Shop fashion, electronics, food & more", tag: "NEW SEASON", color1: "#0EA47A", color2: "#0B8A65", icon: "storefront-outline" },
  { id: "2", title: "Flash Sale — Up to 60% Off", subtitle: "Limited time deals across all categories", tag: "FLASH SALE", color1: "#E63946", color2: "#B5131E", icon: "flash-outline" },
  { id: "3", title: "Local Brands, Global Quality", subtitle: "Supporting Gambian businesses every day", tag: "MADE IN GAMBIA", color1: "#2196F3", color2: "#1565C0", icon: "ribbon-outline" },
  { id: "4", title: "Free Delivery on D500+", subtitle: "Delivering to Banjul, Serrekunda & beyond", tag: "FREE SHIPPING", color1: "#FF9800", color2: "#E65100", icon: "bicycle-outline" },
];

const CAT_GRID = [
  { id: "fashion", label: "Fashion", icon: "shirt-outline", color: "#E91E8C", bg: "#FCE4F0" },
  { id: "electronics", label: "Electronics", icon: "phone-portrait-outline", color: "#2196F3", bg: "#E3F2FD" },
  { id: "food", label: "Food", icon: "basket-outline", color: "#4CAF50", bg: "#E8F5E9" },
  { id: "beauty", label: "Beauty", icon: "sparkles-outline", color: "#FF6B9D", bg: "#FFE4EF" },
  { id: "furniture", label: "Furniture", icon: "home-outline", color: "#0EA47A", bg: "#E6FAF3" },
  { id: "sports", label: "Sports", icon: "football-outline", color: "#FF9800", bg: "#FFF3E0" },
  { id: "baby", label: "Baby & Kids", icon: "happy-outline", color: "#9C27B0", bg: "#F3E5F5" },
  { id: "agri", label: "Agriculture", icon: "leaf-outline", color: "#388E3C", bg: "#E8F5E9" },
  { id: "auto", label: "Auto", icon: "car-outline", color: "#455A64", bg: "#ECEFF1" },
  { id: "books", label: "Books", icon: "book-outline", color: "#795548", bg: "#EFEBE9" },
  { id: "jewellery", label: "Jewellery", icon: "diamond-outline", color: "#F59E0B", bg: "#FFFBEB" },
  { id: "more", label: "Services", icon: "construct-outline", color: "#7B4FA3", bg: "#F3E8FF" },
];


function useSecs(initial: number) {
  const [s, setS] = useState(initial);
  useEffect(() => {
    const t = setInterval(() => setS(v => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function BannerCarousel() {
  const [active, setActive] = useState(0);
  const ref = useRef<ScrollView>(null);
  useEffect(() => {
    const t = setInterval(() => {
      setActive(a => {
        const next = (a + 1) % BANNERS.length;
        ref.current?.scrollTo({ x: next * (width - 32), animated: true });
        return next;
      });
    }, 3500);
    return () => clearInterval(t);
  }, []);
  return (
    <View style={styles.bannerWrap}>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => setActive(Math.round(e.nativeEvent.contentOffset.x / (width - 32)))}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={width - 32}
      >
        {BANNERS.map(b => (
          <LinearGradient key={b.id} colors={[b.color1, b.color2]} style={styles.banner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={styles.bannerLeft}>
              <View style={styles.bannerTag}>
                <Text style={styles.bannerTagText}>{b.tag}</Text>
              </View>
              <Text style={styles.bannerTitle}>{b.title}</Text>
              <Text style={styles.bannerSubtitle}>{b.subtitle}</Text>
              <Pressable style={styles.bannerBtn} onPress={() => router.push("/(tabs)/browse")}>
                <Text style={styles.bannerBtnText}>Shop Now</Text>
                <Ionicons name="arrow-forward" size={13} color={b.color1} />
              </Pressable>
            </View>
            <View style={styles.bannerIconWrap}>
              <Ionicons name={b.icon as any} size={64} color="rgba(255,255,255,0.22)" />
            </View>
          </LinearGradient>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {BANNERS.map((_, i) => (
          <View key={i} style={[styles.dot, i === active && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const countdown = useSecs(2 * 3600 + 47 * 60 + 22);
  const headerHeight = getHeaderHeight(insets);

  const { data: apiProducts } = useQuery<any[]>({ queryKey: ["/api/products"] });
  const { data: flashDealsData = [] } = useQuery<any[]>({ queryKey: ["/api/flash-deals"] });
  const { data: recommendations = [] } = useQuery<any[]>({ queryKey: ["/api/recommendations"] });
  const allProducts = apiProducts && apiProducts.length > 0 ? apiProducts : localProducts;
  const featuredProducts = allProducts.filter((p: any) => p.isFeatured).slice(0, 8);
  const newProducts = allProducts.filter((p: any) => p.isNew).slice(0, 8);
  const flashProducts = flashDealsData.length > 0
    ? flashDealsData.slice(0, 8).map((d: any) => d.product ? { ...d.product, price: d.dealPrice, originalPrice: d.product.price, isSale: true } : null).filter(Boolean)
    : getSaleProducts().slice(0, 6);

  return (
    <View style={styles.container}>
      <FixedHeader showSearch showCategories onSearchFocus={() => router.push("/(tabs)/browse")} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 120 + (Platform.OS === "web" ? 34 : 0) }}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome bar */}
        {user && (
          <View style={styles.welcomeBar}>
            <Text style={styles.welcomeText}>Hello, <Text style={styles.welcomeName}>{user.name.split(" ")[0]}</Text> 👋</Text>
            <Pressable onPress={() => router.push("/(tabs)/profile")}>
              <View style={[styles.avatarSmall, { backgroundColor: Colors.primary }]}>
                <Text style={styles.avatarSmallText}>{user.name[0].toUpperCase()}</Text>
              </View>
            </Pressable>
          </View>
        )}

        {/* Banner */}
        <BannerCarousel />

        {/* Category Grid */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Shop by Category</Text>
          <Pressable onPress={() => router.push("/(tabs)/browse")}>
            <Text style={styles.seeAll}>All ›</Text>
          </Pressable>
        </View>
        <View style={styles.catGrid}>
          {CAT_GRID.map(cat => (
            <Pressable
              key={cat.id}
              style={({ pressed }) => [styles.catItem, pressed && { opacity: 0.8 }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (cat.id === "more") router.push("/(tabs)/services");
                else router.push("/(tabs)/browse");
              }}
            >
              <View style={[styles.catIcon, { backgroundColor: cat.bg }]}>
                <Ionicons name={cat.icon as any} size={22} color={cat.color} />
              </View>
              <Text style={styles.catLabel} numberOfLines={1}>{cat.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Flash Deals */}
        <View style={styles.flashSection}>
          <View style={styles.flashHeader}>
            <View style={styles.flashTitleRow}>
              <View style={styles.flashLive} />
              <Text style={styles.flashTitle}>Flash Deals</Text>
              <View style={styles.flashTimerBadge}>
                <Ionicons name="timer-outline" size={12} color="#fff" />
                <Text style={styles.flashTimerText}>{countdown}</Text>
              </View>
            </View>
            <Pressable onPress={() => router.push("/flash-deals" as any)}>
              <Text style={styles.seeAllDark}>See all ›</Text>
            </Pressable>
          </View>
          <FlatList
            data={flashProducts as any[]}
            keyExtractor={(p: any) => p.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.flashList}
            renderItem={({ item }) => (
              <ProductCard product={item} onPress={() => router.push(`/product/${item.id}`)} style={{ width: 160, marginRight: 0 }} />
            )}
            ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
          />
        </View>

        {/* For You */}
        <View style={[styles.sectionHeader, { marginTop: 16 }]}>
          <View style={styles.forYouTitle}>
            <Ionicons name="heart-outline" size={16} color={Colors.deal} />
            <Text style={styles.sectionTitle}>For You</Text>
          </View>
          <Pressable onPress={() => router.push("/(tabs)/browse")}>
            <Text style={styles.seeAll}>See all ›</Text>
          </Pressable>
        </View>
        <View style={styles.grid}>
          {featuredProducts.map(p => <ProductCard key={p.id} product={p} />)}
        </View>

        {/* Best Sellers banner */}
        <Pressable style={styles.midBanner} onPress={() => router.push("/(tabs)/browse")}>
          <LinearGradient colors={["#0F172A", "#1E293B"]} style={styles.midBannerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <View style={styles.midBannerLeft}>
              <Text style={styles.midBannerTag}>🔥 TRENDING</Text>
              <Text style={styles.midBannerTitle}>Best Sellers{"\n"}This Week</Text>
              <Text style={styles.midBannerSub}>1,200+ items sold today</Text>
            </View>
            <View style={styles.midBannerIcons}>
              {["shirt-outline", "phone-portrait-outline", "sparkles-outline", "basket-outline"].map((icon, i) => (
                <View key={i} style={[styles.midIconCircle, { opacity: 1 - i * 0.15 }]}>
                  <Ionicons name={icon as any} size={18} color="#fff" />
                </View>
              ))}
            </View>
          </LinearGradient>
        </Pressable>

        {/* New Arrivals */}
        <View style={styles.sectionHeader}>
          <View style={styles.forYouTitle}>
            <View style={styles.newBadgeInline}>
              <Text style={styles.newBadgeInlineText}>NEW</Text>
            </View>
            <Text style={styles.sectionTitle}>New Arrivals</Text>
          </View>
          <Pressable onPress={() => router.push("/(tabs)/browse")}>
            <Text style={styles.seeAll}>See all ›</Text>
          </Pressable>
        </View>
        <View style={styles.grid}>
          {newProducts.map(p => <ProductCard key={p.id} product={p} />)}
        </View>

        {/* Recommended for You */}
        {(recommendations as any[]).length > 0 && (
          <>
            <View style={[styles.sectionHeader, { marginTop: 4 }]}>
              <View style={styles.forYouTitle}>
                <Ionicons name="sparkles-outline" size={16} color="#F59E0B" />
                <Text style={styles.sectionTitle}>Recommended for You</Text>
              </View>
              <Pressable onPress={() => router.push("/(tabs)/browse")}>
                <Text style={styles.seeAll}>See all ›</Text>
              </Pressable>
            </View>
            <View style={styles.grid}>
              {(recommendations as any[]).slice(0, 8).map((p: any) => (
                <ProductCard key={p.id} product={p} onPress={() => router.push(`/product/${p.id}`)} />
              ))}
            </View>
          </>
        )}

        {/* Services Promo */}
        <Pressable style={styles.servicesPromo} onPress={() => router.push("/(tabs)/services")}>
          <View style={styles.servicesPromoLeft}>
            <View style={styles.servicesTag}>
              <Text style={styles.servicesTagText}>SERVICES</Text>
            </View>
            <Text style={styles.servicesTitle}>Book Home Services</Text>
            <Text style={styles.servicesSub}>Assembly, cleaning, design & more</Text>
            <View style={styles.servicesBtn}>
              <Text style={styles.servicesBtnText}>Browse Services ›</Text>
            </View>
          </View>
          <View style={styles.servicesIcons}>
            {[
              { icon: "construct-outline", color: "#2563EB", bg: "#EFF6FF" },
              { icon: "sparkles-outline", color: "#E8813A", bg: "#FEF0E6" },
              { icon: "color-palette-outline", color: "#7B4FA3", bg: "#F3E8FF" },
              { icon: "car-outline", color: "#0EA47A", bg: "#E6FAF3" },
            ].map((item, i) => (
              <View key={i} style={[styles.serviceIconBubble, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon as any} size={20} color={item.color} />
              </View>
            ))}
          </View>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  welcomeBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 14 },
  welcomeText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  welcomeName: { fontFamily: "Inter_700Bold", color: Colors.text },
  avatarSmall: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  avatarSmallText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },
  bannerWrap: { marginHorizontal: 16, marginBottom: 20 },
  banner: { width: width - 32, borderRadius: 16, padding: 20, flexDirection: "row", alignItems: "center", overflow: "hidden" },
  bannerLeft: { flex: 1, gap: 7 },
  bannerTag: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  bannerTagText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 1 },
  bannerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff", lineHeight: 24 },
  bannerSubtitle: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", lineHeight: 16 },
  bannerBtn: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: "#fff", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  bannerBtnText: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.text },
  bannerIconWrap: { width: 80, alignItems: "center", justifyContent: "center" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 5, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.border },
  dotActive: { width: 18, backgroundColor: Colors.primary },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.text },
  seeAll: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  seeAllDark: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  forYouTitle: { flexDirection: "row", alignItems: "center", gap: 6 },
  newBadgeInline: { backgroundColor: Colors.deal, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  newBadgeInlineText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.5 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 4, marginBottom: 20 },
  catItem: { width: (width - 24 - 4 * 5) / 6, alignItems: "center", gap: 5, padding: 4 },
  catIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  catLabel: { fontSize: 9, fontFamily: "Inter_500Medium", color: Colors.textSecondary, textAlign: "center" },
  flashSection: { backgroundColor: "#0F172A", paddingVertical: 16, marginBottom: 0 },
  flashHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 12 },
  flashTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  flashLive: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.deal },
  flashTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff" },
  flashTimerBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.deal, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4 },
  flashTimerText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 1 },
  flashList: { paddingHorizontal: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 10, marginBottom: 20 },
  midBanner: { marginHorizontal: 16, marginBottom: 20, borderRadius: 16, overflow: "hidden" },
  midBannerGradient: { flexDirection: "row", alignItems: "center", padding: 20 },
  midBannerLeft: { flex: 1, gap: 5 },
  midBannerTag: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.accent, letterSpacing: 0.5 },
  midBannerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff", lineHeight: 27 },
  midBannerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" },
  midBannerIcons: { gap: 8 },
  midIconCircle: { width: 38, height: 38, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  servicesPromo: { marginHorizontal: 16, marginBottom: 20, backgroundColor: "#F3E8FF", borderRadius: 16, padding: 20, flexDirection: "row", alignItems: "center" },
  servicesPromoLeft: { flex: 1, gap: 5 },
  servicesTag: { alignSelf: "flex-start", backgroundColor: "#7B4FA3", borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  servicesTagText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 1 },
  servicesTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.text },
  servicesSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  servicesBtn: { alignSelf: "flex-start", marginTop: 4 },
  servicesBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#7B4FA3" },
  servicesIcons: { flexWrap: "wrap", width: 88, flexDirection: "row", gap: 8 },
  serviceIconBubble: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
});
