export type VendorShopCategory =
  | "fashion"
  | "electronics"
  | "furniture"
  | "beauty"
  | "food"
  | "agri"
  | "auto"
  | "books"
  | "jewellery"
  | "general";

export type DynamicField = {
  key: string;
  label: string;
  placeholder: string;
  field: "material" | "dimensions" | "weight" | "colors" | "features" | "tags" | "warranty" | "size" | "modelNumber" | "condition" | "productType" | "sku" | "location";
  multiline?: boolean;
};

export type ShopCategoryConfig = {
  id: VendorShopCategory;
  name: string;
  icon: string;
  color: string;
  productNamePlaceholder: string;
  descriptionPlaceholder: string;
  subcategories: string[];
  fields: DynamicField[];
  suggestedFeatures: string[];
  suggestedTags: string[];
};

export const SHOP_CATEGORY_CONFIGS: ShopCategoryConfig[] = [
  {
    id: "fashion",
    name: "Fashion & Clothing",
    icon: "shirt-outline",
    color: "#E91E8C",
    productNamePlaceholder: "e.g. Kaftan, Abaya, Shirt, Shoes",
    descriptionPlaceholder: "Mention fabric quality, size options, fitting, color, and whether custom sewing is available.",
    subcategories: ["Men Wear", "Women Wear", "Kids Wear", "Shoes", "Bags", "Traditional Wear", "Tailoring", "Accessories"],
    fields: [
      { key: "productType", label: "Fashion Type", placeholder: "Kaftan, dress, shoes, bag...", field: "productType" },
      { key: "size", label: "Available Sizes", placeholder: "S, M, L, XL or 40, 41, 42", field: "size" },
      { key: "material", label: "Fabric / Material", placeholder: "Cotton, bazin, silk, leather...", field: "material" },
      { key: "colors", label: "Available Colors", placeholder: "Black, white, gold, blue", field: "colors" },
      { key: "condition", label: "Condition", placeholder: "New, custom-made, imported...", field: "condition" },
    ],
    suggestedFeatures: ["Custom size", "Quality fabric", "Ready to wear", "Same-day pickup", "Tailoring available"],
    suggestedTags: ["fashion", "clothing", "traditional", "style"],
  },
  {
    id: "electronics",
    name: "Electronics & Gadgets",
    icon: "phone-portrait-outline",
    color: "#2196F3",
    productNamePlaceholder: "e.g. iPhone 13, Samsung TV, Bluetooth Speaker",
    descriptionPlaceholder: "Mention model, storage, warranty, accessories, condition, and what is inside the box.",
    subcategories: ["Phones", "Laptops", "TVs", "Audio", "Gaming", "Accessories", "Home Appliances", "Repairs"],
    fields: [
      { key: "modelNumber", label: "Model / Serial", placeholder: "iPhone 13 Pro, A2638, HP 840 G5...", field: "modelNumber" },
      { key: "condition", label: "Condition", placeholder: "Brand new, UK used, refurbished...", field: "condition" },
      { key: "warranty", label: "Warranty", placeholder: "7 days, 1 month, 1 year...", field: "warranty" },
      { key: "features", label: "Specifications", placeholder: "128GB, 8GB RAM, 5000mAh, 4K...", field: "features" },
      { key: "sku", label: "SKU / Shop Code", placeholder: "Optional internal tracking code", field: "sku" },
    ],
    suggestedFeatures: ["Warranty included", "Original charger", "Tested", "Free setup", "Receipt available"],
    suggestedTags: ["electronics", "gadget", "phone", "laptop"],
  },
  {
    id: "furniture",
    name: "Furniture & Decor",
    icon: "bed-outline",
    color: "#0EA47A",
    productNamePlaceholder: "e.g. Modern Sofa Set, Office Desk, Bed Frame",
    descriptionPlaceholder: "Mention material, dimensions, room type, delivery option, and whether custom size is available.",
    subcategories: ["Living Room", "Bedroom", "Office", "Kitchen", "Lighting", "Storage", "Decor", "Outdoor"],
    fields: [
      { key: "material", label: "Material", placeholder: "Wood, leather, metal, fabric...", field: "material" },
      { key: "dimensions", label: "Dimensions", placeholder: "120cm x 80cm x 60cm", field: "dimensions" },
      { key: "colors", label: "Available Colors", placeholder: "Brown, black, cream", field: "colors" },
      { key: "warranty", label: "Warranty / Aftercare", placeholder: "3 months, repair support, no warranty...", field: "warranty" },
      { key: "features", label: "Features", placeholder: "Custom design, durable, washable cover", field: "features" },
    ],
    suggestedFeatures: ["Custom size", "Delivery available", "Premium finishing", "Made in The Gambia", "Installation support"],
    suggestedTags: ["furniture", "home", "decor", "office"],
  },
  {
    id: "beauty",
    name: "Beauty & Cosmetics",
    icon: "sparkles-outline",
    color: "#FF6B9D",
    productNamePlaceholder: "e.g. Body Lotion, Wig, Makeup Kit",
    descriptionPlaceholder: "Mention skin/hair type, size, ingredients, expiry date, and usage instructions.",
    subcategories: ["Skincare", "Hair Care", "Makeup", "Perfume", "Wigs", "Nails", "Spa", "Accessories"],
    fields: [
      { key: "productType", label: "Beauty Type", placeholder: "Skincare, haircare, perfume...", field: "productType" },
      { key: "size", label: "Size / Volume", placeholder: "100ml, 250ml, 30g", field: "size" },
      { key: "features", label: "Ingredients / Benefits", placeholder: "Shea butter, vitamin C, organic...", field: "features" },
      { key: "tags", label: "Skin/Hair Tags", placeholder: "oily skin, natural hair, sensitive skin", field: "tags" },
    ],
    suggestedFeatures: ["Original product", "Organic", "Suitable for sensitive skin", "Long lasting", "Salon quality"],
    suggestedTags: ["beauty", "cosmetics", "skincare", "hair"],
  },
  {
    id: "food",
    name: "Food & Groceries",
    icon: "fast-food-outline",
    color: "#4CAF50",
    productNamePlaceholder: "e.g. Rice Bag, Local Juice, Cake, Lunch Pack",
    descriptionPlaceholder: "Mention quantity, expiry/preparation time, ingredients, packaging, and delivery limits.",
    subcategories: ["Groceries", "Meals", "Bakery", "Drinks", "Frozen Food", "Local Food", "Wholesale", "Catering"],
    fields: [
      { key: "weight", label: "Weight / Quantity", placeholder: "1kg, 5kg, dozen, plate...", field: "weight" },
      { key: "features", label: "Ingredients / Package", placeholder: "No sugar, spicy, family pack, fresh daily", field: "features" },
      { key: "condition", label: "Freshness", placeholder: "Fresh today, frozen, sealed pack...", field: "condition" },
      { key: "tags", label: "Food Tags", placeholder: "halal, spicy, local, wholesale", field: "tags" },
    ],
    suggestedFeatures: ["Fresh daily", "Halal", "Bulk order", "Same-day delivery", "Prepared on request"],
    suggestedTags: ["food", "grocery", "fresh", "local"],
  },
  {
    id: "agri",
    name: "Agriculture",
    icon: "leaf-outline",
    color: "#388E3C",
    productNamePlaceholder: "e.g. Onion Bag, Seedlings, Fertilizer",
    descriptionPlaceholder: "Mention origin, quantity, grade, season, and pickup/delivery location.",
    subcategories: ["Fresh Produce", "Seeds", "Fertilizer", "Farm Tools", "Livestock", "Poultry", "Animal Feed", "Wholesale"],
    fields: [
      { key: "weight", label: "Weight / Quantity", placeholder: "50kg, crate, bundle, sack", field: "weight" },
      { key: "condition", label: "Grade / Condition", placeholder: "Grade A, fresh harvest, dry stock...", field: "condition" },
      { key: "location", label: "Farm / Pickup Location", placeholder: "Brikama, Farafenni, Banjul market...", field: "location" },
    ],
    suggestedFeatures: ["Fresh harvest", "Wholesale available", "Farm direct", "Bulk discount", "Organic"],
    suggestedTags: ["agriculture", "farm", "fresh", "wholesale"],
  },
  {
    id: "auto",
    name: "Auto Parts",
    icon: "car-outline",
    color: "#455A64",
    productNamePlaceholder: "e.g. Toyota Brake Pad, Tyre, Engine Oil",
    descriptionPlaceholder: "Mention car model compatibility, condition, warranty, and installation support.",
    subcategories: ["Car Parts", "Motorbike Parts", "Tyres", "Lubricants", "Tools", "Accessories", "Maintenance", "Batteries"],
    fields: [
      { key: "modelNumber", label: "Compatible Model", placeholder: "Toyota Corolla 2010-2015, Honda...", field: "modelNumber" },
      { key: "condition", label: "Condition", placeholder: "New, used, original, aftermarket", field: "condition" },
      { key: "warranty", label: "Warranty", placeholder: "7 days, 1 month, no warranty", field: "warranty" },
      { key: "sku", label: "Part Number / SKU", placeholder: "Optional part number", field: "sku" },
    ],
    suggestedFeatures: ["Original part", "Installation available", "Tested", "Warranty", "Bulk price"],
    suggestedTags: ["auto", "parts", "car", "motorbike"],
  },
  {
    id: "books",
    name: "Books & Stationery",
    icon: "book-outline",
    color: "#795548",
    productNamePlaceholder: "e.g. Exercise Books, Textbook, Office Paper",
    descriptionPlaceholder: "Mention class/level, subject, quantity, edition, and condition.",
    subcategories: ["Textbooks", "Exercise Books", "Office Supplies", "School Supplies", "Printing", "Novels", "Kids Books", "Art Supplies"],
    fields: [
      { key: "productType", label: "Item Type", placeholder: "Textbook, notebook, paper, pen...", field: "productType" },
      { key: "condition", label: "Condition", placeholder: "New, used, latest edition...", field: "condition" },
      { key: "features", label: "Level / Subject / Quantity", placeholder: "Grade 9, science, 10 pieces", field: "features" },
    ],
    suggestedFeatures: ["Bulk price", "School package", "Latest edition", "Office supply", "Delivery available"],
    suggestedTags: ["books", "school", "stationery", "office"],
  },
  {
    id: "jewellery",
    name: "Jewellery & Accessories",
    icon: "diamond-outline",
    color: "#FFC107",
    productNamePlaceholder: "e.g. Gold Necklace, Watch, Bracelet",
    descriptionPlaceholder: "Mention material, size, weight, design, packaging, and authenticity.",
    subcategories: ["Necklaces", "Rings", "Watches", "Bracelets", "Earrings", "Sets", "Custom Design", "Luxury"],
    fields: [
      { key: "material", label: "Material", placeholder: "Gold, silver, stainless steel, beads...", field: "material" },
      { key: "weight", label: "Weight / Size", placeholder: "18g, adjustable, medium", field: "weight" },
      { key: "condition", label: "Condition", placeholder: "New, handmade, imported...", field: "condition" },
      { key: "features", label: "Features", placeholder: "Gift box, custom name, waterproof", field: "features" },
    ],
    suggestedFeatures: ["Gift box", "Custom design", "Premium quality", "Waterproof", "Handmade"],
    suggestedTags: ["jewellery", "accessories", "gift", "luxury"],
  },
  {
    id: "general",
    name: "General Store",
    icon: "storefront-outline",
    color: "#6B7280",
    productNamePlaceholder: "e.g. Product name",
    descriptionPlaceholder: "Describe the product, quality, stock, delivery and warranty details.",
    subcategories: ["General", "Home", "Office", "Personal", "Wholesale", "Retail", "Other"],
    fields: [
      { key: "productType", label: "Product Type", placeholder: "What type of product is this?", field: "productType" },
      { key: "condition", label: "Condition", placeholder: "New, used, imported, handmade...", field: "condition" },
      { key: "features", label: "Features", placeholder: "Durable, premium, warranty...", field: "features" },
      { key: "tags", label: "Tags", placeholder: "popular, wholesale, premium", field: "tags" },
    ],
    suggestedFeatures: ["Quality checked", "Delivery available", "Bulk price", "Warranty", "Fast response"],
    suggestedTags: ["general", "retail", "shop", "marketplace"],
  },
];

export function getShopCategoryConfig(id?: string | null): ShopCategoryConfig {
  return SHOP_CATEGORY_CONFIGS.find(c => c.id === id) || SHOP_CATEGORY_CONFIGS.find(c => c.id === "general")!;
}

export function getAllowedCategoryIds(profile?: any): VendorShopCategory[] {
  const shopCategory = (profile?.shopCategory || profile?.businessType || "general") as VendorShopCategory;
  const allowed = Array.isArray(profile?.allowedCategories) ? profile.allowedCategories : [];
  const ids = [shopCategory, ...allowed].filter(Boolean) as VendorShopCategory[];
  return Array.from(new Set(ids.length ? ids : ["general"]));
}
