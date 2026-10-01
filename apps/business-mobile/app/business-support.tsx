import React from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";

const TOPICS = ["Orders", "Bookings", "Payments", "Payouts", "Verification", "Account", "Other"];

export default function BusinessSupportScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [topic, setTopic] = React.useState(TOPICS[0]);
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [priority, setPriority] = React.useState<"low" | "normal" | "high">("normal");
  const { data: tickets = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/support/tickets"] });
  const submit = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/support/tickets", { subject: `${topic}: ${subject.trim()}`, message: message.trim(), priority });
      return response.json();
    },
    onSuccess: async () => {
      setSubject(""); setMessage(""); setPriority("normal");
      await qc.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      Alert.alert("Ticket created", "MansaMart support received your request. Status updates will appear below.");
    },
    onError: (error: any) => Alert.alert("Ticket not created", error?.message || "Please try again."),
  });
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const canSubmit = subject.trim().length >= 3 && message.trim().length >= 10 && !submit.isPending;

  return <View style={styles.container}>
    <Stack.Screen options={{ headerShown: false }} />
    <View style={[styles.header, { paddingTop: topPad + 12 }]}><Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={Colors.text} /></Pressable><View style={{ flex: 1 }}><Text style={styles.title}>Business Support</Text><Text style={styles.subtitle}>Secure help for marketplace operations</Text></View></View>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.notice}><Ionicons name="shield-checkmark-outline" size={22} color={Colors.primary} /><Text style={styles.noticeText}>Use a ticket for verification, order, booking, payment, or payout details. Never include a password, PIN, API key, or one-time code.</Text></View>
      <Text style={styles.label}>Topic</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{TOPICS.map((value) => <Pressable key={value} style={[styles.chip, topic === value && styles.chipActive]} onPress={() => setTopic(value)}><Text style={[styles.chipText, topic === value && styles.chipTextActive]}>{value}</Text></Pressable>)}</ScrollView>
      <Text style={styles.label}>Subject</Text><TextInput style={styles.input} value={subject} onChangeText={setSubject} placeholder="Short summary" placeholderTextColor={Colors.textMuted} maxLength={120} />
      <Text style={styles.label}>Details</Text><TextInput style={styles.messageInput} value={message} onChangeText={setMessage} placeholder="Include relevant order or booking numbers" placeholderTextColor={Colors.textMuted} multiline maxLength={4000} />
      <Text style={styles.label}>Priority</Text><View style={styles.priorityRow}>{(["low", "normal", "high"] as const).map((value) => <Pressable key={value} style={[styles.priority, priority === value && styles.chipActive]} onPress={() => setPriority(value)}><Text style={[styles.chipText, priority === value && styles.chipTextActive]}>{value}</Text></Pressable>)}</View>
      <Pressable style={[styles.submit, !canSubmit && { opacity: 0.5 }]} disabled={!canSubmit} onPress={() => submit.mutate()}>{submit.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Send to Support</Text>}</Pressable>
      <View style={styles.sectionRow}><Text style={styles.sectionTitle}>Your Tickets</Text><Text style={styles.count}>{tickets.length}</Text></View>
      {isLoading ? <ActivityIndicator color={Colors.primary} /> : tickets.length === 0 ? <Text style={styles.empty}>No support tickets yet.</Text> : tickets.map((ticket) => <View key={ticket.id} style={styles.ticket}><View style={styles.ticketTop}><Text style={styles.ticketTitle}>{ticket.subject}</Text><Text style={styles.ticketStatus}>{ticket.status}</Text></View><Text style={styles.ticketMessage}>{ticket.message}</Text><Text style={styles.ticketDate}>#{String(ticket.id).slice(0, 8).toUpperCase()} • {new Date(ticket.createdAt).toLocaleDateString("en-GB")}</Text></View>)}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background }, header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: Colors.surface }, title: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text }, subtitle: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted }, content: { padding: 16 },
  notice: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 14, backgroundColor: Colors.primaryLight, marginBottom: 12 }, noticeText: { flex: 1, fontSize: 11, lineHeight: 17, color: Colors.textSecondary, fontFamily: "Inter_400Regular" }, label: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.textSecondary, marginTop: 12, marginBottom: 7 }, chips: { gap: 7 }, chip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface }, chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary }, chipText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, textTransform: "capitalize" }, chipTextActive: { color: "#fff" },
  input: { height: 46, paddingHorizontal: 13, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, color: Colors.text, backgroundColor: Colors.surface }, messageInput: { height: 110, padding: 13, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, color: Colors.text, backgroundColor: Colors.surface, textAlignVertical: "top" }, priorityRow: { flexDirection: "row", gap: 8 }, priority: { flex: 1, alignItems: "center", padding: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface }, submit: { height: 50, marginTop: 16, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: Colors.primary }, submitText: { color: "#fff", fontFamily: "Inter_700Bold" },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 24, marginBottom: 10 }, sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text }, count: { fontSize: 11, color: Colors.primary, fontFamily: "Inter_700Bold", backgroundColor: Colors.primaryLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }, empty: { textAlign: "center", color: Colors.textMuted, padding: 25 }, ticket: { padding: 14, gap: 7, borderRadius: 14, backgroundColor: Colors.surface, marginBottom: 9 }, ticketTop: { flexDirection: "row", gap: 10 }, ticketTitle: { flex: 1, fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.text }, ticketStatus: { color: Colors.primary, textTransform: "capitalize", fontSize: 10, fontFamily: "Inter_700Bold" }, ticketMessage: { fontSize: 12, lineHeight: 18, color: Colors.textSecondary }, ticketDate: { fontSize: 10, color: Colors.textMuted },
});
