import React, { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, ActivityIndicator, TouchableOpacity, Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, UserRole, RegisterData } from "@/contexts/AuthContext";
import { requestCurrentLocation } from "@/lib/location";
import { safeBack } from "@/lib/navigation";

const C = {
  primary: "#2F5D59", primaryLight: "#E8F1EF",
  vendor: "#2F5D59", vendorLight: "#E8F1EF",
  provider: "#D8843B", providerLight: "#FFF1E5",
  bg: "#F4FAF9", text: "#1F2A2A", muted: "#53605F",
  border: "#DDE8E6", white: "#FFFFFF", red: "#D44B4B",
  inputBg: "#FFFFFF",
};

const ROLES = [
  { id: "user" as UserRole, title: "Shopper", subtitle: "Shop products, save wishlist and book services", icon: "bag-handle-outline", color: C.primary, bg: C.primaryLight },
  { id: "vendor" as UserRole, title: "Vendor", subtitle: "Sell products on MansaMart", icon: "storefront-outline", color: C.vendor, bg: C.vendorLight },
  { id: "service_provider" as UserRole, title: "Service Provider", subtitle: "Offer home & professional services", icon: "construct-outline", color: C.provider, bg: C.providerLight },
  { id: "delivery_rider" as UserRole, title: "Rider", subtitle: "Accept delivery jobs and earn from completed orders", icon: "bicycle-outline", color: "#2563EB", bg: "#EFF6FF" },
];

const GAMBIA_REGIONS = ["Banjul", "Kanifing", "Brikama", "Mansakonko", "Kerewan", "Kuntaur", "Janjanbureh"];
const GENDERS = ["Male", "Female", "Prefer not to say"];
const BUSINESS_TYPES = ["Groceries", "Fashion", "Electronics", "Furniture & Home", "Beauty", "Food", "Auto Parts", "Books", "Other"];
const SERVICE_TYPES = ["Cleaning", "Plumbing", "Electrical", "Painting", "Gardening", "Interior Design", "Security", "IT Support", "Catering", "Education", "Photography", "Other"];
const VEHICLE_TYPES = ["Motorbike", "Car", "Van", "Bicycle", "Tricycle", "Other"];

