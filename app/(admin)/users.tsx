import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, Pressable, FlatList, Platform,
  TextInput, Alert, Modal,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth, User, UserRole } from "@/contexts/AuthContext";

const ROLE_OPTIONS: UserRole[] = ["user", "vendor", "service_provider", "delivery_rider", "admin"];

function roleStyle(role: UserRole) {
  const map = {
    user: { color: Colors.primary, bg: Colors.primaryLight, label: "Shopper" },
    vendor: { color: "#2563EB", bg: "#EFF6FF", label: "Vendor" },
    service_provider: { color: "#7B4FA3", bg: "#F3E8FF", label: "Provider" },
    delivery_rider: { color: "#E8813A", bg: "#FFF7ED", label: "Rider" },
    admin: { color: "#DC2626", bg: "#FEF2F2", label: "Admin" },
  };
  return map[role] ?? map.user;
}

export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets();
  const { allUsers, updateUserRole, removeUser, refreshUsers } = useAuth();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("All");
  const [editUser, setEditUser] = useState<User | null>(null);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  useEffect(() => { refreshUsers(); }, []);

  const ROLE_FILTERS = ["All", "Shopper", "Vendor", "Provider", "Rider", "Admin"];

  const filtered = allUsers.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole = roleFilter === "All" ||
      (roleFilter === "Shopper" ? u.role === "user" : roleFilter === "Provider" ? u.role === "service_provider" : roleFilter === "Rider" ? u.role === "delivery_rider" : u.role === roleFilter.toLowerCase());
    return matchSearch && matchRole;
  });

  const handleDelete = (u: User) => {
    if (u.role === "admin") return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Remove User",
      `Remove ${u.name} from the platform?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => removeUser(u.id) },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>Users</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{filtered.length}</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={17} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or email..."
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.filterRow}>
        {ROLE_FILTERS.map(f => (
          <Pressable
            key={f}
            style={[styles.filterChip, roleFilter === f && styles.filterChipActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setRoleFilter(f);
            }}
          >
            <Text style={[styles.filterText, roleFilter === f && styles.filterTextActive]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={u => u.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 + (Platform.OS === "web" ? 34 : 0) }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: u }) => {
          const rs = roleStyle(u.role);
          return (
            <View style={styles.userCard}>
              <View style={[styles.avatar, { backgroundColor: rs.bg }]}>
                <Text style={[styles.avatarText, { color: rs.color }]}>
                  {u.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.userName}>{u.name}</Text>
                  {u.isVerified && <Ionicons name="checkmark-circle" size={14} color={Colors.success} />}
                </View>
                <Text style={styles.userEmail}>{u.email}</Text>
                {u.businessName && <Text style={styles.businessName}>{u.businessName}</Text>}
                <Text style={styles.joinDate}>Joined {u.createdAt ? String(u.createdAt).split("T")[0] : ""}</Text>
              </View>
              <View style={styles.userActions}>
                <View style={[styles.roleBadge, { backgroundColor: rs.bg }]}>
                  <Text style={[styles.roleText, { color: rs.color }]}>{rs.label}</Text>
                </View>
                <View style={styles.actionBtns}>
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setEditUser(u);
                    }}
                  >
                    <Ionicons name="create-outline" size={16} color={Colors.primary} />
                  </Pressable>
                  {u.role !== "admin" && (
                    <Pressable style={[styles.actionBtn, { backgroundColor: "#FEF2F2" }]} onPress={() => handleDelete(u)}>
                      <Ionicons name="trash-outline" size={16} color={Colors.error} />
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={Colors.border} />
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        }
      />

      <Modal visible={!!editUser} transparent animationType="slide" onRequestClose={() => setEditUser(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Role</Text>
              <Pressable onPress={() => setEditUser(null)} hitSlop={8}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </Pressable>
            </View>
            <Text style={styles.modalSubtitle}>{editUser?.name}</Text>
            <View style={styles.roleOptions}>
              {ROLE_OPTIONS.map(r => {
                const rs = roleStyle(r);
                const isSelected = editUser?.role === r;
                return (
                  <Pressable
                    key={r}
                    style={[styles.roleOption, isSelected && { backgroundColor: rs.bg, borderColor: rs.color }]}
                    onPress={() => {
                      if (editUser) {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        updateUserRole(editUser.id, r);
                        setEditUser({ ...editUser, role: r });
                      }
                    }}
                  >
                    <View style={[styles.roleOptionIcon, { backgroundColor: rs.bg }]}>
                      <Ionicons
                        name={r === "admin" ? "shield-outline" : r === "vendor" ? "storefront-outline" : r === "service_provider" ? "construct-outline" : "person-outline"}
                        size={18}
                        color={rs.color}
                      />
                    </View>
                    <Text style={[styles.roleOptionText, isSelected && { color: rs.color, fontFamily: "Inter_700Bold" }]}>
                      {rs.label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={18} color={rs.color} />}
                  </Pressable>
                );
              })}
            </View>
            <Pressable style={styles.doneBtn} onPress={() => setEditUser(null)}>
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingBottom: 12,
  },
  title: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  countBadge: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  countText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 20, marginBottom: 10,
    backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, height: 44,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.text },
  filterRow: { flexDirection: "row", gap: 6, paddingHorizontal: 20, paddingBottom: 10 },
  filterChip: {
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  filterTextActive: { color: "#fff" },
  userCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  avatar: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  userInfo: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  userName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  userEmail: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  businessName: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.primary },
  joinDate: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  userActions: { alignItems: "flex-end", gap: 8 },
  roleBadge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  roleText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  actionBtns: { flexDirection: "row", gap: 6 },
  actionBtn: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center",
  },
  emptyState: { alignItems: "center", gap: 12, paddingTop: 60 },
  emptyText: { fontSize: 16, fontFamily: "Inter_500Medium", color: Colors.textMuted },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 16,
    paddingBottom: 36,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  modalSubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: -8 },
  roleOptions: { gap: 10 },
  roleOption: {
    flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 14,
    borderWidth: 2, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  roleOptionIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  roleOptionText: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.text },
  doneBtn: {
    backgroundColor: Colors.primary, borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center",
  },
  doneBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
