import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { hasCoords, openMap } from "@/lib/maps";
import type { CustomerDeliveryMapProps } from "./CustomerDeliveryMap.types";

export function CustomerDeliveryMap({ riderLocation, status }: CustomerDeliveryMapProps) {
  const available = hasCoords(riderLocation?.latitude, riderLocation?.longitude);
  const updatedAt = riderLocation?.createdAt ? new Date(riderLocation.createdAt) : null;
  const stale = !updatedAt || Date.now() - updatedAt.getTime() > 60_000;
  const pickedUp = ["picked_up", "on_the_way", "in_transit"].includes(String(status));
  const finished = ["delivered", "completed"].includes(String(status));

  return (
    <View style={styles.card}>
      <View style={styles.preview}>
        <View style={styles.roadA} /><View style={styles.roadB} />
        <View style={styles.rider}><Ionicons name="bicycle" size={23} color="#fff" /></View>
      </View>
      <View style={styles.body}>
        <View style={styles.statusRow}><View style={[styles.dot, stale && !finished && styles.dotStale]} /><Text style={styles.status}>{finished ? "Delivery completed" : stale ? "Last known rider position" : "Rider location live"}</Text></View>
        <Text style={styles.title}>{finished ? "Order delivered" : pickedUp ? "Your order is on the way" : "Rider is heading to the vendor"}</Text>
        <Text style={styles.sub}>{updatedAt ? `Last update: ${updatedAt.toLocaleTimeString()}` : "Waiting for the rider's first location update."}</Text>
        <Pressable disabled={!available} style={[styles.button, !available && styles.disabled]} onPress={() => openMap(riderLocation?.latitude, riderLocation?.longitude, "Rider's last known location")}>
          <Ionicons name="map-outline" size={17} color="#fff" /><Text style={styles.buttonText}>Open last location in Google Maps</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: Colors.borderLight, overflow: "hidden", backgroundColor: "#fff" },
  preview: { height: 150, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  roadA: { position: "absolute", left: -30, right: -30, height: 16, backgroundColor: "rgba(14,164,122,0.15)", transform: [{ rotate: "-15deg" }] },
  roadB: { position: "absolute", top: -20, bottom: -20, width: 14, left: "60%", backgroundColor: "rgba(14,164,122,0.12)", transform: [{ rotate: "22deg" }] },
  rider: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#4285F4", alignItems: "center", justifyContent: "center" },
  body: { padding: 14 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  dotStale: { backgroundColor: "#F59E0B" },
  status: { fontSize: 10, letterSpacing: 0.7, fontWeight: "800", color: Colors.textMuted, textTransform: "uppercase" },
  title: { marginTop: 5, color: Colors.text, fontWeight: "800", fontSize: 15 },
  sub: { marginTop: 4, color: Colors.textMuted, fontSize: 12, lineHeight: 18 },
  button: { marginTop: 12, minHeight: 44, borderRadius: 12, backgroundColor: Colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  disabled: { backgroundColor: "#CBD5E1" },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 12 },
});
