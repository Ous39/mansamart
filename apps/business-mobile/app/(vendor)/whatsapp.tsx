import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import { getToken } from "@/lib/auth-token";

type Connection = {
  id: string;
  businessPhone: string;
  displayName?: string | null;
  status: string;
  aiEnabled: boolean;
  humanHandoffEnabled: boolean;
  catalogSyncEnabled: boolean;
  welcomeMessage?: string | null;
  lastWebhookAt?: string | null;
};

type Overview = {
  connection: Connection | null;
  tokens: { balance: number; lifetimeUsed: number };
  stats: {
    products: number;
    customers: number;
    conversations: number;
    unread: number;
    activeCarts: number;
    whatsappOrders: number;
    whatsappRevenue: number;
  };
  recentConversations: Array<{
    id: string;
    unreadCount: number;
    mode: string;
    lastMessagePreview?: string | null;
    lastMessageAt?: string | null;
    customer?: { displayName?: string | null; phone: string } | null;
  }>;
  campaigns: Array<{ id: string; name: string; status: string; recipientCount: number; createdAt: string }>;
};

async function apiCall<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(new URL(path, getApiUrl()).toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      "X-MansaMart-App": "business",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || "Request failed");
  }
  return response.json();
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return <View style={styles.stat}>
    <View style={styles.statIcon}><Ionicons name={icon as any} size={18} color="#087A50" /></View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>;
}

function SettingRow({ icon, title, description, value, onChange }: {
  icon: string; title: string; description: string; value: boolean; onChange: (value: boolean) => void;
}) {
  return <View style={styles.settingRow}>
    <View style={styles.settingIcon}><Ionicons name={icon as any} size={19} color={Colors.primary} /></View>
    <View style={styles.settingCopy}><Text style={styles.settingTitle}>{title}</Text><Text style={styles.settingDescription}>{description}</Text></View>
    <Switch value={value} onValueChange={onChange} trackColor={{ false: "#D7DDD9", true: "#8AD7B8" }} thumbColor={value ? "#087A50" : "#F7F7F7"} />
  </View>;
}

