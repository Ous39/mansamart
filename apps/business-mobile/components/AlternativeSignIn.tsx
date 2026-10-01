import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import Colors from "@/constants/colors";
import { useAuth, type UserRole } from "@/contexts/AuthContext";
import { getDefaultRouteForRole } from "@/lib/role-routes";

WebBrowser.maybeCompleteAuthSession();

export function AlternativeSignIn({ role }: { role?: UserRole }) {
  const { socialLogin } = useAuth();
  const [busy, setBusy] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState("");
  const [appleAvailable, setAppleAvailable] = useState(false);
  const handledGoogleToken = useRef("");
  const googleConfigured = Boolean(
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
  );
  const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "not-configured";

  const [, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: googleClientId,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || googleClientId,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || googleClientId,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || googleClientId,
  });

  const finish = useCallback(async (provider: "google" | "apple", idToken: string, nonce?: string, name?: string) => {
    try {
      setError(""); setBusy(provider);
      const result = await socialLogin(provider, idToken, nonce, role, name);
      router.replace((result.hasPin ? "/pin-entry" : getDefaultRouteForRole(result.user.role)) as any);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message.replace(/^\d+:\s*/, "") : "Sign-in failed");
    } finally { setBusy(null); }
  }, [role, socialLogin]);

  useEffect(() => {
    if (Platform.OS === "ios") void AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  useEffect(() => {
    if (response?.type !== "success") return;
    const idToken = response.authentication?.idToken || response.params.id_token;
    if (!idToken) {
      setError("Google did not return a secure identity token.");
      setBusy(null);
      return;
    }
    if (handledGoogleToken.current === idToken) return;
    handledGoogleToken.current = idToken;
    void finish("google", idToken);
  }, [finish, response]);

  const signInWithApple = async () => {
    try {
      setBusy("apple");
      setError("");
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) throw new Error("Apple did not return a secure identity token.");
      const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(" ") || undefined;
      await finish("apple", credential.identityToken, rawNonce, name);
    } catch (reason: any) {
      if (reason?.code !== "ERR_REQUEST_CANCELED") setError(reason instanceof Error ? reason.message : "Apple sign-in failed");
      setBusy(null);
    }
  };

  if (!googleConfigured && !appleAvailable) return (
    <Pressable style={styles.phoneButton} onPress={() => router.push("/(auth)/phone")}>
      <Ionicons name="call-outline" size={19} color={Colors.text} />
      <Text style={styles.buttonText}>Continue with phone</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.divider}><View style={styles.line}/><Text style={styles.or}>or</Text><View style={styles.line}/></View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {googleConfigured ? (
        <Pressable style={styles.button} disabled={busy !== null} onPress={() => { setBusy("google"); void promptAsync(); }}>
          {busy === "google" ? <ActivityIndicator color={Colors.text}/> : <Ionicons name="logo-google" size={19} color="#4285F4"/>}
          <Text style={styles.buttonText}>Continue with Google</Text>
        </Pressable>
      ) : null}
      {appleAvailable ? (
        <Pressable style={styles.button} disabled={busy !== null} onPress={signInWithApple}>
          {busy === "apple" ? <ActivityIndicator color={Colors.text}/> : <Ionicons name="logo-apple" size={20} color="#111827"/>}
          <Text style={styles.buttonText}>Continue with Apple</Text>
        </Pressable>
      ) : null}
      <Pressable style={styles.phoneButton} disabled={busy !== null} onPress={() => router.push("/(auth)/phone")}>
        <Ionicons name="call-outline" size={19} color={Colors.text} />
        <Text style={styles.buttonText}>Continue with phone</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, marginTop: 20 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 4 },
  line: { flex: 1, height: 1, backgroundColor: Colors.border },
  or: { color: Colors.textMuted, fontFamily: "Inter_500Medium", fontSize: 13 },
  button: { minHeight: 52, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  phoneButton: { minHeight: 52, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", backgroundColor: Colors.borderLight },
  buttonText: { color: Colors.text, fontFamily: "Inter_600SemiBold", fontSize: 14 },
  error: { color: Colors.error, fontFamily: "Inter_500Medium", fontSize: 12, textAlign: "center" },
});
