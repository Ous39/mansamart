import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  Dimensions,
  Platform,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { serviceCategories } from "@/data/services";
import { useBookings } from "@/contexts/BookingContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";

const { width } = Dimensions.get("window");

const TIMES = ["9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM"];

function getNextDays(count: number) {
  const days = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      full: d.toISOString().split("T")[0],
      day: d.toLocaleDateString("en-US", { weekday: "short" }),
      date: d.getDate(),
      month: d.toLocaleDateString("en-US", { month: "short" }),
    });
  }
  return days;
}

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { addBooking } = useBookings();
  const { user } = useAuth();
  const days = getNextDays(7);

  const { data: service, isLoading } = useQuery<any>({
    queryKey: ["/api/services", id],
    enabled: !!id,
  });

  const [selectedDay, setSelectedDay] = useState(days[0].full);
  const [selectedTime, setSelectedTime] = useState(TIMES[0]);
  const [address, setAddress] = useState(user?.address ?? "");
  const [notes, setNotes] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [isBooked, setIsBooked] = useState(false);
  const [bookingPending, setBookingPending] = useState(false);
  const btnScale = useSharedValue(1);

  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

  if (isLoading) {
    return (
      <View style={[styles.notFound, { justifyContent: "center" }]}>
        <Text style={styles.notFoundText}>Loading...</Text>
      </View>
    );
  }

  if (!service) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Service not found</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: Colors.primary }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const cat = serviceCategories.find(c => c.id === service.category);
  const priceLabel = service.priceType === "hourly" ? "/hr" : service.priceType === "per_room" ? "/room" : "";
  const features: string[] = Array.isArray(service.features) ? service.features : [];

  const handleBook = async () => {
    if (!user) {
      router.push("/(auth)/login");
      return;
    }
    if (address.trim().length < 5) {
      Alert.alert("Address required", "Enter the address where the service should be provided.");
      return;
    }
    setBookingPending(true);
    try {
      btnScale.value = withSpring(0.95, { damping: 10 }, () => {
        btnScale.value = withSpring(1);
      });
      await addBooking({ serviceId: service.id, date: selectedDay, time: selectedTime, notes, address: address.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsBooked(true);
      setShowModal(true);
    } catch (error: any) {
      Alert.alert("Booking not submitted", String(error?.message || "Please check your connection and try again.").replace(/^\d+:\s*/, ""));
    } finally {
      setBookingPending(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={styles.imgWrap}>
          {service.imageUrl ? (
            <Image source={{ uri: service.imageUrl }} style={styles.img} resizeMode="cover" />
          ) : (
            <View style={[styles.img, { backgroundColor: "#7B4FA3", alignItems: "center", justifyContent: "center" }]}>
              <Ionicons name="construct-outline" size={60} color="rgba(255,255,255,0.4)" />
            </View>
          )}
          <View style={[styles.topBar, { top: insets.top + (Platform.OS === "web" ? 67 : 0) + 12 }]}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
              <Ionicons name="arrow-back" size={22} color={Colors.text} />
            </Pressable>
          </View>
          {cat && (
            <View style={[styles.catBadge, { backgroundColor: cat.color }]}>
              <Ionicons name={cat.icon as any} size={12} color="#fff" />
              <Text style={styles.catBadgeText}>{cat.name}</Text>
            </View>
          )}
        </View>

        <View style={styles.body}>
          <View style={styles.providerRow}>
            <View style={styles.providerAvatar}>
              <Ionicons name="business-outline" size={18} color={Colors.primary} />
            </View>
            <Text style={styles.providerName}>{service.providerName}</Text>
            {service.isAvailable && (
              <View style={styles.availBadge}>
                <View style={styles.availDot} />
                <Text style={styles.availText}>Available</Text>
              </View>
            )}
          </View>

          <Text style={styles.serviceName}>{service.name}</Text>
          <View style={styles.ratingRow}>
            {[1,2,3,4,5].map(s => (
              <Ionicons key={s} name={s <= Math.round(service.rating) ? "star" : "star-outline"} size={14} color="#F59E0B" />
            ))}
            <Text style={styles.ratingVal}>{service.rating}</Text>
            <Text style={styles.ratingCount}>({service.reviewCount} reviews)</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="time-outline" size={16} color={Colors.primary} />
              <Text style={styles.statText}>{service.duration}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="cash-outline" size={16} color={Colors.primary} />
              <Text style={styles.statText}>
                D {service.price}{priceLabel}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="people-outline" size={16} color={Colors.primary} />
              <Text style={styles.statText}>{service.reviewCount} clients</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>About this service</Text>
          <Text style={styles.description}>{service.description}</Text>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>What’s included</Text>
          <View style={styles.featuresList}>
            {features.map((f, i) => (
              <View key={i} style={styles.featureItem}>
                <View style={styles.featureCheck}>
                  <Ionicons name="checkmark" size={12} color="#fff" />
                </View>
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Select Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
            {days.map(d => (
              <Pressable
                key={d.full}
                style={[styles.dateCard, selectedDay === d.full && styles.dateCardSelected]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedDay(d.full);
                }}
              >
                <Text style={[styles.dateDayText, selectedDay === d.full && styles.dateSelectedText]}>{d.day}</Text>
                <Text style={[styles.dateDateText, selectedDay === d.full && styles.dateSelectedText]}>{d.date}</Text>
                <Text style={[styles.dateMonthText, selectedDay === d.full && styles.dateSelectedText]}>{d.month}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={[styles.sectionLabel, { marginTop: 4 }]}>Select Time</Text>
          <View style={styles.timeGrid}>
            {TIMES.map(t => (
              <Pressable
                key={t}
                style={[styles.timeChip, selectedTime === t && styles.timeChipSelected]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedTime(t);
                }}
              >
                <Text style={[styles.timeChipText, selectedTime === t && styles.timeChipTextSelected]}>{t}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Service Address</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="location-outline" size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.addressInput}
              value={address}
              onChangeText={setAddress}
              placeholder="Enter your address"
              placeholderTextColor={Colors.textMuted}
              multiline
            />
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Special Notes (optional)</Text>
          <View style={[styles.inputWrap, { minHeight: 80, alignItems: "flex-start", paddingTop: 12 }]}>
            <TextInput
              style={[styles.addressInput, { flex: 1 }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any special instructions..."
              placeholderTextColor={Colors.textMuted}
              multiline
            />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 12 }]}>
        <View style={styles.priceSummary}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalPrice}>D {service.price}{priceLabel}</Text>
        </View>
        <Animated.View style={[{ flex: 1 }, btnStyle]}>
          <Pressable style={[styles.bookBtn, bookingPending && { opacity: 0.65 }]} onPress={handleBook} disabled={bookingPending || isBooked}>
            {bookingPending ? <ActivityIndicator color="#fff" /> : <Ionicons name="calendar-outline" size={18} color="#fff" />}
            <Text style={styles.bookBtnText}>{isBooked ? "Booking Submitted" : bookingPending ? "Submitting…" : "Book Now"}</Text>
          </Pressable>
        </Animated.View>
      </View>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Ionicons name="checkmark-circle" size={56} color={Colors.primary} />
            </View>
            <Text style={styles.modalTitle}>Booking Confirmed!</Text>
            <Text style={styles.modalSubtext}>
              Your booking for {service.name} has been placed.{"\n"}
              <Text style={{ fontFamily: "Inter_600SemiBold" }}>
                {new Date(selectedDay).toLocaleDateString("en-US", { month: "long", day: "numeric" })} at {selectedTime}
              </Text>
            </Text>
            <Pressable
              style={styles.modalBtn}
              onPress={() => {
                setShowModal(false);
                router.replace({ pathname: "/(tabs)/wishlist", params: { tab: "bookings" } });
              }}
            >
              <Text style={styles.modalBtnText}>View My Bookings</Text>
            </Pressable>
            <Pressable onPress={() => { setShowModal(false); router.back(); }} style={styles.modalSecBtn}>
              <Text style={styles.modalSecBtnText}>Continue Browsing</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  notFoundText: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.text },
  imgWrap: { width: "100%", height: width * 0.7, backgroundColor: Colors.borderLight, position: "relative" },
  img: { width: "100%", height: "100%" },
  topBar: {
    position: "absolute", left: 0, right: 0,
    flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center",
  },
  catBadge: {
    position: "absolute", bottom: 16, left: 20,
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  catBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff" },
  body: { backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -20, padding: 24 },
  providerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  providerAvatar: {
    width: 36, height: 36, borderRadius: 11, backgroundColor: Colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  providerName: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  availBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#D1FAE5", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  availDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  availText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.success },
  serviceName: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text, lineHeight: 30, marginBottom: 10 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 16 },
  ratingVal: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text, marginLeft: 4 },
  ratingCount: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  statsRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.borderLight, borderRadius: 14, padding: 14, marginBottom: 4,
  },
  statItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  statDivider: { width: 1, height: 20, backgroundColor: Colors.border },
  statText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.text },
  divider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 20 },
  sectionLabel: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 12 },
  description: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 22 },
  featuresList: { gap: 8 },
  featureItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureCheck: { width: 20, height: 20, borderRadius: 6, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  featureText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  dateRow: { gap: 10, paddingBottom: 4 },
  dateCard: {
    width: 60, borderRadius: 14, padding: 10, alignItems: "center",
    backgroundColor: Colors.borderLight, gap: 2, borderWidth: 2, borderColor: "transparent",
  },
  dateCardSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dateDayText: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textMuted },
  dateDateText: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  dateMonthText: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  dateSelectedText: { color: "#fff" },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  timeChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
    backgroundColor: Colors.borderLight, borderWidth: 1.5, borderColor: "transparent",
  },
  timeChipSelected: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  timeChipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  timeChipTextSelected: { color: Colors.primary, fontFamily: "Inter_600SemiBold" },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.borderLight, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 10,
  },
  addressInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.text },
  bottomBar: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingTop: 16,
    backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  priceSummary: { gap: 2 },
  totalLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  totalPrice: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text },
  bookBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.primary, borderRadius: 16, height: 52,
  },
  bookBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: {
    width: "100%", backgroundColor: "#fff", borderRadius: 24, padding: 28,
    alignItems: "center", gap: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10,
  },
  modalIcon: { marginBottom: 4 },
  modalTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: Colors.text },
  modalSubtext: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", lineHeight: 21 },
  modalBtn: {
    width: "100%", backgroundColor: Colors.primary, borderRadius: 14,
    height: 52, alignItems: "center", justifyContent: "center", marginTop: 4,
  },
  modalBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  modalSecBtn: { paddingVertical: 8 },
  modalSecBtnText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
});
