import React, { useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Image, Platform, ActivityIndicator, KeyboardAvoidingView, Alert, Switch } from "react-native";
import { router, useLocalSearchParams, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";
import { pickAndUploadImage } from "@/lib/upload-image";
import { toImageSource } from "@/lib/product-media";
import { resolveAssetUrl } from "@/lib/product-media";
import { getAllowedCategoryIds, getShopCategoryConfig, SHOP_CATEGORY_CONFIGS } from "@/data/vendor-categories";

function splitList(value: string) { return value.split(",").map(v => v.trim()).filter(Boolean); }
function joinList(value: any) { return Array.isArray(value) ? value.join(", ") : (value || ""); }
function joinUnique(current: string, value: string) { const list = splitList(current); return list.includes(value) ? list.filter(x => x !== value).join(", ") : [...list, value].join(", "); }
const COLOR_OPTIONS = ["Black", "White", "Blue", "Red", "Green", "Yellow", "Gold", "Silver", "Brown", "Cream", "Pink", "Purple", "Grey", "Orange"];
const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL", "38", "39", "40", "41", "42", "43", "44", "Custom Size"];
const CONDITION_OPTIONS = ["Brand New", "New", "UK Used", "Refurbished", "Custom Made", "Fresh", "Sealed", "Used Good", "Imported"];
const WARRANTY_OPTIONS = ["No Warranty", "7 Days", "14 Days", "1 Month", "3 Months", "6 Months", "1 Year", "Aftercare Included"];
const MATERIAL_OPTIONS = ["Cotton", "Bazin", "Silk", "Leather", "Wood", "Metal", "Glass", "Fabric", "Plastic", "Gold", "Silver", "Stainless Steel"];
function getPresetOptions(field: string, subcategories: string[]) { if (field === "colors") return COLOR_OPTIONS; if (field === "size") return SIZE_OPTIONS; if (field === "condition") return CONDITION_OPTIONS; if (field === "warranty") return WARRANTY_OPTIONS; if (field === "material") return MATERIAL_OPTIONS; if (field === "productType") return subcategories; return []; }

function Field({ label, value, onChangeText, placeholder, keyboardType, multiline }: any) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={[styles.input, multiline && styles.textarea]} value={value} onChangeText={onChangeText} placeholder={placeholder || label} placeholderTextColor={Colors.textMuted} keyboardType={keyboardType} multiline={multiline} />
    </View>
  );
}

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const { data: profile } = useQuery<any>({ queryKey: ["/api/vendors/me/profile"] });
  const { data: product, isLoading } = useQuery<any>({ queryKey: ["/api/products", id], enabled: !!id });
  const allowedCategoryIds = useMemo(() => getAllowedCategoryIds(profile), [profile]);
  const allowedConfigs = useMemo(() => SHOP_CATEGORY_CONFIGS.filter(c => allowedCategoryIds.includes(c.id as any)), [allowedCategoryIds]);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [manualUrl, setManualUrl] = useState("");
  const [stock, setStock] = useState("0");
  const [location, setLocation] = useState("");
  const [material, setMaterial] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [weight, setWeight] = useState("");
  const [colors, setColors] = useState("");
  const [features, setFeatures] = useState("");
  const [tags, setTags] = useState("");
  const [productType, setProductType] = useState("");
  const [sku, setSku] = useState("");
  const [modelNumber, setModelNumber] = useState("");
  const [size, setSize] = useState("");
  const [condition, setCondition] = useState("");
  const [warranty, setWarranty] = useState("");
  const [isSale, setIsSale] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [freeShipping, setFreeShipping] = useState(false);
  const [uploading, setUploading] = useState(false);

  const activeConfig = useMemo(() => getShopCategoryConfig(category || profile?.shopCategory), [category, profile?.shopCategory]);

  useEffect(() => {
    if (!product) return;
    setName(product.name || "");
    setPrice(String(product.price || ""));
    setOriginalPrice(product.originalPrice ? String(product.originalPrice) : "");
    setBrand(product.brand || profile?.storeName || "");
    setCategory(product.category || profile?.shopCategory || allowedConfigs[0]?.id || "general");
    setSubcategory(product.subcategory || "");
    setDescription(product.description || "");
    setImages(Array.isArray(product.images) ? product.images.filter(Boolean) : []);
    setStock(String(product.stock ?? 0));
    setLocation(product.location || profile?.location || "The Gambia");
    setMaterial(product.material || "");
    setDimensions(product.dimensions || "");
    setWeight(product.weight || "");
    setColors(joinList(product.colors));
    setFeatures(joinList(product.features));
    setTags(joinList(product.tags));
    setProductType(product.productType || "");
    setSku(product.sku || "");
    setModelNumber(product.modelNumber || "");
    setSize(product.size || "");
    setCondition(product.condition || "");
    setWarranty(product.warranty || "");
    setIsSale(!!product.isSale);
    setIsNew(!!product.isNew);
    setIsFeatured(!!product.isFeatured);
    setFreeShipping(!!product.freeShipping);
  }, [product?.id, profile?.storeName, profile?.location, profile?.shopCategory, allowedConfigs.length]);

  useEffect(() => {
    const firstSub = activeConfig.subcategories[0] || "General";
    if (!subcategory || !activeConfig.subcategories.includes(subcategory)) setSubcategory(product?.subcategory || firstSub);
  }, [activeConfig.id]);

  const dynamicValueMap: Record<string, [string, (v: string) => void]> = {
    material: [material, setMaterial], dimensions: [dimensions, setDimensions], weight: [weight, setWeight], colors: [colors, setColors], features: [features, setFeatures], tags: [tags, setTags], warranty: [warranty, setWarranty], size: [size, setSize], modelNumber: [modelNumber, setModelNumber], condition: [condition, setCondition], productType: [productType, setProductType], sku: [sku, setSku], location: [location, setLocation],
  };

  const addSuggestion = (field: "features" | "tags", value: string) => {
    const current = field === "features" ? features : tags;
    const setter = field === "features" ? setFeatures : setTags;
    const list = splitList(current);
    if (!list.includes(value)) setter([...list, value].join(", "));
  };

  const pickImage = async () => {
    if (images.length >= 5) return Alert.alert("Limit reached", "You can upload up to 5 images per product.");
    try { setUploading(true); const url = await pickAndUploadImage("product"); if (url) setImages(prev => [...prev, url]); }
    catch (e: any) { Alert.alert("Upload failed", e?.message ?? "Could not upload image."); }
    finally { setUploading(false); }
  };

  const addManualUrl = () => {
    const url = manualUrl.trim();
    if (!url) return;
    if (images.length >= 5) return Alert.alert("Limit reached", "You can upload up to 5 images per product.");
    setImages(prev => [...prev, url]);
    setManualUrl("");
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        brand: profile?.storeName || brand.trim() || "MansaMart Vendor",
        category,
        subcategory,
        productType: productType.trim() || subcategory,
        sku: sku.trim() || undefined,
        modelNumber: modelNumber.trim() || undefined,
        size: size.trim() || undefined,
        condition: condition.trim() || undefined,
        warranty: warranty.trim() || undefined,
        description: description.trim(),
        price: Math.round(Number(price || 0)),
        originalPrice: originalPrice ? Math.round(Number(originalPrice)) : null,
        stock: Math.max(0, Math.round(Number(stock || 0))),
        inStock: Number(stock || 0) > 0,
        isSale, isNew, isFeatured, freeShipping,
        images,
        colors: splitList(colors), features: splitList(features), tags: Array.from(new Set([...splitList(tags), category, subcategory])).filter(Boolean),
        material: material.trim() || undefined,
        dimensions: dimensions.trim() || undefined,
        weight: weight.trim() || undefined,
        location: profile?.location || location.trim() || "The Gambia",
        specs: { shopCategory: category, subcategory, productType, modelNumber, size, condition, warranty },
        placeholderColor: activeConfig.color,
        placeholderIcon: activeConfig.icon,
      };
      const res = await apiRequest("PUT", `/api/products/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/products/vendor/mine"] });
      qc.invalidateQueries({ queryKey: ["/api/vendor/dashboard"] });
      qc.invalidateQueries({ queryKey: ["/api/products"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Product updated", "Your product details have been saved.", [{ text: "OK", onPress: () => router.back() }]);
    },
    onError: (e: any) => Alert.alert("Error", e?.message ?? "Failed to update product."),
  });

  if (isLoading) return <View style={styles.center}><Stack.Screen options={{ headerShown: false }} /><ActivityIndicator color={Colors.primary} /><Text style={styles.loadingText}>Loading product...</Text></View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, { paddingTop: topPad + 16 }]}> 
          <Pressable onPress={() => router.back()} hitSlop={8}><Ionicons name="arrow-back" size={24} color={Colors.text} /></Pressable>
          <View style={{ flex: 1 }}><Text style={styles.title}>Edit Product</Text><Text style={styles.subtitle}>Category-aware product form</Text></View>
          <Pressable style={[styles.saveHeaderBtn, save.isPending && { opacity: 0.7 }]} onPress={() => save.mutate()} disabled={save.isPending || !name.trim() || !price.trim()}>
            {save.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveHeaderBtnText}>Save</Text>}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.shopLockCard}>
            <View style={[styles.shopIcon, { backgroundColor: activeConfig.color + "20" }]}><Ionicons name={activeConfig.icon as any} size={22} color={activeConfig.color} /></View>
            <View style={{ flex: 1 }}><Text style={styles.shopLockTitle}>{activeConfig.name}</Text><Text style={styles.shopLockText}>Editing uses the same shop-category rules as add product.</Text></View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Product Images</Text>
            <Text style={styles.sectionSub}>First image is shown first on product cards and detail pages.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageRow}>
              {images.map((url, i) => {
                const preview = resolveAssetUrl(url);
                return (
                  <View key={`${url}-${i}`} style={styles.previewBox}>
                    {preview ? <Image source={toImageSource(preview) as any} style={styles.previewImage} /> : <Ionicons name="image-outline" size={24} color={Colors.textMuted} />}
                    <Pressable style={styles.removeImage} onPress={() => setImages(prev => prev.filter((_, idx) => idx !== i))}><Ionicons name="close" size={14} color="#fff" /></Pressable>
                    {i === 0 && <View style={styles.mainBadge}><Text style={styles.mainBadgeText}>Main</Text></View>}
                  </View>
                );
              })}
              <Pressable style={styles.uploadBox} onPress={pickImage} disabled={uploading}>{uploading ? <ActivityIndicator color={Colors.primary} /> : <Ionicons name="cloud-upload-outline" size={28} color={Colors.primary} />}<Text style={styles.uploadText}>Upload</Text></Pressable>
            </ScrollView>
            <View style={styles.urlRow}><TextInput style={[styles.input, { flex: 1 }]} value={manualUrl} onChangeText={setManualUrl} placeholder="Paste image URL" placeholderTextColor={Colors.textMuted} autoCapitalize="none" /><Pressable style={styles.addUrlBtn} onPress={addManualUrl}><Ionicons name="add" size={22} color="#fff" /></Pressable></View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Shop Category</Text>
            <View style={styles.catGrid}>{allowedConfigs.map(c => <Pressable key={c.id} style={[styles.catOption, category === c.id && { backgroundColor: c.color, borderColor: c.color }]} onPress={() => setCategory(c.id)}><Ionicons name={c.icon as any} size={15} color={category === c.id ? "#fff" : c.color} /><Text style={[styles.catOptionText, category === c.id && { color: "#fff" }]}>{c.name}</Text></Pressable>)}</View>
            <Text style={styles.label}>Subcategory *</Text>
            <View style={styles.subGrid}>{activeConfig.subcategories.map(sc => <Pressable key={sc} style={[styles.subOption, subcategory === sc && { backgroundColor: activeConfig.color + "20", borderColor: activeConfig.color }]} onPress={() => setSubcategory(sc)}><Text style={[styles.subOptionText, subcategory === sc && { color: activeConfig.color }]}>{sc}</Text></Pressable>)}</View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Basic Details</Text>
            <Field label="Product Name *" value={name} onChangeText={setName} placeholder={activeConfig.productNamePlaceholder} />
            <LockedInfo icon="storefront-outline" label="Shop Name" value={profile?.storeName || brand || "Your shop profile name"} note="Locked from Vendor Profile so products stay under the correct shop." />
            <View style={styles.twoCols}><View style={{ flex: 1 }}><Field label="Price (D) *" value={price} onChangeText={setPrice} placeholder="2500" keyboardType="numeric" /></View><View style={{ flex: 1 }}><Field label="Stock" value={stock} onChangeText={setStock} placeholder="10" keyboardType="numeric" /></View></View>
            <Field label="Original Price (D)" value={originalPrice} onChangeText={setOriginalPrice} placeholder="Optional" keyboardType="numeric" />
            <Field label="Description" value={description} onChangeText={setDescription} placeholder={activeConfig.descriptionPlaceholder} multiline />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{activeConfig.name} Details</Text>
            <LockedInfo icon="location-outline" label="Shop Location" value={profile?.location || location || "The Gambia"} note="Location is locked from Vendor Profile. Update your shop profile if the business location changes." />
            {activeConfig.fields.filter(f => f.field !== "location").map(f => {
              const [value, setter] = dynamicValueMap[f.field] || ["", () => {}];
              const options = getPresetOptions(f.field, activeConfig.subcategories);
              const multi = ["colors", "features", "tags", "size"].includes(f.field);
              if (options.length > 0) return <OptionSelector key={f.key} label={f.label} value={value} options={options} multi={multi} onSelect={(selected) => multi ? setter(joinUnique(value, selected)) : setter(selected)} />;
              return <Field key={f.key} label={f.label} value={value} onChangeText={setter} placeholder={f.placeholder} multiline={f.multiline} />;
            })}
            {activeConfig.id === "furniture" && <Field label="Weight" value={weight} onChangeText={setWeight} placeholder="Optional" />}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Quick Suggestions</Text>
            <Text style={styles.label}>Features</Text><View style={styles.subGrid}>{activeConfig.suggestedFeatures.map(x => <Chip key={x} label={x} onPress={() => addSuggestion("features", x)} />)}</View>
            <Text style={styles.label}>Tags</Text><View style={styles.subGrid}>{activeConfig.suggestedTags.map(x => <Chip key={x} label={x} onPress={() => addSuggestion("tags", x)} />)}</View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Selling Options</Text>
            {[{ label: "New Arrival", value: isNew, set: setIsNew }, { label: "On Sale", value: isSale, set: setIsSale }, { label: "Free Shipping", value: freeShipping, set: setFreeShipping }, { label: "Featured Product", value: isFeatured, set: setIsFeatured }].map(item => <View key={item.label} style={styles.switchRow}><Text style={styles.switchText}>{item.label}</Text><Switch value={item.value} onValueChange={item.set as any} trackColor={{ true: Colors.primaryLight }} thumbColor={item.value ? Colors.primary : "#f4f3f4"} /></View>)}
          </View>

          <Pressable style={[styles.saveBtn, (!name.trim() || !price.trim() || save.isPending) && { opacity: 0.6 }]} onPress={() => save.mutate()} disabled={!name.trim() || !price.trim() || save.isPending}>{save.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}</Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function LockedInfo({ icon, label, value, note }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; note?: string }) {
  return <View style={styles.lockedInfo}><View style={styles.lockedIcon}><Ionicons name={icon} size={17} color={Colors.primary} /></View><View style={{ flex: 1 }}><Text style={styles.lockedLabel}>{label}</Text><Text style={styles.lockedValue}>{value}</Text>{!!note && <Text style={styles.lockedNote}>{note}</Text>}</View><Ionicons name="lock-closed-outline" size={17} color={Colors.textMuted} /></View>;
}
function OptionSelector({ label, value, options, onSelect, multi }: { label: string; value: string; options: string[]; onSelect: (v: string) => void; multi?: boolean }) {
  const selected = splitList(value);
  return <View style={styles.fieldBlock}><Text style={styles.label}>{label}</Text><View style={styles.optionWrap}>{options.map(option => { const active = multi ? selected.includes(option) : value === option; return <Pressable key={option} style={[styles.optionChip, active && styles.optionChipActive]} onPress={() => onSelect(option)}>{active && <Ionicons name="checkmark" size={13} color="#fff" />}<Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>{option}</Text></Pressable>; })}</View>{multi && selected.length > 0 && <Text style={styles.selectedText}>Selected: {selected.join(", ")}</Text>}</View>;
}
function Chip({ label, onPress }: { label: string; onPress: () => void }) { return <Pressable style={styles.chip} onPress={onPress}><Text style={styles.chipText}>+ {label}</Text></Pressable>; }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.background, gap: 10 },
  loadingText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textMuted },
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  saveHeaderBtn: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, minWidth: 60, alignItems: "center" },
  saveHeaderBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 },
  form: { padding: 16, gap: 14, paddingBottom: 44 },
  shopLockCard: { flexDirection: "row", gap: 12, backgroundColor: Colors.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: Colors.border },
  shopIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  shopLockTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text },
  shopLockText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted, lineHeight: 18, marginTop: 2 },
  card: { backgroundColor: Colors.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  lockedInfo: { flexDirection: "row", gap: 10, alignItems: "flex-start", padding: 12, backgroundColor: "#F8FAFC", borderRadius: 14, borderWidth: 1, borderColor: Colors.border },
  lockedIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" },
  lockedLabel: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.4 },
  lockedValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.text, marginTop: 2 },
  lockedNote: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 3, lineHeight: 16 },
  optionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 999, backgroundColor: Colors.borderLight, borderWidth: 1, borderColor: Colors.border },
  optionChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  optionChipText: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.textSecondary },
  optionChipTextActive: { color: "#fff" },
  selectedText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text },
  sectionSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted, lineHeight: 18 },
  fieldBlock: { gap: 8 }, label: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text },
  input: { minHeight: 48, borderRadius: 14, backgroundColor: Colors.borderLight, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.text },
  textarea: { minHeight: 110, paddingTop: 12, textAlignVertical: "top" },
  imageRow: { gap: 10, paddingTop: 10, paddingBottom: 4 },
  previewBox: { width: 92, height: 92, borderRadius: 16, overflow: "hidden", backgroundColor: Colors.borderLight, alignItems: "center", justifyContent: "center" },
  previewImage: { width: "100%", height: "100%" },
  uploadBox: { width: 92, height: 92, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: Colors.primary, alignItems: "center", justifyContent: "center", backgroundColor: Colors.primaryLight },
  uploadText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.primary, marginTop: 4 },
  removeImage: { position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  mainBadge: { position: "absolute", left: 6, bottom: 6, backgroundColor: Colors.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  mainBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  urlRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  addUrlBtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  twoCols: { flexDirection: "row", gap: 10 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catOption: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, backgroundColor: Colors.borderLight, borderWidth: 1, borderColor: Colors.border },
  catOptionText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.text },
  subGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  subOption: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, backgroundColor: Colors.borderLight, borderWidth: 1, borderColor: Colors.border },
  subOptionText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: "rgba(14,164,122,0.18)" },
  chipText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  switchText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  saveBtn: { minHeight: 54, borderRadius: 18, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", marginTop: 4 },
  saveBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});
