import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { getDefaultRouteForRole } from "@/lib/role-routes";
import { safeBack } from "@/lib/navigation";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      const { hasPin, user } = await login(email.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace((hasPin ? "/pin-entry" : getDefaultRouteForRole(user.role)) as any);
    } catch (e) {
      setError("Invalid email or password");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 20,
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 20,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => safeBack("/")}
          style={styles.backBtn}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>

        <View style={styles.header}>
          <View style={styles.logoMini}>
            <Image
              source={require("@/assets/images/icon.png")}
              style={styles.logoImg}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to MansaMart</Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View>
            <Text style={styles.label}>Email address</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="client@mansamart.studio"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>
          </View>

          <View>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Enter your password"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
              />
              <Pressable onPress={() => setShowPassword(p => !p)} hitSlop={8} style={styles.eyeBtn}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={Colors.textMuted}
                />
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={() => router.push("/(auth)/forgot-password")}
            style={styles.forgotBtn}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              isLoading && styles.disabledBtn,
            ]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Sign In</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <Pressable onPress={() => router.replace("/(auth)/register")}>
            <Text style={styles.footerLink}> Create account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    backgroundColor: "#fff",
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  header: {
    marginBottom: 32,
  },
  logoMini: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoImg: {
    width: 40,
    height: 40,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  form: {
    gap: 16,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.borderLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  eyeBtn: {
    padding: 4,
  },
  forgotBtn: {
    alignSelf: "flex-end",
    marginTop: -4,
  },
  forgotText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  disabledBtn: {
    opacity: 0.7,
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.errorLight,
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.error,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 32,
  },
  footerText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  footerLink: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
});
