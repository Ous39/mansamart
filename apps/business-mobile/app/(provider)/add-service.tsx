import React, { useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  Platform, ActivityIndicator, KeyboardAvoidingView, Alert, Image,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { serviceCategories } from "@/data/services";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import { pickAndUploadImage } from "@/lib/upload-image";

const PRICE_TYPES = [
  { id: "fixed", label: "Fixed Price" },
  { id: "hourly", label: "Per Hour" },
  { id: "per_room", label: "Per Room" },
];

export default function AddServiceScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const serviceId = Array.isArray(id) ? id[0] : id;
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [priceType, setPriceType] = useState<"fixed" | "hourly" | "per_room">("fixed");
  const [duration, setDuration] = useState("");
  const [description, setDescription] = useState("");
  const [features, setFeatures] = useState("");
  const [serviceAreas, setServiceAreas] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const { data: existing } = useQuery<any>({
    queryKey: [`/api/services/${serviceId}`],
    enabled: !!serviceId,
  });

  React.useEffect(() => {
    if (!existing) return;
    setName(existing.name || "");
    setCategory(existing.category || "");
    setPrice(String(existing.price || ""));
    setPriceType(existing.priceType || "fixed");
    setDuration(existing.duration || "");
    setDescription(existing.description || "");
    setFeatures(Array.isArray(existing.features) ? existing.features.join("\n") : "");
    setServiceAreas(Array.isArray(existing.serviceAreas) ? existing.serviceAreas.join(", ") : "");
    setImageUrl(existing.imageUrl || "");
  }, [existing]);

  const handleSave = async () => {
    const parsedPrice = Math.round(Number(price));
    if (!name.trim() || !category || !description.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      Alert.alert("Complete required fields", "Add a name, category, description and valid GMD price.");
      return;
    }
    try {
      setIsLoading(true);
      await apiRequest(serviceId ? "PUT" : "POST", serviceId ? `/api/services/${serviceId}` : "/api/services", {
        name: name.trim(), category, description: description.trim(), price: parsedPrice, priceType,
        duration: duration.trim() || undefined,
        features: features.split("\n").map((value) => value.trim()).filter(Boolean),
        serviceAreas: serviceAreas.split(",").map((value) => value.trim()).filter(Boolean),
        imageUrl: imageUrl || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/services/provider/mine"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/provider/dashboard"] });
      setSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => router.back(), 700);
    } catch (error: any) {
      const raw = String(error?.message || "Could not save this service.");
      let message = raw;
      try { message = JSON.parse(raw.replace(/^\d+:\s*/, "")).message || raw; } catch {}
      Alert.alert("Service not saved", message);
    } finally {
      setIsLoading(false);
    }
  };

  const uploadImage = async () => {
    try {
      setIsUploading(true);
      const url = await pickAndUploadImage("product");
      if (url) setImageUrl(url);
    } catch (error: any) {
      Alert.alert("Upload failed", error?.message || "Could not upload the service photo.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: topPad + 16 }]}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </Pressable>
          <Text style={styles.title}>{serviceId ? "Edit Service" : "Add Service"}</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View>
            <Text style={styles.label}>Service Name *</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Full Room Interior Design"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>

          <View>
            <Text style={styles.label}>Category *</Text>
            <View style={styles.catGrid}>
              {serviceCategories.map(c => (
                <Pressable
                  key={c.id}
                  style={[
                    styles.catOption,
                    { backgroundColor: c.bgColor, borderColor: category === c.id ? c.color : "transparent" },
                    category === c.id && styles.catOptionSelected,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setCategory(c.id);
                  }}
                >
                  <Ionicons name={c.icon as any} size={15} color={category === c.id ? "#fff" : c.color} />
                  <Text style={[styles.catOptionText, { color: category === c.id ? "#fff" : c.color }]}>{c.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.priceRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Price (GMD) *</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={price}
                  onChangeText={setPrice}
                  placeholder="e.g. 149"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Type</Text>
              <View style={styles.priceTypeRow}>
                {PRICE_TYPES.map(pt => (
                  <Pressable
                    key={pt.id}
                    style={[styles.priceTypeChip, priceType === pt.id && styles.priceTypeChipActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setPriceType(pt.id as any);
                    }}
                  >
                    <Text style={[styles.priceTypeText, priceType === pt.id && styles.priceTypeTextActive]}>{pt.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <View>
            <Text style={styles.label}>Duration (e.g. “2-3 hours”)</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                value={duration}
                onChangeText={setDuration}
                placeholder="How long does it take?"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>

          <View>
            <Text style={styles.label}>Description</Text>
            <View style={[styles.inputWrap, { height: 100, alignItems: "flex-start", paddingTop: 12 }]}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe your service..."
                placeholderTextColor={Colors.textMuted}
                multiline
              />
            </View>
          </View>

          <View>
            <Text style={styles.label}>What’s Included (one per line)</Text>
            <View style={[styles.inputWrap, { height: 100, alignItems: "flex-start", paddingTop: 12 }]}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={features}
                onChangeText={setFeatures}
                placeholder="e.g. Free consultation&#10;All tools included&#10;3-month warranty"
                placeholderTextColor={Colors.textMuted}
                multiline
              />
            </View>
          </View>

          <View>
            <Text style={styles.label}>Service Areas (comma separated)</Text>
            <View style={styles.inputWrap}>
              <TextInput style={styles.input} value={serviceAreas} onChangeText={setServiceAreas} placeholder="Banjul, Serrekunda, Brikama" placeholderTextColor={Colors.textMuted} />
            </View>
          </View>

          <View>
            <Text style={styles.label}>Service Photo</Text>
            {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.serviceImage} /> : null}
            <Pressable style={styles.uploadBtn} onPress={uploadImage} disabled={isUploading}>
              {isUploading ? <ActivityIndicator color="#7B4FA3" /> : <Ionicons name="image-outline" size={18} color="#7B4FA3" />}
              <Text style={styles.uploadText}>{imageUrl ? "Replace photo" : "Upload photo"}</Text>
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.saveBtn,
              success && styles.saveBtnSuccess,
              pressed && { opacity: 0.9 },
              (!name || !price || !category || isLoading) && { opacity: 0.5 },
            ]}
            onPress={handleSave}
            disabled={!name || !price || !category || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : success ? (
              <>
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>Service Saved!</Text>
              </>
            ) : (
              <Text style={styles.saveBtnText}>{serviceId ? "Save Changes" : "Publish Service"}</Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 16,
  },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  form: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text, marginBottom: 8 },
  inputWrap: {
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, height: 50, justifyContent: "center",
  },
  input: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.text },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catOption: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10,
    borderWidth: 2,
  },
  catOptionSelected: { backgroundColor: "#7B4FA3", borderColor: "#7B4FA3" },
  catOptionText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  priceRow: { flexDirection: "row", gap: 12 },
  priceTypeRow: { gap: 5 },
  priceTypeChip: {
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center",
  },
  priceTypeChipActive: { backgroundColor: "#7B4FA3", borderColor: "#7B4FA3" },
  priceTypeText: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  priceTypeTextActive: { color: "#fff" },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#7B4FA3", borderRadius: 16, height: 56, marginTop: 8,
  },
  saveBtnSuccess: { backgroundColor: Colors.success },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  serviceImage: { width: "100%", height: 180, borderRadius: 14, marginBottom: 10, backgroundColor: Colors.borderLight },
  uploadBtn: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: "#7B4FA3", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  uploadText: { color: "#7B4FA3", fontFamily: "Inter_600SemiBold", fontSize: 13 },
});
