import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Platform, Alert, ActivityIndicator,
} from "react-native";
import { router, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/query-client";
import { pickAndUploadImage } from "@/lib/upload-image";

async function apiCall(path: string, method: string, body?: any) {
  const response = await apiRequest(method, path, body);
  return response.json();
}

const ALL_AREAS = ["Banjul", "Serrekunda", "Kanifing", "Bakau", "Fajara", "Kotu", "Kololi", "Tallinding", "Brikama", "Farafenni", "Basse", "Kerewan"];

export default function ProviderSettingsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { logout } = useAuth();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery<any>({
    queryKey: ["/api/providers/me/profile"],
  });

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  const [whatsapp, setWhatsapp] = useState("");
  const [responseTime, setResponseTime] = useState("< 1 hour");
  const [certInput, setCertInput] = useState("");
  const [certs, setCerts] = useState<string[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [docType, setDocType] = useState("Professional Certificate");
  const [uploading, setUploading] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState<"mobile_money" | "bank_transfer">("mobile_money");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [mobileMoneyProvider, setMobileMoneyProvider] = useState("Wave");
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState("");

  React.useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || "");
      setBio(profile.bio || "");
      setLocation(profile.location || "");
      setServiceAreas(profile.serviceAreas || []);
      setWhatsapp(profile.whatsapp || "");
      setResponseTime(profile.responseTime || "< 1 hour");
      setCerts(profile.certifications || []);
      setDocuments(Array.isArray(profile.documents) ? profile.documents : []);
      setPayoutMethod(profile.payoutMethod || "mobile_money");
      setBankName(profile.bankName || "");
      setAccountName(profile.accountName || "");
      setAccountNumber(profile.accountNumber || "");
      setMobileMoneyProvider(profile.mobileMoneyProvider || "Wave");
      setMobileMoneyNumber(profile.mobileMoneyNumber || "");
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: (data: any) => apiCall("/api/providers/profile", "PUT", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/providers/me/profile"] }); Alert.alert("✅", "Profile saved!"); },
    onError: (e: any) => Alert.alert("Error", e.message),
  });

  function toggleArea(area: string) {
    setServiceAreas(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]);
  }

  function addCert() {
    if (certInput.trim()) { setCerts(prev => [...prev, certInput.trim()]); setCertInput(""); }
  }

  async function uploadDocument() {
    try {
      setUploading(true);
      const url = await pickAndUploadImage("provider-document");
      if (!url) return;
      const next = [...documents, { type: docType, name: `${docType} - ${new Date().toLocaleDateString()}`, url }];
      await apiCall("/api/providers/me/documents", "PUT", { documents: next });
      setDocuments(next);
      await qc.invalidateQueries({ queryKey: ["/api/providers/me/profile"] });
      Alert.alert("Document submitted", "Your verification file was updated and is ready for administrator review.");
    } catch (error: any) {
      Alert.alert("Upload failed", error?.message || "Could not upload the document.");
    } finally { setUploading(false); }
  }

  async function removeDocument(index: number) {
    try {
      const next = documents.filter((_, itemIndex) => itemIndex !== index);
      await apiCall("/api/providers/me/documents", "PUT", { documents: next });
      setDocuments(next);
      await qc.invalidateQueries({ queryKey: ["/api/providers/me/profile"] });
    } catch (error: any) {
      Alert.alert("Update failed", error?.message || "Could not remove the document.");
    }
  }

  const verificationStatus = profile?.verificationStatus || "pending";
  const statusConfig: Record<string, { color: string; icon: string; label: string; desc: string }> = {
    pending: { color: "#F59E0B", icon: "time-outline", label: "Pending Verification", desc: "Your profile is under review. This usually takes 1-2 business days." },
    verified: { color: "#0EA47A", icon: "checkmark-circle", label: "Verified Provider", desc: "You're verified! Clients see a badge on your services." },
    rejected: { color: "#E63946", icon: "close-circle", label: "Verification Rejected", desc: profile?.verificationNote || "Please contact support to resubmit." },
    not_submitted: { color: "#888", icon: "document-outline", label: "Not Submitted", desc: "Submit your documents to get verified." },
  };
  const st = statusConfig[verificationStatus] || statusConfig.pending;

  const responseTimes = ["< 30 minutes", "< 1 hour", "< 2 hours", "< 4 hours", "Same day"];

  return (
    <View style={{ flex: 1, backgroundColor: "#F7F8FA" }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={24} color="#1A1A2E" /></Pressable>
        <Text style={styles.headerTitle}>Provider Profile</Text>
        <Pressable onPress={() => save.mutate({ displayName, bio, location, serviceAreas, whatsapp, responseTime, certifications: certs, payoutMethod, bankName, accountName, accountNumber, mobileMoneyProvider, mobileMoneyNumber })} disabled={save.isPending}>
          {save.isPending ? <ActivityIndicator size="small" color={Colors.primary} /> : <Text style={styles.saveBtn}>Save</Text>}
        </Pressable>
      </View>

      {isLoading ? <ActivityIndicator style={{ marginTop: 60 }} color={Colors.primary} /> : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Verification Status */}
          <View style={[styles.statusCard, { borderLeftColor: st.color }]}>
            <Ionicons name={st.icon as any} size={22} color={st.color} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusLabel, { color: st.color }]}>{st.label}</Text>
              <Text style={styles.statusDesc}>{st.desc}</Text>
            </View>
          </View>

          {/* Stats */}
          {profile && (
            <View style={styles.statsRow}>
              <StatBox label="Jobs" value={profile.totalJobs || 0} icon="briefcase-outline" />
              <StatBox label="Reviews" value={profile.reviewCount || 0} icon="chatbubble-outline" />
              <StatBox label="Rating" value={(profile.rating || 4.5).toFixed(1)} icon="star" iconColor="#F59E0B" />
            </View>
          )}

          {/* Profile */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profile Information</Text>
            <Field label="Display Name" value={displayName} onChange={setDisplayName} placeholder="Your business/service name" />
            <Field label="Bio" value={bio} onChange={setBio} placeholder="Describe your experience and services..." multiline />
            <Field label="Location" value={location} onChange={setLocation} placeholder="e.g. Bakau, Greater Banjul" />
          </View>

          {/* Service Areas */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service Areas</Text>
            <Text style={styles.hint}>Select the areas where you provide services</Text>
            <View style={styles.areasGrid}>
              {ALL_AREAS.map(area => {
                const selected = serviceAreas.includes(area);
                return (
                  <Pressable key={area} onPress={() => toggleArea(area)} style={[styles.areaChip, selected && styles.areaChipActive]}>
                    {selected && <Ionicons name="checkmark" size={12} color="#fff" />}
                    <Text style={[styles.areaChipText, selected && styles.areaChipTextActive]}>{area}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Response Time */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Response Time</Text>
            <View style={styles.areasGrid}>
              {responseTimes.map(rt => (
                <Pressable key={rt} onPress={() => setResponseTime(rt)} style={[styles.areaChip, responseTime === rt && styles.areaChipActive]}>
                  <Text style={[styles.areaChipText, responseTime === rt && styles.areaChipTextActive]}>{rt}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Certifications */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Certifications</Text>
            {certs.map((cert, i) => (
              <View key={i} style={styles.certRow}>
                <Ionicons name="ribbon-outline" size={16} color={Colors.primary} />
                <Text style={styles.certText}>{cert}</Text>
                <Pressable onPress={() => setCerts(prev => prev.filter((_, j) => j !== i))}>
                  <Ionicons name="close-circle" size={18} color="#E63946" />
                </Pressable>
              </View>
            ))}
            <View style={styles.certInputRow}>
              <TextInput
                style={styles.certInput}
                value={certInput}
                onChangeText={setCertInput}
                placeholder="Add a certification..."
                placeholderTextColor="#bbb"
                onSubmitEditing={addCert}
              />
              <Pressable onPress={addCert} style={styles.certAddBtn}>
                <Ionicons name="add" size={20} color="#fff" />
              </Pressable>
            </View>
          </View>

          {/* Business Documents */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Documents & Media</Text>
            <Text style={styles.hint}>Upload clear photos of the documents required for verification. Web links are not accepted here.</Text>
            <View style={styles.areasGrid}>
              {["Professional Certificate", "Business License", "National ID / Passport"].map((type) => (
                <Pressable key={type} style={[styles.areaChip, docType === type && styles.areaChipActive]} onPress={() => setDocType(type)}>
                  <Text style={[styles.areaChipText, docType === type && styles.areaChipTextActive]}>{type}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.uploadBtn} onPress={uploadDocument} disabled={uploading}>
              {uploading ? <ActivityIndicator color="#fff" /> : <Ionicons name="cloud-upload-outline" size={18} color="#fff" />}
              <Text style={styles.uploadText}>{uploading ? "Uploading..." : `Upload ${docType}`}</Text>
            </Pressable>
            {documents.map((document, index) => (
              <View key={`${document.url}-${index}`} style={styles.documentRow}>
                <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
                <View style={{ flex: 1 }}><Text style={styles.documentName}>{document.name || document.type}</Text><Text style={styles.documentStatus}>Submitted for review</Text></View>
                <Pressable onPress={() => removeDocument(index)}><Ionicons name="trash-outline" size={18} color="#E63946" /></Pressable>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payout Details</Text>
            <Text style={styles.hint}>Payout requests are reviewed by MansaMart. Saving these details does not transfer money automatically.</Text>
            <View style={styles.areasGrid}>
              <Pressable style={[styles.areaChip, payoutMethod === "mobile_money" && styles.areaChipActive]} onPress={() => setPayoutMethod("mobile_money")}><Text style={[styles.areaChipText, payoutMethod === "mobile_money" && styles.areaChipTextActive]}>Mobile money</Text></Pressable>
              <Pressable style={[styles.areaChip, payoutMethod === "bank_transfer" && styles.areaChipActive]} onPress={() => setPayoutMethod("bank_transfer")}><Text style={[styles.areaChipText, payoutMethod === "bank_transfer" && styles.areaChipTextActive]}>Bank transfer</Text></Pressable>
            </View>
            <Field label="Account Name" value={accountName} onChange={setAccountName} placeholder="Name on the account" />
            {payoutMethod === "mobile_money" ? <>
              <Field label="Mobile Money Provider" value={mobileMoneyProvider} onChange={setMobileMoneyProvider} placeholder="e.g. Wave" />
              <Field label="Mobile Money Number" value={mobileMoneyNumber} onChange={setMobileMoneyNumber} placeholder="+220 7xxxxxx" keyboardType="phone-pad" />
            </> : <>
              <Field label="Bank Name" value={bankName} onChange={setBankName} placeholder="Bank name" />
              <Field label="Account Number" value={accountNumber} onChange={setAccountNumber} placeholder="Bank account number" />
            </>}
          </View>

          {/* Contact */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact</Text>
            <Field label="WhatsApp" value={whatsapp} onChange={setWhatsapp} placeholder="+220 7xxxxxx" keyboardType="phone-pad" icon="logo-whatsapp" />
          </View>

          {/* Quick Links */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Manage</Text>
            <QuickLink icon="list-outline" label="My Services" onPress={() => router.push("/(provider)/services")} />
            <QuickLink icon="calendar-outline" label="Bookings" onPress={() => router.push("/(provider)/bookings")} />
            <QuickLink icon="bar-chart-outline" label="Dashboard" onPress={() => router.push("/(provider)/" as any)} />
            <QuickLink icon="wallet-outline" label="Finance & Payouts" onPress={() => router.push("/wallet")} />
            <QuickLink icon="help-buoy-outline" label="Business Support" onPress={() => router.push("/business-support" as any)} />
          </View>

          <Pressable style={styles.logoutBtn} onPress={() => { logout(); router.replace("/(auth)/login"); }}>
            <Ionicons name="log-out-outline" size={18} color="#E63946" />
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
          <View style={{ height: Platform.OS === "web" ? 34 : insets.bottom + 20 }} />
        </ScrollView>
      )}
    </View>
  );
}

function StatBox({ label, value, icon, iconColor }: any) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon} size={18} color={iconColor || Colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Field({ label, value, onChange, placeholder, multiline, keyboardType, icon }: any) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value} onChangeText={onChange} placeholder={placeholder}
        multiline={multiline} keyboardType={keyboardType || "default"}
        placeholderTextColor="#bbb"
      />
    </View>
  );
}

function QuickLink({ icon, label, onPress }: any) {
  return (
    <Pressable style={styles.quickLink} onPress={onPress}>
      <View style={styles.quickLinkLeft}>
        <View style={styles.quickLinkIcon}><Ionicons name={icon} size={18} color={Colors.primary} /></View>
        <Text style={styles.quickLinkLabel}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#ccc" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  back: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#1A1A2E" },
  saveBtn: { color: Colors.primary, fontSize: 15, fontWeight: "700" },
  content: { padding: 16, gap: 12 },
  statusCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: "#fff", borderRadius: 16, padding: 14, borderLeftWidth: 4 },
  statusLabel: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  statusDesc: { fontSize: 13, color: "#666", lineHeight: 18 },
  statsRow: { flexDirection: "row", gap: 8 },
  statBox: { flex: 1, alignItems: "center", gap: 4, backgroundColor: "#fff", borderRadius: 12, paddingVertical: 12 },
  statValue: { fontSize: 18, fontWeight: "800", color: "#1A1A2E" },
  statLabel: { fontSize: 10, color: "#888" },
  section: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 2 },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: "#aaa", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },
  hint: { fontSize: 12, color: "#999", marginBottom: 10 },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#555", marginBottom: 6 },
  input: { backgroundColor: "#F7F8FA", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#1A1A2E" },
  inputMulti: { minHeight: 80, textAlignVertical: "top" },
  areasGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  areaChip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "#F7F8FA" },
  areaChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  areaChipText: { fontSize: 13, color: "#666" },
  areaChipTextActive: { color: "#fff", fontWeight: "700" },
  certRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F5F5F5" },
  certText: { flex: 1, fontSize: 13, color: "#1A1A2E" },
  certInputRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  certInput: { flex: 1, backgroundColor: "#F7F8FA", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: "#1A1A2E" },
  certAddBtn: { width: 42, height: 42, backgroundColor: Colors.primary, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  uploadBtn: { marginTop: 12, backgroundColor: Colors.primary, height: 48, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  uploadText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  documentRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: "#F7F8FA" },
  documentName: { color: "#1A1A2E", fontSize: 12, fontWeight: "600" },
  documentStatus: { color: "#888", fontSize: 10, marginTop: 2 },
  quickLink: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F5F5F5" },
  quickLinkLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  quickLinkIcon: { width: 34, height: 34, backgroundColor: "#E6FAF3", borderRadius: 10, alignItems: "center", justifyContent: "center" },
  quickLinkLabel: { fontSize: 15, color: "#1A1A2E" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#FFE5E5" },
  logoutText: { fontSize: 15, fontWeight: "700", color: "#E63946" },
});
