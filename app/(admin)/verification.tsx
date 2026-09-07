import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, Platform,
  ActivityIndicator, Alert, TextInput, Modal,
} from "react-native";
import { router, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import { getToken } from "@/lib/auth-token";
import { safeBack } from "@/lib/navigation";

async function apiCall(path: string, method: string, body?: any) {
  const token = getToken();
  const r = await fetch(new URL(path, getApiUrl()).toString(), {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || "Failed"); }
  return r.json();
}


type VerificationKind = "vendor" | "provider" | "rider" | "personal" | "profile_change" | "personal_change";

function safeVerificationType(item: any): VerificationKind {
  if (item?.type === "profile_change") return "profile_change";
  if (item?.type === "personal_change") return "personal_change";
  if (item?.type === "personal") return "personal";
  if (item?.type === "rider") return "rider";
  return item?.type === "provider" ? "provider" : "vendor";
}

function isChangeType(item: any) {
  const t = safeVerificationType(item);
  return t === "profile_change" || t === "personal_change";
}

function displayType(item: any) {
  const t = safeVerificationType(item);
  if (t === "profile_change") return "Vendor Change";
  if (t === "personal_change") return "Personal Change";
  if (t === "personal") return "Personal";
  if (t === "rider") return "Rider";
  return t === "vendor" ? "Vendor" : "Provider";
}

function safeProfileName(item: any): string {
  return item?.storeName || item?.displayName || item?.businessName || item?.user?.name || "Unnamed account";
}

function safeUserName(item: any): string {
  return item?.user?.name || item?.name || "Unknown user";
}

function safeUserEmail(item: any): string {
  return item?.user?.email || item?.email || "No email";
}


function typeColors(item: any) {
  const t = safeVerificationType(item);
  if (isChangeType(item)) return { bg: "#F59E0B20", fg: "#B45309", icon: "create-outline" as const };
  if (t === "vendor") return { bg: "#2563EB20", fg: "#2563EB", icon: "storefront-outline" as const };
  if (t === "rider") return { bg: "#E8813A20", fg: "#E8813A", icon: "bicycle-outline" as const };
  if (t === "personal") return { bg: "#0EA47A20", fg: "#0EA47A", icon: "person-circle-outline" as const };
  return { bg: "#7B4FA320", fg: "#7B4FA3", icon: "construct-outline" as const };
}

function safeDate(value: any): string {
  if (!value) return "No date";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "No date";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function VerificationScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const qc = useQueryClient();
  const [modalItem, setModalItem] = useState<any>(null);
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState<"all" | "vendor" | "provider" | "rider" | "personal" | "profile_change" | "personal_change">("all");

  const { data: verificationPending = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/admin/verifications"],
    refetchInterval: 30000,
  });

  const { data: changeRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/vendor-profile-change-requests"],
    refetchInterval: 30000,
  });

  const { data: personalChangeRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/personal-profile-change-requests"],
    refetchInterval: 30000,
  });

  const reviewChange = useMutation({
    mutationFn: ({ userId, action, note, type }: any) => apiCall(type === "personal_change" ? `/api/admin/personal-profile-change/${userId}` : `/api/admin/vendor-profile-change/${userId}`, "PUT", { action, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/vendor-profile-change-requests"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/personal-profile-change-requests"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/vendors"] });
      Alert.alert("Saved", "Vendor profile change decision saved.");
      setModalItem(null);
      setNote("");
    },
    onError: (e: any) => Alert.alert("Error", e.message),
  });

  const verify = useMutation({
    mutationFn: ({ type, userId, status, note }: any) =>
      apiCall(`/api/admin/verify/${type}/${userId}`, "PUT", { status, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/verifications"] });
      Alert.alert("✅", "Verification decision saved!");
      setModalItem(null);
      setNote("");
    },
    onError: (e: any) => Alert.alert("Error", e.message),
  });

  const safeVerifications = Array.isArray(verificationPending) ? verificationPending.filter(Boolean) : [];
  const safeChanges = Array.isArray(changeRequests) ? changeRequests.filter(Boolean).map((x: any) => ({ ...x, type: "profile_change" })) : [];
  const safePersonalChanges = Array.isArray(personalChangeRequests) ? personalChangeRequests.filter(Boolean).map((x: any) => ({ ...x, type: "personal_change", userId: x.userId || x.id })) : [];
  const safePending = [...safeVerifications, ...safeChanges, ...safePersonalChanges];
  const filtered = filter === "all" ? safePending : safePending.filter((p: any) => safeVerificationType(p) === filter);

  return (
    <View style={{ flex: 1, backgroundColor: "#F7F8FA" }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Pressable onPress={() => safeBack("/(admin)")} style={styles.back}><Ionicons name="arrow-back" size={24} color="#1A1A2E" /></Pressable>
        <Text style={styles.headerTitle}>Verification Queue</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{safePending.length}</Text>
        </View>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterBar}>
        {(["all", "vendor", "provider", "rider", "personal", "profile_change", "personal_change"] as const).map(f => (
          <Pressable key={f} onPress={() => setFilter(f)} style={[styles.filterTab, filter === f && styles.filterTabActive]}>
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f === "profile_change" ? "Vendor Changes" : f === "personal_change" ? "Personal Changes" : f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== "all" && ` (${safePending.filter((p: any) => safeVerificationType(p) === f).length})`}
              {f === "all" && ` (${safePending.length})`}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="checkmark-circle-outline" size={72} color="#0EA47A" />
          <Text style={styles.emptyTitle}>All Clear!</Text>
          <Text style={styles.emptyDesc}>No pending {filter !== "all" ? filter : ""} verifications</Text>
          <Pressable onPress={() => refetch()} style={styles.refreshBtn}>
            <Ionicons name="refresh-outline" size={16} color={Colors.primary} />
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, index) => String(item?.id ?? item?.userId ?? index)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.typeTag, { backgroundColor: typeColors(item).bg }]}>
                  <Ionicons
                    name={typeColors(item).icon}
                    size={13}
                    color={typeColors(item).fg}
                  />
                  <Text style={[styles.typeTagText, { color: typeColors(item).fg }]}>
                    {displayType(item)}
                  </Text>
                </View>
                <Text style={styles.cardDate}>{safeDate(item?.createdAt)}</Text>
              </View>

              <Text style={styles.cardName}>{safeProfileName(item)}</Text>
              <Text style={styles.cardUser}>
                <Ionicons name="person-outline" size={12} color="#888" /> {safeUserName(item)} • {safeUserEmail(item)}
              </Text>
              {item?.location ? (
                <Text style={styles.cardLocation}>
                  <Ionicons name="location-outline" size={12} color="#888" /> {item?.location}
                </Text>
              ) : null}
              {item?.description || item?.bio ? (
                <Text style={styles.cardDesc} numberOfLines={2}>{item?.description || item?.bio}</Text>
              ) : null}

              {isChangeType(item) && item?.pendingProfileChanges ? (
                <View style={styles.changeBox}>
                  <Text style={styles.changeTitle}>Requested changes</Text>
                  {Object.keys(item.pendingProfileChanges || {}).slice(0, 8).map(k => <Text key={k} style={styles.changeLine}>• {k}</Text>)}
                </View>
              ) : null}

              <View style={styles.cardActions}>
                <Pressable
                  style={[styles.actionBtn, styles.rejectBtn]}
                  onPress={() => { setModalItem(item); setNote(""); }}
                >
                  <Ionicons name="close" size={16} color="#E63946" />
                  <Text style={styles.rejectBtnText}>Review</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, styles.approveBtn]}
                  onPress={() => {
                    Alert.alert(
                      "Approve",
                      `Verify ${safeProfileName(item)}?`,
                      [
                        { text: "Cancel" },
                        {
                          text: "Approve", onPress: () =>
                            isChangeType(item)
                              ? reviewChange.mutate({ userId: item?.userId || item?.id, action: "approve", type: safeVerificationType(item) })
                              : verify.mutate({ type: safeVerificationType(item), userId: item?.userId || item?.id, status: "verified" }),
                        },
                      ]
                    );
                  }}
                  disabled={verify.isPending}
                >
                  {verify.isPending
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <>
                        <Ionicons name="checkmark" size={16} color="#fff" />
                        <Text style={styles.approveBtnText}>Approve</Text>
                      </>
                  }
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      {/* Review/Reject Modal */}
      <Modal visible={!!modalItem} transparent animationType="slide" onRequestClose={() => setModalItem(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Review: {safeProfileName(modalItem)}</Text>
            <Text style={styles.modalLabel}>Note (optional)</Text>
            <TextInput
              style={styles.modalInput}
              value={note}
              onChangeText={setNote}
              placeholder="Reason for rejection or additional notes..."
              multiline
              placeholderTextColor="#bbb"
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setModalItem(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalReject}
                onPress={() => isChangeType(modalItem) ? reviewChange.mutate({ userId: modalItem?.userId || modalItem?.id, action: "reject", note, type: safeVerificationType(modalItem) }) : verify.mutate({ type: safeVerificationType(modalItem), userId: modalItem?.userId || modalItem?.id, status: "rejected", note })}
                disabled={verify.isPending}
              >
                {verify.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalRejectText}>Reject</Text>}
              </Pressable>
              <Pressable
                style={styles.modalApprove}
                onPress={() => isChangeType(modalItem) ? reviewChange.mutate({ userId: modalItem?.userId || modalItem?.id, action: "approve", note, type: safeVerificationType(modalItem) }) : verify.mutate({ type: safeVerificationType(modalItem), userId: modalItem?.userId || modalItem?.id, status: "verified", note })}
                disabled={verify.isPending}
              >
                {verify.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalApproveText}>Approve</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  back: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#1A1A2E" },
  countBadge: { backgroundColor: "#E63946", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, minWidth: 28, alignItems: "center" },
  countText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  filterBar: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  filterTab: { flex: 1, alignItems: "center", paddingVertical: 13 },
  filterTabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  filterTabText: { fontSize: 13, color: "#888", fontWeight: "600" },
  filterTabTextActive: { color: Colors.primary, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyTitle: { fontSize: 22, fontWeight: "800", color: "#1A1A2E", marginTop: 16 },
  emptyDesc: { fontSize: 14, color: "#888", marginTop: 8, textAlign: "center" },
  refreshBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16, padding: 12 },
  refreshBtnText: { color: Colors.primary, fontWeight: "700" },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  typeTag: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  typeTagText: { fontSize: 12, fontWeight: "700" },
  cardDate: { fontSize: 12, color: "#aaa" },
  cardName: { fontSize: 17, fontWeight: "800", color: "#1A1A2E", marginBottom: 4 },
  cardUser: { fontSize: 13, color: "#888", marginBottom: 4 },
  cardLocation: { fontSize: 12, color: "#aaa", marginBottom: 6 },
  cardDesc: { fontSize: 13, color: "#555", lineHeight: 18, marginBottom: 12 },
  changeBox: { backgroundColor: "#FFF7ED", borderRadius: 12, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: "#FED7AA" },
  changeTitle: { fontSize: 12, fontWeight: "800", color: "#92400E", marginBottom: 4 },
  changeLine: { fontSize: 12, color: "#92400E", marginTop: 2 },
  cardActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, paddingVertical: 11 },
  rejectBtn: { backgroundColor: "#FFF0F0", borderWidth: 1, borderColor: "#FFCCCC" },
  rejectBtnText: { color: "#E63946", fontWeight: "700", fontSize: 14 },
  approveBtn: { backgroundColor: Colors.primary },
  approveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalTitle: { fontSize: 17, fontWeight: "800", color: "#1A1A2E" },
  modalLabel: { fontSize: 13, fontWeight: "600", color: "#555" },
  modalInput: { backgroundColor: "#F7F8FA", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 80, fontSize: 14, color: "#1A1A2E", textAlignVertical: "top" },
  modalActions: { flexDirection: "row", gap: 8 },
  modalCancel: { flex: 1, backgroundColor: "#F7F8FA", borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  modalCancelText: { fontWeight: "700", color: "#666" },
  modalReject: { flex: 1, backgroundColor: "#E63946", borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  modalRejectText: { color: "#fff", fontWeight: "700" },
  modalApprove: { flex: 1, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  modalApproveText: { color: "#fff", fontWeight: "700" },
});
