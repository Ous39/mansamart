import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useCart } from "@/contexts/CartContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { categories } from "@/data/products";

const LOCATIONS = ["Banjul", "Serrekunda", "Brikama", "Kanifing", "Farafenni", "Basse", "Nationwide"];

interface FixedHeaderProps {
  showSearch?: boolean;
  showCategories?: boolean;
  onCategorySelect?: (cat: string | null) => void;
  selectedCategory?: string | null;
  searchValue?: string;
  onSearchChange?: (text: string) => void;
  onSearchFocus?: () => void;
  searchPlaceholder?: string;
}

export function FixedHeader({
  showSearch = true,
  showCategories = true,
  onCategorySelect,
  selectedCategory,
  searchValue,
  onSearchChange,
  onSearchFocus,
  searchPlaceholder = "Search MansaMart...",
}: FixedHeaderProps) {
  const insets = useSafeAreaInsets();
  const { totalItems } = useCart();
  const { unreadCount } = useNotifications();
  const [locationIdx, setLocationIdx] = useState(0);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const cycleLocation = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocationIdx(i => (i + 1) % LOCATIONS.length);
  };

  return (
    <View style={[styles.container, { paddingTop: topPad + 10 }]}>
      {/* Logo + Actions Row */}
      <View style={styles.logoRow}>
        <View style={styles.logoWrap}>
          <View style={styles.logoDot} />
          <Text style={styles.logoText}>MansaMart</Text>
        </View>

        <Pressable style={styles.locationBtn} onPress={cycleLocation}>
          <Ionicons name="location-sharp" size={13} color={Colors.deal} />
          <Text style={styles.locationText}>{LOCATIONS[locationIdx]}</Text>
          <Ionicons name="chevron-down" size={11} color={Colors.textMuted} />
        </Pressable>

        <View style={styles.actions}>
          <Pressable style={styles.iconBtn} onPress={() => router.push("/notifications")} hitSlop={8}>
            <Ionicons name="notifications-outline" size={22} color={Colors.text} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => router.push("/cart")} hitSlop={8}>
            <Ionicons name="bag-outline" size={22} color={Colors.text} />
            {totalItems > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{totalItems > 9 ? "9+" : totalItems}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Search Bar */}
      {showSearch && (
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={17} color={Colors.textMuted} />
            {onSearchChange ? (
              <TextInput
                style={styles.searchInput}
                placeholder={searchPlaceholder}
                placeholderTextColor={Colors.textMuted}
                value={searchValue}
                onChangeText={onSearchChange}
                autoCapitalize="none"
                returnKeyType="search"
              />
            ) : (
              <Pressable style={{ flex: 1 }} onPress={onSearchFocus ?? (() => router.push("/(tabs)/browse"))}>
                <Text style={styles.searchPlaceholder}>{searchPlaceholder}</Text>
              </Pressable>
            )}
            {searchValue && searchValue.length > 0 && onSearchChange && (
              <Pressable onPress={() => onSearchChange("")} hitSlop={8}>
                <Ionicons name="close-circle" size={17} color={Colors.textMuted} />
              </Pressable>
            )}
          </View>
          <Pressable style={styles.scanBtn} hitSlop={8} onPress={() => router.push("/scan-order")}>
            <Ionicons name="scan-outline" size={20} color={Colors.primary} />
          </Pressable>
        </View>
      )}

      {/* Category Strip */}
      {showCategories && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catStrip}
        >
          <Pressable
            style={[styles.catPill, selectedCategory === null && styles.catPillActive]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onCategorySelect?.(null); }}
          >
            <Text style={[styles.catPillText, selectedCategory === null && styles.catPillTextActive]}>All</Text>
          </Pressable>
          {categories.map(cat => (
            <Pressable
              key={cat.id}
              style={[styles.catPill, selectedCategory === cat.id && { backgroundColor: cat.color, borderColor: cat.color }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onCategorySelect?.(selectedCategory === cat.id ? null : cat.id);
              }}
            >
              <Ionicons
                name={cat.icon as any}
                size={12}
                color={selectedCategory === cat.id ? "#fff" : cat.color}
              />
              <Text style={[styles.catPillText, selectedCategory === cat.id && styles.catPillTextActive]}>
                {cat.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Free Shipping Strip */}
      <View style={styles.shippingStrip}>
        <Ionicons name="bicycle-outline" size={13} color={Colors.primary} />
        <Text style={styles.shippingText}>Free delivery on orders over <Text style={styles.shippingBold}>D 500</Text></Text>
        <Text style={styles.shippingDivider}>|</Text>
        <Ionicons name="shield-checkmark-outline" size={13} color={Colors.primary} />
        <Text style={styles.shippingText}>Buyer Protection</Text>
      </View>
    </View>
  );
}

export function getHeaderHeight(insets: { top: number }) {
  const webOffset = Platform.OS === "web" ? 67 : 0;
  const base = insets.top + webOffset + 10;
  return base + 40 + 50 + 44 + 32;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 4,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  logoWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  logoDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  logoText: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    letterSpacing: -0.5,
  },
  locationBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.borderLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginRight: 8,
  },
  locationText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.deal,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: Colors.surface,
    paddingHorizontal: 2,
  },
  badgeText: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
  },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.borderLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    height: "100%",
  },
  searchPlaceholder: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    height: 40,
    lineHeight: 40,
  },
  scanBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  catStrip: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  catPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.borderLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  catPillText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  catPillTextActive: {
    color: "#fff",
  },
  shippingStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 6,
  },
  shippingText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  shippingBold: {
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  shippingDivider: {
    color: Colors.border,
    fontSize: 11,
  },
});
