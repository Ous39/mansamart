import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Platform, Alert, Switch, ActivityIndicator,
} from "react-native";
import { router, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/query-client";
import { getToken } from "@/lib/auth-token";

type Section = "main" | "editProfile" | "changePassword" | "addresses";

async function apiCall(path: string, method: string, body?: any) {
  const token = getToken();
  const r = await fetch(new URL(path, getApiUrl()).toString(), {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || "Request failed"); }
  return r.json();
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const [section, setSection] = useState<Section>("main");

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [city, setCity] = useState(user?.city || "");
  const [region, setRegion] = useState(user?.region || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  const updateProfile = useMutation({
    mutationFn: (data: any) => apiCall("/api/profile", "PUT", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/auth/me"] }); Alert.alert("✅", "Profile updated!"); setSection("main"); },
    onError: (e: any) => Alert.alert("Error", e.message),
  });

  const changePwd = useMutation({
    mutationFn: () => apiCall("/api/profile/change-password", "PUT", { currentPassword: currentPwd, newPassword: newPwd }),
    onSuccess: () => { Alert.alert("✅", "Password changed!"); setCurrentPwd(""); setNewPwd(""); setConfirmPwd(""); setSection("main"); },
    onError: (e: any) => Alert.alert("Error", e.message),
  });

  const gambiaCities = ["Banjul", "Serrekunda", "Kanifing", "Bakau", "Fajara", "Kotu", "Kololi", "Tallinding", "Brikama", "Farafenni"];
  const regions = ["Greater Banjul", "West Coast", "North Bank", "Lower River", "Central River", "Upper River"];

  if (section === "main") return (
    <View style={{ flex: 1, backgroundColor: "#F7F8FA" }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={24} color="#1A1A2E" /></Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 32 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileBanner}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || "U"}</Text></View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            {user?.isVerified && <View style={styles.verifiedBadge}><Ionicons name="checkmark-circle" size={12} color="#0EA47A" /><Text style={styles.verifiedText}>Verified Account</Text></View>}
            <View style={styles.pointsBadge}><Ionicons name="star" size={12} color="#F59E0B" /><Text style={styles.pointsText}>{(user as any)?.loyaltyPoints || 0} Loyalty Points</Text></View>
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <SettingRow icon="person-outline" label="Edit Profile" onPress={() => setSection("editProfile")} />
          <SettingRow icon="location-outline" label="Delivery Addresses" onPress={() => setSection("addresses")} />
          <SettingRow icon="lock-closed-outline" label="Change Password" onPress={() => setSection("changePassword")} />
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity</Text>
          <SettingRow icon="bag-outline" label="My Orders" onPress={() => router.push("/(tabs)/wishlist" as any)} />
          <SettingRow icon="calendar-outline" label="My Bookings" onPress={() => router.push("/(tabs)/wishlist" as any)} />
          <SettingRow icon="heart-outline" label="Wishlist" onPress={() => router.push("/(tabs)/wishlist")} />
          <SettingRow icon="notifications-outline" label="Notifications" onPress={() => router.push("/(tabs)/wishlist" as any)} />
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <SettingRow icon="chatbubble-outline" label="Help Center" onPress={() => {}} />
          <SettingRow icon="document-text-outline" label="Terms & Conditions" onPress={() => {}} />
          <SettingRow icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => {}} />
          <SettingRow icon="information-circle-outline" label="About MansaMart" onPress={() => {}} />
        </View>
        <Pressable style={styles.logoutBtn} onPress={() => { logout(); router.replace("/(auth)/login"); }}>
          <Ionicons name="log-out-outline" size={18} color="#E63946" />
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
        <Text style={styles.version}>MansaMart v1.0 • MansaMart</Text>
        <View style={{ height: Platform.OS === "web" ? 34 : insets.bottom + 20 }} />
      </ScrollView>
    </View>
  );

  if (section === "editProfile") return (
    <View style={{ flex: 1, backgroundColor: "#F7F8FA" }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Pressable onPress={() => setSection("main")} style={styles.back}><Ionicons name="arrow-back" size={24} color="#1A1A2E" /></Pressable>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <Pressable onPress={() => updateProfile.mutate({ name, phone, city, region, bio })} disabled={updateProfile.isPending}>
          {updateProfile.isPending ? <ActivityIndicator size="small" color={Colors.primary} /> : <Text style={styles.saveBtn}>Save</Text>}
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.formContent}>
        <FormField label="Full Name" value={name} onChangeText={setName} placeholder="Your full name" />
        <FormField label="Phone" value={phone} onChangeText={setPhone} placeholder="+220 7xxxxxx" keyboardType="phone-pad" />
        <FormField label="Bio" value={bio} onChangeText={setBio} placeholder="Tell us about yourself" multiline />
        <Text style={styles.fieldLabel}>City</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          {gambiaCities.map(c => <Pressable key={c} onPress={() => setCity(c)} style={[styles.chip, city === c && styles.chipActive]}><Text style={[styles.chipText, city === c && styles.chipTextActive]}>{c}</Text></Pressable>)}
        </ScrollView>
        <Text style={styles.fieldLabel}>Region</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          {regions.map(r => <Pressable key={r} onPress={() => setRegion(r)} style={[styles.chip, region === r && styles.chipActive]}><Text style={[styles.chipText, region === r && styles.chipTextActive]}>{r}</Text></Pressable>)}
        </ScrollView>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );

  if (section === "changePassword") return (
    <View style={{ flex: 1, backgroundColor: "#F7F8FA" }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Pressable onPress={() => setSection("main")} style={styles.back}><Ionicons name="arrow-back" size={24} color="#1A1A2E" /></Pressable>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={{ width: 32 }} />
      </View>
      <ScrollView contentContainerStyle={styles.formContent}>
        <FormField label="Current Password" value={currentPwd} onChangeText={setCurrentPwd} placeholder="Current password" secureTextEntry />
        <FormField label="New Password" value={newPwd} onChangeText={setNewPwd} placeholder="New password (min 6 chars)" secureTextEntry />
        <FormField label="Confirm New Password" value={confirmPwd} onChangeText={setConfirmPwd} placeholder="Confirm new password" secureTextEntry />
        <Pressable style={styles.submitBtn} onPress={() => {
          if (!currentPwd || !newPwd || !confirmPwd) return Alert.alert("Error", "All fields required");
          if (newPwd !== confirmPwd) return Alert.alert("Error", "Passwords don't match");
          if (newPwd.length < 6) return Alert.alert("Error", "Min 6 characters");
          changePwd.mutate();
        }} disabled={changePwd.isPending}>
          {changePwd.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Update Password</Text>}
        </Pressable>
      </ScrollView>
    </View>
  );

  return <AddressesSection topPad={topPad} insets={insets} onBack={() => setSection("main")} />;
}

function AddressesSection({ topPad, insets, onBack }: any) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: "Home", fullName: "", phone: "", address: "", city: "Banjul", region: "Greater Banjul", isDefault: false });
  const { data: addrList = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/addresses"] });
  const addAddr = useMutation({
    mutationFn: (data: any) => apiCall("/api/addresses", "POST", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/addresses"] }); setAdding(false); },
    onError: () => Alert.alert("Error", "Failed to add address"),
  });
  const delAddr = useMutation({
    mutationFn: (id: string) => apiCall(`/api/addresses/${id}`, "DELETE"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/addresses"] }),
  });
  const cities = ["Banjul", "Serrekunda", "Kanifing", "Bakau", "Fajara", "Brikama"];

  return (
    <View style={{ flex: 1, backgroundColor: "#F7F8FA" }}>
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Pressable onPress={onBack} style={styles.back}><Ionicons name="arrow-back" size={24} color="#1A1A2E" /></Pressable>
        <Text style={styles.headerTitle}>Delivery Addresses</Text>
        <Pressable onPress={() => setAdding(true)}><Ionicons name="add" size={26} color={Colors.primary} /></Pressable>
      </View>
      {isLoading ? <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} /> : (
        <ScrollView contentContainerStyle={styles.content}>
          {addrList.length === 0 && !adding && (
            <View style={styles.emptyAddr}>
              <Ionicons name="location-outline" size={48} color="#ccc" />
              <Text style={styles.emptyAddrText}>No saved addresses</Text>
              <Pressable onPress={() => setAdding(true)} style={styles.submitBtn}><Text style={styles.submitBtnText}>Add Address</Text></Pressable>
            </View>
          )}
          {addrList.map((addr: any) => (
            <View key={addr.id} style={styles.addrCard}>
              <View style={styles.addrHeader}>
                <View style={styles.addrLabelRow}>
                  <Ionicons name={addr.label === "Home" ? "home-outline" : addr.label === "Work" ? "briefcase-outline" : "location-outline"} size={14} color={Colors.primary} />
                  <Text style={styles.addrLabel}>{addr.label}</Text>
                  {addr.isDefault && <Text style={styles.defaultBadge}>Default</Text>}
                </View>
                <Pressable onPress={() => Alert.alert("Delete", "Remove this address?", [{ text: "Cancel" }, { text: "Delete", style: "destructive", onPress: () => delAddr.mutate(addr.id) }])}>
                  <Ionicons name="trash-outline" size={18} color="#E63946" />
                </Pressable>
              </View>
              <Text style={styles.addrName}>{addr.fullName} • {addr.phone}</Text>
              <Text style={styles.addrText}>{addr.address}, {addr.city}, {addr.region}</Text>
            </View>
          ))}
          {adding && (
            <View style={styles.addrCard}>
              <Text style={styles.cardTitle}>New Address</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                {["Home", "Work", "Other"].map(l => <Pressable key={l} onPress={() => setForm({ ...form, label: l })} style={[styles.chip, form.label === l && styles.chipActive]}><Text style={[styles.chipText, form.label === l && styles.chipTextActive]}>{l}</Text></Pressable>)}
              </ScrollView>
              <FormField label="Full Name" value={form.fullName} onChangeText={(v: string) => setForm({ ...form, fullName: v })} placeholder="Recipient name" />
              <FormField label="Phone" value={form.phone} onChangeText={(v: string) => setForm({ ...form, phone: v })} placeholder="+220 7xxxxxx" keyboardType="phone-pad" />
              <FormField label="Street / Compound" value={form.address} onChangeText={(v: string) => setForm({ ...form, address: v })} placeholder="Address details" />
              <Text style={styles.fieldLabel}>City</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {cities.map(c => <Pressable key={c} onPress={() => setForm({ ...form, city: c })} style={[styles.chip, form.city === c && styles.chipActive]}><Text style={[styles.chipText, form.city === c && styles.chipTextActive]}>{c}</Text></Pressable>)}
              </ScrollView>
              <View style={styles.defaultRow}>
                <Text style={styles.fieldLabel}>Set as default</Text>
                <Switch value={form.isDefault} onValueChange={v => setForm({ ...form, isDefault: v })} trackColor={{ true: Colors.primary }} />
              </View>
              <View style={styles.addrBtns}>
                <Pressable style={styles.cancelBtn} onPress={() => setAdding(false)}><Text style={styles.cancelBtnText}>Cancel</Text></Pressable>
                <Pressable style={[styles.submitBtn, { flex: 1 }]} onPress={() => addAddr.mutate(form)} disabled={addAddr.isPending}>
                  {addAddr.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Save</Text>}
                </Pressable>
              </View>
            </View>
          )}
          <View style={{ height: Platform.OS === "web" ? 34 : insets.bottom + 20 }} />
        </ScrollView>
      )}
    </View>
  );
}

function SettingRow({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.settingRow} onPress={onPress}>
      <View style={styles.settingLeft}>
        <View style={styles.settingIconBox}><Ionicons name={icon as any} size={18} color={Colors.primary} /></View>
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#ccc" />
    </Pressable>
  );
}

