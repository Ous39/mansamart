import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

const REASONS = ["Damaged item", "Wrong item", "Missing parts", "Not as described", "Changed my mind"];

export default function ReturnsScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { isAuthenticated } = useAuth();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const [orderId, setOrderId] = useState("");
  const [requestType, setRequestType] = useState<"return" | "refund">("return");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data: eligibleData, isLoading: eligibleLoading } = useQuery<any[]>({ queryKey: ["/api/customer/return-eligibility"], enabled: isAuthenticated });
  const { data: requestsData, isLoading: requestsLoading } = useQuery<any[]>({ queryKey: ["/api/customer/returns"], enabled: isAuthenticated });
  const eligible = useMemo(() => eligibleData ?? [], [eligibleData]);
  const requests = requestsData ?? [];
  const selectedOrder = useMemo(() => eligible.find((order) => order.id === orderId), [eligible, orderId]);

  const submit = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/customer/returns", { orderId, requestType, reason, details: details.trim() });
      return response.json();
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["/api/customer/returns"] }),
        qc.invalidateQueries({ queryKey: ["/api/customer/return-eligibility"] }),
      ]);
      setOrderId("");
      setReason("");
      setDetails("");
      setShowForm(false);
      Alert.alert("Request submitted", "MansaMart support will review your request and notify you of the decision.");
    },
    onError: (error: any) => Alert.alert("Request not submitted", cleanError(error)),
  });

  const canSubmit = !!orderId && !!reason && details.trim().length >= 10 && !submit.isPending;

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <Pressable onPress={() => router.back()} hitSlop={8}><Ionicons name="arrow-back" size={24} color={Colors.text} /></Pressable>
          <Text style={styles.title}>Returns & Refunds</Text>
        </View>
        <View style={styles.center}>
          <Ionicons name="person-circle-outline" size={52} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Sign in to manage returns</Text>
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
          <Text style={styles.title}>Returns & Refunds</Text>
          <Text style={styles.subtitle}>Eligible delivered orders have a 7-day request window</Text>
        </View>
        <Pressable
          style={[styles.newButton, eligible.length === 0 && styles.disabled]}
          onPress={() => setShowForm(true)}
          disabled={eligible.length === 0}
        >
          <Ionicons name="add" size={19} color="#fff" />
        </Pressable>
      </View>

      {(eligibleLoading || requestsLoading) ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.policyCard}>
            <Ionicons name="shield-checkmark-outline" size={22} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.policyTitle}>Protected request process</Text>
              <Text style={styles.policyText}>Submitting a request does not automatically issue a refund. Support checks the order, seller policy, payment, and item condition first.</Text>
            </View>
          </View>

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Your requests</Text>
            <Text style={styles.count}>{requests.length}</Text>
          </View>
          {requests.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="return-down-back-outline" size={42} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No return requests</Text>
              <Text style={styles.emptyText}>{eligible.length ? "Use the plus button to start a request." : "Eligible delivered orders will appear here."}</Text>
            </View>
          ) : requests.map((request) => (
            <View style={styles.requestCard} key={request.id}>
              <View style={styles.requestTop}>
                <View>
                  <Text style={styles.orderNumber}>Order #{String(request.orderId).slice(0, 8).toUpperCase()}</Text>
                  <Text style={styles.meta}>{request.requestType} • D {Number(request.orderTotal).toLocaleString()}</Text>
                </View>
                <StatusBadge status={request.status} />
              </View>
              <Text style={styles.reason}>{request.reason}</Text>
              {!!request.resolution && <Text style={styles.resolution}>{request.resolution}</Text>}
              <Text style={styles.date}>{new Date(request.createdAt).toLocaleDateString("en-GB")}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {showForm && (
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowForm(false)} />
          <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Start a request</Text>
            <Text style={styles.label}>Eligible order</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {eligible.map((order) => (
                <Pressable key={order.id} style={[styles.orderChip, orderId === order.id && styles.selectedChip]} onPress={() => setOrderId(order.id)}>
                  <Text style={[styles.chipTitle, orderId === order.id && styles.selectedText]}>#{String(order.id).slice(0, 8).toUpperCase()}</Text>
                  <Text style={[styles.chipMeta, orderId === order.id && styles.selectedText]}>D {Number(order.total).toLocaleString()}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {!!selectedOrder && <Text style={styles.deadline}>Request by {new Date(selectedOrder.returnBy).toLocaleDateString("en-GB")}</Text>}

            <Text style={styles.label}>Request type</Text>
            <View style={styles.typeRow}>
              {(["return", "refund"] as const).map((type) => (
                <Pressable key={type} style={[styles.typeButton, requestType === type && styles.typeActive]} onPress={() => setRequestType(type)}>
                  <Text style={[styles.typeText, requestType === type && styles.selectedText]}>{type === "return" ? "Return item" : "Request refund"}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Reason</Text>
            <View style={styles.reasonGrid}>
              {REASONS.map((item) => (
                <Pressable key={item} style={[styles.reasonChip, reason === item && styles.reasonActive]} onPress={() => setReason(item)}>
                  <Text style={[styles.reasonChipText, reason === item && { color: Colors.primary }]}>{item}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Details</Text>
            <TextInput
              style={styles.input}
              value={details}
              onChangeText={setDetails}
              placeholder="Describe the issue and the condition of the item"
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={2000}
            />
            <Pressable style={[styles.submit, !canSubmit && styles.disabled]} disabled={!canSubmit} onPress={() => submit.mutate()}>
              {submit.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit for Review</Text>}
            </Pressable>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const done = status === "completed" || status === "approved";
  const rejected = status === "rejected" || status === "cancelled";
  const color = done ? Colors.success : rejected ? Colors.error : "#D97706";
  return <View style={[styles.status, { backgroundColor: `${color}18` }]}><Text style={[styles.statusText, { color }]}>{status.replace(/_/g, " ")}</Text></View>;
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
  content: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  policyCard: { flexDirection: "row", gap: 12, backgroundColor: Colors.primaryLight, padding: 15, borderRadius: 15 },
  policyTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.text },
  policyText: { fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 3 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text },
  count: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.primary, backgroundColor: Colors.primaryLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9 },
  empty: { alignItems: "center", gap: 8, backgroundColor: Colors.surface, padding: 34, borderRadius: 16 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text },
  emptyText: { fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" },
  requestCard: { padding: 15, gap: 8, borderRadius: 15, backgroundColor: Colors.surface },
  requestTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  orderNumber: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.text },
  meta: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, textTransform: "capitalize", marginTop: 2 },
  status: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  statusText: { fontSize: 10, fontFamily: "Inter_700Bold", textTransform: "capitalize" },
  reason: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  resolution: { fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  date: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.36)" },
  sheet: { maxHeight: "88%", padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: Colors.surface },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginBottom: 18 },
  sheetTitle: { fontSize: 19, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 18 },
  label: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.textSecondary, marginTop: 14, marginBottom: 8 },
  chips: { gap: 8 },
  orderChip: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  selectedChip: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTitle: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.text },
  chipMeta: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  selectedText: { color: "#fff" },
  deadline: { fontSize: 10, color: Colors.textMuted, marginTop: 7 },
  typeRow: { flexDirection: "row", gap: 8 },
  typeButton: { flex: 1, padding: 12, borderRadius: 11, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  typeActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  reasonGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  reasonChip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  reasonActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  reasonChipText: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  input: { height: 105, padding: 13, borderRadius: 13, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, textAlignVertical: "top", color: Colors.text, fontFamily: "Inter_400Regular" },
  submit: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: Colors.primary, marginTop: 18 },
  submitText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  disabled: { opacity: 0.5 },
});
