import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Platform,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { products as localProducts, categories } from "@/data/products";
import { ProductCard } from "@/components/ProductCard";
import { FixedHeader } from "@/components/FixedHeader";

const sortOptions = [
  { key: "popular", label: "Popular" },
  { key: "newest", label: "Newest" },
  { key: "price_low", label: "Price ↑" },
  { key: "price_high", label: "Price ↓" },
  { key: "rating", label: "Top Rated" },
];

export default function BrowseScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSort, setSelectedSort] = useState("popular");
  const [freeShipOnly, setFreeShipOnly] = useState(false);
  const [isSale, setIsSale] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [showPriceFilter, setShowPriceFilter] = useState(false);

  const { data: apiProducts } = useQuery<any[]>({ queryKey: ["/api/products"] });
  const products = apiProducts && apiProducts.length > 0 ? apiProducts : localProducts;

  const filtered = useMemo(() => {
    let list = [...products];
    if (selectedCategory) list = list.filter(p => p.category === selectedCategory);
    if (freeShipOnly) list = list.filter(p => p.freeShipping);
    if (isSale) list = list.filter(p => p.isSale);
    if (isNew) list = list.filter(p => p.isNew);
    if (minPrice) list = list.filter(p => p.price >= parseInt(minPrice));
    if (maxPrice) list = list.filter(p => p.price <= parseInt(maxPrice));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.subcategory || "").toLowerCase().includes(q)
      );
    }
    if (selectedSort === "price_low") list.sort((a, b) => a.price - b.price);
    else if (selectedSort === "price_high") list.sort((a, b) => b.price - a.price);
    else if (selectedSort === "newest") list = list.filter(p => p.isNew).concat(list.filter(p => !p.isNew));
    else if (selectedSort === "rating") list.sort((a, b) => b.rating - a.rating);
    else list.sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0));
    return list;
  }, [search, selectedCategory, selectedSort, freeShipOnly, isSale, isNew, minPrice, maxPrice]);

  const selectedCat = categories.find(c => c.id === selectedCategory);

  return (
    <View style={styles.container}>
      <FixedHeader
        showSearch
        showCategories
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={selectedCat ? `Search in ${selectedCat.name}...` : "Search MansaMart..."}
        selectedCategory={selectedCategory}
        onCategorySelect={setSelectedCategory}
      />

      {/* Sort + Filter bar */}
      <View style={styles.filterBar}>
        <View style={styles.filterRow}>
          <Text style={styles.resultCount}>
            <Text style={styles.resultNum}>{filtered.length}</Text> items
          </Text>
          <Pressable
            style={[styles.filterChip, freeShipOnly && styles.filterChipActive]}
            onPress={() => setFreeShipOnly(v => !v)}
          >
            <Ionicons name="bicycle-outline" size={12} color={freeShipOnly ? "#fff" : Colors.primary} />
            <Text style={[styles.filterChipText, freeShipOnly && styles.filterChipTextActive]}>Free Ship</Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, isSale && styles.filterChipActive]}
            onPress={() => setIsSale(v => !v)}
          >
            <Ionicons name="pricetag-outline" size={12} color={isSale ? "#fff" : Colors.primary} />
            <Text style={[styles.filterChipText, isSale && styles.filterChipTextActive]}>Sale</Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, isNew && styles.filterChipActive]}
            onPress={() => setIsNew(v => !v)}
          >
            <Ionicons name="sparkles-outline" size={12} color={isNew ? "#fff" : Colors.primary} />
            <Text style={[styles.filterChipText, isNew && styles.filterChipTextActive]}>New</Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, (!!minPrice || !!maxPrice) && styles.filterChipActive, showPriceFilter && { borderStyle: "solid" as const }]}
            onPress={() => setShowPriceFilter(v => !v)}
          >
            <Ionicons name="funnel-outline" size={12} color={(!!minPrice || !!maxPrice) ? "#fff" : Colors.primary} />
            <Text style={[styles.filterChipText, (!!minPrice || !!maxPrice) && styles.filterChipTextActive]}>
              {minPrice || maxPrice ? `D${minPrice || "0"}–D${maxPrice || "∞"}` : "Price"}
            </Text>
          </Pressable>
        </View>
        {showPriceFilter && (
          <View style={styles.priceRow}>
            <TextInput
              style={styles.priceInput}
              placeholder="Min (D)"
              value={minPrice}
              onChangeText={setMinPrice}
              keyboardType="numeric"
              placeholderTextColor="#aaa"
            />
            <Text style={styles.priceSep}>–</Text>
            <TextInput
              style={styles.priceInput}
              placeholder="Max (D)"
              value={maxPrice}
              onChangeText={setMaxPrice}
              keyboardType="numeric"
              placeholderTextColor="#aaa"
            />
            <Pressable style={styles.priceApplyBtn} onPress={() => setShowPriceFilter(false)}>
              <Text style={styles.priceApplyText}>Apply</Text>
            </Pressable>
            {(!!minPrice || !!maxPrice) && (
              <Pressable onPress={() => { setMinPrice(""); setMaxPrice(""); setShowPriceFilter(false); }}>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </Pressable>
            )}
          </View>
        )}
        <View style={styles.sortRow}>
          {sortOptions.map(s => (
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

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="search-outline" size={40} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No items found</Text>
          <Text style={styles.emptySubtext}>Try adjusting your search or filters</Text>
          <Pressable style={styles.clearBtn} onPress={() => {
            setSearch(""); setSelectedCategory(null); setFreeShipOnly(false);
            setIsSale(false); setIsNew(false); setMinPrice(""); setMaxPrice(""); setShowPriceFilter(false);
          }}>
            <Text style={styles.clearBtnText}>Clear all filters</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          numColumns={2}
          contentContainerStyle={[
            styles.grid,
            { paddingBottom: 120 + (Platform.OS === "web" ? 34 : 0) },
          ]}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <ProductCard product={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  filterBar: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  filterLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  filterRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  priceInput: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.text, backgroundColor: Colors.background },
  priceSep: { fontSize: 14, color: Colors.textMuted, fontFamily: "Inter_400Regular" },
  priceApplyBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  priceApplyText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  resultCount: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  resultNum: { fontFamily: "Inter_700Bold", color: Colors.text },
  filterChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primary,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  filterChipTextActive: { color: "#fff" },
  sortRow: { flexDirection: "row", gap: 7, flexWrap: "nowrap" },
  sortChip: {
    borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: Colors.borderLight, borderWidth: 1, borderColor: Colors.border,
  },
  sortChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sortText: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  sortTextActive: { color: "#fff", fontFamily: "Inter_600SemiBold" },
  grid: { paddingHorizontal: 12, paddingTop: 12 },
  row: { gap: 10, marginBottom: 10 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 60 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: Colors.borderLight, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.text },
  emptySubtext: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  clearBtn: { backgroundColor: Colors.primaryLight, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  clearBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.primary },
});
