import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Platform, Alert, ActivityIndicator, Image,
} from "react-native";
import { router, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { safeBack } from "@/lib/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/query-client";
import { pickAndUploadImage } from "@/lib/upload-image";
import { toImageSource } from "@/lib/product-media";

const ALL_AREAS = ["Banjul", "Serrekunda", "Kanifing", "Bakau", "Fajara", "Kotu", "Kololi", "Tallinding", "Brikama", "Farafenni", "Basse", "Kerewan"];
const VEHICLE_TYPES = ["Motorbike", "Car", "Van", "Truck", "Bicycle", "Tricycle"];
const PAYOUT_METHODS = ["Mobile Money", "Bank Transfer", "Cash Office Payout"];
const DOC_TYPES = ["National ID", "Driving License", "Selfie Verification", "Vehicle Registration", "Insurance", "Address Proof"];

type UploadingType = "profile" | "cover" | "doc" | null;

function asList(value: any): string[] {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

async function apiCall(path: string, method: string, body?: any) {
  const response = await apiRequest(method, path, body);
  return response.json();
}

export default function RiderSettingsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { user, logout } = useAuth();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery<any>({ queryKey: ["/api/rider/me/profile"] });

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [profilePhoto, setProfilePhoto] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [currentAddress, setCurrentAddress] = useState("");
  const [homeAddress, setHomeAddress] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [region, setRegion] = useState("");
  const [area, setArea] = useState("");
  const [serviceZones, setServiceZones] = useState<string[]>([]);
  const [vehicleType, setVehicleType] = useState("Motorbike");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleRegistrationNo, setVehicleRegistrationNo] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [drivingLicenseExpiry, setDrivingLicenseExpiry] = useState("");
  const [nationalIdNumber, setNationalIdNumber] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("Mobile Money");
  const [mobileMoneyProvider, setMobileMoneyProvider] = useState("");
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [documents, setDocuments] = useState<any[]>([]);
  const [docType, setDocType] = useState("National ID");
  const [uploading, setUploading] = useState<UploadingType>(null);

  React.useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName || profile.user?.businessName || profile.user?.name || "");
    setBio(profile.bio || profile.user?.bio || "");
    setProfilePhoto(profile.profilePhoto || profile.user?.avatar || "");
    setCoverImage(profile.coverImage || "");
    setPhone(profile.phone || profile.user?.phone || "");
    setWhatsapp(profile.whatsapp || profile.phone || profile.user?.phone || "");
    setCurrentAddress(profile.currentAddress || profile.user?.address || "");
    setHomeAddress(profile.homeAddress || "");
    setCity(profile.city || profile.user?.city || "");
    setDistrict(profile.district || "");
    setRegion(profile.region || profile.user?.region || "");
    setArea(profile.area || profile.user?.area || "");
    setServiceZones(asList(profile.serviceZones));
    setVehicleType(profile.vehicleType || profile.user?.businessType || "Motorbike");
    setVehicleModel(profile.vehicleModel || "");
    setVehicleColor(profile.vehicleColor || "");
    setVehiclePlate(profile.vehiclePlate || "");
    setVehicleRegistrationNo(profile.vehicleRegistrationNo || "");
    setLicenseNumber(profile.licenseNumber || "");
    setDrivingLicenseExpiry(profile.drivingLicenseExpiry || "");
    setNationalIdNumber(profile.nationalIdNumber || "");
    setEmergencyContactName(profile.emergencyContactName || "");
    setEmergencyContactPhone(profile.emergencyContactPhone || "");
    setPayoutMethod(profile.payoutMethod || "Mobile Money");
    setMobileMoneyProvider(profile.mobileMoneyProvider || "");
    setMobileMoneyNumber(profile.mobileMoneyNumber || "");
    setBankName(profile.bankName || "");
    setAccountName(profile.accountName || "");
    setAccountNumber(profile.accountNumber || "");
    setInternalNotes(profile.internalNotes || "");
    setDocuments(Array.isArray(profile.documents) ? profile.documents : []);
  }, [profile]);

  const save = useMutation({
    mutationFn: (data: any) => apiCall("/api/rider/profile", "PUT", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rider/me/profile"] });
      qc.invalidateQueries({ queryKey: ["/api/rider/dashboard"] });
      Alert.alert("Saved", "Rider profile updated. Admin can now review your verification file.");
    },
    onError: (e: any) => Alert.alert("Error", e.message || "Could not save rider profile."),
  });

  const updateDocuments = useMutation({
    mutationFn: (data: any) => apiCall("/api/rider/me/documents", "PUT", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rider/me/profile"] });
      qc.invalidateQueries({ queryKey: ["/api/rider/dashboard"] });
    },
    onError: (e: any) => Alert.alert("Upload saved but profile update failed", e.message || "Try saving again."),
  });

  const savePayload = () => ({
    displayName, bio, profilePhoto, coverImage, phone, whatsapp, currentAddress, homeAddress,
    city, district, region, area, serviceZones, vehicleType, vehicleModel, vehicleColor,
    vehiclePlate, vehicleRegistrationNo, licenseNumber, drivingLicenseExpiry, nationalIdNumber,
    emergencyContactName, emergencyContactPhone, payoutMethod, mobileMoneyProvider, mobileMoneyNumber,
    bankName, accountName, accountNumber, internalNotes, documents,
  });

  const toggleZone = (zone: string) => {
    setServiceZones(prev => prev.includes(zone) ? prev.filter(z => z !== zone) : [...prev, zone]);
  };

  const uploadProfileImage = async (type: "profile" | "cover") => {
    try {
      setUploading(type);
      const url = await pickAndUploadImage(type === "profile" ? "profile-avatar" : "vendor-cover");
      if (!url) return;
      if (type === "profile") setProfilePhoto(url); else setCoverImage(url);
      await updateDocuments.mutateAsync(type === "profile" ? { profilePhoto: url } : { coverImage: url });
      Alert.alert("Image uploaded", type === "profile" ? "Your rider profile photo/selfie was updated." : "Your rider cover image was updated.");
    } catch (e: any) {
      Alert.alert("Upload failed", e?.message || "Could not upload image.");
    } finally {
      setUploading(null);
    }
  };

  const uploadDocument = async () => {
    try {
      setUploading("doc");
      const url = await pickAndUploadImage(docType.toLowerCase().includes("selfie") ? "profile-avatar" : "rider-document");
      if (!url) return;
      const next = [...documents, {
        type: docType,
        name: `${docType} - ${new Date().toLocaleDateString()}`,
        url,
        uploadedAt: new Date().toISOString(),
        status: "submitted",
      }];
      setDocuments(next);
      await updateDocuments.mutateAsync({ documents: next });
      Alert.alert("Document uploaded", "Your document has been attached to your rider verification file.");
    } catch (e: any) {
      Alert.alert("Upload failed", e?.message || "Could not upload document.");
    } finally {
      setUploading(null);
    }
  };

  const removeDocument = async (index: number) => {
    const next = documents.filter((_, i) => i !== index);
    setDocuments(next);
    await updateDocuments.mutateAsync({ documents: next });
  };

  const verificationStatus = profile?.verificationStatus || "pending";
  const statusConfig: Record<string, { color: string; icon: string; label: string; desc: string }> = {
    pending: { color: "#F59E0B", icon: "time-outline", label: "Pending Verification", desc: "Complete your rider profile, vehicle, ID, address, and payout information so admin can approve you." },
    verified: { color: "#0EA47A", icon: "checkmark-circle", label: "Verified Rider", desc: "You are verified. You can receive delivery requests when online and available." },
    rejected: { color: "#E63946", icon: "close-circle", label: "Verification Rejected", desc: profile?.verificationNote || "Please update your documents and contact support." },
    not_submitted: { color: "#888", icon: "document-outline", label: "Not Submitted", desc: "Submit your profile and documents to start verification." },
  };
  const st = statusConfig[verificationStatus] || statusConfig.pending;
  const profileSource = toImageSource(profilePhoto);
  const coverSource = toImageSource(coverImage);
  const completion = profile?.completion;
  const missingItems = Array.isArray(completion?.missingItems) ? completion.missingItems : [];

  return (
    <View style={{ flex: 1, backgroundColor: "#F7F8FA" }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: topPad + 10 }]}> 
        <Pressable onPress={() => safeBack("/(rider)")} style={styles.back}><Ionicons name="arrow-back" size={24} color="#1A1A2E" /></Pressable>
        <Text style={styles.headerTitle}>Rider Profile</Text>
        <Pressable onPress={() => save.mutate(savePayload())} disabled={save.isPending}>
          {save.isPending ? <ActivityIndicator size="small" color={Colors.primary} /> : <Text style={styles.saveBtn}>Save</Text>}
        </Pressable>
      </View>

      {isLoading ? <ActivityIndicator style={{ marginTop: 60 }} color={Colors.primary} /> : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.statusCard, { borderLeftColor: st.color }]}> 
            <Ionicons name={st.icon as any} size={22} color={st.color} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusLabel, { color: st.color }]}>{st.label}</Text>
              <Text style={styles.statusDesc}>{st.desc}</Text>
              {missingItems.length > 0 && <Text style={styles.pendingText}>Missing: {missingItems.join(", ")}</Text>}
            </View>
          </View>

          <View style={styles.profileHeaderCard}>
            <View style={[styles.coverFrame, !coverSource && styles.coverEmpty]}>
              {coverSource ? <Image source={coverSource} style={styles.coverImage} resizeMode="cover" /> : <><Ionicons name="image-outline" size={26} color="#6B7280" /><Text style={styles.coverEmptyText}>Add rider cover image</Text></>}
              <View style={styles.coverOverlay} />
            </View>
            <View style={styles.logoLine}>
              <View style={[styles.logoPreview, !profileSource && styles.logoEmpty]}>
                {profileSource ? <Image source={profileSource} style={styles.logoImage} resizeMode="cover" /> : <Ionicons name="person" size={30} color={Colors.primary} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.storeName}>{displayName || user?.name || "MansaMart Rider"}</Text>
                <Text style={styles.storeCategory}>{vehicleType || "Delivery Rider"} • {city || region || "The Gambia"}</Text>
              </View>
            </View>
            <View style={styles.imageActions}>
              <Pressable style={styles.smallBtn} onPress={() => uploadProfileImage("profile")} disabled={uploading !== null}>
                {uploading === "profile" ? <ActivityIndicator size="small" color={Colors.primary} /> : <Text style={styles.smallBtnText}>Upload Photo/Selfie</Text>}
              </Pressable>
              <Pressable style={styles.smallBtn} onPress={() => uploadProfileImage("cover")} disabled={uploading !== null}>
                {uploading === "cover" ? <ActivityIndicator size="small" color={Colors.primary} /> : <Text style={styles.smallBtnText}>Upload Cover</Text>}
              </Pressable>
            </View>
          </View>

          <View style={styles.statsRow}>
            <StatBox label="Completed" value={profile?.completedDeliveries || 0} icon="checkmark-done-outline" />
            <StatBox label="Rating" value={(profile?.rating || 0).toFixed(1)} icon="star" iconColor="#F59E0B" />
            <StatBox label="Online" value={profile?.isOnline ? "Yes" : "No"} icon="radio-outline" />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal & Rider Information</Text>
            <Field label="Display Name" value={displayName} onChange={setDisplayName} placeholder="Your rider/display name" />
            <Field label="Bio" value={bio} onChange={setBio} placeholder="Briefly describe yourself and your delivery experience" multiline />
            <Field label="Phone" value={phone} onChange={setPhone} placeholder="+220 7xxxxxx" keyboardType="phone-pad" icon="call-outline" />
            <Field label="WhatsApp" value={whatsapp} onChange={setWhatsapp} placeholder="+220 7xxxxxx" keyboardType="phone-pad" icon="logo-whatsapp" />
            <Field label="National ID Number" value={nationalIdNumber} onChange={setNationalIdNumber} placeholder="Enter national ID/passport number" />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Address & Delivery Zones</Text>
            <Field label="Current Address" value={currentAddress} onChange={setCurrentAddress} placeholder="Where you are currently based" multiline />
            <Field label="Home Address" value={homeAddress} onChange={setHomeAddress} placeholder="Permanent/home address" multiline />
            <Field label="City" value={city} onChange={setCity} placeholder="e.g. Serrekunda" />
            <Field label="District" value={district} onChange={setDistrict} placeholder="e.g. Kanifing" />
            <Field label="Region" value={region} onChange={setRegion} placeholder="e.g. Greater Banjul Area" />
            <Field label="Area" value={area} onChange={setArea} placeholder="e.g. Kotu, Bakau, Brikama" />
            <Text style={styles.hint}>Select areas where this rider can accept delivery jobs.</Text>
            <View style={styles.areasGrid}>
              {ALL_AREAS.map(zone => {
                const selected = serviceZones.includes(zone);
                return (
                  <Pressable key={zone} onPress={() => toggleZone(zone)} style={[styles.areaChip, selected && styles.areaChipActive]}>
                    {selected && <Ionicons name="checkmark" size={12} color="#fff" />}
                    <Text style={[styles.areaChipText, selected && styles.areaChipTextActive]}>{zone}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vehicle Information</Text>
            <Text style={styles.hint}>Choose the vehicle type and add plate/license details for admin verification.</Text>
            <View style={styles.areasGrid}>
              {VEHICLE_TYPES.map(type => (
                <Pressable key={type} onPress={() => setVehicleType(type)} style={[styles.areaChip, vehicleType === type && styles.areaChipActive]}>
                  <Text style={[styles.areaChipText, vehicleType === type && styles.areaChipTextActive]}>{type}</Text>
                </Pressable>
              ))}
            </View>
            <Field label="Vehicle Model" value={vehicleModel} onChange={setVehicleModel} placeholder="e.g. Boxer, TVS, Toyota, Suzuki" />
            <Field label="Vehicle Color" value={vehicleColor} onChange={setVehicleColor} placeholder="e.g. Red, Black, White" />
            <Field label="Plate Number" value={vehiclePlate} onChange={setVehiclePlate} placeholder="Vehicle plate number" />
            <Field label="Registration Number" value={vehicleRegistrationNo} onChange={setVehicleRegistrationNo} placeholder="Vehicle registration number" />
            <Field label="Driving License Number" value={licenseNumber} onChange={setLicenseNumber} placeholder="Driving/riding license number" />
            <Field label="License Expiry Date" value={drivingLicenseExpiry} onChange={setDrivingLicenseExpiry} placeholder="YYYY-MM-DD" />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Documents & Verification</Text>
            <Text style={styles.helpText}>Upload ID, driving license, selfie, vehicle registration, insurance, and address proof. Admin uses these to approve riders safely.</Text>
            <View style={styles.docTypes}>
              {DOC_TYPES.map(type => (
                <Pressable key={type} onPress={() => setDocType(type)} style={[styles.docType, docType === type && styles.docTypeActive]}>
                  <Text style={[styles.docTypeText, docType === type && styles.docTypeTextActive]}>{type}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={uploadDocument} style={styles.uploadDocBtn} disabled={uploading !== null}>
              {uploading === "doc" ? <ActivityIndicator color="#fff" /> : <><Ionicons name="cloud-upload-outline" size={18} color="#fff" /><Text style={styles.uploadDocText}>Upload {docType}</Text></>}
            </Pressable>
            {documents.length === 0 && <Text style={styles.emptyDocText}>No rider documents uploaded yet.</Text>}
            {documents.map((doc, index) => (
              <View key={`${doc.url}-${index}`} style={styles.docRow}>
                <View style={styles.docIcon}><Ionicons name="document-attach-outline" size={17} color={Colors.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docName}>{doc.name || doc.type || "Rider Document"}</Text>
                  <Text style={styles.docMeta}>{doc.status || "submitted"} • {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : "uploaded"}</Text>
                </View>
                <Pressable onPress={() => removeDocument(index)} style={styles.docRemove}><Ionicons name="trash-outline" size={17} color="#E63946" /></Pressable>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Emergency Contact</Text>
            <Field label="Contact Name" value={emergencyContactName} onChange={setEmergencyContactName} placeholder="Full name" />
            <Field label="Contact Phone" value={emergencyContactPhone} onChange={setEmergencyContactPhone} placeholder="+220 7xxxxxx" keyboardType="phone-pad" />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payout Details</Text>
            <View style={styles.areasGrid}>
              {PAYOUT_METHODS.map(method => (
                <Pressable key={method} onPress={() => setPayoutMethod(method)} style={[styles.areaChip, payoutMethod === method && styles.areaChipActive]}>
                  <Text style={[styles.areaChipText, payoutMethod === method && styles.areaChipTextActive]}>{method}</Text>
                </Pressable>
              ))}
            </View>
            <Field label="Mobile Money Provider" value={mobileMoneyProvider} onChange={setMobileMoneyProvider} placeholder="Afrimoney, QMoney, Wave, etc." />
            <Field label="Mobile Money Number" value={mobileMoneyNumber} onChange={setMobileMoneyNumber} placeholder="+220 7xxxxxx" keyboardType="phone-pad" />
            <Field label="Bank Name" value={bankName} onChange={setBankName} placeholder="Optional bank name" />
            <Field label="Account Name" value={accountName} onChange={setAccountName} placeholder="Account holder name" />
            <Field label="Account Number" value={accountNumber} onChange={setAccountNumber} placeholder="Account number" keyboardType="number-pad" />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Admin Notes</Text>
            <Field label="Notes for Admin" value={internalNotes} onChange={setInternalNotes} placeholder="Anything admin should know before verifying you" multiline />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Manage</Text>
            <QuickLink icon="speedometer-outline" label="Rider Dashboard" onPress={() => router.push("/(rider)/" as any)} />
            <QuickLink icon="list-outline" label="Deliveries" onPress={() => router.push("/(rider)/deliveries" as any)} />
            <QuickLink icon="wallet-outline" label="Earnings & Wallet" onPress={() => router.push("/(rider)/earnings" as any)} />
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
  return <View style={styles.statBox}><Ionicons name={icon} size={18} color={iconColor || Colors.primary} /><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function Field({ label, value, onChange, placeholder, multiline, keyboardType, icon }: any) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        {icon && <Ionicons name={icon} size={16} color="#aaa" style={styles.inputIcon} />}
        <TextInput style={[styles.input, multiline && styles.inputMulti, icon && styles.inputWithIcon]} value={value} onChangeText={onChange} placeholder={placeholder} multiline={multiline} keyboardType={keyboardType || "default"} placeholderTextColor="#bbb" autoCapitalize="none" />
      </View>
    </View>
  );
}

function QuickLink({ icon, label, onPress }: any) {
  return <Pressable style={styles.quickLink} onPress={onPress}><View style={styles.quickLinkLeft}><View style={styles.quickLinkIcon}><Ionicons name={icon} size={18} color={Colors.primary} /></View><Text style={styles.quickLinkLabel}>{label}</Text></View><Ionicons name="chevron-forward" size={18} color="#ccc" /></Pressable>;
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
  pendingText: { marginTop: 6, color: "#B45309", fontSize: 12, fontWeight: "700" },
  profileHeaderCard: { backgroundColor: "#fff", borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: "#F0F0F0" },
  coverFrame: { height: 190, width: "100%", backgroundColor: "#EFF6F5", position: "relative", overflow: "hidden" },
  coverImage: { width: "100%", height: "100%" },
  coverOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, height: 82, backgroundColor: "rgba(0,0,0,0.28)" },
  coverEmpty: { alignItems: "center", justifyContent: "center", gap: 8 },
  coverEmptyText: { color: "#6B7280", fontSize: 12, fontWeight: "700" },
  logoLine: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, marginTop: -42 },
  logoPreview: { width: 84, height: 84, borderRadius: 26, backgroundColor: "#fff", borderWidth: 4, borderColor: "#fff", overflow: "hidden" },
  logoImage: { width: "100%", height: "100%" },
  logoEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: Colors.primaryLight },
  storeName: { fontSize: 17, fontWeight: "800", color: "#1A1A2E" },
  storeCategory: { fontSize: 12, color: "#666", marginTop: 2 },
  imageActions: { flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingBottom: 14 },
  smallBtn: { flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" },
  smallBtnText: { color: Colors.primary, fontWeight: "800", fontSize: 12 },
  statsRow: { flexDirection: "row", gap: 8 },
  statBox: { flex: 1, alignItems: "center", gap: 4, backgroundColor: "#fff", borderRadius: 12, paddingVertical: 12 },
  statValue: { fontSize: 16, fontWeight: "800", color: "#1A1A2E" },
  statLabel: { fontSize: 10, color: "#888" },
  section: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 2 },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: "#aaa", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },
  helpText: { fontSize: 12, color: "#777", lineHeight: 18, marginBottom: 10 },
  hint: { fontSize: 12, color: "#777", lineHeight: 18, marginBottom: 10 },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#555", marginBottom: 6 },
  inputWrap: { flexDirection: "row", alignItems: "flex-start" },
  inputIcon: { position: "absolute", left: 14, top: 14, zIndex: 1 },
  input: { flex: 1, backgroundColor: "#F7F8FA", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#1A1A2E" },
  inputWithIcon: { paddingLeft: 36 },
  inputMulti: { minHeight: 80, textAlignVertical: "top" },
  areasGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  areaChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, backgroundColor: "#F7F8FA", borderWidth: 1, borderColor: "#E5E7EB" },
  areaChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  areaChipText: { fontSize: 12, fontWeight: "700", color: "#333" },
  areaChipTextActive: { color: "#fff" },
  docTypes: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  docType: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, backgroundColor: "#F7F8FA", borderWidth: 1, borderColor: "#E5E7EB" },
  docTypeActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  docTypeText: { fontSize: 12, color: "#555", fontWeight: "700" },
  docTypeTextActive: { color: "#fff" },
  uploadDocBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 46, borderRadius: 13, backgroundColor: Colors.primary, marginBottom: 12 },
  uploadDocText: { color: "#fff", fontWeight: "800" },
  emptyDocText: { color: "#999", fontSize: 12, textAlign: "center", paddingVertical: 10 },
  docRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F7F8FA", borderRadius: 12, padding: 10, marginTop: 8 },
  docIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" },
  docName: { fontSize: 13, fontWeight: "800", color: "#1A1A2E" },
  docMeta: { fontSize: 11, color: "#777", marginTop: 2 },
  docRemove: { padding: 8 },
  quickLink: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F5F5F5" },
  quickLinkLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  quickLinkIcon: { width: 34, height: 34, backgroundColor: "#E6FAF3", borderRadius: 10, alignItems: "center", justifyContent: "center" },
  quickLinkLabel: { fontSize: 15, color: "#1A1A2E" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#FFE5E5" },
  logoutText: { fontSize: 15, fontWeight: "700", color: "#E63946" },
});