function PickerRow({ label, options, value, onSelect }: { label: string; options: string[]; value: string; onSelect: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.picker} onPress={() => setOpen(!open)}>
        <Text style={[styles.pickerText, !value && { color: C.muted }]}>{value || `Select ${label}`}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={C.muted} />
      </TouchableOpacity>
      {open && (
        <View style={styles.dropdownList}>
          {options.map(opt => (
            <TouchableOpacity key={opt} style={styles.dropdownItem} onPress={() => { onSelect(opt); setOpen(false); }}>
              <Text style={[styles.dropdownText, value === opt && { color: C.primary, fontFamily: "Inter_600SemiBold" }]}>{opt}</Text>
              {value === opt && <Ionicons name="checkmark" size={16} color={C.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function Field({ label, value, onChange, placeholder, secureTextEntry, keyboardType, multiline, optional }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}{optional && <Text style={{ color: C.muted, fontFamily: "Inter_400Regular" }}> (optional)</Text>}</Text>
      <TextInput
        style={[styles.input, multiline && { height: 80, textAlignVertical: "top" }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? label}
        placeholderTextColor={C.muted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize={secureTextEntry || keyboardType === "email-address" ? "none" : "sentences"}
      />
    </View>
  );
}

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1
  const [role, setRole] = useState<UserRole>("user");

  // Step 2 – Personal
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [locationAccuracy, setLocationAccuracy] = useState<number | undefined>();
  const [isLocating, setIsLocating] = useState(false);

  // Step 3 – Role-specific
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [bio, setBio] = useState("");
  const [area, setArea] = useState("");

  const totalSteps = role === "user" ? 2 : 3;

  const handleNext = () => {
    setError("");
    if (step === 1) { setStep(2); return; }
    if (step === 2) {
      if (!name.trim()) { setError("Full name is required"); return; }
      if (!email.trim() || !email.includes("@")) { setError("Valid email is required"); return; }
      if (!phone.trim()) { setError("Phone number is required"); return; }
      if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
      if (password !== confirmPassword) { setError("Passwords do not match"); return; }
      if (!city) { setError("Please select your city"); return; }
      if (role === "user") { handleSubmit(); return; }
      setStep(3); return;
    }
    if (step === 3) { handleSubmit(); }
  };

  const handleUseCurrentLocation = async () => {
    setError("");
    setIsLocating(true);
    try {
      const location = await requestCurrentLocation();
      if (!location) {
        setError("Location permission was not granted. You can continue by selecting your city manually.");
        return;
      }
      setLatitude(location.latitude);
      setLongitude(location.longitude);
      setLocationAccuracy(location.locationAccuracy);
      if (!city && location.city) setCity(location.city);
      if (!region && location.region) setRegion(location.region);
      if (!area && location.area) setArea(location.area);
    } catch (e: any) {
      setError(e?.message || "Unable to get your current location");
    } finally {
      setIsLocating(false);
    }
  };

  const handleSubmit = async () => {
    setError("");
    if (role === "vendor" && !businessName.trim()) { setError("Business name is required"); return; }
    if (role === "delivery_rider" && !businessType) { setError("Please select your vehicle type"); return; }

    setIsLoading(true);
    try {
      const data: RegisterData = {
        email: email.trim().toLowerCase(),
        password,
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim() || undefined,
        city,
        region: region || undefined,
        area: area.trim() || city || undefined,
        latitude,
        longitude,
        locationAccuracy,
        gender: gender || undefined,
        dateOfBirth: dob.trim() || undefined,
        role,
        businessName: businessName.trim() || undefined,
        businessType: businessType || undefined,
        bio: bio.trim() || undefined,
      };
      await register(data);
      router.replace("/pin-setup");
    } catch (e: any) {
      const msg = e.message ?? "Registration failed";
      setError(msg.includes("409") || msg.toLowerCase().includes("already") ? "This email is already registered" : msg);
    }
    setIsLoading(false);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step === 1 ? safeBack("/") : setStep(s => s - 1)} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Account</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress */}
      <View style={styles.progressContainer}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <View key={i} style={[styles.progressDot, i < step && styles.progressDotActive, i + 1 === step && styles.progressDotCurrent]} />
        ))}
        <Text style={styles.progressLabel}>Step {step} of {totalSteps}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* STEP 1: Role */}
        {step === 1 && (
          <View>
            <Text style={styles.stepTitle}>How will you use MansaMart?</Text>
            <Text style={styles.stepSub}>Choose your account type to get started</Text>
            {ROLES.map(r => (
              <TouchableOpacity
                key={r.id}
                style={[styles.roleCard, role === r.id && { borderColor: r.color, borderWidth: 2 }]}
                onPress={() => setRole(r.id)}
              >
                <View style={[styles.roleIconBox, { backgroundColor: r.bg }]}>
                  <Ionicons name={r.icon as any} size={26} color={r.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.roleTitle, role === r.id && { color: r.color }]}>{r.title}</Text>
                  <Text style={styles.roleSub}>{r.subtitle}</Text>
                </View>
                <Ionicons name={role === r.id ? "radio-button-on" : "radio-button-off"} size={22} color={role === r.id ? r.color : C.border} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* STEP 2: Personal Info */}
        {step === 2 && (
          <View>
            <Text style={styles.stepTitle}>Personal Information</Text>
            <Text style={styles.stepSub}>Tell us about yourself</Text>
            <Field label="Full Name" value={name} onChange={setName} placeholder="Enter your full name" />
            <Field label="Email Address" value={email} onChange={setEmail} placeholder="you@example.com" keyboardType="email-address" />
            <Field label="Phone Number" value={phone} onChange={setPhone} placeholder="+220 XXX XXXX" keyboardType="phone-pad" />
            <Field label="Password" value={password} onChange={setPassword} placeholder="At least 6 characters" secureTextEntry />
            <Field label="Confirm Password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter password" secureTextEntry />
            <PickerRow label="City / Area" options={GAMBIA_REGIONS} value={city} onSelect={setCity} />
            <TouchableOpacity style={styles.locationBtn} onPress={handleUseCurrentLocation} disabled={isLocating}>
              {isLocating ? <ActivityIndicator color={C.primary} /> : <Ionicons name="locate-outline" size={18} color={C.primary} />}
              <Text style={styles.locationBtnText}>{latitude && longitude ? "GPS location added" : "Use my current GPS location"}</Text>
            </TouchableOpacity>
            <PickerRow label="Region" options={GAMBIA_REGIONS} value={region} onSelect={setRegion} />
            <Field label="Home Address" value={address} onChange={setAddress} placeholder="Street / Compound" optional />
            <PickerRow label="Gender" options={GENDERS} value={gender} onSelect={setGender} />
            <Field label="Date of Birth" value={dob} onChange={setDob} placeholder="DD/MM/YYYY" optional />
          </View>
        )}

        {/* STEP 3: Role-specific */}
        {step === 3 && role === "vendor" && (
          <View>
            <Text style={styles.stepTitle}>Business Details</Text>
            <Text style={styles.stepSub}>Tell customers about your business</Text>
            <Field label="Business Name" value={businessName} onChange={setBusinessName} placeholder="Your shop or brand name" />
            <PickerRow label="Business Category" options={BUSINESS_TYPES} value={businessType} onSelect={setBusinessType} />
            <Field label="Business Description" value={bio} onChange={setBio} placeholder="What do you sell? What makes you unique?" multiline optional />
          </View>
        )}

        {step === 3 && role === "service_provider" && (
          <View>
            <Text style={styles.stepTitle}>Service Details</Text>
            <Text style={styles.stepSub}>Tell clients what you offer</Text>
            <Field label="Business / Brand Name" value={businessName} onChange={setBusinessName} placeholder="Your name or business name" optional />
            <PickerRow label="Service Category" options={SERVICE_TYPES} value={businessType} onSelect={setBusinessType} />
            <Field label="About Your Service" value={bio} onChange={setBio} placeholder="Describe your expertise and experience..." multiline optional />
          </View>
        )}

        {step === 3 && role === "delivery_rider" && (
          <View>
            <Text style={styles.stepTitle}>Rider Details</Text>
            <Text style={styles.stepSub}>Tell us how you will deliver orders</Text>
            <PickerRow label="Vehicle Type" options={VEHICLE_TYPES} value={businessType} onSelect={setBusinessType} />
            <Field label="Main Delivery Area" value={area} onChange={setArea} placeholder="Example: Senegambia, Brusubi, Banjul" optional />
            <Field label="Short Bio" value={bio} onChange={setBio} placeholder="Your delivery experience or availability" multiline optional />
          </View>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={C.red} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.btn, { opacity: pressed || isLoading ? 0.85 : 1, backgroundColor: ROLES.find(r => r.id === role)?.color ?? C.primary }]}
          onPress={handleNext}
          disabled={isLoading}
        >
          {isLoading
            ? <ActivityIndicator color="#FFF" />
            : <Text style={styles.btnText}>{step === totalSteps ? "Create Account" : "Continue"}</Text>
          }
        </Pressable>

        <TouchableOpacity onPress={() => router.replace("/(auth)/login")} style={styles.loginLink}>
          <Text style={styles.loginLinkText}>Already have an account? <Text style={{ color: C.primary, fontFamily: "Inter_600SemiBold" }}>Sign In</Text></Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: C.text },
  progressContainer: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginBottom: 4, gap: 6 },
  progressDot: { width: 28, height: 4, borderRadius: 2, backgroundColor: C.border },
  progressDotActive: { backgroundColor: C.primary },
  progressDotCurrent: { backgroundColor: C.primary },
  progressLabel: { marginLeft: "auto", fontSize: 12, color: C.muted, fontFamily: "Inter_400Regular" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12 },
  stepTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: C.text, marginBottom: 6 },
  stepSub: { fontSize: 14, color: C.muted, marginBottom: 24, lineHeight: 20 },
  roleCard: {
    flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 14,
    backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border, marginBottom: 12, gap: 14,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  roleIconBox: { width: 52, height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  roleTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: C.text, marginBottom: 2 },
  roleSub: { fontSize: 13, color: C.muted, lineHeight: 18 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text, marginBottom: 6 },
  input: {
    backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontFamily: "Inter_400Regular", color: C.text,
  },
  picker: {
    backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  pickerText: { fontSize: 15, fontFamily: "Inter_400Regular", color: C.text },
  dropdownList: {
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, marginTop: 4, overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
    zIndex: 999,
  },
  dropdownItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  dropdownText: { fontSize: 15, fontFamily: "Inter_400Regular", color: C.text },
  locationBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.primaryLight, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14 },
  locationBtnText: { color: C.primary, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: C.red, fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  btn: { borderRadius: 12, paddingVertical: 15, alignItems: "center", marginBottom: 16 },
  btnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_700Bold" },
  loginLink: { alignItems: "center", paddingVertical: 8 },
  loginLinkText: { fontSize: 14, color: C.muted, fontFamily: "Inter_400Regular" },
});
