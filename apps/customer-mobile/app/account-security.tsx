import React from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";

type Session = {
  id: string; audience: string; deviceName?: string | null; devicePlatform?: string | null;
  ipAddress?: string | null; userAgent?: string | null; lastSeenAt: string; createdAt: string;
  expiresAt: string; current: boolean;
};

export default function AccountSecurityScreen() {
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const { data = [], isLoading } = useQuery<Session[]>({ queryKey: ["/api/auth/sessions"] });
  const revoke = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/auth/sessions/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: ["/api/auth/sessions"] }),
  });
  const revokeOthers = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/auth/sessions"),
    onSuccess: () => client.invalidateQueries({ queryKey: ["/api/auth/sessions"] }),
  });

  return (
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 55 : 10) }]}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={Colors.text}/></Pressable>
        <Text style={styles.headerTitle}>Account security</Text>
        <View style={{ width: 24 }}/>
      </View>
      <View style={styles.intro}>
        <View style={styles.shield}><Ionicons name="shield-checkmark-outline" size={26} color={Colors.primary}/></View>
        <View style={{ flex: 1 }}><Text style={styles.title}>Signed-in devices</Text><Text style={styles.subtitle}>Review your active sessions and remove anything you do not recognize.</Text></View>
      </View>
      {isLoading ? <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary}/> : (
        <FlatList
          data={data}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={data.length > 1 ? <Pressable style={styles.revokeAll} onPress={() => revokeOthers.mutate()} disabled={revokeOthers.isPending}><Text style={styles.revokeAllText}>Sign out of all other devices</Text></Pressable> : null}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.deviceIcon}><Ionicons name={item.devicePlatform === "web" ? "desktop-outline" : "phone-portrait-outline"} size={22} color={Colors.primary}/></View>
              <View style={styles.cardBody}>
                <View style={styles.row}><Text style={styles.device}>{item.deviceName || item.userAgent?.split(" ")[0] || item.audience}</Text>{item.current ? <Text style={styles.current}>This device</Text> : null}</View>
                <Text style={styles.meta}>{item.audience} · {item.devicePlatform || "unknown platform"}</Text>
                <Text style={styles.meta}>Active {new Date(item.lastSeenAt).toLocaleString()}</Text>
                {!item.current ? <Pressable onPress={() => revoke.mutate(item.id)} disabled={revoke.isPending}><Text style={styles.revoke}>Revoke session</Text></Pressable> : null}
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No active sessions were found.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.background },
  header: { minHeight: 76, paddingHorizontal: 20, paddingBottom: 14, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.text },
  intro: { flexDirection: "row", gap: 14, padding: 20, backgroundColor: "#fff" },
  shield: { width: 50, height: 50, borderRadius: 15, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.text },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19, color: Colors.textSecondary, marginTop: 3 },
  list: { padding: 16, gap: 10, paddingBottom: 60 },
  revokeAll: { borderWidth: 1, borderColor: Colors.error, borderRadius: 13, minHeight: 46, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  revokeAllText: { color: Colors.error, fontFamily: "Inter_600SemiBold" },
  card: { flexDirection: "row", gap: 12, padding: 16, borderRadius: 15, backgroundColor: "#fff", borderWidth: 1, borderColor: Colors.border },
  deviceIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  device: { flex: 1, fontFamily: "Inter_600SemiBold", color: Colors.text, fontSize: 14 },
  current: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: Colors.primary, backgroundColor: Colors.primaryLight, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  meta: { color: Colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 3 },
  revoke: { color: Colors.error, fontFamily: "Inter_600SemiBold", fontSize: 12, marginTop: 10 },
  empty: { textAlign: "center", color: Colors.textMuted, marginTop: 30 },
});

