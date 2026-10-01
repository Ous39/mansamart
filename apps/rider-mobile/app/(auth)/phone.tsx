import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";
import { useAuth, type UserRole } from "@/contexts/AuthContext";
import { getDefaultRouteForRole } from "@/lib/role-routes";

const audience = process.env.EXPO_PUBLIC_APP_AUDIENCE || "customer";
const initialRole: UserRole = audience === "rider" ? "delivery_rider" : audience === "business" ? "vendor" : "user";

function messageFrom(error: unknown) {
  const raw = error instanceof Error ? error.message : "Phone verification failed";
  try {
    const jsonStart = raw.indexOf("{");
    if (jsonStart >= 0) return JSON.parse(raw.slice(jsonStart)).message || raw;
  } catch {}
  return raw.replace(/^\d+:\s*/, "");
}

export default function PhoneAuthScreen() {
  const insets = useSafeAreaInsets();
  const { verifyPhoneCode } = useAuth();
  const [purpose, setPurpose] = useState<"login" | "register">("login");
  const [role, setRole] = useState<UserRole>(initialRole);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+220");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [developmentCode, setDevelopmentCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const requestCode = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await apiRequest("POST", "/api/auth/phone/request", { phone, purpose, role, name: purpose === "register" ? name : undefined });
      const data = await response.json();
      setChallengeId(data.challengeId);
      setDevelopmentCode(data.developmentCode || "");
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await verifyPhoneCode(challengeId, code);
      router.replace((result.hasPin ? "/pin-entry" : getDefaultRouteForRole(result.user.role)) as any);
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 30 }]} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.back} onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={Colors.text}/></Pressable>
        <View style={styles.icon}><Ionicons name="phone-portrait-outline" size={28} color={Colors.primary}/></View>
        <Text style={styles.title}>Continue with your phone</Text>
        <Text style={styles.subtitle}>We will send a one-time code. Codes expire after 10 minutes and can only be used once.</Text>

        {!challengeId ? (
          <View style={styles.form}>
            <View style={styles.tabs}>
              <Pressable style={[styles.tab, purpose === "login" && styles.activeTab]} onPress={() => setPurpose("login")}><Text style={[styles.tabText, purpose === "login" && styles.activeTabText]}>Sign in</Text></Pressable>
              <Pressable style={[styles.tab, purpose === "register" && styles.activeTab]} onPress={() => setPurpose("register")}><Text style={[styles.tabText, purpose === "register" && styles.activeTabText]}>Create account</Text></Pressable>
            </View>
            {purpose === "register" ? <><Text style={styles.label}>Full name</Text><TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your full name" autoComplete="name"/></> : null}
            {purpose === "register" && audience === "business" ? (
              <View style={styles.roleRow}>
                <Pressable style={[styles.roleButton, role === "vendor" && styles.selectedRole]} onPress={() => setRole("vendor")}><Text style={styles.roleText}>Vendor</Text></Pressable>
                <Pressable style={[styles.roleButton, role === "service_provider" && styles.selectedRole]} onPress={() => setRole("service_provider")}><Text style={styles.roleText}>Service provider</Text></Pressable>
              </View>
            ) : null}
            <Text style={styles.label}>Gambian phone number</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="+220 123 456 789"/>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={styles.primary} disabled={busy} onPress={requestCode}>{busy ? <ActivityIndicator color="#fff"/> : <Text style={styles.primaryText}>Send verification code</Text>}</Pressable>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.label}>Six-digit code</Text>
            <TextInput style={[styles.input, styles.code]} value={code} onChangeText={value => setCode(value.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} placeholder="000000"/>
            {developmentCode ? <Text style={styles.dev}>Development code: {developmentCode}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={styles.primary} disabled={busy || code.length !== 6} onPress={verify}>{busy ? <ActivityIndicator color="#fff"/> : <Text style={styles.primaryText}>Verify and continue</Text>}</Pressable>
            <Pressable style={styles.secondary} disabled={busy} onPress={() => { setChallengeId(""); setCode(""); setError(""); }}><Text style={styles.secondaryText}>Use a different number</Text></Pressable>
          </View>
        )}
        <Text style={styles.note}>Phone sign-in is activated only when MansaMart&apos;s SMS provider is configured. Never share a verification code with anyone.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#fff" },
  content: { flexGrow: 1, paddingHorizontal: 24 },
  back: { width: 44, height: 44, justifyContent: "center", marginBottom: 24 },
  icon: { width: 58, height: 58, borderRadius: 18, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  title: { fontFamily: "Inter_700Bold", fontSize: 27, color: Colors.text },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, color: Colors.textSecondary, marginTop: 8, marginBottom: 24 },
  form: { gap: 12 },
  tabs: { flexDirection: "row", backgroundColor: Colors.borderLight, borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 9 },
  activeTab: { backgroundColor: "#fff" },
  tabText: { fontFamily: "Inter_600SemiBold", color: Colors.textMuted },
  activeTabText: { color: Colors.primary },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text, marginTop: 4 },
  input: { minHeight: 54, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.borderLight, borderRadius: 13, paddingHorizontal: 15, fontFamily: "Inter_400Regular", fontSize: 16, color: Colors.text },
  code: { fontFamily: "Inter_700Bold", letterSpacing: 8, textAlign: "center", fontSize: 24 },
  roleRow: { flexDirection: "row", gap: 10 },
  roleButton: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  selectedRole: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  roleText: { fontFamily: "Inter_600SemiBold", color: Colors.text, fontSize: 13 },
  primary: { minHeight: 56, borderRadius: 15, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", marginTop: 6 },
  primaryText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
  secondary: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: Colors.primary, fontFamily: "Inter_600SemiBold" },
  error: { color: Colors.error, fontFamily: "Inter_500Medium", fontSize: 13 },
  dev: { color: Colors.primary, backgroundColor: Colors.primaryLight, borderRadius: 10, padding: 10, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  note: { color: Colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, marginTop: 24 },
});
