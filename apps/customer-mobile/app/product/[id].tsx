import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  FlatList,
  Dimensions,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { products as localProducts } from "@/data/products";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { ReviewsSection } from "@/components/ReviewsSection";
import { ProductCard } from "@/components/ProductCard";
import { apiRequest } from "@/lib/query-client";
import { getProductImages } from "@/lib/product-media";

const { width } = Dimensions.get("window");
const IMG_HEIGHT = width * 0.92;

function formatPrice(value: unknown) {
  return `D ${Number(value ?? 0).toLocaleString()}`;
}

function safeArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
}

function colorToHex(value: string) {
  const key = value.toLowerCase().trim();
  const map: Record<string, string> = { black: "#111827", white: "#FFFFFF", blue: "#2563EB", red: "#EF4444", green: "#22C55E", yellow: "#FACC15", gold: "#D97706", silver: "#CBD5E1", brown: "#92400E", cream: "#FEF3C7", pink: "#EC4899", purple: "#9333EA", grey: "#6B7280", gray: "#6B7280", orange: "#F97316" };
  return map[key] || value;
}

function ProductPill({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.pill}>
      <Ionicons name={icon} size={13} color={Colors.primary} />
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { addToCart } = useCart();
  const { isWishlisted, toggle } = useWishlist();
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const btnScale = useSharedValue(1);

  const { data: product, isLoading } = useQuery<any>({
    queryKey: ["/api/products", id],
    enabled: !!id,
  });
  const { data: allProducts } = useQuery<any[]>({ queryKey: ["/api/products"] });

  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  const productImages = useMemo(() => getProductImages(product), [product]);
  const mainImage = productImages[selectedImageIndex] ?? productImages[0] ?? null;
  const productColors = safeArray(product?.colors);
  const productSizes: string[] = typeof product?.size === "string" ? product.size.split(",").map((v: string) => v.trim()).filter(Boolean) : safeArray(product?.sizes);
  const productFeatures = safeArray(product?.features);
  const productTags = safeArray(product?.tags);
  const stock = Number(product?.stock ?? 0);
  const inStock = Boolean(product?.inStock ?? stock > 0);
  const price = Number(product?.price ?? 0);
  const originalPrice = Number(product?.originalPrice ?? 0);
  const rating = Number(product?.rating ?? 0);
  const reviewCount = Number(product?.reviewCount ?? 0);
  const soldCount = Number(product?.soldCount ?? 0);
  const wishlisted = product ? isWishlisted(product.id) : false;
  const discount = originalPrice > price && price > 0 ? Math.round((1 - price / originalPrice) * 100) : 0;

  useEffect(() => {
    setSelectedImageIndex(0);
    setQty(1);
    const colors = safeArray(product?.colors);
    const sizes = typeof product?.size === "string" ? product.size.split(",").map((v: string) => v.trim()).filter(Boolean) : safeArray(product?.sizes);
    setSelectedColor(colors[0] ?? null);
    setSelectedSize(sizes[0] ?? null);
    if (product?.id) {
      apiRequest("POST", "/api/activity", {
        type: "view",
        targetId: product.id,
        category: product.category,
      }).catch(() => {});
    }
  }, [product?.id]);

  const similarProducts = (allProducts ?? localProducts)
    .filter((p: any) => p.id !== product?.id && p.category === product?.category)
    .slice(0, 6);

  if (isLoading) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Loading product...</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Product not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backHomeBtn}>
          <Text style={styles.backHomeText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const specs = [
    { label: "Material", value: product.material },
    { label: "Dimensions", value: product.dimensions },
    { label: "Weight", value: product.weight },
    { label: "Location", value: product.location },
    { label: "Category", value: product.category },
    { label: "Stock", value: inStock ? `${stock || "Available"} available` : "Out of stock" },
  ].filter(item => item.value !== undefined && item.value !== null && String(item.value).trim() !== "");

  const handleAddToCart = () => {
    if (!inStock) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    for (let i = 0; i < qty; i++) addToCart(product, { color: selectedColor ?? undefined, size: selectedSize ?? undefined, variant: product?.subcategory ?? undefined });
    apiRequest("POST", "/api/activity", { type: "cart", targetId: product.id, category: product.category }).catch(() => {});
    setAddedToCart(true);
    btnScale.value = withSpring(0.94, { damping: 10 }, () => { btnScale.value = withSpring(1); });
    setTimeout(() => setAddedToCart(false), 1800);
  };

  const handleBuyNow = () => {
    if (!inStock) return;
    handleAddToCart();
    router.push("/checkout");
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 142 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={styles.imageWrap}>
          {mainImage ? (
            <Image source={mainImage} style={styles.productImage} resizeMode="cover" />
          ) : (
            <View style={[styles.productImage, styles.placeholder, { backgroundColor: product.placeholderColor ?? Colors.primary }]}>
              <Ionicons name={(product.placeholderIcon ?? "bag-outline") as any} size={86} color="rgba(255,255,255,0.65)" />
              <Text style={styles.placeholderText}>No product image</Text>
            </View>
          )}

          <View style={[styles.topBar, { top: insets.top + (Platform.OS === "web" ? 67 : 0) + 12 }]}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
              <Ionicons name="arrow-back" size={22} color={Colors.text} />
            </Pressable>
            <View style={styles.topActions}>
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggle(product); }}
                style={styles.iconBtn}
                hitSlop={8}
              >
                <Ionicons name={wishlisted ? "heart" : "heart-outline"} size={22} color={wishlisted ? "#EF4444" : Colors.text} />
              </Pressable>
              <Pressable onPress={() => router.push("/cart")} style={styles.iconBtn} hitSlop={8}>
                <Ionicons name="bag-outline" size={22} color={Colors.text} />
              </Pressable>
            </View>
          </View>

          <View style={styles.imageBadges}>
            {discount > 0 && <View style={styles.discountBadge}><Text style={styles.discountText}>-{discount}% OFF</Text></View>}
            {product.isNew && <View style={styles.newBadge}><Text style={styles.newBadgeText}>New arrival</Text></View>}
            {productImages.length > 1 && <View style={styles.photoBadge}><Ionicons name="images-outline" size={12} color="#fff" /><Text style={styles.photoBadgeText}>{productImages.length} photos</Text></View>}
          </View>
        </View>

        {productImages.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailRow}>
            {productImages.map((source, index) => (
              <Pressable
                key={index}
                style={[styles.thumbWrap, selectedImageIndex === index && styles.thumbSelected]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedImageIndex(index); }}
              >
                <Image source={source} style={styles.thumbImage} resizeMode="cover" />
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View style={styles.body}>
          <View style={styles.brandRow}>
            <View style={styles.brandTag}>
              <Text style={styles.brandTagText} numberOfLines={1}>{String(product.brand ?? "MansaMart Vendor")}</Text>
            </View>
            <View style={[styles.stockTag, !inStock && styles.stockTagOut]}>
              <Ionicons name={inStock ? "checkmark-circle" : "close-circle"} size={14} color={inStock ? Colors.success : Colors.deal} />
              <Text style={[styles.stockTagText, !inStock && { color: Colors.deal }]}>{inStock ? "In stock" : "Out of stock"}</Text>
            </View>
          </View>

          <Text style={styles.productName}>{String(product.name ?? "Untitled product")}</Text>

          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map(star => (
              <Ionicons key={star} name={star <= Math.round(rating) ? "star" : "star-outline"} size={14} color="#F59E0B" />
            ))}
            <Text style={styles.ratingValue}>{rating.toFixed(1)}</Text>
            <Text style={styles.reviewCount}>({reviewCount} reviews)</Text>
            {soldCount > 0 && <Text style={styles.reviewCount}>· {soldCount.toLocaleString()} sold</Text>}
          </View>

          <View style={styles.priceRow}>
            <Text style={[styles.price, product.isSale && { color: Colors.deal }]}>{formatPrice(price)}</Text>
            {originalPrice > 0 && <Text style={styles.originalPrice}>{formatPrice(originalPrice)}</Text>}
          </View>

          <View style={styles.quickInfoGrid}>
            <ProductPill icon="shield-checkmark-outline" label="Verified vendor" />
            <ProductPill icon={product.freeShipping ? "bicycle-outline" : "location-outline"} label={product.freeShipping ? "Free shipping" : String(product.location ?? "The Gambia")} />
            <ProductPill icon="chatbubble-ellipses-outline" label="Chat before order" />
            <ProductPill icon="refresh-outline" label="Easy order tracking" />
          </View>

          {productColors.length > 0 && (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>Choose Color</Text>
                {selectedColor && <Text style={styles.sectionHint}>{selectedColor}</Text>}
              </View>
              <View style={styles.colorsRow}>
                {productColors.map(color => (
                  <Pressable
                    key={color}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedColor(color); }}
                    style={[styles.colorChoice, selectedColor === color && styles.colorChoiceSelected]}
                  >
                    <View style={[styles.colorDot, { backgroundColor: colorToHex(color) }]} />
                    <Text style={styles.colorLabel}>{color}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {productSizes.length > 0 && (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>Choose Size / Variant</Text>
                {selectedSize && <Text style={styles.sectionHint}>{selectedSize}</Text>}
              </View>
              <View style={styles.colorsRow}>
                {productSizes.map(size => (
                  <Pressable
                    key={size}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedSize(size); }}
                    style={[styles.sizeChoice, selectedSize === size && styles.sizeChoiceSelected]}
                  >
                    <Text style={[styles.sizeLabel, selectedSize === size && styles.sizeLabelSelected]}>{size}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>Description</Text>
            <Text style={styles.description}>{String(product.description ?? "No description available yet.")}</Text>
          </View>

          {specs.length > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>Product Details</Text>
              <View style={styles.detailsGrid}>
                {specs.map(item => (
                  <View key={item.label} style={styles.detailItem}>
                    <Text style={styles.detailLabel}>{item.label}</Text>
                    <Text style={styles.detailValue}>{String(item.value)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {productFeatures.length > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>Features</Text>
              <View style={styles.featuresList}>
                {productFeatures.map((feature, index) => (
                  <View key={`${feature}-${index}`} style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={17} color={Colors.primary} />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {productTags.length > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>Tags</Text>
              <View style={styles.tagRow}>
                {productTags.map((tag, index) => <Text key={`${tag}-${index}`} style={styles.tag}>#{tag}</Text>)}
              </View>
            </View>
          )}

          <View style={styles.vendorCard}>
            <View style={styles.vendorAvatar}>
              <Ionicons name="storefront-outline" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.vendorTitle}>{String(product.brand ?? "MansaMart Vendor")}</Text>
              <Text style={styles.vendorSub}>Vendor profile, products, ratings and contact options</Text>
            </View>
            {product.vendorId && (
              <Pressable style={styles.vendorBtn} onPress={() => router.push({ pathname: "/vendor/[id]", params: { id: product.vendorId } })}>
                <Text style={styles.vendorBtnText}>View</Text>
              </Pressable>
            )}
          </View>

          <ReviewsSection targetId={product.id} targetType="product" />

          {similarProducts.length > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>Similar Products</Text>
              <FlatList
                data={similarProducts}
                keyExtractor={(p: any) => String(p.id)}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12 }}
                renderItem={({ item }) => <ProductCard product={item} style={{ width: 160, marginRight: 0 }} />}
                scrollEnabled
              />
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 12 }]}>
        <View style={styles.qtyControl}>
          <Pressable onPress={() => setQty(q => Math.max(1, q - 1))} style={styles.qtyBtn} hitSlop={8} disabled={!inStock}>
            <Ionicons name="remove" size={18} color={Colors.text} />
          </Pressable>
          <Text style={styles.qtyText}>{qty}</Text>
          <Pressable onPress={() => setQty(q => Math.min(stock || 99, q + 1))} style={styles.qtyBtn} hitSlop={8} disabled={!inStock}>
            <Ionicons name="add" size={18} color={Colors.text} />
          </Pressable>
        </View>

        <Animated.View style={[styles.addBtnWrap, btnStyle]}>
          <Pressable style={[styles.addBtn, addedToCart && styles.addBtnSuccess, !inStock && styles.addBtnDisabled]} onPress={handleAddToCart} disabled={!inStock}>
            {addedToCart ? (
              <><Ionicons name="checkmark" size={18} color="#fff" /><Text style={styles.addBtnText}>Added!</Text></>
            ) : (
              <><Ionicons name="bag-add-outline" size={18} color="#fff" /><Text style={styles.addBtnText}>{inStock ? `Add · ${formatPrice(price * qty)}` : "Out of stock"}</Text></>
            )}
          </Pressable>
        </Animated.View>

        <Pressable style={[styles.buyBtn, !inStock && styles.buyBtnDisabled]} onPress={handleBuyNow} disabled={!inStock}>
          <Text style={styles.buyBtnText}>Buy</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  notFoundText: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.text },
  backHomeBtn: { backgroundColor: Colors.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  backHomeText: { color: "#fff", fontFamily: "Inter_700Bold" },
  imageWrap: { width: "100%", height: IMG_HEIGHT, backgroundColor: Colors.borderLight, position: "relative" },
  productImage: { width: "100%", height: "100%" },
  placeholder: { alignItems: "center", justifyContent: "center" },
  placeholderText: { color: "rgba(255,255,255,0.85)", fontFamily: "Inter_600SemiBold", marginTop: 8 },
  topBar: { position: "absolute", left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20 },
  topActions: { flexDirection: "row", gap: 10 },
  iconBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center" },
  imageBadges: { position: "absolute", left: 20, right: 20, bottom: 18, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  discountBadge: { backgroundColor: Colors.accent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  discountText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  newBadge: { backgroundColor: Colors.primary, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  newBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  photoBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.48)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  photoBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  thumbnailRow: { paddingHorizontal: 20, paddingVertical: 14, gap: 10, backgroundColor: Colors.background },
  thumbWrap: { width: 64, height: 64, borderRadius: 14, overflow: "hidden", borderWidth: 2, borderColor: "transparent", backgroundColor: Colors.borderLight },
  thumbSelected: { borderColor: Colors.primary },
  thumbImage: { width: "100%", height: "100%" },
  body: { backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -8, padding: 22, gap: 18 },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  brandTag: { flex: 1, backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  brandTagText: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.primary, textTransform: "uppercase", letterSpacing: 0.5 },
  stockTag: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(34,197,94,0.10)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  stockTagOut: { backgroundColor: "rgba(239,68,68,0.10)" },
  stockTagText: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.success },
  productName: { fontSize: 23, fontFamily: "Inter_700Bold", color: Colors.text, lineHeight: 31 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3, flexWrap: "wrap" },
  ratingValue: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.text, marginLeft: 4 },
  reviewCount: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  price: { fontSize: 27, fontFamily: "Inter_700Bold", color: Colors.text },
  originalPrice: { fontSize: 16, fontFamily: "Inter_400Regular", color: Colors.textMuted, textDecorationLine: "line-through" },
  quickInfoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.background, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: Colors.borderLight },
  pillText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  sectionBlock: { gap: 10, borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: 18 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionLabel: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text },
  sectionHint: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  description: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 23 },
  colorsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  colorChoice: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 999, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: Colors.background },
  colorChoiceSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  colorDot: { width: 15, height: 15, borderRadius: 999, borderWidth: 1, borderColor: "rgba(0,0,0,0.12)" },
  colorLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  sizeChoice: { borderRadius: 999, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: Colors.background },
  sizeChoiceSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  sizeLabel: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.textSecondary },
  sizeLabelSelected: { color: Colors.primary },
  detailsGrid: { borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 14, overflow: "hidden" },
  detailItem: { flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  detailLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, width: 95 },
  detailValue: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.text, flex: 1 },
  featuresList: { gap: 9 },
  featureItem: { flexDirection: "row", alignItems: "center", gap: 9 },
  featureText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, flex: 1 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.primary, backgroundColor: Colors.primaryLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  vendorCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.background, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: Colors.borderLight },
  vendorAvatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  vendorTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.text },
  vendorSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  vendorBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 8 },
  vendorBtnText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  bottomBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 14, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  qtyControl: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.borderLight, borderRadius: 14, overflow: "hidden" },
  qtyBtn: { width: 38, height: 48, alignItems: "center", justifyContent: "center" },
  qtyText: { width: 34, textAlign: "center", fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text },
  addBtnWrap: { flex: 1 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: Colors.primary, borderRadius: 16, height: 52, paddingHorizontal: 10 },
  addBtnSuccess: { backgroundColor: Colors.success },
  addBtnDisabled: { backgroundColor: Colors.textMuted },
  addBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
  buyBtn: { height: 52, minWidth: 58, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: Colors.text },
  buyBtnDisabled: { backgroundColor: Colors.textMuted },
  buyBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
});
