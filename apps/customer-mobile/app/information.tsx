import React from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

const pages = {
  terms: {
    title: "Terms & Conditions",
    icon: "document-text-outline",
    intro: "The official MansaMart marketplace terms explain account responsibilities, ordering, service bookings, payments, cancellations, returns, prohibited conduct, and dispute handling.",
    points: [
      "Prices and availability are confirmed by the server when an order or booking is submitted.",
      "A Wave redirect is not proof of payment; payment is confirmed only after server verification.",
      "Returns and refunds require review under the applicable seller and marketplace policies.",
      "Accounts may be restricted when activity threatens customers, businesses, riders, or the platform.",
    ],
    url: "https://mansamart.gm/terms",
  },
  privacy: {
    title: "Privacy Policy",
    icon: "shield-checkmark-outline",
    intro: "The official privacy policy explains what information MansaMart needs, why it is used, how it is protected, and the choices available to account holders.",
    points: [
      "Account, address, order, booking, and payment-status data are used to provide marketplace services.",
      "Payment credentials and Wave secrets stay on secure payment systems and MansaMart servers, not in this app.",
      "Location is used only for relevant marketplace and active-delivery features with device permission.",
      "Contact support to ask about access, correction, or deletion options that apply to your account.",
    ],
    url: "https://mansamart.gm/privacy",
  },
  about: {
    title: "About MansaMart",
    icon: "storefront-outline",
    intro: "MansaMart connects customers with Gambian businesses, service providers, and delivery riders through one coordinated marketplace.",
    points: [
      "Shop products from local vendors.",
      "Book services from verified providers.",
      "Pay through supported providers such as Wave when production activation is complete.",
      "Track orders and delivery progress from the customer app.",
    ],
    url: "https://mansamart.gm",
  },
} as const;

export default function InformationScreen() {
  const { page = "about" } = useLocalSearchParams<{ page?: string }>();
  const insets = useSafeAreaInsets();
  const info = pages[page as keyof typeof pages] || pages.about;
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Ionicons name="arrow-back" size={24} color={Colors.text} /></Pressable>
        <Text style={styles.title}>{info.title}</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]}>
        <View style={styles.hero}>
          <View style={styles.icon}><Ionicons name={info.icon as any} size={30} color={Colors.primary} /></View>
          <Text style={styles.intro}>{info.intro}</Text>
        </View>
        <View style={styles.card}>
          {info.points.map((point) => (
            <View style={styles.point} key={point}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
              <Text style={styles.pointText}>{point}</Text>
            </View>
          ))}
        </View>
        {page !== "about" && (
          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={19} color="#D97706" />
            <Text style={styles.noticeText}>This in-app summary is for convenience. The published policy on the MansaMart website is the controlling version.</Text>
          </View>
        )}
        <Pressable style={styles.websiteButton} onPress={() => Linking.openURL(info.url)}>
          <Text style={styles.websiteText}>Open {page === "about" ? "MansaMart Website" : "Full Published Policy"}</Text>
          <Ionicons name="open-outline" size={18} color="#fff" />
        </Pressable>
        <Pressable style={styles.supportButton} onPress={() => router.push("/support")}>
          <Ionicons name="help-circle-outline" size={18} color={Colors.primary} />
          <Text style={styles.supportText}>Ask MansaMart Support</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  content: { padding: 18, gap: 14 },
  hero: { alignItems: "center", gap: 13, padding: 22, borderRadius: 18, backgroundColor: Colors.primaryLight },
  icon: { width: 62, height: 62, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: Colors.surface },
  intro: { fontSize: 14, lineHeight: 22, fontFamily: "Inter_500Medium", color: Colors.text, textAlign: "center" },
  card: { gap: 14, padding: 18, borderRadius: 17, backgroundColor: Colors.surface },
  point: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  pointText: { flex: 1, fontSize: 13, lineHeight: 20, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  notice: { flexDirection: "row", gap: 9, padding: 13, borderRadius: 13, backgroundColor: "#FFFBEB" },
  noticeText: { flex: 1, fontSize: 11, lineHeight: 17, fontFamily: "Inter_400Regular", color: "#92400E" },
  websiteButton: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, backgroundColor: Colors.primary },
  websiteText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  supportButton: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 14, borderWidth: 1, borderColor: Colors.primary },
  supportText: { color: Colors.primary, fontSize: 13, fontFamily: "Inter_700Bold" },
});