export default function WhatsAppCommerceScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showCampaign, setShowCampaign] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [campaignMessage, setCampaignMessage] = useState("");
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const overview = useQuery<Overview>({
    queryKey: ["/api/vendor/whatsapp/overview"],
    queryFn: () => apiCall("/api/vendor/whatsapp/overview"),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/vendor/whatsapp/overview"] });
  const connect = useMutation({
    mutationFn: () => apiCall("/api/vendor/whatsapp/connect", "POST", { businessPhone: phone, displayName }),
    onSuccess: () => { refresh(); Alert.alert("Setup saved", "Your WhatsApp Business number is ready for Meta verification."); },
    onError: (error: Error) => Alert.alert("Unable to save", error.message),
  });
  const updateSettings = useMutation({
    mutationFn: (change: Partial<Connection>) => apiCall("/api/vendor/whatsapp/settings", "PATCH", change),
    onSuccess: refresh,
    onError: (error: Error) => Alert.alert("Unable to update", error.message),
  });
  const createCampaign = useMutation({
    mutationFn: () => apiCall("/api/vendor/whatsapp/campaigns", "POST", { name: campaignName, message: campaignMessage }),
    onSuccess: () => {
      setCampaignName(""); setCampaignMessage(""); setShowCampaign(false); refresh();
      Alert.alert("Campaign saved", "It is saved as a draft. Only customers who opted in can receive it.");
    },
    onError: (error: Error) => Alert.alert("Unable to save", error.message),
  });

  const data = overview.data;
  const connection = data?.connection;

  return <View style={styles.page}>
    <Stack.Screen options={{ headerShown: false }} />
    <LinearGradient colors={["#075E54", "#0C8B61"]} style={[styles.header, { paddingTop: topPad + 12 }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}><Ionicons name="arrow-back" size={22} color="#fff" /></Pressable>
        <View style={styles.headerTitleWrap}><Text style={styles.headerTitle}>WhatsApp Sales</Text><Text style={styles.headerSubtitle}>Your shop, inside the conversation</Text></View>
        <View style={styles.whatsappMark}><Ionicons name="logo-whatsapp" size={23} color="#075E54" /></View>
      </View>
      <View style={styles.connectionBar}>
        <View style={[styles.statusDot, connection?.status === "connected" && styles.connectedDot]} />
        <Text style={styles.connectionText}>{connection ? `${connection.displayName || "WhatsApp shop"} · ${connection.status.replaceAll("_", " ")}` : "No WhatsApp Business number connected"}</Text>
      </View>
    </LinearGradient>

    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]} showsVerticalScrollIndicator={false}>
      {overview.isLoading ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 50 }} /> : overview.isError ? <View style={styles.errorCard}><Text style={styles.errorTitle}>Could not load WhatsApp Sales</Text><Text style={styles.errorText}>Check the API and database migration, then try again.</Text><Pressable onPress={() => overview.refetch()}><Text style={styles.retry}>Try again</Text></Pressable></View> : <>
        {!connection ? <View style={styles.setupCard}>
          <View style={styles.setupIcon}><Ionicons name="storefront-outline" size={25} color="#087A50" /></View>
          <Text style={styles.cardTitle}>Connect your business number</Text>
          <Text style={styles.cardText}>Use a WhatsApp Business number. Customers will browse your existing MansaMart products and place orders without leaving their chat.</Text>
          <Text style={styles.label}>Shop display name</Text>
          <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="Example: Banjul Fresh Market" placeholderTextColor="#929A96" />
          <Text style={styles.label}>WhatsApp Business number</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+220 000 0000" keyboardType="phone-pad" placeholderTextColor="#929A96" />
          <Pressable style={[styles.primaryButton, (!displayName.trim() || phone.trim().length < 7) && styles.disabled]} disabled={!displayName.trim() || phone.trim().length < 7 || connect.isPending} onPress={() => connect.mutate()}>
            {connect.isPending ? <ActivityIndicator color="#fff" /> : <><Ionicons name="logo-whatsapp" size={18} color="#fff" /><Text style={styles.primaryButtonText}>Save and continue</Text></>}
          </Pressable>
          <Text style={styles.safeNote}>Meta verification is completed securely on the server. Access tokens are never entered in this app.</Text>
        </View> : <>
          <View style={styles.statsGrid}>
            <Stat icon="chatbubbles-outline" label="Conversations" value={String(data?.stats.conversations || 0)} />
            <Stat icon="cart-outline" label="Active carts" value={String(data?.stats.activeCarts || 0)} />
            <Stat icon="receipt-outline" label="Orders" value={String(data?.stats.whatsappOrders || 0)} />
            <Stat icon="cash-outline" label="Revenue" value={`D ${(data?.stats.whatsappRevenue || 0).toLocaleString()}`} />
          </View>

          <View style={styles.tokenCard}>
            <View><Text style={styles.tokenLabel}>AI reply balance</Text><Text style={styles.tokenValue}>{(data?.tokens.balance || 0).toLocaleString()} tokens</Text><Text style={styles.tokenHint}>Used only when the shop assistant replies</Text></View>
            <View style={styles.tokenBadge}><Ionicons name="sparkles" size={20} color="#7A4BD1" /></View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeading}><View><Text style={styles.cardTitle}>Store automation</Text><Text style={styles.cardText}>Control how the assistant handles each conversation.</Text></View></View>
            <SettingRow icon="sparkles-outline" title="AI shop assistant" description="Answer product questions and guide customers" value={connection.aiEnabled} onChange={(value) => updateSettings.mutate({ aiEnabled: value })} />
            <SettingRow icon="people-outline" title="Human handoff" description="Let staff take over difficult conversations" value={connection.humanHandoffEnabled} onChange={(value) => updateSettings.mutate({ humanHandoffEnabled: value })} />
            <SettingRow icon="sync-outline" title="Live catalogue sync" description={`Share ${data?.stats.products || 0} available products in chat`} value={connection.catalogSyncEnabled} onChange={(value) => updateSettings.mutate({ catalogSyncEnabled: value })} />
          </View>

          <View style={styles.card}>
            <View style={styles.sectionTitleRow}><View><Text style={styles.cardTitle}>Recent conversations</Text><Text style={styles.cardText}>{data?.stats.unread || 0} unread messages</Text></View><View style={styles.countBadge}><Text style={styles.countText}>{data?.stats.customers || 0}</Text></View></View>
            {data?.recentConversations.length ? data.recentConversations.map((thread) => <View key={thread.id} style={styles.conversation}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{(thread.customer?.displayName || thread.customer?.phone || "C").slice(0, 1).toUpperCase()}</Text></View>
              <View style={styles.conversationCopy}><Text style={styles.conversationName}>{thread.customer?.displayName || thread.customer?.phone || "Customer"}</Text><Text style={styles.conversationMessage} numberOfLines={1}>{thread.lastMessagePreview || "New conversation"}</Text></View>
              <View style={styles.conversationMeta}><Text style={styles.mode}>{thread.mode.toUpperCase()}</Text>{thread.unreadCount > 0 && <View style={styles.unread}><Text style={styles.unreadText}>{thread.unreadCount}</Text></View>}</View>
            </View>) : <View style={styles.empty}><Ionicons name="chatbubble-ellipses-outline" size={28} color="#9AA5A0" /><Text style={styles.emptyTitle}>No conversations yet</Text><Text style={styles.emptyText}>New customer messages will appear here.</Text></View>}
          </View>

          <View style={styles.card}>
            <View style={styles.sectionTitleRow}><View><Text style={styles.cardTitle}>Campaigns</Text><Text style={styles.cardText}>Message customers who have opted in.</Text></View><Pressable style={styles.smallButton} onPress={() => setShowCampaign((value) => !value)}><Ionicons name={showCampaign ? "close" : "add"} size={18} color="#087A50" /><Text style={styles.smallButtonText}>{showCampaign ? "Close" : "New"}</Text></Pressable></View>
            {showCampaign && <View style={styles.campaignForm}>
              <TextInput style={styles.input} value={campaignName} onChangeText={setCampaignName} placeholder="Campaign name" placeholderTextColor="#929A96" />
              <TextInput style={[styles.input, styles.messageInput]} value={campaignMessage} onChangeText={setCampaignMessage} placeholder="Write your approved WhatsApp message" multiline placeholderTextColor="#929A96" />
              <Pressable style={[styles.primaryButton, (!campaignName.trim() || !campaignMessage.trim()) && styles.disabled]} disabled={!campaignName.trim() || !campaignMessage.trim() || createCampaign.isPending} onPress={() => createCampaign.mutate()}><Text style={styles.primaryButtonText}>{createCampaign.isPending ? "Saving…" : "Save draft"}</Text></Pressable>
            </View>}
            {data?.campaigns.length ? data.campaigns.map((campaign) => <View key={campaign.id} style={styles.campaignRow}><View style={styles.campaignIcon}><Ionicons name="megaphone-outline" size={18} color="#7A4BD1" /></View><View style={{ flex: 1 }}><Text style={styles.conversationName}>{campaign.name}</Text><Text style={styles.conversationMessage}>{campaign.recipientCount} opted-in recipients</Text></View><Text style={styles.draftBadge}>{campaign.status}</Text></View>) : !showCampaign && <Text style={styles.noCampaigns}>No campaigns created yet.</Text>}
          </View>
        </>}
      </>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F4F7F5" },
  header: { paddingHorizontal: 18, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  headerTitleWrap: { flex: 1 },
  headerTitle: { color: "#fff", fontSize: 21, fontFamily: "Inter_700Bold" },
  headerSubtitle: { color: "#CDEDE0", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  whatsappMark: { width: 42, height: 42, borderRadius: 15, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  connectionBar: { flexDirection: "row", alignItems: "center", marginTop: 17, backgroundColor: "rgba(0,0,0,0.13)", paddingHorizontal: 13, paddingVertical: 10, borderRadius: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFD166", marginRight: 8 },
  connectedDot: { backgroundColor: "#73F0B7" },
  connectionText: { color: "#F2FFF9", fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "capitalize" },
  content: { padding: 16, gap: 14 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { width: "48%", flexGrow: 1, backgroundColor: "#fff", padding: 14, borderRadius: 16, borderWidth: 1, borderColor: "#E6ECE8" },
  statIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#E8F7F0", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  statValue: { color: "#17251F", fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { color: "#6B7872", fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 3 },
  setupCard: { backgroundColor: "#fff", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "#E3EAE6" },
  setupIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#E8F7F0", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#E3EAE6" },
  cardHeading: { marginBottom: 4 },
  cardTitle: { color: "#17251F", fontSize: 17, fontFamily: "Inter_700Bold" },
  cardText: { color: "#697770", fontSize: 12.5, lineHeight: 18, fontFamily: "Inter_400Regular", marginTop: 4 },
  label: { color: "#34443C", fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 17, marginBottom: 7 },
  input: { borderWidth: 1, borderColor: "#D9E2DD", backgroundColor: "#FAFCFB", borderRadius: 12, minHeight: 48, paddingHorizontal: 13, color: "#17251F", fontSize: 14, fontFamily: "Inter_400Regular" },
  primaryButton: { minHeight: 49, marginTop: 16, borderRadius: 12, paddingHorizontal: 16, backgroundColor: "#087A50", flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  disabled: { opacity: 0.45 },
  safeNote: { color: "#79867F", fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 12 },
  tokenCard: { backgroundColor: "#242039", borderRadius: 18, padding: 17, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tokenLabel: { color: "#CFC8EA", fontSize: 12, fontFamily: "Inter_500Medium" },
  tokenValue: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold", marginTop: 4 },
  tokenHint: { color: "#9F98BB", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 },
  tokenBadge: { width: 43, height: 43, borderRadius: 14, backgroundColor: "#EDE7FF", alignItems: "center", justifyContent: "center" },
  settingRow: { flexDirection: "row", alignItems: "center", paddingVertical: 13, borderTopWidth: 1, borderTopColor: "#EEF2EF" },
  settingIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center", marginRight: 10 },
  settingCopy: { flex: 1, paddingRight: 8 },
  settingTitle: { color: "#25332D", fontSize: 13.5, fontFamily: "Inter_600SemiBold" },
  settingDescription: { color: "#7B8781", fontSize: 11, lineHeight: 15, fontFamily: "Inter_400Regular", marginTop: 2 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  countBadge: { minWidth: 30, height: 30, borderRadius: 10, paddingHorizontal: 8, backgroundColor: "#E8F7F0", alignItems: "center", justifyContent: "center" },
  countText: { color: "#087A50", fontFamily: "Inter_700Bold", fontSize: 12 },
  conversation: { flexDirection: "row", alignItems: "center", paddingVertical: 11, borderTopWidth: 1, borderTopColor: "#EEF2EF" },
  avatar: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#DFF4EA", alignItems: "center", justifyContent: "center", marginRight: 10 },
  avatarText: { color: "#087A50", fontSize: 15, fontFamily: "Inter_700Bold" },
  conversationCopy: { flex: 1, minWidth: 0 },
  conversationName: { color: "#25332D", fontSize: 13.5, fontFamily: "Inter_600SemiBold" },
  conversationMessage: { color: "#7B8781", fontSize: 11.5, fontFamily: "Inter_400Regular", marginTop: 3 },
  conversationMeta: { alignItems: "flex-end", gap: 4, marginLeft: 8 },
  mode: { color: "#738079", fontSize: 9, fontFamily: "Inter_700Bold" },
  unread: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: "#18A66A", alignItems: "center", justifyContent: "center" },
  unreadText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  empty: { alignItems: "center", paddingVertical: 22 },
  emptyTitle: { color: "#46544D", fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptyText: { color: "#8A9690", fontSize: 11.5, fontFamily: "Inter_400Regular", marginTop: 3 },
  smallButton: { flexDirection: "row", gap: 4, alignItems: "center", backgroundColor: "#E8F7F0", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  smallButtonText: { color: "#087A50", fontSize: 12, fontFamily: "Inter_700Bold" },
  campaignForm: { gap: 10, paddingTop: 6, paddingBottom: 12 },
  messageInput: { minHeight: 88, paddingTop: 13, textAlignVertical: "top" },
  campaignRow: { flexDirection: "row", alignItems: "center", paddingVertical: 11, borderTopWidth: 1, borderTopColor: "#EEF2EF" },
  campaignIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: "#F1ECFF", alignItems: "center", justifyContent: "center", marginRight: 10 },
  draftBadge: { color: "#67509A", backgroundColor: "#F1ECFF", overflow: "hidden", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, fontSize: 10, fontFamily: "Inter_700Bold", textTransform: "capitalize" },
  noCampaigns: { color: "#8A9690", fontSize: 12, fontFamily: "Inter_400Regular", paddingVertical: 12 },
  errorCard: { marginTop: 24, borderRadius: 16, padding: 18, backgroundColor: "#FFF3F1", borderWidth: 1, borderColor: "#F2D4D0" },
  errorTitle: { color: "#8C3328", fontSize: 15, fontFamily: "Inter_700Bold" },
  errorText: { color: "#865D57", fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular", marginTop: 5 },
  retry: { color: "#8C3328", fontSize: 13, fontFamily: "Inter_700Bold", marginTop: 12 },
});
