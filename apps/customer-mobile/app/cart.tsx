import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useCart, CartItem } from "@/contexts/CartContext";
import { getProductMainImage } from "@/lib/product-media";

function CartItemRow({ item }: { item: CartItem }) {
  const { updateQuantity, removeFromCart } = useCart();
  const mainImage = getProductMainImage(item.product);
  return (
    <View style={styles.itemCard}>
      {mainImage ? (
        <Image source={mainImage} style={styles.itemImg} resizeMode="cover" />
      ) : (
        <View style={[styles.itemImg, styles.itemImgPlaceholder, { backgroundColor: item.product.placeholderColor ?? Colors.primary }]}>
          <Ionicons name={(item.product.placeholderIcon ?? "bag-outline") as any} size={30} color="rgba(255,255,255,0.75)" />
        </View>
      )}
      <View style={styles.itemInfo}>
        <Text style={styles.itemBrand}>{item.product.brand}</Text>
        <Text style={styles.itemName} numberOfLines={2}>{item.product.name}</Text>
        <Text style={styles.itemPrice}>D {item.product.price.toLocaleString()}</Text>
        <View style={styles.itemActions}>
          <View style={styles.qtyRow}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                updateQuantity(item, item.quantity - 1);
              }}
              style={styles.qtyBtn}
              hitSlop={8}
            >
              <Ionicons name="remove" size={14} color={Colors.text} />
            </Pressable>
            <Text style={styles.qtyText}>{item.quantity}</Text>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                updateQuantity(item, item.quantity + 1);
              }}
              style={styles.qtyBtn}
              hitSlop={8}
            >
              <Ionicons name="add" size={14} color={Colors.text} />
            </Pressable>
          </View>
          <Text style={styles.lineTotal}>
            D {(item.product.price * item.quantity).toLocaleString()}
          </Text>
        </View>
        {Object.keys(item.selectedOptions || {}).length > 0 && (
          <Text style={styles.optionText} numberOfLines={2}>
            {Object.entries(item.selectedOptions || {}).map(([key, value]) => `${key}: ${value}`).join(" • ")}
          </Text>
        )}
      </View>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          removeFromCart(item);
        }}
        style={styles.removeBtn}
        hitSlop={8}
      >
        <Ionicons name="trash-outline" size={16} color={Colors.error} />
      </Pressable>
    </View>
  );
}

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const { items, subtotal, clearCart } = useCart();
  const shipping = subtotal > 0 ? (subtotal >= 500 ? 0 : 3500) : 0;
  const total = subtotal + shipping;
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>Cart{items.length > 0 ? ` (${items.length})` : ""}</Text>
        {items.length > 0 ? (
          <Pressable onPress={() => clearCart()} hitSlop={8}>
            <Text style={styles.clearBtn}>Clear</Text>
          </Pressable>
        ) : <View style={{ width: 40 }} />}
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="bag-outline" size={48} color={Colors.border} />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtext}>Add some items from MansaMart to get started</Text>
          <Pressable
            style={styles.shopBtn}
            onPress={() => router.push("/(tabs)/browse")}
          >
            <Text style={styles.shopBtnText}>Start Shopping</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.itemsList}
            showsVerticalScrollIndicator={false}
          >
            {items.map(item => (
              <CartItemRow key={`${item.product.id}:${item.optionKey}`} item={item} />
            ))}

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Order Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>D {subtotal.toLocaleString()}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Shipping</Text>
                <Text style={[styles.summaryValue, shipping === 0 && { color: Colors.success }]}>
                  {shipping === 0 ? "Free 🎉" : `D ${shipping.toLocaleString()}`}
                </Text>
              </View>
              {shipping > 0 && (
                <View style={styles.freeShipBanner}>
                  <Ionicons name="bicycle-outline" size={14} color={Colors.primary} />
                  <Text style={styles.freeShipText}>
                    Add D {(500 - subtotal).toLocaleString()} more for free shipping
                  </Text>
                </View>
              )}
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>D {total.toLocaleString()}</Text>
              </View>
            </View>
          </ScrollView>

          <View
            style={[
              styles.bottomBar,
              { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 12 },
            ]}
          >
            <Pressable
              style={({ pressed }) => [styles.checkoutBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push("/checkout");
              }}
            >
              <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  clearBtn: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.error,
  },
  itemsList: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 100,
    gap: 12,
  },
  itemCard: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  itemImg: {
    width: 100,
    height: 120,
    backgroundColor: Colors.borderLight,
  },
  itemImgPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  itemInfo: {
    flex: 1,
    padding: 12,
    gap: 3,
  },
  itemBrand: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  itemName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    lineHeight: 18,
  },
  itemPrice: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginTop: 2,
  },
  itemActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.borderLight,
    borderRadius: 10,
    overflow: "hidden",
  },
  qtyBtn: {
    width: 30,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    width: 26,
    textAlign: "center",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  lineTotal: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  optionText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
    textTransform: "capitalize",
  },
  removeBtn: {
    padding: 10,
    alignSelf: "flex-start",
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  freeShipBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
    padding: 10,
  },
  freeShipText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.primary,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 12,
    marginTop: 0,
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  totalValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  checkoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    height: 56,
  },
  checkoutBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },
  shopBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 8,
  },
  shopBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});
