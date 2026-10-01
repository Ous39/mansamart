import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";

type EligibleReview = {
  targetType: "product" | "service";
  targetId: string;
  name: string;
  subtitle?: string;
};

export default function MyReviewsScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { isAuthenticated } = useAuth();
  const params = useLocalSearchParams<{ targetType?: string; targetId?: string }>();
  const [selected, setSelected] = useState<EligibleReview | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [tab, setTab] = useState<"pending" | "published">("pending");
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const { data: eligibleData, isLoading: eligibleLoading } = useQuery<EligibleReview[]>({
    queryKey: ["/api/customer/review-eligibility"],
    enabled: isAuthenticated,
  });
  const { data: publishedData, isLoading: publishedLoading } = useQuery<any[]>({
    queryKey: ["/api/customer/reviews"],
    enabled: isAuthenticated,
  });
  const eligible = useMemo(() => eligibleData ?? [], [eligibleData]);
  const published = useMemo(() => publishedData ?? [], [publishedData]);

  useEffect(() => {
    if (!selected && params.targetId) {
      const match = eligible.find((item) => item.targetId === params.targetId && item.targetType === params.targetType);
      if (match) setSelected(match);
    }
  }, [eligible, params.targetId, params.targetType, selected]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Choose an item to review");
      const response = await apiRequest("POST", "/api/reviews", {
        targetType: selected.targetType,
        targetId: selected.targetId,
        rating,
        text: comment.trim(),
      });
      return response.json();
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["/api/customer/reviews"] }),
        qc.invalidateQueries({ queryKey: ["/api/customer/review-eligibility"] }),
      ]);
      setSelected(null);
      setRating(5);
      setComment("");
      setTab("published");
      Alert.alert("Review published", "Thank you for sharing your verified experience.");
    },
    onError: (error: any) => Alert.alert("Review not published", cleanError(error)),
  });

  const list = useMemo(() => tab === "pending" ? eligible : published, [eligible, published, tab]);

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <Pressable onPress={() => router.back()} hitSlop={8}><Ionicons name="arrow-back" size={24} color={Colors.text} /></Pressable>
          <Text style={styles.title}>My Reviews</Text>
        </View>
        <View style={styles.center}>
          <Ionicons name="person-circle-outline" size={52} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Sign in to view your reviews</Text>
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
        <View style={styles.headerCopy}>
          <Text style={styles.title}>My Reviews</Text>
          <Text style={styles.subtitle}>Only completed purchases and bookings can be reviewed</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <Tab label={`To review (${eligible.length})`} active={tab === "pending"} onPress={() => setTab("pending")} />
        <Tab label={`Published (${published.length})`} active={tab === "published"} onPress={() => setTab("published")} />
      </View>

      {(eligibleLoading || publishedLoading) ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : list.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}><Ionicons name="star-outline" size={44} color={Colors.textMuted} /></View>
          <Text style={styles.emptyTitle}>{tab === "pending" ? "Nothing waiting for a review" : "No reviews published yet"}</Text>
          <Text style={styles.emptyText}>{tab === "pending" ? "Delivered orders and completed services will appear here." : "Your verified reviews will appear here."}</Text>
        </View>
      ) : tab === "pending" ? (
        <FlatList
          data={eligible}
          keyExtractor={(item) => `${item.targetType}:${item.targetId}`}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 30 }]}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => setSelected(item)}>
              <View style={styles.itemIcon}><Ionicons name={item.targetType === "product" ? "bag-outline" : "construct-outline"} size={21} color={Colors.primary} /></View>
              <View style={styles.cardCopy}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardMeta}>{item.subtitle || `Completed ${item.targetType}`}</Text>
              </View>
              <Text style={styles.reviewLink}>Review</Text>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={published}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 30 }]}
          renderItem={({ item }) => (
            <View style={styles.cardColumn}>
              <View style={styles.publishedTop}>
                <View style={styles.stars}>{[1, 2, 3, 4, 5].map((star) => <Ionicons key={star} name={star <= item.rating ? "star" : "star-outline"} size={15} color="#F59E0B" />)}</View>
                <View style={styles.verified}><Ionicons name="checkmark-circle" size={13} color={Colors.success} /><Text style={styles.verifiedText}>Verified</Text></View>
              </View>
              <Text style={styles.reviewText}>{item.text}</Text>
              <Text style={styles.cardMeta}>{item.targetType} • {new Date(item.createdAt).toLocaleDateString("en-GB")}</Text>
            </View>
          )}
        />
      )}

      {selected && (
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelected(null)} />
          <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }} keyboardShouldPersistTaps="handled">
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Review {selected.name}</Text>
            <Text style={styles.sheetLabel}>Your rating</Text>
            <View style={styles.bigStars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable key={star} onPress={() => setRating(star)} hitSlop={6}>
                  <Ionicons name={star <= rating ? "star" : "star-outline"} size={34} color="#F59E0B" />
                </Pressable>
              ))}
            </View>
            <Text style={styles.sheetLabel}>Your experience</Text>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="What did you like? What should improve?"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
              multiline
              maxLength={2000}
            />
            <Text style={styles.counter}>{comment.length}/2000</Text>
            <Pressable
              style={[styles.submit, (comment.trim().length < 5 || submit.isPending) && styles.disabled]}
              disabled={comment.trim().length < 5 || submit.isPending}
              onPress={() => submit.mutate()}
            >
              {submit.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Publish Verified Review</Text>}
            </Pressable>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable style={[styles.tab, active && styles.tabActive]} onPress={onPress}><Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text></Pressable>;
}

function cleanError(error: any) {
  const message = String(error?.message || "Please try again.").replace(/^\d+:\s*/, "");
  try { return JSON.parse(message).message || message; } catch { return message; }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", gap: 14, alignItems: "center", paddingHorizontal: 20, paddingBottom: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  headerCopy: { flex: 1 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  tabs: { flexDirection: "row", gap: 10, padding: 16 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  tabTextActive: { color: "#fff" },
  list: { paddingHorizontal: 16, gap: 10 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 15, backgroundColor: Colors.surface },
  itemIcon: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: Colors.primaryLight },
  cardCopy: { flex: 1 },
  cardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  cardMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 3, textTransform: "capitalize" },
  reviewLink: { color: Colors.primary, fontSize: 13, fontFamily: "Inter_700Bold" },
  cardColumn: { gap: 8, padding: 16, borderRadius: 15, backgroundColor: Colors.surface },
  publishedTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stars: { flexDirection: "row", gap: 2 },
  verified: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#E6FAF3" },
  verifiedText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: Colors.success },
  reviewText: { fontSize: 14, lineHeight: 21, fontFamily: "Inter_400Regular", color: Colors.text },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 34 },
  emptyIcon: { width: 82, height: 82, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: Colors.borderLight },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text, textAlign: "center" },
  emptyText: { fontSize: 13, lineHeight: 20, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" },
  sheetOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.36)" },
  sheet: { maxHeight: "78%", borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: Colors.surface, padding: 20 },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginBottom: 18 },
  sheetTitle: { fontSize: 19, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 18 },
  sheetLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, marginBottom: 8 },
  bigStars: { flexDirection: "row", gap: 8, marginBottom: 20 },
  input: { height: 120, padding: 14, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, color: Colors.text, fontSize: 14, fontFamily: "Inter_400Regular", textAlignVertical: "top", backgroundColor: Colors.background },
  counter: { alignSelf: "flex-end", marginTop: 5, fontSize: 10, color: Colors.textMuted },
  submit: { height: 52, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: Colors.primary, marginTop: 16 },
  disabled: { opacity: 0.55 },
  submitText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
