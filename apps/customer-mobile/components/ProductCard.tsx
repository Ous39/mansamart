import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { Product } from "@/data/products";
import { useWishlist } from "@/contexts/WishlistContext";
import { useCart } from "@/contexts/CartContext";
import { getProductImages, getProductMainImage } from "@/lib/product-media";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

interface ProductCardProps {
  onPress?: () => void;
  product: Product;
  style?: any;
}

function formatPrice(price: number) {
  return `D ${price.toLocaleString()}`;
}

export function ProductCard({ product, style, onPress: onPressProp }: ProductCardProps) {
  const { isWishlisted, toggle } = useWishlist();
  const { addToCart } = useCart();
  const scale = useSharedValue(1);
  const wishlisted = isWishlisted(product.id);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (onPressProp) { onPressProp(); return; }
    router.push({ pathname: "/product/[id]", params: { id: product.id } });
  };

  const handleWishlist = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggle(product);
  };

  const handleAddToCart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addToCart(product);
    scale.value = withSpring(0.9, { damping: 10 }, () => {
      scale.value = withSpring(1);
    });
  };

  const safePrice = Number(product.price ?? 0);
  const safeOriginalPrice = Number(product.originalPrice ?? 0);
  const discount = safeOriginalPrice > 0
    ? Math.max(0, Math.round((1 - safePrice / safeOriginalPrice) * 100))
    : 0;

  const safeBrand = String(product.brand ?? "MansaMart");
  const safeName = String(product.name ?? "Untitled product");
  const safeRating = Number(product.rating ?? 0).toFixed(1);
  const safeReviewCount = Number(product.reviewCount ?? 0);
  const safeSoldCount = Number(product.soldCount ?? 0);
  const productImages = getProductImages(product);
  const mainImage = getProductMainImage(product);
  const imageCount = productImages.length;
  const safeStock = Number((product as any).stock ?? 0);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.94 }]}
    >
      <View style={styles.imageContainer}>
        {mainImage ? (
          <Image source={mainImage} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.placeholder, { backgroundColor: product.placeholderColor ?? Colors.primary }]}>
            <Ionicons
              name={(product.placeholderIcon ?? "bag-outline") as any}
              size={44}
              color="rgba(255,255,255,0.75)"
            />
            {Number(product.soldCount ?? 0) > 200 && (
              <View style={styles.hotTag}>
                <Text style={styles.hotTagText}>🔥 HOT</Text>
              </View>
            )}
          </View>
        )}

        {product.isNew && !product.isSale && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NEW</Text>
          </View>
        )}
        {discount > 0 && (
          <View style={styles.saleBadge}>
            <Text style={styles.saleBadgeText}>-{discount}%</Text>
          </View>
        )}
        {product.freeShipping && (
          <View style={styles.shipBadge}>
            <Text style={styles.shipBadgeText}>Free shipping</Text>
          </View>
        )}
        {imageCount > 1 && (
          <View style={styles.imageCountBadge}>
            <Ionicons name="images-outline" size={10} color="#fff" />
            <Text style={styles.imageCountText}>{imageCount}</Text>
          </View>
        )}
        {safeStock > 0 && safeStock <= 5 && (
          <View style={styles.lowStockBadge}>
            <Text style={styles.lowStockText}>Only {safeStock} left</Text>
          </View>
        )}

        <Pressable style={styles.wishlistBtn} onPress={handleWishlist} hitSlop={8}>
          <Ionicons
            name={wishlisted ? "heart" : "heart-outline"}
            size={17}
            color={wishlisted ? Colors.deal : Colors.textSecondary}
          />
        </Pressable>
      </View>

      <View style={styles.info}>
        <Text style={styles.brand} numberOfLines={1}>{safeBrand}</Text>
        <Text style={styles.name} numberOfLines={2}>{safeName}</Text>

        <View style={styles.ratingRow}>
          <Ionicons name="star" size={10} color={Colors.gold} />
          <Text style={styles.rating}>{safeRating}</Text>
          <Text style={styles.reviewCount}>({safeReviewCount})</Text>
          {Number(product.soldCount ?? 0) > 0 && (
            <Text style={styles.soldCount}>· {safeSoldCount > 999 ? (safeSoldCount / 1000).toFixed(1) + "k" : safeSoldCount} sold</Text>
          )}
        </View>

        <View style={styles.bottomRow}>
          <View>
            <Text style={[styles.price, discount > 0 && { color: Colors.deal }]}>
              {formatPrice(safePrice)}
            </Text>
            {safeOriginalPrice > 0 && (
              <Text style={styles.originalPrice}>{formatPrice(safeOriginalPrice)}</Text>
            )}
          </View>
          <Animated.View style={animStyle}>
            <Pressable style={styles.addBtn} onPress={handleAddToCart}>
              <Ionicons name="add" size={15} color="#fff" />
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  imageContainer: {
    width: "100%",
    height: CARD_WIDTH * 1.1,
    backgroundColor: Colors.borderLight,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  hotTag: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingVertical: 4,
    alignItems: "center",
  },
  hotTagText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  newBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: Colors.primary,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  newBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 0.5,
  },
  saleBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: Colors.deal,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  saleBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  shipBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(14,164,122,0.9)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  shipBadgeText: {
    fontSize: 8,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },

  imageCountBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  imageCountText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  lowStockBadge: {
    position: "absolute",
    left: 6,
    bottom: 30,
    backgroundColor: "rgba(239,68,68,0.92)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  lowStockText: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  wishlistBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    padding: 9,
    gap: 3,
  },
  brand: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  name: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
    lineHeight: 17,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  rating: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  reviewCount: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  soldCount: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  price: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  originalPrice: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textDecorationLine: "line-through",
  },
  addBtn: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
