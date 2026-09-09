import React from "react";
import {
  View, Text, StyleSheet, Pressable, FlatList, Platform, ActivityIndicator,
} from "react-native";
import { router, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import { getToken } from "@/lib/auth-token";
import { useAuth } from "@/contexts/AuthContext";

async function apiCall(path: string, method = "PUT") {
  const token = getToken();
  const r = await fetch(new URL(path, getApiUrl()).toString(), {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-MansaMart-App": "rider" },
  });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

function timeAgo(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function notificationRoute(value?: string) {
  if (!value) return null;
  const allowed = ["/(rider)", "/order/", "/order-tracking", "/wallet", "/support"];
  return allowed.some(prefix => value === prefix || value.startsWith(prefix)) ? value : null;
}

const TYPE_META: Record<string, { icon: string; color: string; bg: string }> = {
  order:        { icon: "bag-check-outline",        color: "#2563EB", bg: "#EFF6FF" },
  booking:      { icon: "calendar-check-outline",   color: "#7B4FA3", bg: "#F3E8FF" },
  verification: { icon: "shield-checkmark-outline", color: "#0EA47A", bg: "#E6FAF3" },
  promo:        { icon: "pricetag-outline",          color: "#E8813A", bg: "#FFF3E9" },
  system:       { icon: "information-circle-outline",color: "#64748B", bg: "#F1F5F9" },
  alert:        { icon: "alert-circle-outline",      color: "#E63946", bg: "#FEF2F2" },
  review:       { icon: "star-outline",              color: "#F59E0B", bg: "#FFFBEB" },
};

function NotifCard({ item, onPress }: { item: any; onPress: () => void }) {
  const meta = TYPE_META[item.type] ?? TYPE_META.system;
  const iconColor = item.color || meta.color;
  const iconBg = item.color ? item.color + "22" : meta.bg;
  const iconName = item.icon || meta.icon;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, !item.isRead && styles.cardUnread, pressed && { opacity: 0.9 }]}
      onPress={onPress}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName as any} size={22} color={iconColor} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.titleRow}>
          <Text style={[styles.cardTitle, !item.isRead && styles.cardTitleBold]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.cardTime}>{timeAgo(item.createdAt)}</Text>
        </View>
        <Text style={styles.cardText} numberOfLines={2}>{item.body}</Text>
      </View>
      {!item.isRead && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/notifications"],
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => apiCall(`/api/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const markAll = useMutation({
    mutationFn: () => apiCall("/api/notifications/read-all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const unread = notifications.filter(n => !n.isRead).length;

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, styles.centerFlex]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.emptyIconWrap}>
          <Ionicons name="notifications-off-outline" size={48} color={Colors.border} />
        </View>
        <Text style={styles.emptyTitle}>Sign in to view notifications</Text>
        <Pressable style={styles.signInBtn} onPress={() => router.push("/(auth)/login")}>
          <Text style={styles.signInText}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <View style={styles.headerMid}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unread}</Text>
            </View>
          )}
        </View>
        {unread > 0 && !markAll.isPending && (
          <Pressable onPress={() => markAll.mutate()} hitSlop={8}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View style={styles.centerFlex}><ActivityIndicator color={Colors.primary} /></View>
      ) : notifications.length === 0 ? (
        <View style={[styles.centerFlex, { paddingBottom: 80 }]}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="notifications-outline" size={48} color={Colors.border} />
          </View>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySubtext}>
            Delivery offers, verification updates, support replies, and payout alerts will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={i => i.id}
          contentContainerStyle={[styles.list, { paddingBottom: 60 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <NotifCard
              item={item}
              onPress={() => {
                if (!item.isRead) markRead.mutate(item.id);
                const destination = notificationRoute(item.actionRoute || item.action_route);
                if (destination) router.push(destination as any);
              }}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerFlex: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  headerMid: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 12 },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  unreadBadge: {
    backgroundColor: Colors.error, borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2, minWidth: 20, alignItems: "center",
  },
  unreadBadgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  markAllText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  list: { padding: 16 },
  card: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  cardUnread: {
    borderLeftWidth: 3, borderLeftColor: Colors.primary,
    backgroundColor: "#F0FDF9",
  },
  iconWrap: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1, gap: 3 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 6 },
  cardTitle: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.text },
  cardTitleBold: { fontFamily: "Inter_700Bold" },
  cardTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, flexShrink: 0 },
  cardText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 18 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  emptyIconWrap: {
    width: 96, height: 96, borderRadius: 32,
    backgroundColor: Colors.borderLight, alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text, textAlign: "center" },
  emptySubtext: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary,
    textAlign: "center", paddingHorizontal: 36, lineHeight: 20,
  },
  signInBtn: {
    backgroundColor: Colors.primary, paddingHorizontal: 32, paddingVertical: 14,
    borderRadius: 14, marginTop: 8,
  },
  signInText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
});
