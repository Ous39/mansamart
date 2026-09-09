import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { calculateDeliveryFee, calculateOrderTotal } from "@mansamart/business-logic";
import Colors from "@/constants/colors";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/query-client";
import { useQuery } from "@tanstack/react-query";

const paymentMethods = [
  { id: "wave", label: "Wave Mobile Money", icon: "phone-portrait-outline" },
];

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const { items, subtotal, clearCart } = useCart();
  const { user } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState("wave");
  const [fulfillmentType, setFulfillmentType] = useState<"delivery" | "pickup">("delivery");
  const [isLoading, setIsLoading] = useState(false);
  const [waveReady, setWaveReady] = useState<boolean | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState("");

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [address, setAddress] = useState(user?.address ?? "");
  const [city, setCity] = useState(user?.city ?? "");
  const everyItemHasFreeShipping = items.length > 0 && items.every((item) => item.product.freeShipping);
  const shipping = calculateDeliveryFee(subtotal, fulfillmentType, everyItemHasFreeShipping);
  const total = calculateOrderTotal(subtotal, shipping);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const { data: savedAddresses = [] } = useQuery<any[]>({
    queryKey: ["/api/addresses"],
    enabled: !!user,
  });

  useEffect(() => {
    if (selectedAddressId || savedAddresses.length === 0) return;
    const saved = savedAddresses.find((item) => item.isDefault) || savedAddresses[0];
    setSelectedAddressId(saved.id);
    setName(saved.fullName);
    setPhone(saved.phone);
    setAddress(saved.address);
    setCity(saved.city);
  }, [savedAddresses, selectedAddressId]);

  useEffect(() => {
    apiRequest("GET", "/api/payments/config")
      .then((response) => response.json())
      .then((config) => setWaveReady(config?.wave?.ready === true))
      .catch(() => setWaveReady(false));
  }, []);

  const handlePlaceOrder = async () => {
    setValidationError("");
    if (!user) {
      router.push("/(auth)/login");
      return;
    }
    if (items.length === 0) {
      Alert.alert("Cart is empty", "Add an item before checking out.");
      router.replace("/cart");
      return;
    }
    if (name.trim().length < 2 || phone.trim().length < 7 || address.trim().length < 5 || city.trim().length < 2) {
      setValidationError("Enter a full name, reachable phone number, street address, and city.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      let orderId = pendingOrderId;
      if (!orderId) {
        const orderResponse = await apiRequest("POST", "/api/orders", {
          items: items.map(i => {
            const options = i.selectedOptions || { color: i.selectedColor };
            return {
              productId: i.product.id,
              quantity: i.quantity,
              selectedColor: options.color,
              selectedSize: options.size,
              selectedVariant: options.variant || i.product.subcategory,
              selectedOptions: options,
            };
          }),
          address: address.trim(),
          city: city.trim(),
          phone: phone.trim(),
          paymentMethod,
          fulfillmentType,
          notes: fulfillmentType === "pickup" ? "Shopper will pickup from vendor" : "Home delivery requested",
        });
        const order = await orderResponse.json();
        orderId = order.id;
        setPendingOrderId(orderId);
      }

      const payerMobile = /^\+[1-9]\d{7,14}$/.test(phone.trim()) ? phone.trim() : undefined;
      const checkoutResponse = await apiRequest("POST", "/api/payments/wave/checkout", {
        orderId,
        ...(payerMobile ? { payerMobile } : {}),
      });
      const payment = await checkoutResponse.json();
      if (!payment.launchUrl) throw new Error("Wave did not return a payment link");
      await WebBrowser.openBrowserAsync(payment.launchUrl);
      clearCart();
      router.replace({ pathname: "/payment-status", params: { paymentId: payment.id, orderId } });
    } catch (err: any) {
      const message = cleanError(err);
      setValidationError(message);
      Alert.alert("Checkout not completed", message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: topPad + 16 }]}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </Pressable>
          <Text style={styles.title}>Checkout</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: 110 + (Platform.OS === "web" ? 34 : 0) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionTitle}>Delivery Information</Text>
          {savedAddresses.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedAddressRow}>
              {savedAddresses.map((saved) => (
                <Pressable
                  key={saved.id}
                  style={[styles.savedAddress, selectedAddressId === saved.id && styles.savedAddressSelected]}
                  onPress={() => {
                    setSelectedAddressId(saved.id);
                    setName(saved.fullName);
                    setPhone(saved.phone);
                    setAddress(saved.address);
                    setCity(saved.city);
                    setValidationError("");
                  }}
                >
                  <Ionicons name={saved.label === "Home" ? "home-outline" : "location-outline"} size={16} color={selectedAddressId === saved.id ? Colors.primary : Colors.textSecondary} />
                  <View>
                    <Text style={styles.savedAddressLabel}>{saved.label}{saved.isDefault ? " • Default" : ""}</Text>
                    <Text style={styles.savedAddressText} numberOfLines={1}>{saved.address}, {saved.city}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
          <View style={styles.card}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your full name"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+220 000 000 000"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Street Address</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="123 Main Street"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>City</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={city}
                  onChangeText={setCity}
                  placeholder="Banjul"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>
          </View>

          {!!validationError && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={Colors.error} />
              <Text style={styles.errorText}>{validationError}</Text>
            </View>
          )}


          <Text style={styles.sectionTitle}>Fulfillment Option</Text>
          <View style={styles.paymentMethods}>
            {[
              { id: "delivery", label: "Home Delivery", icon: "bicycle-outline" },
              { id: "pickup", label: "Pickup / Collect from Vendor", icon: "storefront-outline" },
            ].map((m) => (
              <Pressable
                key={m.id}
                style={[styles.paymentItem, fulfillmentType === m.id && styles.paymentItemSelected]}
                onPress={() => setFulfillmentType(m.id as any)}
              >
                <Ionicons name={m.icon as any} size={20} color={fulfillmentType === m.id ? Colors.primary : Colors.textSecondary} />
                <Text style={[styles.paymentLabel, fulfillmentType === m.id && styles.paymentLabelSelected]}>{m.label}</Text>
                <View style={[styles.radio, fulfillmentType === m.id && styles.radioSelected]}>
                  {fulfillmentType === m.id && <View style={styles.radioDot} />}
                </View>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.paymentMethods}>
            {paymentMethods.map(m => (
              <Pressable
                key={m.id}
                style={[
                  styles.paymentItem,
                  paymentMethod === m.id && styles.paymentItemSelected,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPaymentMethod(m.id);
                }}
              >
                <Ionicons
                  name={m.icon as any}
                  size={20}
                  color={paymentMethod === m.id ? Colors.primary : Colors.textSecondary}
                />
                <Text
                  style={[
                    styles.paymentLabel,
                    paymentMethod === m.id && styles.paymentLabelSelected,
                  ]}
                >
                  {m.label}
                </Text>
                <View
                  style={[
                    styles.radio,
                    paymentMethod === m.id && styles.radioSelected,
                  ]}
                >
                  {paymentMethod === m.id && <View style={styles.radioDot} />}
                </View>
              </Pressable>
            ))}
          </View>
          <Text style={{ color: waveReady === false ? Colors.error : Colors.textSecondary, fontSize: 13 }}>
            {waveReady === null
              ? "Checking Wave availability…"
              : waveReady
                ? "You will finish payment securely in the Wave app."
                : "Wave checkout is awaiting activation for GMD payments."}
          </Text>

          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.card}>
            {items.slice(0, 3).map(item => {
              const options = item.selectedOptions || { color: item.selectedColor };
              const optionText = [options.color && `Color: ${options.color}`, options.size && `Size: ${options.size}`, options.variant && `Variant: ${options.variant}`].filter(Boolean).join(" • ");
              return (
                <View key={`${item.product.id}-${JSON.stringify(options)}`} style={styles.orderItemBlock}>
                  <View style={styles.orderItemRow}>
                    <Text style={styles.orderItemName} numberOfLines={1}>{item.product.name}</Text>
                    <Text style={styles.orderItemQty}>×{item.quantity}</Text>
                    <Text style={styles.orderItemPrice}>
                      D {(item.product.price * item.quantity).toLocaleString()}
                    </Text>
                  </View>
                  {!!optionText && <Text style={styles.orderOptionText}>{optionText}</Text>}
                </View>
              );
            })}
            {items.length > 3 && (
              <Text style={styles.moreItems}>+{items.length - 3} more items</Text>
            )}
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>D {subtotal.toLocaleString()}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{fulfillmentType === "pickup" ? "Pickup" : "Shipping"}</Text>
              <Text style={[styles.summaryValue, shipping === 0 && { color: Colors.success }]}>
                {shipping === 0 ? "Free 🎉" : `D ${shipping.toLocaleString()}`}
              </Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>D {total.toLocaleString()}</Text>
            </View>
            <Text style={styles.verifiedTotal}>Prices, stock, fees, and the final total are verified again by MansaMart before Wave opens.</Text>
          </View>
        </ScrollView>

        <View
          style={[
            styles.bottomBar,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 12 },
          ]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.placeOrderBtn,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              (isLoading || waveReady !== true) && { opacity: 0.6 },
            ]}
            onPress={handlePlaceOrder}
            disabled={isLoading || waveReady !== true}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="phone-portrait-outline" size={20} color="#fff" />
                <Text style={styles.placeOrderText}>{waveReady === null ? "Checking Wave…" : waveReady ? `Pay with Wave · D ${total.toLocaleString()}` : "Wave awaiting activation"}</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function cleanError(error: any) {
  const message = String(error?.message || "Please check your connection and try again.").replace(/^\d+:\s*/, "");
  try { return JSON.parse(message).message || message; } catch { return message; }
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
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginTop: 4,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  savedAddressRow: { gap: 9 },
  savedAddress: { width: 220, flexDirection: "row", alignItems: "center", gap: 9, padding: 12, borderRadius: 13, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  savedAddressSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  savedAddressLabel: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.text },
  savedAddressText: { width: 165, fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, backgroundColor: Colors.errorLight },
  errorText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: "Inter_500Medium", color: Colors.error },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  inputWrap: {
    backgroundColor: Colors.borderLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 46,
    justifyContent: "center",
  },
  input: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  row2Col: {
    flexDirection: "row",
    gap: 12,
  },
  paymentMethods: {
    gap: 8,
  },
  paymentItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  paymentItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  paymentLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  paymentLabelSelected: {
    color: Colors.primary,
    fontFamily: "Inter_600SemiBold",
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: Colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  orderItemBlock: { gap: 4 },
  orderItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  orderItemName: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  orderItemQty: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  orderItemPrice: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  orderOptionText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
    marginLeft: 2,
  },
  moreItems: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    fontStyle: "italic",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 4,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 10,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  totalValue: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  verifiedTotal: { fontSize: 10, lineHeight: 15, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 3 },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  placeOrderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    height: 56,
  },
  placeOrderText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});
