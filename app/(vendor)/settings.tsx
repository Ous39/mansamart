import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Platform, Alert, ActivityIndicator, Image } from "react-native";
import { router, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/query-client";
import { getToken } from "@/lib/auth-token";
import { pickAndUploadImage } from "@/lib/upload-image";
import { toImageSource } from "@/lib/product-media";
import { SHOP_CATEGORY_CONFIGS, getShopCategoryConfig } from "@/data/vendor-categories";

function splitList(value: string) { return value.split(",").map(v => v.trim()).filter(Boolean); }
function joinList(value: any) { return Array.isArray(value) ? value.join(", ") : ""; }

async function apiCall(path: string, method: string, body?: any) {
  const token = getToken();
  const r = await fetch(new URL(path, getApiUrl()).toString(), {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || "Failed"); }
  return r.json();
}

export default function VendorSettingsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { user, logout } = useAuth();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery<any>({ queryKey: ["/api/vendors/me/profile"] });

  const [storeName, setStoreName] = useState("");
  const [shopCategory, setShopCategory] = useState("general");
  const [allowedCategories, setAllowedCategories] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [operatingHours, setOperatingHours] = useState("");
  const [deliveryZones, setDeliveryZones] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("0");
  const [returnPolicy, setReturnPolicy] = useState("");
  const [shippingPolicy, setShippingPolicy] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [facebook, setFacebook] = useState("");
  const [instagram, setInstagram] = useState("");
  const [logo, setLogo] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [businessRegistrationNo, setBusinessRegistrationNo] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [mobileMoneyProvider, setMobileMoneyProvider] = useState("");
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploading, setUploading] = useState<"logo" | "cover" | "doc" | null>(null);
  const [docType, setDocType] = useState("Business Registration");

  React.useEffect(() => {
    if (profile) {
      setStoreName(profile.storeName || "");
      setShopCategory(profile.shopCategory || user?.businessType || "general");
      setAllowedCategories(Array.isArray(profile.allowedCategories) ? profile.allowedCategories : []);
      setSubcategories(joinList(profile.subcategories));
      setDescription(profile.description || "");
      setLocation(profile.location || "");
      setOperatingHours(profile.operatingHours || "");
      setDeliveryZones(joinList(profile.deliveryZones));
      setSupportPhone(profile.supportPhone || "");
      setSupportEmail(profile.supportEmail || "");
      setMinOrderAmount(String(profile.minOrderAmount ?? 0));
      setReturnPolicy(profile.returnPolicy || "");
      setShippingPolicy(profile.shippingPolicy || "");
      setWhatsapp(profile.whatsapp || "");
      setFacebook(profile.facebook || "");
      setInstagram(profile.instagram || "");
      setLogo(profile.logo || "");
      setCoverImage(profile.coverImage || "");
      setBusinessRegistrationNo(profile.businessRegistrationNo || "");
      setTaxNumber(profile.taxNumber || "");
      setBankName(profile.bankName || "");
      setAccountName(profile.accountName || "");
      setAccountNumber(profile.accountNumber || "");
      setMobileMoneyProvider(profile.mobileMoneyProvider || "");
      setMobileMoneyNumber(profile.mobileMoneyNumber || "");
      setInternalNotes(profile.internalNotes || "");
      setDocuments(Array.isArray(profile.documents) ? profile.documents : []);
    }
  }, [profile, user?.businessType]);

  const save = useMutation({
    mutationFn: (data: any) => apiCall("/api/vendors/profile", "PUT", data),
    onSuccess: (data: any) => { qc.invalidateQueries({ queryKey: ["/api/vendors/me/profile"] }); Alert.alert(data?.changeRequestSubmitted ? "Request submitted" : "Saved", data?.message || "Vendor profile updated. Product forms will now follow this shop profile."); },
    onError: (e: any) => Alert.alert("Error", e.message),
  });

  const selectedConfig = getShopCategoryConfig(shopCategory);

  const savePayload = () => ({
    storeName, shopCategory, allowedCategories, subcategories: splitList(subcategories), description,
    logo, coverImage, location, operatingHours, deliveryZones: splitList(deliveryZones), supportPhone, supportEmail,
    minOrderAmount: Math.max(0, Math.round(Number(minOrderAmount || 0))),
    returnPolicy, shippingPolicy, whatsapp, facebook, instagram,
    businessRegistrationNo, taxNumber, bankName, accountName, accountNumber, mobileMoneyProvider, mobileMoneyNumber, internalNotes,
  });

  const toggleAllowed = (id: string) => {
    if (id === shopCategory) return;
    setAllowedCategories(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const uploadProfileImage = async (type: "logo" | "cover") => {
    try {
      setUploading(type);
      const url = await pickAndUploadImage(type === "logo" ? "vendor-logo" : "vendor-cover");
      if (url) {
        if (type === "logo") setLogo(url); else setCoverImage(url);
        await updateDocuments.mutateAsync(type === "logo" ? { logo: url } : { coverImage: url });
        Alert.alert(isVerifiedLocked ? "Change request created" : "Image uploaded", isVerifiedLocked ? "Your verified store image change was sent to admin for approval." : "Your store image was updated.");
      }
    } catch (e: any) {
      Alert.alert("Upload failed", e?.message || "Could not upload image.");
    } finally { setUploading(null); }
  };

  const updateDocuments = useMutation({
    mutationFn: (data: any) => apiCall("/api/vendors/me/documents", "PUT", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/vendors/me/profile"] }); },
    onError: (e: any) => Alert.alert("Upload saved image but profile update failed", e.message),
  });

  const uploadDocument = async () => {
    try {
      setUploading("doc");
      const url = await pickAndUploadImage(docType.toLowerCase().includes("id") ? "identity-document" : "business-document");
      if (url) {
        const next = [...documents, { type: docType, name: `${docType} - ${new Date().toLocaleDateString()}`, url, uploadedAt: new Date().toISOString(), status: "submitted" }];
        setDocuments(next);
        await updateDocuments.mutateAsync({ documents: next });
        Alert.alert("Document uploaded", "Your document has been attached to your verification file.");
      }
    } catch (e: any) {
      Alert.alert("Upload failed", e?.message || "Could not upload document.");
    } finally { setUploading(null); }
  };

  const removeDocument = async (index: number) => {
    const next = documents.filter((_, i) => i !== index);
    setDocuments(next);
    await updateDocuments.mutateAsync({ documents: next });
  };

  const verificationStatus = profile?.verificationStatus || "pending";
  const isVerifiedLocked = verificationStatus === "verified" || profile?.profileEditLocked === true;
  const statusConfig: Record<string, { color: string; icon: string; label: string; desc: string }> = {
    pending: { color: "#F59E0B", icon: "time-outline", label: "Pending Verification", desc: "Your store is under review. Complete all tracking fields to help admin verify faster." },
    verified: { color: "#0EA47A", icon: "checkmark-circle", label: "Verified Store", desc: "Your store is verified. Customers can trust your listings." },
    rejected: { color: "#E63946", icon: "close-circle", label: "Verification Rejected", desc: profile?.verificationNote || "Please update documents and contact support." },
    not_submitted: { color: "#888", icon: "document-outline", label: "Not Submitted", desc: "Submit documents and tracking details to get verified." },
  };
  const st = statusConfig[verificationStatus] || statusConfig.pending;
  const pendingChanges = (profile?.pendingProfileChanges || {}) as any;
  const displayLogo = (isVerifiedLocked && pendingChanges.logo ? pendingChanges.logo : logo) || "";
  const displayCoverImage = (isVerifiedLocked && pendingChanges.coverImage ? pendingChanges.coverImage : coverImage) || "";
  const coverSource = toImageSource(displayCoverImage);
  const logoSource = toImageSource(displayLogo);
  const hasPendingMedia = isVerifiedLocked && (pendingChanges.logo || pendingChanges.coverImage);

  return (
    <View style={{ flex: 1, backgroundColor: "#F7F8FA" }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: topPad + 10 }]}> 
        <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={24} color="#1A1A2E" /></Pressable>
        <Text style={styles.headerTitle}>Vendor Profile</Text>
        <Pressable onPress={() => save.mutate(savePayload())} disabled={save.isPending}>
          {save.isPending ? <ActivityIndicator size="small" color={Colors.primary} /> : <Text style={styles.saveBtn}>{isVerifiedLocked ? "Request" : "Save"}</Text>}
        </Pressable>
      </View>

      {isLoading ? <ActivityIndicator style={{ marginTop: 60 }} color={Colors.primary} /> : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.statusCard, { borderLeftColor: st.color }]}> 
            <Ionicons name={st.icon as any} size={22} color={st.color} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusLabel, { color: st.color }]}>{st.label}</Text>
              <Text style={styles.statusDesc}>{st.desc}</Text>
              {profile?.profileChangeStatus === "pending" && <Text style={styles.pendingText}>Profile change request pending admin approval.</Text>}
              {profile?.profileChangeStatus === "rejected" && !!profile?.profileChangeNote && <Text style={styles.rejectedText}>Last request rejected: {profile.profileChangeNote}</Text>}
            </View>
          </View>
          {isVerifiedLocked && (
            <View style={styles.lockCard}>
              <Ionicons name="lock-closed-outline" size={20} color="#B45309" />
              <Text style={styles.lockText}>Verified vendors cannot change live profile details directly. Edit the form and tap Request; admin must approve before changes go live.</Text>
            </View>
          )}

          <View style={styles.profileHeaderCard}>
            <View style={styles.coverFrame}>
              {coverSource ? (
                <Image source={coverSource as any} style={styles.coverImage} resizeMode="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFillObject as any, styles.coverEmpty]}>
                  <Ionicons name="image-outline" size={28} color="#9CA3AF" />
                  <Text style={styles.coverEmptyText}>Upload a wide 16:9 shop cover</Text>
                </View>
              )}
              <View style={styles.coverOverlay} />
              {hasPendingMedia && <View style={styles.pendingMediaBadge}><Text style={styles.pendingMediaText}>Pending admin approval</Text></View>}
            </View>
            <View style={styles.logoLine}>
              {logoSource ? <Image source={logoSource as any} style={styles.logoPreview} resizeMode="cover" /> : <View style={[styles.logoPreview, styles.logoEmpty]}><Ionicons name="storefront-outline" size={24} color={Colors.primary} /></View>}
              <View style={{ flex: 1 }}>
                <Text style={styles.storeName}>{storeName || profile?.storeName || "Your store"}</Text>
                <Text style={styles.storeCategory}>{selectedConfig.name} • {location || "No location"}</Text>
              </View>
            </View>
            <View style={styles.imageActions}>
              <Pressable style={styles.smallBtn} onPress={() => uploadProfileImage("logo")} disabled={uploading !== null}><Text style={styles.smallBtnText}>{uploading === "logo" ? "Uploading..." : "Upload Logo"}</Text></Pressable>
              <Pressable style={styles.smallBtn} onPress={() => uploadProfileImage("cover")} disabled={uploading !== null}><Text style={styles.smallBtnText}>{uploading === "cover" ? "Uploading..." : "Upload Cover"}</Text></Pressable>
            </View>
          </View>

          {profile && (
            <View style={styles.statsRow}>
              <StatBox label="Sales" value={(profile.totalSales || 0).toLocaleString()} icon="trending-up-outline" />
              <StatBox label="Revenue" value={`D${(profile.totalRevenue || 0).toLocaleString()}`} icon="wallet-outline" />
              <StatBox label="Rating" value={(profile.rating || 4.5).toFixed(1)} icon="star" iconColor="#F59E0B" />
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Store Information</Text>
            <Field label="Store Name" value={storeName} onChange={setStoreName} placeholder="Your public store name" />
            <Field label="Description" value={description} onChange={setDescription} placeholder="Tell customers what you sell, your quality, delivery and services..." multiline />
            <Field label="Location" value={location} onChange={setLocation} placeholder="e.g. Pipeline Market, Serrekunda" />
            <Field label="Operating Hours" value={operatingHours} onChange={setOperatingHours} placeholder="Mon-Sat, 9am-7pm" />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shop Type & Product Rules</Text>
            <Text style={styles.helpText}>This controls what product form your vendor sees. A fashion shop gets sizes/fabric fields. Electronics gets model/warranty/specification fields.</Text>
            <View style={styles.catGrid}>
              {SHOP_CATEGORY_CONFIGS.map(c => (
                <Pressable key={c.id} style={[styles.catOption, shopCategory === c.id && { backgroundColor: c.color, borderColor: c.color }]} onPress={() => { setShopCategory(c.id); setAllowedCategories(prev => prev.filter(x => x !== c.id)); setSubcategories(c.subcategories.join(", ")); }}>
                  <Ionicons name={c.icon as any} size={15} color={shopCategory === c.id ? "#fff" : c.color} />
                  <Text style={[styles.catOptionText, shopCategory === c.id && { color: "#fff" }]}>{c.name}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Extra allowed categories</Text>
            <View style={styles.catGrid}>
              {SHOP_CATEGORY_CONFIGS.filter(c => c.id !== shopCategory).map(c => (
                <Pressable key={c.id} style={[styles.extraOption, allowedCategories.includes(c.id) && { borderColor: c.color, backgroundColor: c.color + "18" }]} onPress={() => toggleAllowed(c.id)}>
                  <Text style={[styles.extraOptionText, allowedCategories.includes(c.id) && { color: c.color }]}>{allowedCategories.includes(c.id) ? "✓ " : "+ "}{c.name}</Text>
                </Pressable>
              ))}
            </View>
            <Field label="Custom Subcategories" value={subcategories} onChange={setSubcategories} placeholder={selectedConfig.subcategories.join(", ")} multiline />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery & Customer Support</Text>
            <Field label="Delivery Zones" value={deliveryZones} onChange={setDeliveryZones} placeholder="Banjul, Kanifing, Brikama" />
            <Field label="Minimum Order Amount (D)" value={minOrderAmount} onChange={setMinOrderAmount} placeholder="0" keyboardType="numeric" />
            <Field label="Support Phone" value={supportPhone} onChange={setSupportPhone} placeholder="+220 7xxxxxx" keyboardType="phone-pad" />
            <Field label="Support Email" value={supportEmail} onChange={setSupportEmail} placeholder="support@yourstore.com" keyboardType="email-address" />
            <Field label="Return Policy" value={returnPolicy} onChange={setReturnPolicy} placeholder="e.g. 7-day return policy..." multiline />
            <Field label="Shipping Policy" value={shippingPolicy} onChange={setShippingPolicy} placeholder="e.g. Delivery in 2-5 days..." multiline />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Tracking</Text>
            <Field label="Bank Name" value={bankName} onChange={setBankName} placeholder="Bank name" />
            <Field label="Account Name" value={accountName} onChange={setAccountName} placeholder="Account name" />
            <Field label="Account Number" value={accountNumber} onChange={setAccountNumber} placeholder="Account number" keyboardType="number-pad" />
            <Field label="Mobile Money Provider" value={mobileMoneyProvider} onChange={setMobileMoneyProvider} placeholder="QMoney, Wave, Afrimoney..." />
            <Field label="Mobile Money Number" value={mobileMoneyNumber} onChange={setMobileMoneyNumber} placeholder="+220 7xxxxxx" keyboardType="phone-pad" />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Business Documents & IDs</Text>
            <Text style={styles.helpText}>Upload business registration, owner ID, tax document, shop license, bank proof, or any important document for admin verification.</Text>
            <View style={styles.docTypes}>
              {["Business Registration", "Owner ID", "Tax Document", "Shop License", "Bank Proof", "Other Document"].map(t => (
                <Pressable key={t} style={[styles.docType, docType === t && styles.docTypeActive]} onPress={() => setDocType(t)}>
                  <Text style={[styles.docTypeText, docType === t && styles.docTypeTextActive]}>{t}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.uploadDocBtn} onPress={uploadDocument} disabled={uploading !== null || updateDocuments.isPending}>
              <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
              <Text style={styles.uploadDocText}>{uploading === "doc" ? "Uploading..." : `Upload ${docType}`}</Text>
            </Pressable>
            {documents.length === 0 ? <Text style={styles.emptyDocText}>No documents uploaded yet.</Text> : documents.map((d, index) => (
              <View key={`${d.url}-${index}`} style={styles.docRow}>
                <View style={styles.docIcon}><Ionicons name="document-attach-outline" size={18} color={Colors.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docName}>{d.name || d.type || "Document"}</Text>
                  <Text style={styles.docMeta}>{d.type || "Document"} • {d.status || "submitted"}</Text>
                </View>
                <Pressable onPress={() => removeDocument(index)} style={styles.docRemove}><Ionicons name="trash-outline" size={17} color="#E63946" /></Pressable>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Verification & Admin Tracking</Text>
            <Field label="Business Registration No." value={businessRegistrationNo} onChange={setBusinessRegistrationNo} placeholder="Optional but useful for verification" />
            <Field label="Tax Number" value={taxNumber} onChange={setTaxNumber} placeholder="Optional" />
            <Field label="Internal Notes" value={internalNotes} onChange={setInternalNotes} placeholder="Anything admin should know about this shop" multiline />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact & Social</Text>
            <Field label="WhatsApp" value={whatsapp} onChange={setWhatsapp} placeholder="+220 7xxxxxx" keyboardType="phone-pad" icon="logo-whatsapp" />
            <Field label="Facebook Page" value={facebook} onChange={setFacebook} placeholder="Your Facebook page name" icon="logo-facebook" />
            <Field label="Instagram" value={instagram} onChange={setInstagram} placeholder="@yourinstagram" icon="logo-instagram" />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Manage</Text>
            <QuickLink icon="cube-outline" label="My Products" onPress={() => router.push("/(vendor)/products")} />
            <QuickLink icon="receipt-outline" label="Incoming Orders" onPress={() => router.push("/(vendor)/orders")} />
            <QuickLink icon="add-circle-outline" label="Add Product Using Shop Form" onPress={() => router.push("/(vendor)/add-product")} />
            <QuickLink icon="bar-chart-outline" label="Dashboard" onPress={() => router.push("/(vendor)/" as any)} />
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
  rejectedText: { marginTop: 6, color: "#E63946", fontSize: 12, fontWeight: "700" },
  lockCard: { flexDirection: "row", gap: 10, backgroundColor: "#FFF7ED", borderWidth: 1, borderColor: "#FED7AA", borderRadius: 14, padding: 13 },
  lockText: { flex: 1, color: "#92400E", fontSize: 12, lineHeight: 18, fontWeight: "600" },
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
  pendingMediaBadge: { position: "absolute", top: 12, right: 12, backgroundColor: "rgba(0,0,0,0.62)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pendingMediaText: { color: "#fff", fontSize: 11, fontWeight: "800" },
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
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#555", marginBottom: 6 },
  inputWrap: { flexDirection: "row", alignItems: "flex-start" },
  inputIcon: { position: "absolute", left: 14, top: 14, zIndex: 1 },
  input: { flex: 1, backgroundColor: "#F7F8FA", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#1A1A2E" },
  inputWithIcon: { paddingLeft: 36 },
  inputMulti: { minHeight: 80, textAlignVertical: "top" },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  catOption: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, backgroundColor: "#F7F8FA", borderWidth: 1, borderColor: "#E5E7EB" },
  catOptionText: { fontSize: 12, fontWeight: "700", color: "#333" },
  extraOption: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, backgroundColor: "#F7F8FA", borderWidth: 1, borderColor: "#E5E7EB" },
  extraOptionText: { fontSize: 12, fontWeight: "700", color: "#555" },
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
