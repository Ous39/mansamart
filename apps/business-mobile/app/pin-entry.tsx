import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { getDefaultRouteForRole } from "@/lib/role-routes";

const COLORS = {
  primary: "#0EA47A",
  primaryLight: "#E6FAF3",
  bg: "#F7F8FA",
  text: "#1A1A2E",
  muted: "#6B7280",
  white: "#FFFFFF",
  red: "#E63946",
};

const PIN_LENGTH = 6;

export default function PinEntryScreen() {
  const insets = useSafeAreaInsets();
  const { user, verifyPin, logout } = useAuth();
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);

  const handleDigit = (digit: string) => {
    if (pin.length < PIN_LENGTH && !isLoading) {
      const newPin = pin + digit;
      setPin(newPin);
      setError("");
      if (newPin.length === PIN_LENGTH) {
        setTimeout(() => handleVerify(newPin), 150);
      }
    }
  };

  const handleDelete = () => {
    if (pin.length > 0 && !isLoading) setPin(pin.slice(0, -1));
  };

  const handleVerify = async (enteredPin: string) => {
    setIsLoading(true);
    try {
      await verifyPin(enteredPin);
      router.replace(getDefaultRouteForRole(user?.role) as any);
    } catch {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setError(newAttempts >= 5 ? "Too many attempts. Please log in again." : "Incorrect PIN. Try again.");
      setPin("");
      if (newAttempts >= 5) {
        await logout();
        router.replace("/(auth)/login");
      }
    }
    setIsLoading(false);
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  const keypad = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["", "0", "del"],
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Switch Account</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {user?.avatar ? null : (
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() ?? "?"}</Text>
          </View>
        )}

        <Text style={styles.hello}>Welcome back,</Text>
        <Text style={styles.name} numberOfLines={1}>{user?.name ?? "User"}</Text>
        <Text style={styles.subtitle}>Enter your 6-digit PIN</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.dotsRow}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i < pin.length && styles.dotFilled]}
            />
          ))}
        </View>

        <View style={styles.keypad}>
          {keypad.map((row, ri) => (
            <View key={ri} style={styles.keypadRow}>
              {row.map((key, ki) => (
                <View key={ki} style={styles.keyWrap}>
                  {key === "" ? (
                    <View style={styles.keyEmpty} />
                  ) : key === "del" ? (
                    <TouchableOpacity style={styles.keyBtn} onPress={handleDelete}>
                      <Ionicons name="backspace-outline" size={24} color={COLORS.text} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.keyBtn}
                      onPress={() => handleDigit(key)}
                      disabled={isLoading}
                    >
                      <Text style={styles.keyText}>{key}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 8,
    minHeight: 48,
  },
  logoutBtn: { padding: 4 },
  logoutText: { color: COLORS.muted, fontSize: 15 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
    marginBottom: 16,
  },
  avatarText: { fontSize: 32, fontFamily: "Inter_700Bold", color: COLORS.white },
  hello: { fontSize: 16, color: COLORS.muted, marginBottom: 2 },
  name: { fontSize: 22, fontFamily: "Inter_700Bold", color: COLORS.text, marginBottom: 24, maxWidth: 280 },
  subtitle: { fontSize: 15, color: COLORS.muted, marginBottom: 12 },
  error: { color: COLORS.red, fontSize: 14, marginBottom: 16, textAlign: "center" },
  dotsRow: { flexDirection: "row", gap: 14, marginBottom: 48 },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: COLORS.primary,
    backgroundColor: "transparent",
  },
  dotFilled: { backgroundColor: COLORS.primary },
  keypad: { width: "100%", gap: 12 },
  keypadRow: { flexDirection: "row", justifyContent: "center", gap: 16 },
  keyWrap: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  keyBtn: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: COLORS.white,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.06,
    shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  keyEmpty: { width: 76, height: 76 },
  keyText: { fontSize: 26, fontFamily: "Inter_600SemiBold", color: COLORS.text },
});
