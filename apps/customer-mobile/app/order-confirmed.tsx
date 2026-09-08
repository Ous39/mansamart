import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

export default function OrderConfirmedScreen() {
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const contentY = useSharedValue(30);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    scale.value = withDelay(200, withSpring(1, { damping: 12, stiffness: 150 }));
    opacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    contentOpacity.value = withDelay(700, withTiming(1, { duration: 500 }));
    contentY.value = withDelay(700, withSpring(0, { damping: 20 }));
  }, []);

  const iconStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentY.value }],
  }));

  const orderId = `FK-${Date.now().toString().slice(-6)}`;
  const estimatedDelivery = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <View style={[
      styles.container,
      {
        paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
        paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0),
      },
    ]}>
      <View style={styles.content}>
        <Animated.View style={[styles.successRing, iconStyle]}>
          <View style={styles.successCircle}>
            <Ionicons name="checkmark" size={48} color="#fff" />
          </View>
        </Animated.View>

        <Animated.View style={[styles.textSection, contentStyle]}>
          <Text style={styles.title}>Order Confirmed!</Text>
          <Text style={styles.subtitle}>
            Thank you for your purchase. Your order has been placed successfully.
          </Text>

          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <View style={[styles.detailIcon, { backgroundColor: Colors.primaryLight }]}>
                <Ionicons name="receipt-outline" size={18} color={Colors.primary} />
              </View>
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Order Number</Text>
                <Text style={styles.detailValue}>{orderId}</Text>
              </View>
            </View>

            <View style={[styles.detailRow, styles.detailRowBorder]}>
              <View style={[styles.detailIcon, { backgroundColor: "#FEF0E6" }]}>
                <Ionicons name="time-outline" size={18} color={Colors.accent} />
              </View>
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Estimated Delivery</Text>
                <Text style={styles.detailValue}>{estimatedDelivery}</Text>
              </View>
            </View>

            <View style={[styles.detailRow, styles.detailRowBorder]}>
              <View style={[styles.detailIcon, { backgroundColor: "#EFF6FF" }]}>
                <Ionicons name="cube-outline" size={18} color="#2563EB" />
              </View>
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Status</Text>
                <Text style={[styles.detailValue, { color: Colors.success }]}>Processing</Text>
              </View>
            </View>
          </View>

          <View style={styles.messageCard}>
            <Ionicons name="mail-outline" size={18} color={Colors.primary} />
            <Text style={styles.messageText}>
              A confirmation email has been sent with your order details.
            </Text>
          </View>
        </Animated.View>
      </View>

      <Animated.View style={[styles.actions, contentStyle]}>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
          onPress={() => router.replace("/(tabs)")}
        >
          <Text style={styles.primaryBtnText}>Continue Shopping</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.replace("/(tabs)/profile")}
        >
          <Text style={styles.secondaryBtnText}>View My Orders</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
  },
  successRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  successCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  textSection: {
    width: "100%",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  detailsCard: {
    width: "100%",
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 16,
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 10,
  },
  detailRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  detailText: {
    gap: 2,
  },
  detailLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  detailValue: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  messageCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
    padding: 14,
    width: "100%",
  },
  messageText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.primary,
    lineHeight: 19,
  },
  actions: {
    gap: 12,
    paddingBottom: 8,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  secondaryBtn: {
    borderRadius: 16,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
});
