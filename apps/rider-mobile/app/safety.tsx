import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiRequest, queryClient } from "@/lib/query-client";
import { readForegroundLocation } from "@/lib/rider-location";
import { safeBack } from "@/lib/navigation";
import { readableError } from "@/lib/errors";

const TYPES = [
  ["accident", "Accident", "car-outline"], ["unsafe_customer", "Unsafe situation", "shield-outline"],
  ["vehicle_problem", "Vehicle problem", "construct-outline"], ["road_hazard", "Road hazard", "warning-outline"],
] as const;

export default function RiderSafetyScreen() {
  const { data: dashboard } = useQuery<any>({ queryKey: ["/api/rider/dashboard"] });
  const { data: incidents = [] } = useQuery<any[]>({ queryKey: ["/api/rider/safety/incidents"] });
  const [type, setType] = useState("road_hazard");
  const [description, setDescription] = useState("");
  const active = dashboard?.activeDeliveries?.[0];
  const report = useMutation({
    mutationFn: async ({ sos = false }: { sos?: boolean }) => {
      let location = {};
      try { location = await readForegroundLocation(); } catch {}
      return (await apiRequest("POST", "/api/rider/safety/incidents", { deliveryId: active?.id, type: sos ? "sos" : type, severity: sos ? "critical" : "high", description: sos ? "Emergency assistance requested from the rider safety screen." : description, ...location })).json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rider/safety/incidents"] });
      setDescription("");
      Alert.alert(variables.sos ? "SOS sent" : "Report sent", variables.sos ? "The operations team has been alerted with your latest available location. Call local emergency services if you are in immediate danger." : "MansaMart operations can now follow up on this incident.");
    },
    onError: (error) => Alert.alert("Report not sent", readableError(error, "Try again or contact emergency services directly.")),
  });

  const sendSos = () => Alert.alert("Send emergency SOS?", "This immediately alerts MansaMart operations and attaches your active delivery and latest location.", [{ text: "Cancel", style: "cancel" }, { text: "Send SOS", style: "destructive", onPress: () => report.mutate({ sos: true }) }]);

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <View style={styles.header}><Pressable style={styles.back} onPress={() => safeBack("/(rider)")}><Ionicons name="chevron-back" size={23} color={Colors.text} /></Pressable><View><Text style={styles.eyebrow}>RIDER PROTECTION</Text><Text style={styles.title}>Safety centre</Text></View></View>
    <View style={styles.sosCard}><Ionicons name="alert-circle" size={36} color="#fff" /><Text style={styles.sosTitle}>Need urgent help?</Text><Text style={styles.sosText}>Stop in a safe place first. SOS alerts MansaMart operations; it does not replace local emergency services.</Text><Pressable disabled={report.isPending} style={styles.sosButton} onPress={sendSos}>{report.isPending ? <ActivityIndicator color="#B91C1C" /> : <><Ionicons name="radio-outline" size={20} color="#B91C1C" /><Text style={styles.sosButtonText}>Send SOS alert</Text></>}</Pressable></View>
    {active && <View style={styles.active}><Ionicons name="bicycle-outline" size={19} color={Colors.primary} /><Text style={styles.activeText}>Report will be linked to delivery {String(active.id).slice(0, 8).toUpperCase()}</Text></View>}
    <Text style={styles.section}>Report a safety issue</Text>
    <View style={styles.grid}>{TYPES.map(([value, label, icon]) => <Pressable key={value} style={[styles.type, type === value && styles.typeSelected]} onPress={() => setType(value)}><Ionicons name={icon} size={21} color={type === value ? "#fff" : Colors.primary} /><Text style={[styles.typeText, type === value && { color: "#fff" }]}>{label}</Text></Pressable>)}</View>
    <TextInput multiline value={description} onChangeText={setDescription} placeholder="Describe what happened, where you are, and what help you need…" placeholderTextColor={Colors.textMuted} style={styles.input} />
    <Pressable disabled={description.trim().length < 5 || report.isPending} style={[styles.submit, description.trim().length < 5 && { opacity: .5 }]} onPress={() => report.mutate({})}><Text style={styles.submitText}>Send safety report</Text></Pressable>
    <Text style={styles.section}>Recent reports</Text>
    {incidents.slice(0, 5).map((incident) => <View key={incident.id} style={styles.row}><View style={styles.rowIcon}><Ionicons name="shield-checkmark-outline" size={19} color={Colors.primary} /></View><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{String(incident.type).replace(/_/g, " ")}</Text><Text style={styles.rowText}>{incident.status} · {new Date(incident.createdAt).toLocaleString()}</Text></View></View>)}
    {incidents.length === 0 && <Text style={styles.empty}>No safety reports submitted.</Text>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F7FB" }, content: { width: "100%", maxWidth: 900, alignSelf: "center", padding: 18, paddingTop: 58, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 }, back: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }, eyebrow: { color: Colors.primary, fontSize: 9, letterSpacing: 1.3, fontFamily: "Inter_700Bold" }, title: { color: Colors.text, fontSize: 23, fontFamily: "Inter_700Bold" },
  sosCard: { backgroundColor: "#B91C1C", borderRadius: 24, padding: 20, alignItems: "center" }, sosTitle: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 21, marginTop: 8 }, sosText: { color: "#FEE2E2", textAlign: "center", fontSize: 12, lineHeight: 18, marginTop: 6, maxWidth: 420 }, sosButton: { backgroundColor: "#fff", borderRadius: 14, minHeight: 49, alignSelf: "stretch", marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, sosButtonText: { color: "#B91C1C", fontFamily: "Inter_700Bold" },
  active: { flexDirection: "row", gap: 8, backgroundColor: Colors.primaryLight, borderRadius: 14, padding: 12, marginTop: 12 }, activeText: { flex: 1, color: Colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 12 }, section: { color: Colors.text, fontFamily: "Inter_700Bold", fontSize: 17, marginTop: 22, marginBottom: 10 }, grid: { flexDirection: "row", flexWrap: "wrap", gap: 9 }, type: { flexGrow: 1, flexBasis: 160, minHeight: 76, backgroundColor: "#fff", borderRadius: 16, padding: 13, borderWidth: 1, borderColor: "#E2E8F0", gap: 7 }, typeSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary }, typeText: { color: Colors.text, fontFamily: "Inter_600SemiBold", fontSize: 12 }, input: { minHeight: 120, backgroundColor: "#fff", borderRadius: 16, padding: 14, color: Colors.text, textAlignVertical: "top", marginTop: 12, borderWidth: 1, borderColor: "#E2E8F0" }, submit: { height: 50, borderRadius: 14, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", marginTop: 10 }, submitText: { color: "#fff", fontFamily: "Inter_700Bold" }, row: { flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: "#fff", padding: 13, borderRadius: 15, marginBottom: 8 }, rowIcon: { width: 38, height: 38, backgroundColor: Colors.primaryLight, borderRadius: 12, alignItems: "center", justifyContent: "center" }, rowTitle: { color: Colors.text, textTransform: "capitalize", fontFamily: "Inter_700Bold", fontSize: 13 }, rowText: { color: Colors.textMuted, textTransform: "capitalize", fontSize: 11, marginTop: 3 }, empty: { color: Colors.textMuted, textAlign: "center", backgroundColor: "#fff", borderRadius: 14, padding: 16 },
});
