import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity
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
  border: "#E5E7EB",
  white: "#FFFFFF",
  red: "#E63946",
};

const PIN_LENGTH = 6;

type Step = "create" | "confirm";

export default function PinSetupScreen() {
  const insets = useSafeAreaInsets();
  const { user, setupPin } = useAuth();
  const [step, setStep] = useState<Step>("create");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const currentPin = step === "create" ? pin : confirmPin;
  const setCurrentPin = step === "create" ? setPin : setConfirmPin;

  const handleDigit = (digit: string) => {
    if (currentPin.length < PIN_LENGTH) {
      const newPin = currentPin + digit;
      setCurrentPin(newPin);
      setError("");
      if (newPin.length === PIN_LENGTH) {
        if (step === "create") {
          setTimeout(() => setStep("confirm"), 200);
        } else {
          setTimeout(() => handleConfirm(newPin), 200);
        }
      }
    }
  };

  const handleDelete = () => {
    if (currentPin.length > 0) setCurrentPin(currentPin.slice(0, -1));
  };

  const handleBack = () => {
    if (step === "confirm") {
      setStep("create");
      setConfirmPin("");
      setError("");
    }
  };

  const handleConfirm = async (confirmedPin: string) => {
    if (pin !== confirmedPin) {
      setError("PINs do not match. Try again.");
      setConfirmPin("");
      setStep("create");
      setPin("");
      return;
    }
    setIsLoading(true);
    try {
      await setupPin(pin);
      router.replace(getDefaultRouteForRole(user?.role) as any);
    } catch (e: any) {
      setError(e.message ?? "Failed to set PIN");
    }
    setIsLoading(false);
  };

  const handleSkip = () => {
    router.replace(getDefaultRouteForRole(user?.role) as any);
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
        {step === "confirm" && (
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="lock-closed" size={44} color={COLORS.primary} />
        </View>

        <Text style={styles.title}>
          {step === "create" ? "Set Up PIN" : "Confirm PIN"}
        </Text>
        <Text style={styles.subtitle}>
          {step === "create"
            ? "Create a 6-digit PIN to secure your account"
            : "Re-enter your PIN to confirm"}
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.dotsRow}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < currentPin.length && styles.dotFilled,
              ]}
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
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    minHeight: 48,
  },
  backBtn: { position: "absolute", left: 20, padding: 4 },
  skipBtn: { padding: 4 },
  skipText: { color: COLORS.muted, fontSize: 16 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  iconContainer: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center", justifyContent: "center",
    marginBottom: 24,
  },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", color: COLORS.text, marginBottom: 8 },
  subtitle: { fontSize: 15, color: COLORS.muted, textAlign: "center", marginBottom: 32, lineHeight: 22 },
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
