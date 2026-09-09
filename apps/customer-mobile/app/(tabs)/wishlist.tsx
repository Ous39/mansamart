import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Image,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useWishlist } from "@/contexts/WishlistContext";
import { useCart } from "@/contexts/CartContext";
import { useBookings, type Booking } from "@/contexts/BookingContext";
import { useAuth } from "@/contexts/AuthContext";
import { getProductMainImage } from "@/lib/product-media";

function WishlistItem({ product, onRemove, onAddToCart }: { product: any; onRemove: () => void; onAddToCart: () => void }) {
  const mainImage = getProductMainImage(product);
  return (
    <Pressable
      style={({ pressed }) => [styles.itemCard, pressed && { opacity: 0.95 }]}
      onPress={() => router.push({ pathname: "/product/[id]", params: { id: product.id } })}
    >
      {mainImage ? (
        <Image source={mainImage} style={styles.itemImage} resizeMode="cover" />
      ) : (
        <View style={[styles.itemImage, { backgroundColor: product.placeholderColor ?? Colors.primary, alignItems: "center", justifyContent: "center" }]}>
          <Ionicons name={(product.placeholderIcon ?? "bag-outline") as any} size={28} color="rgba(255,255,255,0.8)" />
        </View>
      )}
      <View style={styles.itemInfo}>
        <Text style={styles.itemBrand}>{product.brand}</Text>
        <Text style={styles.itemName} numberOfLines={2}>{product.name}</Text>
        <View style={styles.itemRating}>
          <Ionicons name="star" size={11} color="#F59E0B" />
          <Text style={styles.ratingText}>{product.rating}</Text>
        </View>
        <View style={styles.itemPriceRow}>
          <Text style={styles.itemPrice}>D {product.price.toLocaleString()}</Text>
          {Number(product.originalPrice ?? 0) > 0 && (
            <Text style={styles.originalPrice}>D {product.originalPrice.toLocaleString()}</Text>
          )}
        </View>
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
          onPress={onAddToCart}
        >
          <Ionicons name="bag-add-outline" size={14} color="#fff" />
          <Text style={styles.addBtnText}>Add to Cart</Text>
        </Pressable>
      </View>
      <Pressable onPress={onRemove} style={styles.removeBtn} hitSlop={8}>
        <Ionicons name="close" size={18} color={Colors.textMuted} />
      </Pressable>
    </Pressable>
  );
}

function statusStyle(s: string) {
  const map: Record<string, { bg: string; text: string }> = {
    pending: { bg: "#FFFBEB", text: "#D97706" },
    confirmed: { bg: "#EFF6FF", text: "#2563EB" },
    in_progress: { bg: "#F3E8FF", text: "#7B4FA3" },
    completed: { bg: "#D1FAE5", text: "#059669" },
    cancelled: { bg: "#FEF2F2", text: "#DC2626" },
  };
  return map[s] ?? { bg: Colors.borderLight, text: Colors.textSecondary };
}

