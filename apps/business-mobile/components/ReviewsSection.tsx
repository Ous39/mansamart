import React, { useState } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/query-client";
import { getToken } from "@/lib/auth-token";

function Stars({ rating, size = 14, interactive = false, onSelect }: {
  rating: number; size?: number; interactive?: boolean; onSelect?: (r: number) => void;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Pressable key={i} onPress={() => interactive && onSelect?.(i)} disabled={!interactive}>
          <Ionicons
            name={i <= Math.round(rating) ? "star" : "star-outline"}
            size={size}
            color={i <= Math.round(rating) ? "#F59E0B" : "#D1D5DB"}
          />
        </Pressable>
      ))}
    </View>
  );
}

interface Props { targetId: string; targetType?: string; }

export function ReviewsSection({ targetId, targetType = "product" }: Props) {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");

  const { data: reviews = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/reviews/${targetType}/${targetId}`],
    queryFn: async () => {
      const r = await fetch(new URL(`/api/reviews/${targetType}/${targetId}`, getApiUrl()).toString());
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!targetId,
  });

  const submit = useMutation({
    mutationFn: async () => {
      const token = getToken();
      const r = await fetch(new URL(`/api/reviews/${targetType}/${targetId}`, getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rating, text }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message || "Failed"); }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/reviews/${targetType}/${targetId}`] });
      setText(""); setRating(5); setShowForm(false);
      Alert.alert("✅", "Review posted!");
    },
    onError: (e: any) => Alert.alert("Error", e.message),
  });

  const markHelpful = useMutation({
    mutationFn: async (reviewId: string) => {
      const token = getToken();
      const r = await fetch(new URL(`/api/reviews/${reviewId}/helpful`, getApiUrl()).toString(), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/reviews/${targetType}/${targetId}`] }),
  });

  const avgRating = reviews.length > 0
    ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length : 0;
  const ratingDist: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach(r => { if (ratingDist[r.rating] !== undefined) ratingDist[r.rating]++; });

  function fmt(d: string) {
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <View style={styles.summaryLeft}>
          <Text style={styles.avgNum}>{avgRating > 0 ? avgRating.toFixed(1) : "—"}</Text>
          <Stars rating={avgRating} size={16} />
          <Text style={styles.reviewCount}>{reviews.length} review{reviews.length !== 1 ? "s" : ""}</Text>
        </View>
        <View style={styles.summaryBars}>
          {[5, 4, 3, 2, 1].map(star => {
            const cnt = ratingDist[star] || 0;
            const pct = reviews.length > 0 ? (cnt / reviews.length) * 100 : 0;
            return (
              <View key={star} style={styles.barRow}>
                <Text style={styles.barLabel}>{star}</Text>
                <Ionicons name="star" size={10} color="#F59E0B" />
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${pct}%` as any }]} />
                </View>
                <Text style={styles.barCount}>{cnt}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {isAuthenticated && !showForm && (
        <Pressable style={styles.writeBtn} onPress={() => setShowForm(true)}>
          <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
          <Text style={styles.writeBtnText}>Write a Review</Text>
        </Pressable>
      )}

      {showForm && (
        <View style={styles.form}>
          <Text style={styles.formTitle}>Your Review</Text>
          <Text style={styles.formLabel}>Rating</Text>
          <Stars rating={rating} size={28} interactive onSelect={setRating} />
          <Text style={[styles.formLabel, { marginTop: 10 }]}>Comment</Text>
          <TextInput
            style={styles.formInput}
            value={text}
            onChangeText={setText}
            placeholder="Share your experience with this product..."
            multiline
            placeholderTextColor="#bbb"
          />
          <View style={styles.formBtns}>
            <Pressable style={styles.cancelBtn} onPress={() => setShowForm(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.submitBtn, (!text || text.length < 5) && { opacity: 0.5 }]}
              onPress={() => submit.mutate()}
              disabled={submit.isPending || !text || text.length < 5}
            >
              {submit.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.submitBtnText}>Post</Text>}
            </Pressable>
          </View>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator style={{ marginVertical: 20 }} color={Colors.primary} />
      ) : reviews.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubble-outline" size={36} color="#ccc" />
          <Text style={styles.emptyText}>No reviews yet — be the first!</Text>
        </View>
      ) : (
        reviews.map(rev => (
          <View key={rev.id} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{rev.name?.[0]?.toUpperCase() || "?"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.reviewMeta}>
                  <Text style={styles.reviewerName}>{rev.name}</Text>
                  {rev.verified && (
                    <View style={styles.verifiedChip}>
                      <Ionicons name="checkmark-circle" size={10} color="#0EA47A" />
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Stars rating={rev.rating} />
                  <Text style={styles.reviewDate}>{fmt(rev.createdAt)}</Text>
                </View>
              </View>
            </View>
            <Text style={styles.reviewText}>{rev.text}</Text>
            {isAuthenticated && (
              <Pressable onPress={() => markHelpful.mutate(rev.id)} style={styles.helpfulBtn}>
                <Ionicons name="thumbs-up-outline" size={13} color="#888" />
                <Text style={styles.helpfulText}>Helpful ({rev.helpful || 0})</Text>
              </Pressable>
            )}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16 },
  summary: { flexDirection: "row", gap: 16, backgroundColor: "#F7F8FA", borderRadius: 16, padding: 14, marginBottom: 12 },
  summaryLeft: { alignItems: "center", gap: 6 },
  avgNum: { fontSize: 36, fontWeight: "800", color: "#1A1A2E" },
  reviewCount: { fontSize: 12, color: "#888" },
  summaryBars: { flex: 1, gap: 5 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  barLabel: { fontSize: 11, color: "#888", width: 10, textAlign: "right" },
  barTrack: { flex: 1, height: 6, backgroundColor: "#E5E7EB", borderRadius: 3, overflow: "hidden" },
  barFill: { height: 6, backgroundColor: "#F59E0B", borderRadius: 3 },
  barCount: { fontSize: 11, color: "#888", width: 16, textAlign: "right" },
  writeBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: Colors.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12 },
  writeBtnText: { color: Colors.primary, fontWeight: "700", fontSize: 14 },
  form: { backgroundColor: "#F7F8FA", borderRadius: 16, padding: 14, marginBottom: 12, gap: 6 },
  formTitle: { fontSize: 16, fontWeight: "700", color: "#1A1A2E", marginBottom: 4 },
  formLabel: { fontSize: 13, fontWeight: "600", color: "#555" },
  formInput: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 90, fontSize: 14, color: "#1A1A2E", textAlignVertical: "top", marginTop: 6 },
  formBtns: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, backgroundColor: "#fff", borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB" },
  cancelBtnText: { fontWeight: "700", color: "#666" },
  submitBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  submitBtnText: { color: "#fff", fontWeight: "700" },
  empty: { alignItems: "center", paddingVertical: 28, gap: 8 },
  emptyText: { fontSize: 14, color: "#aaa" },
  reviewCard: { backgroundColor: "#F7F8FA", borderRadius: 14, padding: 12, marginBottom: 10 },
  reviewHeader: { flexDirection: "row", gap: 10, marginBottom: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  reviewMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  reviewerName: { fontSize: 14, fontWeight: "700", color: "#1A1A2E" },
  verifiedChip: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#E6FAF3", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  verifiedText: { fontSize: 10, color: "#0EA47A", fontWeight: "600" },
  reviewDate: { fontSize: 11, color: "#aaa" },
  reviewText: { fontSize: 13, color: "#444", lineHeight: 19 },
  helpfulBtn: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
  helpfulText: { fontSize: 12, color: "#888" },
});
