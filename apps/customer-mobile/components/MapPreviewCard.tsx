import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { hasCoords, openMap, openNavigation } from "@/lib/maps";

interface MapPreviewCardProps {
  title: string;
  subtitle?: string;
  latitude?: number | null;
  longitude?: number | null;
  actionLabel?: string;
  mode?: "view" | "navigate";
}

export function MapPreviewCard({ title, subtitle, latitude, longitude, actionLabel = "Open Map", mode = "view" }: MapPreviewCardProps) {
  const available = hasCoords(latitude, longitude);
  const open = () => mode === "navigate" ? openNavigation(latitude, longitude, title) : openMap(latitude, longitude, title);
  return (
    <View style={styles.card}>
      <View style={styles.mapBox}>
        <View style={styles.gridLineA} />
        <View style={styles.gridLineB} />
        <View style={styles.pinOuter}><Ionicons name="location-sharp" size={24} color="#fff" /></View>
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{available ? subtitle || `${latitude?.toFixed(5)}, ${longitude?.toFixed(5)}` : "Location coordinates not available yet."}</Text>
        <Pressable style={[styles.btn, !available && styles.btnDisabled]} onPress={open} disabled={!available}>
          <Ionicons name={mode === "navigate" ? "navigate-outline" : "map-outline"} size={16} color="#fff" />
          <Text style={styles.btnText}>{actionLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: Colors.borderLight, marginBottom: 10 },
  mapBox: { height: 130, backgroundColor: "#E6FAF3", position: "relative", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  gridLineA: { position: "absolute", left: -30, right: -30, top: 54, height: 13, backgroundColor: "rgba(14,164,122,0.16)", transform: [{ rotate: "-18deg" }] },
  gridLineB: { position: "absolute", top: -20, bottom: -20, left: "58%", width: 12, backgroundColor: "rgba(14,164,122,0.12)", transform: [{ rotate: "26deg" }] },
  pinOuter: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", shadowColor: Colors.primary, shadowOpacity: 0.35, shadowRadius: 12, elevation: 4 },
  body: { padding: 14 },
  title: { fontSize: 15, fontWeight: "800", color: Colors.text },
  sub: { marginTop: 3, fontSize: 12, color: Colors.textMuted, lineHeight: 18 },
  btn: { marginTop: 12, height: 42, borderRadius: 12, backgroundColor: Colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnDisabled: { backgroundColor: "#CBD5E1" },
  btnText: { color: "#fff", fontWeight: "800" },
});
