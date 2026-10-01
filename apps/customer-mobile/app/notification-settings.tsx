import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";

type Preferences = {
  orders: boolean; delivery: boolean; payments: boolean; bookings: boolean;
  messages: boolean; promotions: boolean; security: boolean;
  pushEnabled: boolean; emailEnabled: boolean; whatsappEnabled: boolean; whatsappPhone?: string | null;
  quietHoursEnabled: boolean; quietHoursStart: string; quietHoursEnd: string; unreadEscalationEnabled: boolean;
};
type CategoryPreference = "orders" | "delivery" | "payments" | "bookings" | "messages" | "promotions" | "security";
const rows: { key: CategoryPreference; title: string; detail: string; icon: any }[] = [
  { key: "orders", title: "Orders", detail: "Confirmation and fulfilment updates", icon: "bag-check-outline" },
  { key: "delivery", title: "Delivery", detail: "Rider assignment, pickup and arrival", icon: "bicycle-outline" },
  { key: "payments", title: "Payments", detail: "Payment, refund and payout updates", icon: "wallet-outline" },
  { key: "bookings", title: "Bookings", detail: "Service booking status changes", icon: "calendar-outline" },
  { key: "messages", title: "Messages & support", detail: "Conversations and support replies", icon: "chatbubble-outline" },
  { key: "promotions", title: "Deals & promotions", detail: "Optional offers from MansaMart", icon: "pricetag-outline" },
  { key: "security", title: "Security", detail: "Important account and sign-in alerts", icon: "shield-checkmark-outline" },
];

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const { data, isLoading } = useQuery<Preferences>({ queryKey: ["/api/notifications/preferences"] });
  useEffect(() => { if (data?.whatsappPhone) setWhatsappPhone(data.whatsappPhone); }, [data?.whatsappPhone]);
  const save = useMutation({
    mutationFn: (value: Partial<Preferences>) => apiRequest("PUT", "/api/notifications/preferences", value),
    onMutate: async value => {
      await client.cancelQueries({ queryKey: ["/api/notifications/preferences"] });
      const previous = client.getQueryData<Preferences>(["/api/notifications/preferences"]);
      if (previous) client.setQueryData(["/api/notifications/preferences"], { ...previous, ...value });
      return { previous };
    },
    onError: (_error, _value, context) => context?.previous && client.setQueryData(["/api/notifications/preferences"], context.previous),
    onSettled: () => client.invalidateQueries({ queryKey: ["/api/notifications/preferences"] }),
  });

  return (
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 55 : 10) }]}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={Colors.text}/></Pressable>
        <Text style={styles.headerTitle}>Notification settings</Text><View style={{ width: 24 }}/>
      </View>
      {isLoading || !data ? <ActivityIndicator style={{ marginTop: 50 }} color={Colors.primary}/> : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
          <Text style={styles.help}>Choose which push alerts you receive. Security alerts remain available in the app even when push is turned off.</Text>
          <View style={styles.card}>
            <ChannelRow title="Push notifications" detail="Immediate alerts on this device" value={data.pushEnabled} onChange={value => save.mutate({ pushEnabled: value })}/>
            <ChannelRow title="Email" detail="Receipts, payment and security updates" value={data.emailEnabled} onChange={value => save.mutate({ emailEnabled: value })}/>
            <View style={styles.channelBlock}>
              <ChannelRow title="WhatsApp" detail="Important updates and unread-message escalation" value={data.whatsappEnabled} onChange={value => value ? save.mutate({ whatsappEnabled: true, whatsappPhone }) : save.mutate({ whatsappEnabled: false })}/>
              <TextInput value={whatsappPhone} onChangeText={setWhatsappPhone} onBlur={() => data.whatsappEnabled && save.mutate({ whatsappPhone })} placeholder="+220 7xxxxxx" keyboardType="phone-pad" style={styles.input}/>
            </View>
            <ChannelRow title="Quiet hours" detail="Pause non-critical alerts from 22:00 to 07:00" value={data.quietHoursEnabled} onChange={value => save.mutate({ quietHoursEnabled: value })}/>
          </View>
          <View style={styles.card}>
            {rows.map((row, index) => (
              <View key={row.key} style={[styles.item, index < rows.length - 1 && styles.divider]}>
                <View style={styles.icon}><Ionicons name={row.icon} size={20} color={Colors.primary}/></View>
                <View style={styles.copy}><Text style={styles.title}>{row.title}</Text><Text style={styles.detail}>{row.detail}</Text></View>
                <Switch value={data[row.key]} onValueChange={value => save.mutate({ [row.key]: value })} trackColor={{ true: Colors.primaryLight }} thumbColor={data[row.key] ? Colors.primary : "#94A3B8"}/>
              </View>
            ))}
          </View>
          <Pressable style={styles.security} onPress={() => router.push("/account-security")}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.primary}/>
            <View style={{ flex: 1 }}><Text style={styles.title}>Manage signed-in devices</Text><Text style={styles.detail}>Review and revoke active sessions</Text></View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted}/>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function ChannelRow({ title, detail, value, onChange }: { title: string; detail: string; value: boolean; onChange: (value: boolean) => void }) {
  return <View style={styles.item}><View style={styles.copy}><Text style={styles.title}>{title}</Text><Text style={styles.detail}>{detail}</Text></View><Switch value={value} onValueChange={onChange} trackColor={{ true: Colors.primaryLight }} thumbColor={value ? Colors.primary : "#94A3B8"}/></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.background },
  header: { minHeight: 76, paddingHorizontal: 20, paddingBottom: 14, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.text },
  content: { padding: 16, gap: 16 },
  help: { color: Colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  card: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" },
  item: { flexDirection: "row", alignItems: "center", gap: 12, padding: 15 },
  divider: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  icon: { width: 38, height: 38, borderRadius: 11, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1 },
  title: { color: Colors.text, fontFamily: "Inter_600SemiBold", fontSize: 14 },
  detail: { color: Colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  security: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: Colors.border },
  channelBlock: { borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingBottom: 12 },
  input: { marginHorizontal: 15, minHeight: 44, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, color: Colors.text, backgroundColor: Colors.background },
});
