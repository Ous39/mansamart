import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, Pressable, FlatList, Platform, Dimensions, Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { services as localServices, serviceCategories } from "@/data/services";
import { FixedHeader } from "@/components/FixedHeader";

const { width } = Dimensions.get("window");
const CARD_W = (width - 12 * 2 - 10) / 2;

const SORT_OPTIONS = [
  { key: "popular", label: "Popular" },
  { key: "rating",  label: "Top Rated" },
  { key: "price_low",  label: "Price ↑" },
  { key: "price_high", label: "Price ↓" },
  { key: "newest", label: "Newest" },
];

const PRICE_TYPES = [
  { key: null,       label: "All" },
  { key: "fixed",    label: "Fixed" },
  { key: "hourly",   label: "Hourly" },
  { key: "per_room", label: "Per Room" },
];

function priceLabel(s: any) {
  if (s.priceType === "hourly")   return "/hr";
  if (s.priceType === "per_room") return "/room";
  return "";
}

function ServiceGridCard({ service }: { service: any }) {
  const cat = serviceCategories.find(c => c.id === service.category);
  const pl = priceLabel(service);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, { width: CARD_W }, pressed && { opacity: 0.93 }]}
      onPress={() => router.push({ pathname: "/service/[id]", params: { id: service.id } })}
    >
      {/* Image */}
      {service.imageUrl ? (
        <Image source={{ uri: service.imageUrl }} style={styles.cardImg} resizeMode="cover" />
      ) : (
        <View style={[styles.cardImg, { backgroundColor: cat?.bgColor ?? Colors.primaryLight, alignItems: "center", justifyContent: "center" }]}>
          <Ionicons name={(cat?.icon ?? "construct-outline") as any} size={38} color={cat?.color ?? Colors.primary} />
        </View>
      )}

      {/* Badges */}
      <View style={styles.cardBadges}>
        <View style={[styles.catBadge, { backgroundColor: cat?.bgColor ?? Colors.primaryLight }]}>
          <Text style={[styles.catBadgeText, { color: cat?.color ?? Colors.primary }]}>
            {cat?.name ?? service.category}
          </Text>
        </View>
        {service.isFeatured && (
          <View style={styles.featuredBadge}>
            <Text style={styles.featuredBadgeText}>⭐</Text>
          </View>
        )}
      </View>

      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={2}>{service.name}</Text>
        <Text style={styles.cardProvider} numberOfLines={1}>{service.providerName ?? "Verified Provider"}</Text>

        <View style={styles.ratingRow}>
          <Ionicons name="star" size={11} color="#F59E0B" />
          <Text style={styles.ratingText}>{service.rating?.toFixed(1) ?? "4.5"}</Text>
          <Text style={styles.reviewCount}>({service.reviewCount ?? 0})</Text>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.price}>D {Number(service.price).toLocaleString()}<Text style={styles.priceSuffix}>{pl}</Text></Text>
          <View style={styles.durationBadge}>
            <Ionicons name="time-outline" size={10} color={Colors.textSecondary} />
            <Text style={styles.durationText}>{service.duration ?? "Flexible"}</Text>
          </View>
        </View>
      </View>

      <Pressable style={styles.bookBtn} onPress={() => router.push({ pathname: "/service/[id]", params: { id: service.id } })}>
        <Text style={styles.bookBtnText}>Book</Text>
        <Ionicons name="arrow-forward" size={13} color="#fff" />
      </Pressable>
    </Pressable>
  );
}

