import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import MapView, { Marker, PROVIDER_GOOGLE, type LatLng } from "react-native-maps";
import Colors from "@/constants/colors";
import { hasCoords, openNavigation } from "@/lib/maps";
import type { RiderDeliveryMapProps } from "./RiderDeliveryMap.types";

type Stop = LatLng & { key: "pickup" | "dropoff"; title: string; description?: string };

export function RiderDeliveryMap(props: RiderDeliveryMapProps) {
  const mapRef = useRef<MapView>(null);
  const [riderLocation, setRiderLocation] = useState<LatLng | null>(null);
  const [locationMessage, setLocationMessage] = useState("Finding your live location…");
  const headingToShopper = ["picked_up", "on_the_way", "in_transit"].includes(String(props.status));

  const stops = useMemo<Stop[]>(() => {
    const result: Stop[] = [];
    if (hasCoords(props.pickupLatitude, props.pickupLongitude)) {
      result.push({
        key: "pickup",
        latitude: props.pickupLatitude!,
        longitude: props.pickupLongitude!,
        title: "Vendor pickup",
        description: props.pickupAddress || undefined,
      });
    }
    if (hasCoords(props.dropoffLatitude, props.dropoffLongitude)) {
      result.push({
        key: "dropoff",
        latitude: props.dropoffLatitude!,
        longitude: props.dropoffLongitude!,
        title: "Shopper drop-off",
        description: props.dropoffAddress || undefined,
      });
    }
    return result;
  }, [props.dropoffAddress, props.dropoffLatitude, props.dropoffLongitude, props.pickupAddress, props.pickupLatitude, props.pickupLongitude]);

  const nextStop = headingToShopper ? stops.find((stop) => stop.key === "dropoff") : stops.find((stop) => stop.key === "pickup");
  const nextAddress = headingToShopper ? props.dropoffAddress : props.pickupAddress;

  useEffect(() => {
    if (props.trackRider === false) {
      setLocationMessage("Open the next stop in Google Maps for turn-by-turn directions.");
      return;
    }

    let subscription: Location.LocationSubscription | undefined;
    let mounted = true;

    async function startLocation() {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!mounted) return;
      if (permission.status !== "granted") {
        setLocationMessage("Location access is off. You can still open the route in Google Maps.");
        return;
      }

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
        ({ coords }) => {
          if (!mounted) return;
          setRiderLocation({ latitude: coords.latitude, longitude: coords.longitude });
          setLocationMessage("Your live position is shown in blue.");
        },
      );
    }

    startLocation().catch(() => {
      if (mounted) setLocationMessage("Live location is unavailable. Google Maps navigation still works.");
    });

    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, [props.trackRider]);

  const fitRoute = () => {
    const points = [...stops, ...(riderLocation ? [riderLocation] : [])];
    if (points.length === 0) return;
    if (points.length === 1) {
      mapRef.current?.animateToRegion({ ...points[0], latitudeDelta: 0.018, longitudeDelta: 0.018 }, 350);
      return;
    }
    mapRef.current?.fitToCoordinates(points, { animated: true, edgePadding: { top: 44, right: 44, bottom: 44, left: 44 } });
  };

  if (stops.length === 0) {
    return (
      <View style={styles.unavailable}>
        <Ionicons name="map-outline" size={28} color={Colors.primary} />
        <Text style={styles.unavailableTitle}>Map waiting for delivery coordinates</Text>
        <Text style={styles.message}>The address will remain available for Google Maps navigation.</Text>
        <NavigateButton
          label={`Navigate to ${headingToShopper ? "shopper" : "vendor"}`}
          address={nextAddress}
          latitude={undefined}
          longitude={undefined}
        />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{ ...stops[0], latitudeDelta: 0.025, longitudeDelta: 0.025 }}
        showsUserLocation={props.trackRider !== false}
        showsMyLocationButton={props.trackRider !== false}
        showsTraffic
        onMapReady={fitRoute}
      >
        {stops.map((stop) => (
          <Marker
            key={stop.key}
            coordinate={stop}
            title={stop.title}
            description={stop.description}
            pinColor={stop.key === "pickup" ? "#E8813A" : "#E63946"}
          />
        ))}
      </MapView>
      <Pressable style={styles.fitButton} onPress={fitRoute} accessibilityLabel="Show the full delivery route">
        <Ionicons name="scan-outline" size={19} color={Colors.text} />
      </Pressable>
      <View style={styles.body}>
        <View style={styles.headingRow}>
          <View>
            <Text style={styles.eyebrow}>GOOGLE MAPS · LIVE</Text>
            <Text style={styles.title}>Next stop: {headingToShopper ? "Shopper" : "Vendor"}</Text>
          </View>
          <Ionicons name="navigate-circle" size={34} color={Colors.primary} />
        </View>
        <Text style={styles.message}>{locationMessage}</Text>
        <View style={styles.legend}>
          <Legend color="#E8813A" label="Pickup" />
          <Legend color="#E63946" label="Drop-off" />
          {props.trackRider !== false && <Legend color="#4285F4" label="You" />}
        </View>
        <NavigateButton
          label={`Navigate to ${headingToShopper ? "shopper" : "vendor"}`}
          address={nextAddress}
          latitude={nextStop?.latitude}
          longitude={nextStop?.longitude}
        />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendText}>{label}</Text></View>;
}

function NavigateButton({ label, latitude, longitude, address }: { label: string; latitude?: number; longitude?: number; address?: string | null }) {
  const available = hasCoords(latitude, longitude) || Boolean(address);
  return (
    <Pressable
      disabled={!available}
      onPress={() => openNavigation(latitude, longitude, label, address || undefined)}
      style={[styles.button, !available && styles.buttonDisabled]}
    >
      <Ionicons name="navigate" size={17} color="#fff" />
      <Text style={styles.buttonText}>{label} with Google Maps</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 16, overflow: "hidden", marginTop: 14, backgroundColor: "#fff" },
  map: { height: 240, width: "100%" },
  fitButton: { position: "absolute", right: 12, top: 12, width: 40, height: 40, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 5, elevation: 4 },
  body: { padding: 14 },
  headingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: Colors.primary },
  title: { marginTop: 3, fontSize: 15, fontWeight: "800", color: Colors.text },
  message: { marginTop: 5, color: Colors.textMuted, fontSize: 12, lineHeight: 18 },
  legend: { flexDirection: "row", gap: 14, marginTop: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: Colors.textMuted, fontWeight: "600" },
  button: { marginTop: 12, minHeight: 44, borderRadius: 12, backgroundColor: Colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 12 },
  buttonDisabled: { backgroundColor: "#CBD5E1" },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  unavailable: { borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 16, padding: 18, alignItems: "center", marginTop: 14, backgroundColor: Colors.primaryLight },
  unavailableTitle: { marginTop: 8, fontSize: 14, fontWeight: "800", color: Colors.text, textAlign: "center" },
});
