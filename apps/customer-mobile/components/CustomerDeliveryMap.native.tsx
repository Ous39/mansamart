import React, { useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_GOOGLE, type LatLng } from "react-native-maps";
import Colors from "@/constants/colors";
import { hasCoords, openMap } from "@/lib/maps";
import type { CustomerDeliveryMapProps } from "./CustomerDeliveryMap.types";

export function CustomerDeliveryMap(props: CustomerDeliveryMapProps) {
  const mapRef = useRef<MapView>(null);
  const pickedUp = ["picked_up", "on_the_way", "in_transit"].includes(String(props.status));
  const finished = ["delivered", "completed"].includes(String(props.status));
  const updatedAt = props.riderLocation?.createdAt ? new Date(props.riderLocation.createdAt) : null;
  const stale = !updatedAt || Date.now() - updatedAt.getTime() > 60_000;
  const rider = hasCoords(props.riderLocation?.latitude, props.riderLocation?.longitude)
    ? { latitude: props.riderLocation!.latitude!, longitude: props.riderLocation!.longitude! }
    : null;

  const stops = useMemo(() => {
    const points: (LatLng & { key: string; title: string; color: string })[] = [];
    if (hasCoords(props.pickupLatitude, props.pickupLongitude)) points.push({ key: "pickup", title: "Vendor", color: "#E8813A", latitude: props.pickupLatitude!, longitude: props.pickupLongitude! });
    if (hasCoords(props.dropoffLatitude, props.dropoffLongitude)) points.push({ key: "dropoff", title: "Your delivery address", color: "#E63946", latitude: props.dropoffLatitude!, longitude: props.dropoffLongitude! });
    return points;
  }, [props.dropoffLatitude, props.dropoffLongitude, props.pickupLatitude, props.pickupLongitude]);

  const fit = () => {
    const points = [...stops, ...(rider ? [rider] : [])];
    if (!points.length) return;
    if (points.length === 1) return mapRef.current?.animateToRegion({ ...points[0], latitudeDelta: 0.018, longitudeDelta: 0.018 }, 300);
    mapRef.current?.fitToCoordinates(points, { animated: true, edgePadding: { top: 42, right: 42, bottom: 42, left: 42 } });
  };

  const initial = rider || stops[0];
  if (!initial) return <View style={styles.empty}><Ionicons name="location-outline" size={28} color={Colors.primary} /><Text style={styles.title}>Waiting for tracking coordinates</Text></View>;

  return (
    <View style={styles.card}>
      <MapView ref={mapRef} provider={PROVIDER_GOOGLE} style={styles.map} initialRegion={{ ...initial, latitudeDelta: 0.025, longitudeDelta: 0.025 }} onMapReady={fit}>
        {stops.map((stop) => <Marker key={stop.key} coordinate={stop} title={stop.title} pinColor={stop.color} />)}
        {rider && <Marker coordinate={rider} title={stale ? "Rider · last known position" : "Rider · live"}><View style={styles.riderMarker}><Ionicons name="bicycle" size={18} color="#fff" /></View></Marker>}
      </MapView>
      <Pressable style={styles.fitButton} onPress={fit}><Ionicons name="scan-outline" size={19} color={Colors.text} /></Pressable>
      <View style={styles.body}>
        <View style={styles.statusRow}><View style={[styles.dot, stale && !finished && styles.dotStale]} /><Text style={styles.status}>{finished ? "Delivery completed" : stale ? "Connection lost · showing last location" : "Live rider tracking"}</Text></View>
        <Text style={styles.title}>{finished ? "Order delivered" : pickedUp ? "Your order is on the way" : "Rider is heading to the vendor"}</Text>
        <Text style={styles.sub}>{updatedAt ? `Rider location updated ${updatedAt.toLocaleTimeString()}` : "Waiting for the rider's first GPS update."}</Text>
        {stale && !finished && <Text style={styles.warning}>The rider may have poor or no internet. This marker will move again automatically after reconnection.</Text>}
        {rider && <Pressable style={styles.button} onPress={() => openMap(rider.latitude, rider.longitude, "Rider's last known location")}><Ionicons name="map-outline" size={17} color={Colors.primary} /><Text style={styles.buttonText}>Open last location in Google Maps</Text></Pressable>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: Colors.borderLight, overflow: "hidden", backgroundColor: "#fff" },
  map: { height: 250, width: "100%" },
  fitButton: { position: "absolute", right: 12, top: 12, width: 40, height: 40, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 5, elevation: 4 },
  riderMarker: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#4285F4", borderWidth: 3, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  body: { padding: 14 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  dotStale: { backgroundColor: "#F59E0B" },
  status: { fontSize: 10, letterSpacing: 0.7, fontWeight: "800", color: Colors.textMuted, textTransform: "uppercase" },
  title: { marginTop: 5, color: Colors.text, fontWeight: "800", fontSize: 15 },
  sub: { marginTop: 4, color: Colors.textMuted, fontSize: 12, lineHeight: 18 },
  warning: { marginTop: 8, color: "#92400E", backgroundColor: "#FFFBEB", borderRadius: 9, padding: 8, fontSize: 11, lineHeight: 16 },
  button: { marginTop: 10, minHeight: 42, borderRadius: 11, backgroundColor: Colors.primaryLight, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  buttonText: { color: Colors.primary, fontWeight: "800", fontSize: 12 },
  empty: { marginTop: 12, padding: 22, borderRadius: 16, backgroundColor: Colors.primaryLight, alignItems: "center", gap: 8 },
});
