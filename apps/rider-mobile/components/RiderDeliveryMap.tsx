import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { hasCoords, openNavigation } from "@/lib/maps";
import type { RiderDeliveryMapProps } from "./RiderDeliveryMap.types";

export function RiderDeliveryMap(props: RiderDeliveryMapProps) {
  const headingToShopper = ["picked_up", "on_the_way", "in_transit"].includes(String(props.status));
  const latitude = headingToShopper ? props.dropoffLatitude : props.pickupLatitude;
  const longitude = headingToShopper ? props.dropoffLongitude : props.pickupLongitude;
  const address = headingToShopper ? props.dropoffAddress : props.pickupAddress;
  const nextStop = headingToShopper ? "Shopper" : "Vendor";
  const available = hasCoords(latitude, longitude) || Boolean(address);

  return (
    <View style={styles.card}>
      <View style={styles.preview}>
        <View style={styles.roadHorizontal} />
        <View style={styles.roadVertical} />
        <View style={styles.pin}>
          <Ionicons name="location-sharp" size={24} color="#fff" />
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.eyebrow}>GOOGLE MAPS</Text>
        <Text style={styles.title}>Next stop: {nextStop}</Text>
        <Text style={styles.subtitle}>{address || "Location coordinates will appear when available."}</Text>
        <Pressable
          disabled={!available}
          onPress={() => openNavigation(latitude, longitude, `${nextStop} location`, address || undefined)}
          style={[styles.button, !available && styles.buttonDisabled]}
        >
          <Ionicons name="navigate" size={17} color="#fff" />
          <Text style={styles.buttonText}>Start Google Maps navigation</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 16, overflow: "hidden", marginTop: 14, backgroundColor: "#fff" },
  preview: { height: 150, backgroundColor: "#E6FAF3", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  roadHorizontal: { position: "absolute", left: -40, right: -40, height: 18, backgroundColor: "rgba(14,164,122,0.14)", transform: [{ rotate: "-14deg" }] },
  roadVertical: { position: "absolute", top: -30, bottom: -30, width: 16, left: "62%", backgroundColor: "rgba(14,164,122,0.12)", transform: [{ rotate: "22deg" }] },
  pin: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  body: { padding: 14 },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: Colors.primary },
  title: { marginTop: 3, fontSize: 15, fontWeight: "800", color: Colors.text },
  subtitle: { marginTop: 4, color: Colors.textMuted, fontSize: 12, lineHeight: 18 },
  button: { marginTop: 12, minHeight: 44, borderRadius: 12, backgroundColor: Colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 12 },
  buttonDisabled: { backgroundColor: "#CBD5E1" },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 13 },
});