export default function ServicesScreen() {
  const insets = useSafeAreaInsets();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSort, setSelectedSort] = useState("popular");
  const [selectedPriceType, setSelectedPriceType] = useState<string | null>(null);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const { data: apiServices } = useQuery<any[]>({ queryKey: ["/api/services"] });
  const allServices = apiServices && apiServices.length > 0 ? apiServices : localServices;

  const filtered = useMemo(() => {
    let list = [...allServices];
    if (selectedCategory) list = list.filter(s => s.category === selectedCategory);
    if (selectedPriceType) list = list.filter(s => s.priceType === selectedPriceType);
    if (minPrice) list = list.filter(s => Number(s.price) >= parseInt(minPrice));
    if (maxPrice) list = list.filter(s => Number(s.price) <= parseInt(maxPrice));
    if (selectedSort === "price_low")  list.sort((a, b) => Number(a.price) - Number(b.price));
    else if (selectedSort === "price_high") list.sort((a, b) => Number(b.price) - Number(a.price));
    else if (selectedSort === "rating")     list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    else if (selectedSort === "newest")     list = list.filter(s => s.isNew).concat(list.filter(s => !s.isNew));
    else list.sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
    return list;
  }, [allServices, selectedCategory, selectedSort, selectedPriceType, minPrice, maxPrice]);

  const selectedCat = serviceCategories.find(c => c.id === selectedCategory);

  return (
    <View style={styles.container}>
      <FixedHeader
        showSearch
        showCategories={false}
        onSearchFocus={() => {}}
        searchPlaceholder="Search services..."
      />

      {/* Category scroll */}
      <View style={styles.catScroll}>
        <FlatList
          data={[{ id: null, name: "All", icon: "apps-outline", color: Colors.primary, bgColor: Colors.primaryLight }, ...serviceCategories]}
          keyExtractor={c => c.id ?? "all"}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catList}
          renderItem={({ item }) => {
            const isActive = selectedCategory === item.id;
            return (
              <Pressable
                style={[styles.catPill, isActive && { backgroundColor: (item as any).color ?? Colors.primary }]}
                onPress={() => setSelectedCategory(item.id === null ? null : item.id as string)}
              >
                <Ionicons name={(item.icon ?? "apps-outline") as any} size={13} color={isActive ? "#fff" : (item as any).color ?? Colors.primary} />
                <Text style={[styles.catPillText, isActive && { color: "#fff" }]}>{item.name}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      {/* Filter bar */}
      <View style={styles.filterBar}>
        <View style={styles.filterRow}>
          <Text style={styles.resultCount}><Text style={styles.resultNum}>{filtered.length}</Text> services</Text>
          {PRICE_TYPES.slice(1).map(pt => (
            <Pressable
              key={pt.key}
              style={[styles.filterChip, selectedPriceType === pt.key && styles.filterChipActive]}
              onPress={() => setSelectedPriceType(prev => prev === pt.key ? null : pt.key)}
            >
              <Text style={[styles.filterChipText, selectedPriceType === pt.key && styles.filterChipTextActive]}>{pt.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.sortRow}>
          {SORT_OPTIONS.map(s => (
            <Pressable
              key={s.key}
              style={[styles.sortChip, selectedSort === s.key && styles.sortChipActive]}
              onPress={() => setSelectedSort(s.key)}
            >
              <Text style={[styles.sortText, selectedSort === s.key && styles.sortTextActive]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {selectedCat ? selectedCat.name : "All Services"}
        </Text>
        {(selectedCategory || selectedPriceType) && (
          <Pressable onPress={() => { setSelectedCategory(null); setSelectedPriceType(null); setMinPrice(""); setMaxPrice(""); }}>
            <Text style={styles.clearText}>Clear filters</Text>
          </Pressable>
        )}
      </View>

      {/* Grid */}
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="search-outline" size={40} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No services found</Text>
          <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
          <Pressable style={styles.clearBtn} onPress={() => { setSelectedCategory(null); setSelectedPriceType(null); }}>
            <Text style={styles.clearBtnText}>Clear all filters</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={s => s.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.grid, { paddingBottom: 120 + (Platform.OS === "web" ? 34 : 0) }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <ServiceGridCard service={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  catScroll: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  catList: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  catPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: Colors.borderLight,
  },
  catPillText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  filterBar: {
    backgroundColor: Colors.surface, paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8,
  },
  filterRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  resultCount: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  resultNum: { fontFamily: "Inter_700Bold", color: Colors.text },
  filterChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primary,
  },
  filterChipActive: { backgroundColor: Colors.primary },
  filterChipText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  filterChipTextActive: { color: "#fff" },
  sortRow: { flexDirection: "row", gap: 7 },
  sortChip: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: Colors.borderLight, borderWidth: 1, borderColor: Colors.border },
  sortChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sortText: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  sortTextActive: { color: "#fff", fontFamily: "Inter_600SemiBold" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text },
  clearText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  grid: { paddingHorizontal: 12, paddingTop: 8 },
  row: { gap: 10, marginBottom: 10 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  cardImg: { width: "100%", height: 130, backgroundColor: Colors.borderLight },
  cardImgActual: { width: "100%", height: "100%" },
  cardBadges: { position: "absolute", top: 8, left: 8, right: 8, flexDirection: "row", justifyContent: "space-between" },
  catBadge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  catBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.5 },
  featuredBadge: { backgroundColor: "#FFFBEB", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 3 },
  featuredBadgeText: { fontSize: 10 },
  cardInfo: { padding: 10, gap: 3 },
  cardName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text, lineHeight: 18 },
  cardProvider: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.text },
  reviewCount: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  price: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text },
  priceSuffix: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  durationBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: Colors.borderLight, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  durationText: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  bookBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: Colors.primary, marginHorizontal: 10, marginBottom: 10, borderRadius: 10, paddingVertical: 8 },
  bookBtnText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 60 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: Colors.borderLight, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.text },
  emptySubtext: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  clearBtn: { backgroundColor: Colors.primaryLight, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  clearBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.primary },
});
