import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { getDefaultRouteForRole } from "@/lib/role-routes";

const { width, height } = Dimensions.get("window");

const FEATURES = [
  { icon: "shirt-outline", label: "Fashion", color: "#E91E8C" },
  { icon: "phone-portrait-outline", label: "Electronics", color: "#2196F3" },
  { icon: "basket-outline", label: "Food", color: "#4CAF50" },
  { icon: "home-outline", label: "Furniture", color: "#0EA47A" },
  { icon: "sparkles-outline", label: "Beauty", color: "#FF6B9D" },
  { icon: "construct-outline", label: "Services", color: "#7B4FA3" },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, isLoading, hasPin, pinVerified } = useAuth();

  const logoOp = useSharedValue(0);
  const logoY = useSharedValue(30);
  const tagOp = useSharedValue(0);
  const tagY = useSharedValue(20);
  const gridOp = useSharedValue(0);
  const btnOp = useSharedValue(0);
  const btnY = useSharedValue(20);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      if (hasPin && !pinVerified) {
        router.replace("/pin-entry");
      } else {
        router.replace(getDefaultRouteForRole(user?.role) as any);
      }
      return;
    }
    if (!isLoading) {
      logoOp.value = withDelay(200, withTiming(1, { duration: 700 }));
      logoY.value = withDelay(200, withSpring(0, { damping: 18 }));
      tagOp.value = withDelay(600, withTiming(1, { duration: 600 }));
      tagY.value = withDelay(600, withSpring(0, { damping: 18 }));
      gridOp.value = withDelay(900, withTiming(1, { duration: 600 }));
      btnOp.value = withDelay(1200, withTiming(1, { duration: 500 }));
      btnY.value = withDelay(1200, withSpring(0, { damping: 18 }));
    }
  }, [isLoading, isAuthenticated, hasPin, pinVerified, user?.role]);

  const logoStyle = useAnimatedStyle(() => ({ opacity: logoOp.value, transform: [{ translateY: logoY.value }] }));
  const tagStyle = useAnimatedStyle(() => ({ opacity: tagOp.value, transform: [{ translateY: tagY.value }] }));
  const gridStyle = useAnimatedStyle(() => ({ opacity: gridOp.value }));
  const btnStyle = useAnimatedStyle(() => ({ opacity: btnOp.value, transform: [{ translateY: btnY.value }] }));

  if (isLoading) return null;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0B8A65", "#0EA47A", "#12C18F"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Decorative circles */}
      <View style={[styles.circle, styles.circle1]} />
      <View style={[styles.circle, styles.circle2]} />
      <View style={[styles.circle, styles.circle3]} />

      <View style={[styles.content, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 40, paddingBottom: insets.bottom + 40 }]}>

        {/* Logo */}
        <Animated.View style={[styles.logoSection, logoStyle]}>
          <View style={styles.logoIcon}>
            <Ionicons name="storefront-outline" size={32} color="#0EA47A" />
          </View>
          <Text style={styles.logoText}>MansaMart</Text>
          <View style={styles.flagRow}>
            <View style={[styles.flag, { backgroundColor: "#3A7A28" }]} />
            <View style={[styles.flag, { backgroundColor: "#E63946", width: 24 }]} />
            <View style={[styles.flag, { backgroundColor: "#3A7A28" }]} />
          </View>
        </Animated.View>

        {/* Tagline */}
        <Animated.View style={[styles.tagSection, tagStyle]}>
          <Text style={styles.tagline}>Shop. Sell. Deliver.</Text>
          <Text style={styles.taglineAccent}>Across The Gambia</Text>
          <Text style={styles.taglineSub}>
            Shop fashion, electronics, food, furniture and more — all from Gambian businesses
          </Text>
        </Animated.View>

        {/* Category Grid */}
        <Animated.View style={[styles.featureGrid, gridStyle]}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureChip}>
              <View style={[styles.featureIcon, { backgroundColor: f.color + "22" }]}>
                <Ionicons name={f.icon as any} size={20} color={f.color} />
              </View>
              <Text style={styles.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Trust badges */}
        <Animated.View style={[styles.trustRow, gridStyle]}>
          {[
            { icon: "shield-checkmark-outline", text: "Secure Payments" },
            { icon: "bicycle-outline", text: "Fast Delivery" },
            { icon: "refresh-outline", text: "Easy Returns" },
          ].map((t, i) => (
            <View key={i} style={styles.trustItem}>
              <Ionicons name={t.icon as any} size={16} color="rgba(255,255,255,0.8)" />
              <Text style={styles.trustText}>{t.text}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Buttons */}
        <Animated.View style={[styles.buttons, btnStyle]}>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
            onPress={() => router.push("/(auth)/register")}
          >
            <Text style={styles.primaryBtnText}>Get Started — It's Free</Text>
            <Ionicons name="arrow-forward" size={18} color="#0EA47A" />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.8 }]}
            onPress={() => router.push("/(auth)/login")}
          >
            <Text style={styles.secondaryBtnText}>Already have an account? Sign In</Text>
          </Pressable>

          <Pressable onPress={() => router.replace("/(tabs)")}>
            <Text style={styles.guestText}>Continue as Guest</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  circle: { position: "absolute", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)" },
  circle1: { width: 300, height: 300, top: -80, right: -80 },
  circle2: { width: 200, height: 200, bottom: 100, left: -60 },
  circle3: { width: 120, height: 120, bottom: 300, right: 20 },
  content: { flex: 1, paddingHorizontal: 28, alignItems: "center", justifyContent: "space-between" },
  logoSection: { alignItems: "center", gap: 10 },
  logoIcon: { width: 72, height: 72, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  logoText: { fontSize: 32, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: -1 },
  flagRow: { flexDirection: "row", gap: 3, alignItems: "center" },
  flag: { width: 18, height: 6, borderRadius: 2 },
  tagSection: { alignItems: "center", gap: 8 },
  tagline: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#fff", textAlign: "center" },
  taglineAccent: { fontSize: 28, fontFamily: "Inter_700Bold", color: "rgba(255,255,255,0.85)", textAlign: "center", marginTop: -8 },
  taglineSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", textAlign: "center", lineHeight: 21, paddingHorizontal: 10 },
  featureGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  featureChip: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  featureIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  featureLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" },
  trustRow: { flexDirection: "row", gap: 6, justifyContent: "center" },
  trustItem: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  trustText: { fontSize: 10, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.85)" },
  buttons: { width: "100%", gap: 12 },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#fff", borderRadius: 16, height: 56, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 6 },
  primaryBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#0EA47A" },
  secondaryBtn: { backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 16, height: 52, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  secondaryBtnText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#fff" },
  guestText: { textAlign: "center", fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)" },
});
