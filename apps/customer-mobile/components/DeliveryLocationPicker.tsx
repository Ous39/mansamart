import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { openMap } from "@/lib/maps";
import type { DeliveryLocationPickerProps } from "./DeliveryLocationPicker.types";

export function DeliveryLocationPicker({ value, onChange }: DeliveryLocationPickerProps) {
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("Use your browser location to give the rider a precise delivery point.");

  const locate = () => {
    if (!globalThis.navigator?.geolocation) {
      setMessage("This browser does not provide location. Continue with the written address.");
      return;
    }
    setLocating(true);
    globalThis.navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy });
        setMessage("Delivery pin saved from this device.");
        setLocating(false);
      },
      () => {
        setMessage("Location permission was not granted. Continue with the written address or enable browser location.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.preview}><Ionicons name={value ? "location" : "map-outline"} size={34} color={Colors.primary} /><Text style={styles.title}>{value ? "Delivery pin is set" : "Add a delivery map pin"}</Text></View>
      <View style={styles.body}>
        <Text style={styles.message}>{message}</Text>
        {value && <Text style={styles.coordinates}>{value.latitude.toFixed(5)}, {value.longitude.toFixed(5)} · ±{Math.round(value.accuracy || 0)}m</Text>}
        <View style={styles.actions}>
          <Pressable style={styles.button} onPress={locate} disabled={locating}>{locating ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="locate" size={17} color="#fff" />}<Text style={styles.buttonText}>{locating ? "Locating…" : "Use my location"}</Text></Pressable>
          {value && <Pressable style={styles.mapButton} onPress={() => openMap(value.latitude, value.longitude, "Delivery point")}><Ionicons name="open-outline" size={17} color={Colors.primary} /><Text style={styles.mapText}>Open map</Text></Pressable>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 16, overflow: "hidden", backgroundColor: "#fff" },
  preview: { minHeight: 110, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center", gap: 6 },
  title: { color: Colors.text, fontWeight: "800", fontSize: 14 },
  body: { padding: 14 },
  message: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18 },
  coordinates: { marginTop: 6, color: Colors.textMuted, fontSize: 11, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  button: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: Colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  mapButton: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: Colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 13 },
  mapText: { color: Colors.primary, fontWeight: "800", fontSize: 12 },
});