function FormField({ label, value, onChangeText, placeholder, multiline, keyboardType, secureTextEntry }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { height: 90, textAlignVertical: "top" }]}
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        multiline={multiline} keyboardType={keyboardType || "default"}
        secureTextEntry={secureTextEntry} placeholderTextColor="#bbb"
      />
    </View>
  );
}

const S = StyleSheet;
const styles = S.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  back: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#1A1A2E" },
  saveBtn: { color: Colors.primary, fontSize: 15, fontWeight: "700" },
  content: { padding: 16, gap: 12 },
  formContent: { padding: 16 },
  profileBanner: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 24, fontWeight: "800" },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: "700", color: "#1A1A2E" },
  profileEmail: { fontSize: 13, color: "#888", marginTop: 2 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  verifiedText: { fontSize: 11, color: "#0EA47A", fontWeight: "700" },
  pointsBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  pointsText: { fontSize: 12, color: "#F59E0B", fontWeight: "700" },
  section: { backgroundColor: "#fff", borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: "#aaa", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F5F5F5" },
  settingLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  settingIconBox: { width: 34, height: 34, backgroundColor: Colors.primaryLight || "#E6FAF3", borderRadius: 10, alignItems: "center", justifyContent: "center" },
  settingLabel: { fontSize: 15, color: "#1A1A2E" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#FFE5E5" },
  logoutText: { fontSize: 15, fontWeight: "700", color: "#E63946" },
  version: { textAlign: "center", fontSize: 11, color: "#ccc", marginTop: 4 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#555", marginBottom: 6 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#1A1A2E" },
  chip: { borderRadius: 20, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, backgroundColor: "#fff" },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: "#666" },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 16 },
  submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  addrCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  addrHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  addrLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  addrLabel: { fontSize: 14, fontWeight: "700", color: "#1A1A2E" },
  defaultBadge: { backgroundColor: "#E6FAF3", color: Colors.primary, fontSize: 10, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  addrName: { fontSize: 13, color: "#555", marginBottom: 4 },
  addrText: { fontSize: 13, color: "#888" },
  emptyAddr: { alignItems: "center", paddingVertical: 50, gap: 12 },
  emptyAddrText: { fontSize: 16, color: "#999" },
  defaultRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 8 },
  addrBtns: { flexDirection: "row", gap: 10, marginTop: 12 },
  cancelBtn: { flex: 1, backgroundColor: "#F7F8FA", borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  cancelBtnText: { fontSize: 14, fontWeight: "700", color: "#666" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#1A1A2E", marginBottom: 12 },
});
