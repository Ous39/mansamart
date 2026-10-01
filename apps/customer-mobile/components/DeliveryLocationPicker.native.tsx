import React, { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import MapView, { Marker, PROVIDER_GOOGLE, type MapPressEvent } from "react-native-maps";
import Colors from "@/constants/colors";
import type { DeliveryCoordinate, DeliveryLocationPickerProps } from "./DeliveryLocationPicker.types";

const GAMBIA_REGION = { latitude: 13.4549, longitude: -16.5790, latitudeDelta: 0.35, longitudeDelta: 0.35 };

export function DeliveryLocationPicker({ value, onChange, compact }: DeliveryLocationPickerProps) {
  const mapRef = useRef<MapView>(null);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState(value ? "Drag the pin if the entrance is not exact." : "Use GPS, then drag the pin to your gate or meeting point.");

  const choose = (coordinate: DeliveryCoordinate) => {
    onChange(coordinate);
    mapRef.current?.animateToRegion({ ...coordinate, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 300);
  };

  const locate = async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setMessage("Location permission is off. You can still place the order using the written address.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      choose({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy ?? undefined });
      setMessage("Pin selected. Drag it to the exact delivery entrance if needed.");
    } catch {
      setMessage("GPS could not find you. Check location services or continue with the written address.");
    } finally {
      setLocating(false);
    }
  };

  const mapPress = (event: MapPressEvent) => {
    choose(event.nativeEvent.coordinate);
    setMessage("Pin selected from the map.");
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleWrap}><Ionicons name="map-outline" size={18} color={Colors.primary} /><Text style={styles.title}>Delivery map pin</Text></View>
        {value && <Text style={styles.ready}>PIN SET</Text>}
      </View>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={[styles.map, compact && styles.mapCompact]}
        initialRegion={value ? { ...value, latitudeDelta: 0.012, longitudeDelta: 0.012 } : GAMBIA_REGION}
        onPress={mapPress}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {value && <Marker coordinate={value} title="Delivery point" draggable onDragEnd={(event) => choose(event.nativeEvent.coordinate)} />}
      </MapView>
      <View style={styles.body}>
        <Text style={styles.message}>{message}</Text>
        {value && <Text style={styles.coordinates}>{value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}{value.accuracy ? ` · ±${Math.round(value.accuracy)}m` : ""}</Text>}
        <Pressable style={styles.button} onPress={locate} disabled={locating}>
          {locating ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="locate" size={17} color="#fff" />}
          <Text style={styles.buttonText}>{locating ? "Finding your location…" : value ? "Update from my GPS" : "Use my current location"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 16, overflow: "hidden", backgroundColor: "#fff" },
  header: { minHeight: 46, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleWrap: { flexDirection: "row", alignItems: "center", gap: 7 },
  title: { fontSize: 14, fontWeight: "800", color: Colors.text },
  ready: { fontSize: 10, fontWeight: "900", color: Colors.primary, backgroundColor: Colors.primaryLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  map: { height: 230, width: "100%" },
  mapCompact: { height: 180 },
  body: { padding: 14 },
  message: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18 },
  coordinates: { marginTop: 6, color: Colors.textMuted, fontSize: 11, fontWeight: "600" },
  button: { marginTop: 12, minHeight: 44, borderRadius: 12, backgroundColor: Colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 13 },
});
