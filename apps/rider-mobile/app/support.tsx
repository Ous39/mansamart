import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiRequest, queryClient } from "@/lib/query-client";
import { readableError } from "@/lib/errors";
import { safeBack } from "@/lib/navigation";

export default function RiderSupportScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const [subject, setSubject] = useState(orderId ? `Delivery issue — order ${String(orderId).slice(0, 8).toUpperCase()}` : "");
  const [message, setMessage] = useState("");
  const { data: tickets = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/support/tickets"] });
  const create = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/support/tickets", { subject: subject.trim(), message: message.trim(), priority: orderId ? "high" : "normal" })).json(),
    onSuccess: () => { setSubject(""); setMessage(""); queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] }); Alert.alert("Support request sent", "MansaMart operations can now review your rider issue."); },
    onError: (error) => Alert.alert("Could not send", readableError(error, "Check the details and try again.")),
  });
  const valid = subject.trim().length >= 3 && message.trim().length >= 10;

  return <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><Pressable style={styles.iconBtn} onPress={() => safeBack("/(rider)")}><Ionicons name="chevron-back" size={23} color={Colors.text} /></Pressable><View style={styles.flex}><Text style={styles.eyebrow}>RIDER SAFETY</Text><Text style={styles.title}>Support</Text></View><Pressable style={styles.iconBtn} onPress={() => router.push("/(rider)/deliveries" as any)}><Ionicons name="bicycle-outline" size={21} color={Colors.primary} /></Pressable></View>
    <View style={styles.alertCard}><Ionicons name="alert-circle-outline" size={24} color="#B45309" /><View style={styles.flex}><Text style={styles.alertTitle}>For an emergency</Text><Text style={styles.alertText}>Move to a safe place first, then contact local emergency services. Use this form for platform, payment, customer, or delivery issues.</Text></View></View>
    <View style={styles.card}><Text style={styles.cardTitle}>Create a support ticket</Text><Text style={styles.label}>Subject</Text><TextInput style={styles.input} value={subject} onChangeText={setSubject} placeholder="What went wrong?" placeholderTextColor={Colors.textMuted} /><Text style={styles.label}>Details</Text><TextInput style={[styles.input, styles.textArea]} value={message} onChangeText={setMessage} placeholder="Explain the issue, location, and what help you need" placeholderTextColor={Colors.textMuted} multiline textAlignVertical="top" /><Pressable disabled={!valid || create.isPending} style={[styles.sendButton, (!valid || create.isPending) && { opacity: .5 }]} onPress={() => create.mutate()}>{create.isPending ? <ActivityIndicator color="#fff" /> : <><Ionicons name="send-outline" size={18} color="#fff" /><Text style={styles.sendText}>Send to operations</Text></>}</Pressable></View>
    <Text style={styles.sectionTitle}>Your recent tickets</Text>
    {isLoading ? <ActivityIndicator color={Colors.primary} /> : tickets.slice(0, 12).map((ticket: any) => <View key={ticket.id} style={styles.ticket}><View style={styles.ticketTop}><Text style={styles.ticketTitle}>{ticket.subject}</Text><Text style={styles.status}>{ticket.status || "open"}</Text></View><Text style={styles.ticketMessage} numberOfLines={3}>{ticket.message}</Text><Text style={styles.ticketDate}>{ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : ""}</Text></View>)}
    {!isLoading && tickets.length === 0 && <Text style={styles.empty}>You have no support tickets.</Text>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F7FB" }, content: { padding: 18, paddingTop: 58, paddingBottom: 40 }, flex: { flex: 1 }, header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 }, iconBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E2E8F0" }, eyebrow: { color: Colors.primary, fontSize: 9, letterSpacing: 1.3, fontFamily: "Inter_700Bold" }, title: { color: Colors.text, fontSize: 23, fontFamily: "Inter_700Bold", marginTop: 2 },
  alertCard: { flexDirection: "row", gap: 11, backgroundColor: "#FFFBEB", borderWidth: 1, borderColor: "#FDE68A", borderRadius: 17, padding: 15, marginBottom: 14 }, alertTitle: { color: "#92400E", fontFamily: "Inter_700Bold", fontSize: 14 }, alertText: { color: "#A16207", fontSize: 12, lineHeight: 18, marginTop: 3 }, card: { backgroundColor: "#fff", borderRadius: 20, padding: 17, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 22 }, cardTitle: { color: Colors.text, fontFamily: "Inter_700Bold", fontSize: 17, marginBottom: 14 }, label: { color: Colors.textSecondary, fontFamily: "Inter_600SemiBold", fontSize: 12, marginBottom: 7 }, input: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 13, paddingHorizontal: 13, minHeight: 48, color: Colors.text, fontFamily: "Inter_500Medium", marginBottom: 13 }, textArea: { minHeight: 120, paddingTop: 13 }, sendButton: { height: 49, borderRadius: 13, backgroundColor: Colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, sendText: { color: "#fff", fontFamily: "Inter_700Bold" },
  sectionTitle: { color: Colors.text, fontFamily: "Inter_700Bold", fontSize: 17, marginBottom: 10 }, ticket: { backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 9 }, ticketTop: { flexDirection: "row", justifyContent: "space-between", gap: 10 }, ticketTitle: { flex: 1, color: Colors.text, fontFamily: "Inter_700Bold", fontSize: 13 }, status: { color: Colors.primary, textTransform: "capitalize", backgroundColor: Colors.primaryLight, borderRadius: 10, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontFamily: "Inter_700Bold" }, ticketMessage: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 7 }, ticketDate: { color: Colors.textMuted, fontSize: 10, marginTop: 7 }, empty: { color: Colors.textMuted, textAlign: "center", padding: 18 },
});
