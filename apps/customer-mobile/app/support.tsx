import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";

const TOPICS = ["Order help", "Payment", "Delivery", "Booking", "Account", "Other"];

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { isAuthenticated } = useAuth();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const [showForm, setShowForm] = useState(false);
  const [topic, setTopic] = useState(TOPICS[0]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");

  const { data: ticketData, isLoading } = useQuery<any[]>({ queryKey: ["/api/support/tickets"], enabled: isAuthenticated });
  const tickets = ticketData ?? [];
  const submit = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/support/tickets", {
        subject: `${topic}: ${subject.trim()}`,
        message: message.trim(),
        priority,
      });
      return response.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      setSubject("");
      setMessage("");
      setPriority("normal");
      setShowForm(false);
      Alert.alert("Ticket created", "Support has received your request. Updates will appear here.");
    },
    onError: (error: any) => Alert.alert("Ticket not created", cleanError(error)),
  });

  const canSubmit = subject.trim().length >= 3 && message.trim().length >= 10 && !submit.isPending;

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <Pressable onPress={() => router.back()} hitSlop={8}><Ionicons name="arrow-back" size={24} color={Colors.text} /></Pressable>
          <Text style={styles.title}>Help & Support</Text>
        </View>
        <View style={styles.empty}>
          <Ionicons name="person-circle-outline" size={52} color={Colors.textMuted} />
          <Text style={styles.contactTitle}>Sign in to contact support</Text>
          <Pressable style={styles.submit} onPress={() => router.push("/(auth)/login")}><Text style={styles.submitText}>Sign In</Text></Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Ionicons name="arrow-back" size={24} color={Colors.text} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Help & Support</Text>
          <Text style={styles.subtitle}>Orders, payments, delivery, bookings, and accounts</Text>
        </View>
        <Pressable style={styles.newButton} onPress={() => setShowForm(true)}><Ionicons name="add" size={20} color="#fff" /></Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.quickGrid}>
          <QuickAction icon="receipt-outline" label="Orders" onPress={() => router.push({ pathname: "/(tabs)/wishlist", params: { tab: "history" } })} />
          <QuickAction icon="return-down-back-outline" label="Returns" onPress={() => router.push("/returns")} />
          <QuickAction icon="calendar-outline" label="Bookings" onPress={() => router.push({ pathname: "/(tabs)/wishlist", params: { tab: "bookings" } })} />
        </View>

        <View style={styles.contactCard}>
          <View style={styles.contactIcon}><Ionicons name="mail-outline" size={22} color={Colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.contactTitle}>Need direct assistance?</Text>
            <Text style={styles.contactText}>Create a ticket for the safest way to share order details. For general questions, email support.</Text>
          </View>
          <Pressable onPress={() => Linking.openURL("mailto:support@mansamart.gm")}><Ionicons name="open-outline" size={20} color={Colors.primary} /></Pressable>
        </View>

        <Text style={styles.sectionTitle}>Common questions</Text>
        <Faq question="When is an order paid?" answer="MansaMart confirms payment only after a valid Wave notification reaches the server. Returning from Wave alone does not mark an order paid." />
        <Faq question="How do I track delivery?" answer="Open My Orders, choose the order, and view its timeline. Live rider location appears only during an active delivery." />
        <Faq question="How do returns work?" answer="Eligible delivered orders can be submitted within the displayed 7-day window. Support reviews the item and payment before approving a refund." />

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Your tickets</Text>
          <Text style={styles.count}>{tickets.length}</Text>
        </View>
        {isLoading ? <ActivityIndicator color={Colors.primary} /> : tickets.length === 0 ? (
          <View style={styles.empty}><Ionicons name="chatbubbles-outline" size={38} color={Colors.textMuted} /><Text style={styles.emptyText}>No support tickets yet</Text></View>
        ) : tickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)}
      </ScrollView>

      {showForm && (
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowForm(false)} />
          <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Create support ticket</Text>
            <Text style={styles.label}>Topic</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {TOPICS.map((item) => (
                <Pressable key={item} style={[styles.chip, topic === item && styles.chipActive]} onPress={() => setTopic(item)}>
                  <Text style={[styles.chipText, topic === item && styles.chipTextActive]}>{item}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.label}>Subject</Text>
            <TextInput style={styles.subjectInput} value={subject} onChangeText={setSubject} placeholder="Short summary" placeholderTextColor={Colors.textMuted} maxLength={120} />
            <Text style={styles.label}>Details</Text>
            <TextInput style={styles.messageInput} value={message} onChangeText={setMessage} placeholder="Include any relevant order or booking number" placeholderTextColor={Colors.textMuted} multiline maxLength={4000} />
            <Text style={styles.label}>Priority</Text>
            <View style={styles.priorityRow}>
              {(["low", "normal", "high"] as const).map((item) => (
                <Pressable key={item} style={[styles.priorityButton, priority === item && styles.priorityActive]} onPress={() => setPriority(item)}>
                  <Text style={[styles.priorityText, priority === item && styles.chipTextActive]}>{item}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={[styles.submit, !canSubmit && styles.disabled]} disabled={!canSubmit} onPress={() => submit.mutate()}>
              {submit.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Send to Support</Text>}
            </Pressable>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function QuickAction({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return <Pressable style={styles.quick} onPress={onPress}><Ionicons name={icon as any} size={22} color={Colors.primary} /><Text style={styles.quickText}>{label}</Text></Pressable>;
}

function Faq({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return <Pressable style={styles.faq} onPress={() => setOpen(!open)}><View style={styles.faqTop}><Text style={styles.faqQuestion}>{question}</Text><Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={Colors.textMuted} /></View>{open && <Text style={styles.faqAnswer}>{answer}</Text>}</Pressable>;
}

function TicketCard({ ticket }: { ticket: any }) {
  const closed = ticket.status === "closed" || ticket.status === "resolved";
  const color = closed ? Colors.success : ticket.priority === "high" ? Colors.error : "#D97706";
  return <View style={styles.ticket}><View style={styles.ticketTop}><Text style={styles.ticketTitle}>{ticket.subject}</Text><View style={[styles.status, { backgroundColor: `${color}18` }]}><Text style={[styles.statusText, { color }]}>{ticket.status}</Text></View></View><Text style={styles.ticketMessage} numberOfLines={2}>{ticket.message}</Text><Text style={styles.ticketDate}>#{String(ticket.id).slice(0, 8).toUpperCase()} • {new Date(ticket.createdAt).toLocaleDateString("en-GB")}</Text></View>;
}

function cleanError(error: any) {
  const message = String(error?.message || "Please try again.").replace(/^\d+:\s*/, "");
  try { return JSON.parse(message).message || message; } catch { return message; }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  newButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 10 },
  quickGrid: { flexDirection: "row", gap: 9 },
  quick: { flex: 1, gap: 7, alignItems: "center", paddingVertical: 15, borderRadius: 14, backgroundColor: Colors.surface },
  quickText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.text },
  contactCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 15, borderRadius: 15, backgroundColor: Colors.primaryLight },
  contactIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: Colors.surface },
  contactTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.text },
  contactText: { fontSize: 11, lineHeight: 17, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text, marginTop: 8 },
  faq: { padding: 14, borderRadius: 14, backgroundColor: Colors.surface },
  faqTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  faqQuestion: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text },
  faqAnswer: { fontSize: 12, lineHeight: 19, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 10 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  count: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9, backgroundColor: Colors.primaryLight, fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.primary },
  empty: { alignItems: "center", gap: 8, padding: 28, borderRadius: 15, backgroundColor: Colors.surface },
  emptyText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  ticket: { gap: 7, padding: 15, borderRadius: 15, backgroundColor: Colors.surface },
  ticketTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  ticketTitle: { flex: 1, fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.text },
  ticketMessage: { fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  ticketDate: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  status: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontFamily: "Inter_700Bold", textTransform: "capitalize" },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.36)" },
  sheet: { maxHeight: "88%", padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: Colors.surface },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginBottom: 18 },
  sheetTitle: { fontSize: 19, fontFamily: "Inter_700Bold", color: Colors.text },
  label: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.textSecondary, marginTop: 14, marginBottom: 8 },
  chips: { gap: 7 },
  chip: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  chipTextActive: { color: "#fff" },
  subjectInput: { height: 46, paddingHorizontal: 13, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, color: Colors.text, backgroundColor: Colors.background },
  messageInput: { height: 115, padding: 13, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, color: Colors.text, backgroundColor: Colors.background, textAlignVertical: "top" },
  priorityRow: { flexDirection: "row", gap: 8 },
  priorityButton: { flex: 1, alignItems: "center", padding: 11, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  priorityActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  priorityText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, textTransform: "capitalize" },
  submit: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: Colors.primary, marginTop: 18 },
  submitText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  disabled: { opacity: 0.5 },
});