function BookingCard({ booking, onCancel }: { booking: Booking; onCancel: () => void }) {
  const ss = statusStyle(booking.status);
  return (
    <View style={styles.bookingCard}>
      <View style={styles.bookingHeader}>
        <View style={[styles.bookingIcon, { backgroundColor: "#F3E8FF" }]}>
          <Ionicons name="construct-outline" size={20} color="#7B4FA3" />
        </View>
        <View style={styles.bookingTitleWrap}>
          <Text style={styles.bookingService} numberOfLines={2}>{booking.serviceName}</Text>
          <Text style={styles.bookingProvider}>{booking.providerName}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: ss.bg }]}>
          <Text style={[styles.statusText, { color: ss.text }]}>
            {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
          </Text>
        </View>
      </View>
      <View style={styles.bookingDetails}>
        <View style={styles.bookingDetail}>
          <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.bookingDetailText}>
            {new Date(booking.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </Text>
        </View>
        <View style={styles.bookingDetail}>
          <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.bookingDetailText}>{booking.time}</Text>
        </View>
        {booking.address && (
          <View style={styles.bookingDetail}>
            <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.bookingDetailText} numberOfLines={1}>{booking.address}</Text>
          </View>
        )}
      </View>
      <View style={styles.bookingFooter}>
        <Text style={styles.bookingPrice}>D {booking.price}</Text>
        {booking.status === "pending" && (
          <Pressable
            style={styles.cancelBtn}
            onPress={onCancel}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        )}
        {booking.status === "completed" && (
          <Pressable
            style={styles.reviewBtn}
            onPress={() => router.push({ pathname: "/my-reviews", params: { targetType: "service", targetId: booking.serviceId } })}
          >
            <Ionicons name="star-outline" size={13} color={Colors.primary} />
            <Text style={styles.reviewBtnText}>Leave Review</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function HistoryCard({ order }: { order: any }) {
  const STATUS_STYLE: Record<string, { bg: string; text: string; icon: string }> = {
    pending:    { bg: "#FFFBEB", text: "#D97706", icon: "time-outline" },
    processing: { bg: "#EFF6FF", text: "#2563EB", icon: "reload-outline" },
    shipped:    { bg: "#F3E8FF", text: "#7B4FA3", icon: "car-outline" },
    delivered:  { bg: "#D1FAE5", text: "#059669", icon: "checkmark-circle-outline" },
    cancelled:  { bg: "#FEF2F2", text: "#DC2626", icon: "close-circle-outline" },
  };
  const ss = STATUS_STYLE[order.status] ?? STATUS_STYLE.pending;
  const items: any[] = Array.isArray(order.items) ? order.items : [];

  return (
    <Pressable style={styles.historyCard} onPress={() => router.push({ pathname: "/order/[id]", params: { id: order.id } })}>
      <View style={styles.historyHeader}>
        <View>
          <Text style={styles.historyId}>Order #{String(order.id).slice(0, 8).toUpperCase()}</Text>
          <Text style={styles.historyDate}>
            {new Date(order.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </Text>
        </View>
        <View style={[styles.historyBadge, { backgroundColor: ss.bg }]}>
          <Ionicons name={ss.icon as any} size={12} color={ss.text} />
          <Text style={[styles.historyBadgeText, { color: ss.text }]}>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </Text>
        </View>
      </View>

      <View style={styles.historyItems}>
        {items.slice(0, 3).map((item: any, i: number) => (
          <View key={i} style={styles.historyItemRow}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.historyItemImg} resizeMode="cover" />
            ) : (
              <View style={[styles.historyItemImg, { backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" }]}>
                <Ionicons name="bag-outline" size={12} color={Colors.primary} />
              </View>
            )}
            <Text style={styles.historyItemName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.historyItemQty}>×{item.quantity}</Text>
            <Text style={styles.historyItemPrice}>D {(item.price * item.quantity).toLocaleString()}</Text>
          </View>
        ))}
        {items.length > 3 && (
          <Text style={styles.moreItems}>+{items.length - 3} more items</Text>
        )}
      </View>

      <View style={styles.historyFooter}>
        <View>
          <Text style={styles.historyTotalLabel}>{items.length} item{items.length !== 1 ? "s" : ""}</Text>
          <Text style={styles.historyTotal}>D {Number(order.total).toLocaleString()}</Text>
        </View>
        <View style={styles.historyActions}>
          {order.status === "delivered" && (
            <Pressable style={styles.reviewBtn} onPress={() => router.push("/my-reviews")}>
              <Ionicons name="star-outline" size={13} color={Colors.primary} />
              <Text style={styles.reviewBtnText}>Review</Text>
            </Pressable>
          )}
          <Pressable
            style={styles.reorderBtn}
            onPress={() => router.push("/(tabs)/browse")}
          >
            <Text style={styles.reorderBtnText}>Reorder</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

export default function WishlistScreen() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const insets = useSafeAreaInsets();
  const { items, toggle } = useWishlist();
  const { addToCart, totalItems } = useCart();
  const { user, isAuthenticated } = useAuth();
  const { getBookingsForUser, cancelBooking } = useBookings();
  const initialTab = tab === "bookings" || tab === "history" ? tab : "saved";
  const [activeTab, setActiveTab] = useState<"saved" | "bookings" | "history">(initialTab);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const myBookings = user ? getBookingsForUser(user.id) : [];

  useEffect(() => setActiveTab(initialTab), [initialTab]);

  const { data: orders = [], isLoading: ordersLoading } = useQuery<any[]>({
    queryKey: ["/api/orders"],
    enabled: isAuthenticated && activeTab === "history",
  });

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={styles.title}>Saved</Text>
        <Pressable style={styles.cartBtn} onPress={() => router.push("/cart")} hitSlop={8}>
          <Ionicons name="bag-outline" size={22} color={Colors.text} />
          {totalItems > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{totalItems > 9 ? "9+" : totalItems}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabBtn, activeTab === "saved" && styles.tabBtnActive]}
          onPress={() => setActiveTab("saved")}
        >
          <Ionicons name="heart-outline" size={14} color={activeTab === "saved" ? "#fff" : Colors.textSecondary} />
          <Text style={[styles.tabBtnText, activeTab === "saved" && styles.tabBtnTextActive]}>
            Saved {items.length > 0 ? `(${items.length})` : ""}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, activeTab === "bookings" && { ...styles.tabBtnActive, backgroundColor: "#7B4FA3" }]}
          onPress={() => setActiveTab("bookings")}
        >
          <Ionicons name="calendar-outline" size={14} color={activeTab === "bookings" ? "#fff" : Colors.textSecondary} />
          <Text style={[styles.tabBtnText, activeTab === "bookings" && styles.tabBtnTextActive]}>
            Bookings {myBookings.length > 0 ? `(${myBookings.length})` : ""}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, activeTab === "history" && { ...styles.tabBtnActive, backgroundColor: "#2563EB" }]}
          onPress={() => setActiveTab("history")}
        >
          <Ionicons name="receipt-outline" size={14} color={activeTab === "history" ? "#fff" : Colors.textSecondary} />
          <Text style={[styles.tabBtnText, activeTab === "history" && styles.tabBtnTextActive]}>
            Orders {orders.length > 0 ? `(${orders.length})` : ""}
          </Text>
        </Pressable>
      </View>

      {activeTab === "history" && (
        ordersLoading
          ? <View style={styles.emptyState}><ActivityIndicator color={Colors.primary} /></View>
          : orders.length === 0
            ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}><Ionicons name="receipt-outline" size={48} color={Colors.border} /></View>
                <Text style={styles.emptyTitle}>No orders yet</Text>
                <Text style={styles.emptySubtext}>Your order history will appear here</Text>
                <Pressable style={styles.browsBtn} onPress={() => router.push("/(tabs)/browse")}>
                  <Text style={styles.browsBtnText}>Start Shopping</Text>
                </Pressable>
              </View>
            )
            : (
              <FlatList
                data={orders}
                keyExtractor={o => String(o.id)}
                contentContainerStyle={[styles.list, { paddingBottom: 120 + (Platform.OS === "web" ? 34 : 0) }]}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => <HistoryCard order={item} />}
              />
            )
      )}

      {activeTab === "saved" && (
        items.length === 0
          ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Ionicons name="heart-outline" size={48} color={Colors.border} /></View>
              <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
              <Text style={styles.emptySubtext}>Save items you love and come back to them later</Text>
              <Pressable style={styles.browsBtn} onPress={() => router.push("/(tabs)/browse")}>
                <Text style={styles.browsBtnText}>Browse Products</Text>
              </Pressable>
            </View>
          )
          : (
            <FlatList
              data={items}
              keyExtractor={i => i.id}
              contentContainerStyle={[styles.list, { paddingBottom: 120 + (Platform.OS === "web" ? 34 : 0) }]}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <WishlistItem
                  product={item}
                  onRemove={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggle(item); }}
                  onAddToCart={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); addToCart(item); }}
                />
              )}
            />
          )
      )}

      {activeTab === "bookings" && (
        myBookings.length === 0
          ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Ionicons name="calendar-outline" size={48} color={Colors.border} /></View>
              <Text style={styles.emptyTitle}>No bookings yet</Text>
              <Text style={styles.emptySubtext}>Book a service and track it here</Text>
              <Pressable style={[styles.browsBtn, { backgroundColor: "#7B4FA3" }]} onPress={() => router.push("/(tabs)/services")}>
                <Text style={styles.browsBtnText}>Browse Services</Text>
              </Pressable>
            </View>
          )
          : (
            <FlatList
              data={myBookings}
              keyExtractor={b => b.id}
              contentContainerStyle={[styles.list, { paddingBottom: 120 + (Platform.OS === "web" ? 34 : 0) }]}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <BookingCard
                  booking={item}
                  onCancel={() => {
                    Alert.alert("Cancel booking", `Cancel ${item.serviceName}?`, [
                      { text: "Keep booking", style: "cancel" },
                      {
                        text: "Cancel booking",
                        style: "destructive",
                        onPress: async () => {
                          try {
                            await cancelBooking(item.id);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                          } catch (error: any) {
                            Alert.alert("Could not cancel", String(error?.message || "Please try again."));
                          }
                        },
                      },
                    ]);
                  }}
                />
              )}
            />
          )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 12,
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", color: Colors.text },
  cartBtn: {
    width: 42, height: 42, borderRadius: 13, backgroundColor: Colors.surface,
    alignItems: "center", justifyContent: "center", position: "relative",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cartBadge: {
    position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: Colors.background,
  },
  cartBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff" },
  tabRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 16 },
  tabBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, borderRadius: 12, paddingVertical: 10,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  tabBtnTextActive: { color: "#fff" },
  list: { paddingHorizontal: 20, paddingTop: 4, gap: 12 },
  itemCard: {
    flexDirection: "row", backgroundColor: Colors.surface, borderRadius: 16, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  itemImage: { width: 110, height: 130, backgroundColor: Colors.borderLight },
  itemInfo: { flex: 1, padding: 12, gap: 4 },
  itemBrand: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  itemName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text, lineHeight: 19 },
  itemRating: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.text },
  itemPriceRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  itemPrice: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text },
  originalPrice: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted, textDecorationLine: "line-through" },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7,
    alignSelf: "flex-start", marginTop: 4,
  },
  addBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#fff" },
  removeBtn: { padding: 10, alignSelf: "flex-start" },
  bookingCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16, gap: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  bookingHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  bookingIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  bookingTitleWrap: { flex: 1, gap: 3 },
  bookingService: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text, lineHeight: 20 },
  bookingProvider: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  statusBadge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, alignSelf: "flex-start" },
  statusText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  bookingDetails: { gap: 7, backgroundColor: Colors.borderLight, borderRadius: 10, padding: 12 },
  bookingDetail: { flexDirection: "row", alignItems: "center", gap: 8 },
  bookingDetailText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  bookingFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bookingPrice: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  cancelBtn: {
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.error, backgroundColor: Colors.errorLight,
  },
  cancelBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.error },
  reviewBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
  },
  reviewBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 24, backgroundColor: Colors.borderLight,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text, textAlign: "center" },
  emptySubtext: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", lineHeight: 21 },
  browsBtn: {
    backgroundColor: Colors.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8,
  },
  browsBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  historyCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 14, gap: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  historyHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  historyId: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.text },
  historyDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  historyBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  historyBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  historyItems: { gap: 6, backgroundColor: Colors.borderLight, borderRadius: 10, padding: 10 },
  historyItemRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  historyItemImg: { width: 28, height: 28, borderRadius: 6, backgroundColor: Colors.borderLight },
  historyItemName: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.text },
  historyItemQty: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  historyItemPrice: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.text },
  moreItems: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2, textAlign: "center" },
  historyFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  historyTotalLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  historyTotal: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  historyActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  reorderBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  reorderBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
