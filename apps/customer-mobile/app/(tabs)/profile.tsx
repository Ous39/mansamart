import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Platform,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";

function MenuItem({
  icon, label, value, onPress, isDestructive, iconBg, iconColor, badge,
}: {
  icon: string; label: string; value?: string; onPress?: () => void;
  isDestructive?: boolean; iconBg?: string; iconColor?: string; badge?: number;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: Colors.borderLight }]}
      onPress={onPress}
    >
      <View style={[styles.menuIconWrap, { backgroundColor: isDestructive ? Colors.errorLight : (iconBg ?? Colors.primaryLight) }]}>
        <Ionicons name={icon as any} size={18} color={isDestructive ? Colors.error : (iconColor ?? Colors.primary)} />
      </View>
      <Text style={[styles.menuLabel, isDestructive && { color: Colors.error }]}>{label}</Text>
      <View style={styles.menuRight}>
        {value && <Text style={styles.menuValue}>{value}</Text>}
        {badge != null && badge > 0 && (
          <View style={styles.menuBadge}>
            <Text style={styles.menuBadgeText}>{badge > 9 ? "9+" : badge}</Text>
          </View>
        )}
        {!isDestructive && <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />}
      </View>
    </Pressable>
  );
}

function roleLabel(role: string) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    user: { label: "Shopper", color: Colors.primary, bg: Colors.primaryLight },
  };
  return map[role] ?? map.user;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, logout, updateProfile } = useAuth();
  const { unreadCount } = useNotifications();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [address, setAddress] = useState(user?.address ?? "");
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const role = user?.role ?? "user";
  const rl = roleLabel(role);

  const handleLogout = () => {
    if (Platform.OS === "web") { logout(); router.replace("/"); return; }
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => { await logout(); router.replace("/"); } },
    ]);
  };

  const handleSave = async () => {
    await updateProfile({ name, phone, address });
    setEditing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: topPad + 32 }]}>
        <View style={styles.unauthContainer}>
          <View style={styles.unauthIcon}>
            <Ionicons name="person-outline" size={48} color={Colors.border} />
          </View>
          <Text style={styles.unauthTitle}>Sign in to view profile</Text>
          <Text style={styles.unauthSubtext}>Access your orders, wishlist, bookings and settings</Text>
          <Pressable style={styles.signInBtn} onPress={() => router.push("/(auth)/login")}>
            <Text style={styles.signInBtnText}>Sign In</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/(auth)/register")}>
            <Text style={styles.registerLink}>Create an account</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: 120 + (Platform.OS === "web" ? 34 : 0) }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.headerIconBtn} onPress={() => router.push("/notifications")} hitSlop={8}>
            <Ionicons name="notifications-outline" size={20} color={Colors.text} />
            {unreadCount > 0 && <View style={styles.headerBadge}><Text style={styles.headerBadgeText}>{unreadCount}</Text></View>}
          </Pressable>
          <Pressable style={styles.headerIconBtn} onPress={() => router.push("/settings")} hitSlop={8}>
            <Ionicons name="settings-outline" size={20} color={Colors.text} />
          </Pressable>
          <Pressable
            onPress={() => { if (editing) handleSave(); else setEditing(true); }}
            style={styles.editBtn}
          >
            <Text style={styles.editBtnText}>{editing ? "Save" : "Edit"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.avatarSection}>
        <View style={[styles.avatar, { backgroundColor: rl.color }]}>
          <Text style={styles.avatarText}>
            {(user?.name ?? "?").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
          </Text>
        </View>
        <View style={styles.avatarInfo}>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={styles.roleRow}>
            <View style={[styles.roleBadge, { backgroundColor: rl.bg }]}>
              <Text style={[styles.roleText, { color: rl.color }]}>{rl.label}</Text>
            </View>
            {user?.isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
          </View>
          {user?.businessName && <Text style={styles.businessName}>{user.businessName}</Text>}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Personal Details</Text>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Full Name</Text>
          {editing ? (
            <TextInput style={styles.fieldInput} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={Colors.textMuted} />
          ) : <Text style={styles.fieldValue}>{user?.name ?? "—"}</Text>}
        </View>
        <View style={[styles.fieldRow, styles.fieldDivider]}>
          <Text style={styles.fieldLabel}>Email</Text>
          <Text style={styles.fieldValue}>{user?.email}</Text>
        </View>
        <View style={[styles.fieldRow, styles.fieldDivider]}>
          <Text style={styles.fieldLabel}>Phone</Text>
          {editing ? (
            <TextInput style={styles.fieldInput} value={phone} onChangeText={setPhone} placeholder="Your phone" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" />
          ) : <Text style={styles.fieldValue}>{user?.phone || "Add phone"}</Text>}
        </View>
        <View style={[styles.fieldRow, styles.fieldDivider]}>
          <Text style={styles.fieldLabel}>Address</Text>
          {editing ? (
            <TextInput style={[styles.fieldInput, { flex: 1 }]} value={address} onChangeText={setAddress} placeholder="Your address" placeholderTextColor={Colors.textMuted} multiline />
          ) : <Text style={[styles.fieldValue, { flex: 1, textAlign: "right" }]}>{user?.address || "Add address"}</Text>}
        </View>
        {user?.createdAt && (
          <View style={[styles.fieldRow, styles.fieldDivider]}>
            <Text style={styles.fieldLabel}>Member since</Text>
            <Text style={styles.fieldValue}>{String(user.createdAt).split("T")[0]}</Text>
          </View>
        )}
      </View>

      {role === "user" && (
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Shopping</Text>
          <View style={styles.menuCard}>
            <MenuItem icon="bag-outline" label="Shopping Orders" onPress={() => router.push({ pathname: "/(tabs)/wishlist", params: { tab: "history" } })} />
            <MenuItem icon="location-outline" label="Track Order" onPress={() => router.push("/order-tracking")} />
            <MenuItem icon="calendar-outline" label="My Bookings" onPress={() => router.push({ pathname: "/(tabs)/wishlist", params: { tab: "bookings" } })} />
            <MenuItem icon="return-down-back-outline" label="Returns & Refunds" onPress={() => router.push("/returns")} />
            <MenuItem icon="star-outline" label="My Reviews" onPress={() => router.push("/my-reviews")} />
          </View>
        </View>
      )}

      <View style={styles.menuSection}>
        <Text style={styles.menuSectionTitle}>Preferences</Text>
        <View style={styles.menuCard}>
          <MenuItem icon="notifications-outline" label="Notifications" badge={unreadCount} onPress={() => router.push("/notifications")} />
          <MenuItem icon="settings-outline" label="Settings" onPress={() => router.push("/settings")} />
          <MenuItem icon="cube-outline" label="Track My Order" onPress={() => router.push("/order-tracking")} />
          <MenuItem icon="shield-outline" label="Privacy & Security" onPress={() => router.push("/settings")} />
          <MenuItem icon="help-circle-outline" label="Help & Support" onPress={() => router.push("/support")} />
          <MenuItem icon="information-circle-outline" label="About MansaMart" value="v2.0.0" onPress={() => router.push({ pathname: "/information", params: { page: "about" } })} />
        </View>
      </View>

      <View style={styles.menuSection}>
        <View style={styles.menuCard}>
          <MenuItem icon="log-out-outline" label="Sign Out" onPress={handleLogout} isDestructive />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", color: Colors.text },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerIconBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center", position: "relative" },
  headerBadge: { position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: Colors.background },
  headerBadgeText: { fontSize: 8, fontFamily: "Inter_700Bold", color: "#fff" },
  editBtn: { backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  editBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  avatarSection: { flexDirection: "row", alignItems: "flex-start", gap: 16, marginBottom: 20 },
  avatar: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff" },
  avatarInfo: { flex: 1, gap: 4 },
  userName: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  userEmail: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  roleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  roleBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  roleText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
  verifiedText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.success },
  businessName: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary, fontStyle: "italic" },
  dashBanner: {
    borderRadius: 20, padding: 20, marginBottom: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  dashBannerLeft: { flex: 1, gap: 4 },
  dashBannerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff" },
  dashBannerSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)" },
  dashBannerBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9,
  },
  dashBannerBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTitle: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 },
  fieldRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, gap: 12 },
  fieldDivider: { borderTopWidth: 1, borderTopColor: Colors.borderLight },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary, minWidth: 80 },
  fieldValue: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.text, flexShrink: 1, textAlign: "right" },
  fieldInput: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.text, textAlign: "right", borderBottomWidth: 1, borderBottomColor: Colors.primary, paddingVertical: 2, minWidth: 140 },
  menuSection: { marginBottom: 16 },
  menuSectionTitle: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 },
  menuCard: { backgroundColor: Colors.surface, borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  menuIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.text },
  menuRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  menuValue: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  menuBadge: { backgroundColor: Colors.accent, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, minWidth: 20, alignItems: "center" },
  menuBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff" },
  unauthContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 },
  unauthIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: Colors.borderLight, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  unauthTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text, textAlign: "center" },
  unauthSubtext: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", lineHeight: 21 },
  signInBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14, marginTop: 8 },
  signInBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  registerLink: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.primary, marginTop: 4 },
});
