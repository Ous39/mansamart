import "dotenv/config";
import { db } from "./db";
import { users, products, services, flashDeals, vendorProfiles, providerProfiles, coupons, banners, reviews } from "../shared/schema";
import { eq, count } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";

async function seed() {
  console.log("🌱 Seeding MansaMart database...");

  // ─── USERS / DEMO ACCOUNTS ──────────────────────────────────────────────
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  async function ensureDemoUser(data: any) {
    const { plainPassword, ...userData } = data;
    const existing = await db.select().from(users).where(eq(users.email, userData.email)).limit(1);
    if (existing.length > 0) {
      const [updated] = await db.update(users)
        .set({
          ...userData,
          password: hash(plainPassword),
          updatedAt: new Date(),
        })
        .where(eq(users.email, userData.email))
        .returning();
      return updated;
    }

    const [created] = await db.insert(users).values({
      ...userData,
      password: hash(plainPassword),
    }).returning();
    return created;
  }

  const admin = await ensureDemoUser({
    email: "admin@oceanbrown.studio",
    plainPassword: "admin123",
    name: "MansaMart Admin",
    phone: "2207001000",
    role: "admin",
    city: "Banjul",
    region: "Greater Banjul",
    isVerified: true,
    verificationStatus: "verified",
  });

  const vendor = await ensureDemoUser({
    email: "vendor@oceanbrown.studio",
    plainPassword: "vendor123",
    name: "Omar Sanneh",
    phone: "2207001001",
    role: "vendor",
    businessName: "Sanneh Trading Store",
    businessType: "general",
    city: "Serrekunda",
    region: "Greater Banjul",
    isVerified: true,
    verificationStatus: "verified",
  });

  const provider = await ensureDemoUser({
    email: "provider@oceanbrown.studio",
    plainPassword: "provider123",
    name: "Fatou Jobe",
    phone: "2207001002",
    role: "service_provider",
    businessName: "Fatou Clean Services",
    businessType: "Home Services",
    city: "Bakau",
    region: "Greater Banjul",
    isVerified: true,
    verificationStatus: "verified",
  });

  const rider = await ensureDemoUser({
    email: "rider@oceanbrown.studio",
    plainPassword: "rider123",
    name: "Ebrima Delivery Rider",
    phone: "2207001004",
    role: "delivery_rider",
    businessName: "MansaMart Delivery",
    businessType: "Delivery Service",
    city: "Kanifing",
    region: "Greater Banjul",
    isVerified: true,
    verificationStatus: "verified",
  });

  const regularUser = await ensureDemoUser({
    email: "user@oceanbrown.studio",
    plainPassword: "user123",
    name: "Mamadou Diallo",
    phone: "2207001003",
    role: "user",
    city: "Kanifing",
    region: "Greater Banjul",
    isVerified: true,
    verificationStatus: "not_submitted",
    loyaltyPoints: 350,
    totalOrders: 5,
    totalSpent: 12500,
  });

  console.log("✅ Demo accounts are ready and passwords were reset");

  // ─── VENDOR PROFILE ──────────────────────────────────────────────────────
  if (vendor) {
    const existing = await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, vendor.id)).limit(1);
    if (existing.length === 0) {
      await db.insert(vendorProfiles).values({
        userId: vendor.id,
        storeName: "Sanneh Trading Store",
        description: "Your one-stop shop for quality products from across The Gambia and beyond. We offer genuine products with the best prices and fast delivery.",
        shopCategory: "general",
        allowedCategories: ["fashion", "electronics", "furniture"],
        subcategories: ["General", "Home", "Electronics", "Fashion", "Office"],
        location: "Pipeline Market, Serrekunda",
        returnPolicy: "7-day no-questions-asked return policy for all items in original condition.",
        shippingPolicy: "Free delivery on orders above D2,000. Standard delivery 1-2 days within Greater Banjul, 3-5 days upcountry.",
        totalSales: 847,
        totalRevenue: 2400000,
        rating: 4.8,
        reviewCount: 312,
        verificationStatus: "verified",
        whatsapp: "+2207001001",
        facebook: "SannehTradingStore",
        instagram: "sanneh_trading",
      });
      console.log("✅ Seeded vendor profile");
    }
  }

  // ─── PROVIDER PROFILE ────────────────────────────────────────────────────
  if (provider) {
    const existing = await db.select().from(providerProfiles).where(eq(providerProfiles.userId, provider.id)).limit(1);
    if (existing.length === 0) {
      await db.insert(providerProfiles).values({
        userId: provider.id,
        displayName: "Fatou Professional Services",
        bio: "10+ years experience in home services across The Gambia. We take pride in our quality workmanship, reliability, and use of eco-friendly products.",
        location: "Bakau, Greater Banjul",
        serviceAreas: ["Banjul", "Serrekunda", "Kanifing", "Bakau", "Fajara", "Kotu", "Kololi", "Tallinding"],
        certifications: ["Certified Home Cleaner - 2019", "Electrician License - 2020", "Plumbing Certificate - 2018"],
        totalJobs: 523,
        totalEarnings: 1850000,
        rating: 4.9,
        reviewCount: 287,
        verificationStatus: "verified",
        responseTime: "< 30 minutes",
        whatsapp: "+2207001002",
      });
      console.log("✅ Seeded provider profile");
    }
  }

  // ─── PENDING VERIFICATION TEST ACCOUNTS ──────────────────────────────────
  const existingPending = await db.select().from(users).where(eq(users.email, "vendor2@oceanbrown.studio")).limit(1);
  if (existingPending.length === 0) {
    const hash = (pw: string) => bcrypt.hashSync(pw, 10);
    const [v2] = await db.insert(users).values({
      email: "vendor2@oceanbrown.studio", password: hash("vendor123"), name: "Binta Touray",
      phone: "2207002001", role: "vendor", businessName: "Touray Fashion House",
      businessType: "fashion", city: "Banjul", region: "Greater Banjul",
      isVerified: false, verificationStatus: "pending",
    }).returning();
    await db.insert(vendorProfiles).values({
      userId: v2.id, storeName: "Touray Fashion House",
      description: "Premium African fashion and accessories. Traditional and modern designs blending Gambian culture with contemporary style.",
      shopCategory: "fashion",
      allowedCategories: [],
      subcategories: ["Women Wear", "Traditional Wear", "Bags", "Accessories"],
      location: "Westfield, Serrekunda", returnPolicy: "5-day return for unworn items.",
      shippingPolicy: "Delivery within 2-3 days across The Gambia.",
      verificationStatus: "pending", whatsapp: "+2207002001",
    });

    const [p2] = await db.insert(users).values({
      email: "provider2@oceanbrown.studio", password: hash("provider123"), name: "Yankuba Jallow",
      phone: "2207002002", role: "service_provider", businessName: "Jallow Electricals",
      businessType: "Electrical Services", city: "Serrekunda", region: "Greater Banjul",
      isVerified: false, verificationStatus: "pending",
    }).returning();
    await db.insert(providerProfiles).values({
      userId: p2.id, displayName: "Jallow Electricals",
      bio: "Licensed electrician with 8 years experience. Specializing in home wiring, solar installation, and appliance repair throughout Greater Banjul.",
      location: "Pipeline, Serrekunda",
      serviceAreas: ["Banjul", "Serrekunda", "Kanifing", "Bakau"],
      certifications: ["Electrical Engineering Certificate - 2016", "Solar Installation License - 2021"],
      verificationStatus: "pending", whatsapp: "+2207002002",
    });
    console.log("✅ Seeded 2 pending verification accounts (vendor2, provider2)");
  }

  // ─── PRODUCTS (100+) ─────────────────────────────────────────────────────
  const [{ value: productCount }] = await db.select({ value: count() }).from(products);

  if (Number(productCount) < 50) {
    const vid = vendor?.id;
    const seedProducts: any[] = [
      // ── FASHION (18) ──────────────────────────────────────────────────────
      { name: "Ankara Print Dress", brand: "AfriStyle", price: 1800, originalPrice: 2400, category: "fashion", subcategory: "dresses", isSale: true, isFeatured: true, soldCount: 234, rating: 4.7, reviewCount: 89, colors: ["#FF6B6B","#4ECDC4","#45B7D1"], features: ["100% Cotton", "Machine washable", "Tailored fit", "Ankara wax print"], tags: ["dress","ankara","african","women"], location: "Banjul", freeShipping: false, placeholderColor: "#FF6B6B", placeholderIcon: "shirt-outline", vendorId: vid },
      { name: "Men's Kaftan Set", brand: "Gambia Threads", price: 2500, originalPrice: 3000, category: "fashion", subcategory: "men", isSale: true, isFeatured: true, soldCount: 156, rating: 4.8, reviewCount: 67, colors: ["#FFFFFF","#1A1A2E","#D4AF37"], features: ["Premium fabric", "Traditional embroidery", "Breathable", "Includes cap"], tags: ["kaftan","men","traditional","eid"], location: "Serrekunda", freeShipping: true, placeholderColor: "#D4AF37", placeholderIcon: "shirt-outline", vendorId: vid },
      { name: "Women's Tie-Dye Wrapper", brand: "Senegambia Crafts", price: 950, originalPrice: 1200, category: "fashion", subcategory: "women", isSale: true, isFeatured: false, soldCount: 445, rating: 4.6, reviewCount: 203, colors: ["#6B4C9A","#E8813A","#0EA47A"], features: ["Hand-dyed", "Versatile use", "Soft fabric"], tags: ["wrapper","tie-dye","women"], location: "Banjul", freeShipping: false, placeholderColor: "#6B4C9A", placeholderIcon: "shirt-outline", vendorId: vid },
      { name: "Leather Sandals (Unisex)", brand: "Banjul Leather", price: 1200, category: "fashion", subcategory: "shoes", isFeatured: true, soldCount: 389, rating: 4.5, reviewCount: 156, colors: ["#8B4513","#000000","#D4AF37"], features: ["Genuine leather", "Handmade", "Durable sole", "Unisex"], tags: ["sandals","leather","shoes"], location: "Banjul", freeShipping: false, placeholderColor: "#8B4513", placeholderIcon: "footsteps-outline", vendorId: vid },
      { name: "Batik Print Blouse", brand: "AfriStyle", price: 1100, originalPrice: 1400, category: "fashion", subcategory: "women", isSale: true, soldCount: 178, rating: 4.4, reviewCount: 72, colors: ["#FF6B6B","#FFE66D","#A8E063"], features: ["Batik fabric", "Short sleeve", "Comfortable fit"], tags: ["blouse","batik","women"], location: "Serrekunda", freeShipping: false, placeholderColor: "#FF6B6B", placeholderIcon: "shirt-outline" },
      { name: "Men's Chinos Trousers", brand: "West African Wear", price: 1650, category: "fashion", subcategory: "men", isFeatured: false, soldCount: 267, rating: 4.3, reviewCount: 98, colors: ["#8B7355","#1A1A2E","#3A7D44"], features: ["Stretch fit", "Flat front", "Available S-3XL"], tags: ["trousers","men","casual"], location: "Serrekunda", freeShipping: false, placeholderColor: "#8B7355", placeholderIcon: "shirt-outline", vendorId: vid },
      { name: "Headscarves 3-Pack", brand: "Senegambia Crafts", price: 750, originalPrice: 1000, category: "fashion", subcategory: "accessories", isSale: true, soldCount: 623, rating: 4.7, reviewCount: 341, colors: ["#FF69B4","#87CEEB","#90EE90"], features: ["Cotton blend", "Lightweight", "Multipurpose", "Pack of 3"], tags: ["headscarf","hijab","women"], location: "Banjul", freeShipping: false, placeholderColor: "#FF69B4", placeholderIcon: "shirt-outline" },
      { name: "Women's Stiletto Heels", brand: "Lagos Style", price: 2200, category: "fashion", subcategory: "shoes", isFeatured: true, soldCount: 134, rating: 4.6, reviewCount: 56, colors: ["#000000","#FF0000","#D4AF37"], features: ["5-inch heel", "Cushioned insole", "Party & formal"], tags: ["heels","shoes","women","party"], location: "Serrekunda", freeShipping: false, placeholderColor: "#D4AF37", placeholderIcon: "footsteps-outline", vendorId: vid },
      { name: "Children's Traditional Outfit", brand: "Gambia Threads", price: 1350, category: "fashion", subcategory: "kids", isFeatured: false, soldCount: 289, rating: 4.8, reviewCount: 145, colors: ["#FF6B6B","#87CEEB","#FFE66D"], features: ["Traditional style", "Kids 3-12 years", "Easy care"], tags: ["kids","traditional","eid","children"], location: "Banjul", freeShipping: false, placeholderColor: "#87CEEB", placeholderIcon: "shirt-outline" },
      { name: "Denim Jacket", brand: "Urban Africa", price: 3200, category: "fashion", subcategory: "outerwear", isFeatured: true, isNew: true, soldCount: 67, rating: 4.5, reviewCount: 23, colors: ["#4169E1","#000000","#ADD8E6"], features: ["Heavy denim", "Brass buttons", "Chest pockets"], tags: ["jacket","denim","unisex"], location: "Serrekunda", freeShipping: true, placeholderColor: "#4169E1", placeholderIcon: "shirt-outline", vendorId: vid },
      { name: "Embroidered Jalabiya", brand: "Mauritanian Craft", price: 3800, category: "fashion", subcategory: "men", isFeatured: true, soldCount: 89, rating: 4.9, reviewCount: 44, colors: ["#FFFFFF","#D4AF37","#1A1A2E"], features: ["Hand embroidered", "Premium fabric", "Luxury finish"], tags: ["jalabiya","men","traditional","premium"], location: "Banjul", freeShipping: true, placeholderColor: "#D4AF37", placeholderIcon: "shirt-outline", vendorId: vid },
      { name: "Women's Floral Summer Dress", brand: "AfriStyle", price: 1450, originalPrice: 1900, category: "fashion", subcategory: "dresses", isSale: true, soldCount: 312, rating: 4.5, reviewCount: 134, colors: ["#FFE4B5","#98FB98","#DDA0DD"], features: ["Polyester blend", "Midi length", "Floral print"], tags: ["dress","floral","summer","women"], location: "Serrekunda", freeShipping: false, placeholderColor: "#98FB98", placeholderIcon: "shirt-outline" },
      { name: "Loafers - Men", brand: "Banjul Leather", price: 2800, category: "fashion", subcategory: "shoes", isFeatured: false, soldCount: 145, rating: 4.4, reviewCount: 67, colors: ["#8B4513","#000000","#C0C0C0"], features: ["Genuine leather", "Slip-on", "Office & casual"], tags: ["loafers","shoes","men","leather"], location: "Banjul", freeShipping: false, placeholderColor: "#8B4513", placeholderIcon: "footsteps-outline", vendorId: vid },
      { name: "African Print Bucket Bag", brand: "Senegambia Crafts", price: 1900, category: "fashion", subcategory: "bags", isFeatured: true, isNew: true, soldCount: 78, rating: 4.7, reviewCount: 31, colors: ["#FF6B6B","#4ECDC4","#FFE66D"], features: ["Ankara fabric", "Zipper closure", "Inner pockets"], tags: ["bag","african","ankara","women"], location: "Banjul", freeShipping: false, placeholderColor: "#FF6B6B", placeholderIcon: "bag-outline", vendorId: vid },
      { name: "Men's Sport Sneakers", brand: "SportGambia", price: 2600, category: "fashion", subcategory: "shoes", isFeatured: false, soldCount: 234, rating: 4.3, reviewCount: 89, colors: ["#FFFFFF","#000000","#E63946"], features: ["Air sole", "Breathable mesh", "Non-slip"], tags: ["sneakers","sport","men","shoes"], location: "Serrekunda", freeShipping: false, placeholderColor: "#E63946", placeholderIcon: "footsteps-outline" },
      { name: "Boubou Dress - Women", brand: "Gambia Threads", price: 4500, category: "fashion", subcategory: "dresses", isFeatured: true, soldCount: 123, rating: 4.9, reviewCount: 67, colors: ["#E8813A","#6B4C9A","#0EA47A"], features: ["Embroidered", "Flowing fabric", "Formal & special occasions"], tags: ["boubou","dress","women","formal"], location: "Banjul", freeShipping: true, placeholderColor: "#E8813A", placeholderIcon: "shirt-outline", vendorId: vid },
      { name: "Gambian Football Jersey", brand: "Scorpions FC", price: 1500, originalPrice: 2000, category: "fashion", subcategory: "sportswear", isSale: true, isFeatured: true, soldCount: 567, rating: 4.6, reviewCount: 234, colors: ["#FFFFFF","#E63946","#1A1A2E"], features: ["Official replica", "Breathable fabric", "Adult sizes"], tags: ["jersey","football","gambia","sport"], location: "Banjul", freeShipping: false, placeholderColor: "#E63946", placeholderIcon: "shirt-outline" },
      { name: "Wax Print Maxi Skirt", brand: "AfriStyle", price: 1300, category: "fashion", subcategory: "women", soldCount: 198, rating: 4.5, reviewCount: 78, colors: ["#FF6B6B","#4ECDC4","#FFE66D"], features: ["Wax print", "Elastic waistband", "Maxi length"], tags: ["skirt","wax","women","african"], location: "Serrekunda", freeShipping: false, placeholderColor: "#4ECDC4", placeholderIcon: "shirt-outline" },

      // ── ELECTRONICS (16) ──────────────────────────────────────────────────
      { name: "Samsung Galaxy A55", brand: "Samsung", price: 28000, originalPrice: 32000, category: "electronics", subcategory: "phones", isSale: true, isFeatured: true, soldCount: 89, rating: 4.7, reviewCount: 43, colors: ["#1A1A2E","#C0C0C0","#87CEEB"], features: ["6.6\" AMOLED", "50MP Camera", "5000mAh", "128GB"], tags: ["phone","samsung","android","smartphone"], location: "Banjul", freeShipping: true, placeholderColor: "#1A1A2E", placeholderIcon: "phone-portrait-outline", vendorId: vid },
      { name: "Tecno Spark 20", brand: "Tecno", price: 9500, originalPrice: 11000, category: "electronics", subcategory: "phones", isSale: true, isFeatured: true, soldCount: 234, rating: 4.4, reviewCount: 112, colors: ["#000000","#87CEEB","#FF69B4"], features: ["6.56\" screen", "13MP Camera", "5000mAh", "64GB"], tags: ["phone","tecno","budget","android"], location: "Serrekunda", freeShipping: false, placeholderColor: "#000000", placeholderIcon: "phone-portrait-outline", vendorId: vid },
      { name: "Infinix Hot 40", brand: "Infinix", price: 8200, category: "electronics", subcategory: "phones", isFeatured: false, soldCount: 178, rating: 4.3, reviewCount: 89, colors: ["#4ECDC4","#FF6B6B","#000000"], features: ["6.78\" screen", "Helio G85", "5000mAh", "128GB"], tags: ["phone","infinix","android"], location: "Banjul", freeShipping: false, placeholderColor: "#4ECDC4", placeholderIcon: "phone-portrait-outline" },
      { name: "Itel Vision 3 Plus", brand: "Itel", price: 4500, category: "electronics", subcategory: "phones", isFeatured: false, soldCount: 445, rating: 4.1, reviewCount: 223, colors: ["#000000","#1A1A2E","#87CEEB"], features: ["6.6\" screen", "5MP Camera", "5000mAh", "32GB"], tags: ["phone","itel","budget"], location: "Serrekunda", freeShipping: false, placeholderColor: "#1A1A2E", placeholderIcon: "phone-portrait-outline" },
      { name: "Lenovo IdeaPad Laptop", brand: "Lenovo", price: 45000, originalPrice: 52000, category: "electronics", subcategory: "laptops", isSale: true, isFeatured: true, soldCount: 34, rating: 4.6, reviewCount: 18, colors: ["#C0C0C0","#1A1A2E"], features: ["Intel i5", "8GB RAM", "256GB SSD", "15.6\" screen"], tags: ["laptop","lenovo","computer","work"], location: "Banjul", freeShipping: true, placeholderColor: "#C0C0C0", placeholderIcon: "laptop-outline", vendorId: vid },
      { name: "HP Chromebook", brand: "HP", price: 32000, category: "electronics", subcategory: "laptops", isFeatured: false, soldCount: 23, rating: 4.4, reviewCount: 11, colors: ["#C0C0C0"], features: ["Intel Celeron", "4GB RAM", "64GB eMMC", "14\" screen"], tags: ["laptop","hp","chromebook","student"], location: "Serrekunda", freeShipping: true, placeholderColor: "#1A1A2E", placeholderIcon: "laptop-outline", vendorId: vid },
      { name: "43\" LED TV - Smart", brand: "Hisense", price: 35000, originalPrice: 42000, category: "electronics", subcategory: "tv", isSale: true, isFeatured: true, soldCount: 56, rating: 4.7, reviewCount: 34, colors: ["#000000"], features: ["Smart TV", "4K ready", "WiFi", "Netflix/YouTube"], tags: ["tv","smart","hisense","entertainment"], location: "Banjul", freeShipping: false, placeholderColor: "#000000", placeholderIcon: "tv-outline", vendorId: vid },
      { name: "Sonos JBL Speaker", brand: "JBL", price: 8500, originalPrice: 10000, category: "electronics", subcategory: "audio", isSale: true, isFeatured: false, soldCount: 145, rating: 4.8, reviewCount: 78, colors: ["#000000","#E63946","#1A1A2E"], features: ["Waterproof", "Bluetooth 5.0", "12hr battery", "Deep bass"], tags: ["speaker","bluetooth","jbl","music"], location: "Serrekunda", freeShipping: false, placeholderColor: "#E63946", placeholderIcon: "musical-notes-outline", vendorId: vid },
      { name: "Portable Generator 2.5kVA", brand: "Sumec Firman", price: 22000, category: "electronics", subcategory: "generators", isFeatured: true, soldCount: 78, rating: 4.5, reviewCount: 41, colors: ["#E8813A","#FF0000"], features: ["2.5kVA", "6 hours run time", "Electric start", "220V"], tags: ["generator","power","backup"], location: "Banjul", freeShipping: false, placeholderColor: "#E8813A", placeholderIcon: "flash-outline" },
      { name: "Standing Fan - 18\"", brand: "Binatone", price: 3800, originalPrice: 4500, category: "electronics", subcategory: "appliances", isSale: true, soldCount: 389, rating: 4.4, reviewCount: 167, colors: ["#FFFFFF","#1A1A2E"], features: ["3 speeds", "Adjustable height", "Timer", "Remote control"], tags: ["fan","cooling","standing","appliance"], location: "Serrekunda", freeShipping: false, placeholderColor: "#FFFFFF", placeholderIcon: "cloudy-outline" },
      { name: "Table Fan - 12\"", brand: "Binatone", price: 2200, category: "electronics", subcategory: "appliances", soldCount: 567, rating: 4.2, reviewCount: 234, colors: ["#FFFFFF","#1A1A2E"], features: ["3 speeds", "90° oscillation", "Compact"], tags: ["fan","table","cooling"], location: "Banjul", freeShipping: false, placeholderColor: "#1A1A2E", placeholderIcon: "cloudy-outline" },
      { name: "Samsung 200L Refrigerator", brand: "Samsung", price: 48000, originalPrice: 55000, category: "electronics", subcategory: "appliances", isSale: true, isFeatured: true, soldCount: 23, rating: 4.8, reviewCount: 12, colors: ["#C0C0C0","#FFFFFF"], features: ["200 Liters", "No-frost", "Energy A+", "5-year warranty"], tags: ["fridge","refrigerator","samsung","appliance"], location: "Banjul", freeShipping: false, placeholderColor: "#C0C0C0", placeholderIcon: "cube-outline", vendorId: vid },
      { name: "Bluetooth Earbuds", brand: "Oraimo", price: 2800, originalPrice: 3500, category: "electronics", subcategory: "audio", isSale: true, soldCount: 345, rating: 4.3, reviewCount: 189, colors: ["#FFFFFF","#000000","#FF69B4"], features: ["True wireless", "6hr playtime", "Noise cancel", "USB-C charging"], tags: ["earbuds","bluetooth","wireless","oraimo"], location: "Serrekunda", freeShipping: false, placeholderColor: "#FFFFFF", placeholderIcon: "headset-outline", vendorId: vid },
      { name: "Power Bank 20000mAh", brand: "Oraimo", price: 3500, category: "electronics", subcategory: "accessories", isFeatured: false, soldCount: 456, rating: 4.5, reviewCount: 223, colors: ["#000000","#C0C0C0","#1A1A2E"], features: ["20000mAh", "Fast charge 18W", "USB-C + USB-A", "LED indicator"], tags: ["powerbank","charging","oraimo","backup"], location: "Banjul", freeShipping: false, placeholderColor: "#1A1A2E", placeholderIcon: "battery-charging-outline" },
      { name: "WiFi Router - 300Mbps", brand: "TP-Link", price: 5200, category: "electronics", subcategory: "networking", isFeatured: false, soldCount: 89, rating: 4.6, reviewCount: 45, colors: ["#FFFFFF"], features: ["300Mbps", "2.4GHz", "4 antennas", "Easy setup"], tags: ["router","wifi","internet","tp-link"], location: "Banjul", freeShipping: false, placeholderColor: "#FFFFFF", placeholderIcon: "wifi-outline", vendorId: vid },
      { name: "Inverter AC 1HP", brand: "LG", price: 85000, originalPrice: 95000, category: "electronics", subcategory: "appliances", isSale: true, isFeatured: true, soldCount: 12, rating: 4.9, reviewCount: 8, colors: ["#FFFFFF"], features: ["1HP cooling", "Inverter tech", "Energy saving", "5-year compressor warranty"], tags: ["ac","airconditioner","lg","cooling"], location: "Banjul", freeShipping: false, placeholderColor: "#FFFFFF", placeholderIcon: "thermometer-outline", vendorId: vid },

      // ── FOOD & BEVERAGES (10) ─────────────────────────────────────────────
      { name: "Premium Jasmine Rice 25kg", brand: "Gambia Rice", price: 2200, category: "food", subcategory: "grains", isFeatured: true, soldCount: 1234, rating: 4.8, reviewCount: 567, features: ["Long grain", "Premium quality", "25kg bag", "Free delivery"], tags: ["rice","food","staple","bulk"], location: "Banjul", freeShipping: true, placeholderColor: "#F5DEB3", placeholderIcon: "nutrition-outline" },
      { name: "Groundnut Oil 5L", brand: "Gambia Best", price: 850, originalPrice: 1000, category: "food", subcategory: "oils", isSale: true, soldCount: 2345, rating: 4.7, reviewCount: 891, features: ["Cold pressed", "5 Liters", "No additives"], tags: ["oil","groundnut","cooking","food"], location: "Serrekunda", freeShipping: false, placeholderColor: "#DAA520", placeholderIcon: "nutrition-outline" },
      { name: "Attaya Green Tea 500g", brand: "Mauritanian Gold", price: 450, category: "food", subcategory: "beverages", soldCount: 3456, rating: 4.9, reviewCount: 1234, features: ["Premium gunpowder tea", "500g pack", "Traditional recipe"], tags: ["tea","attaya","traditional","beverage"], location: "Banjul", freeShipping: false, placeholderColor: "#2E8B57", placeholderIcon: "cafe-outline" },
      { name: "Benachin Spice Mix 200g", brand: "Gambian Spice", price: 280, category: "food", subcategory: "spices", soldCount: 1890, rating: 4.8, reviewCount: 678, features: ["Authentic Gambian recipe", "All natural", "No MSG"], tags: ["spice","benachin","cooking","gambian"], location: "Banjul", freeShipping: false, placeholderColor: "#FF6B35", placeholderIcon: "nutrition-outline" },
      { name: "Moringa Powder 250g", brand: "Gambia Naturals", price: 650, category: "food", subcategory: "health", isFeatured: true, isNew: true, soldCount: 456, rating: 4.7, reviewCount: 234, features: ["Organic", "Nutrient-rich", "Farm fresh"], tags: ["moringa","organic","health","superfood"], location: "Brikama", freeShipping: false, placeholderColor: "#3A7D44", placeholderIcon: "leaf-outline" },
      { name: "Honey - Wild Gambian 500ml", brand: "Gambia Naturals", price: 750, category: "food", subcategory: "honey", isFeatured: false, soldCount: 678, rating: 4.9, reviewCount: 345, features: ["Pure wild honey", "Unprocessed", "Glass bottle"], tags: ["honey","natural","health"], location: "Brikama", freeShipping: false, placeholderColor: "#DAA520", placeholderIcon: "nutrition-outline" },
      { name: "Groundnuts Roasted 1kg", brand: "Farm Fresh", price: 350, category: "food", subcategory: "snacks", soldCount: 2100, rating: 4.6, reviewCount: 789, features: ["Freshly roasted", "Lightly salted", "1kg bag"], tags: ["groundnuts","snacks","peanuts"], location: "Serrekunda", freeShipping: false, placeholderColor: "#DEB887", placeholderIcon: "nutrition-outline" },
      { name: "Black-Eyed Beans 5kg", brand: "Gambia Farm", price: 480, category: "food", subcategory: "grains", soldCount: 567, rating: 4.5, reviewCount: 234, features: ["Fresh harvest", "5kg pack", "Premium grade"], tags: ["beans","black-eyed","food","protein"], location: "Brikama", freeShipping: false, placeholderColor: "#F5DEB3", placeholderIcon: "nutrition-outline" },
      { name: "Palm Oil 4L", brand: "Gambia Best", price: 1100, category: "food", subcategory: "oils", soldCount: 1890, rating: 4.7, reviewCount: 678, features: ["Pure red palm oil", "4 Liters", "Traditional cooking"], tags: ["palm oil","cooking","traditional"], location: "Banjul", freeShipping: false, placeholderColor: "#FF6B35", placeholderIcon: "nutrition-outline" },
      { name: "Tapalapa Bread Mix 2kg", brand: "Gambian Bake", price: 380, category: "food", subcategory: "baking", soldCount: 345, rating: 4.6, reviewCount: 123, features: ["Traditional Gambian recipe", "Easy to make", "2kg pack"], tags: ["bread","tapalapa","baking","gambian"], location: "Serrekunda", freeShipping: false, placeholderColor: "#DEB887", placeholderIcon: "nutrition-outline" },

      // ── BEAUTY & HEALTH (10) ──────────────────────────────────────────────
      { name: "Pure Shea Butter 500g", brand: "Africa Beauty", price: 450, originalPrice: 600, category: "beauty", subcategory: "skincare", isSale: true, isFeatured: true, soldCount: 2345, rating: 4.9, reviewCount: 1023, colors: ["#F5DEB3"], features: ["100% raw unrefined", "Moisturizing", "Hair & skin", "500g jar"], tags: ["shea butter","skincare","natural","moisturizer"], location: "Banjul", freeShipping: false, placeholderColor: "#F5DEB3", placeholderIcon: "sparkles-outline", vendorId: vid },
      { name: "African Black Soap 250g", brand: "Ghana Naturals", price: 280, category: "beauty", subcategory: "skincare", soldCount: 3456, rating: 4.8, reviewCount: 1567, features: ["Authentic black soap", "Brightening", "Acne fighting", "Natural"], tags: ["black soap","skincare","african","natural"], location: "Serrekunda", freeShipping: false, placeholderColor: "#3A2008", placeholderIcon: "sparkles-outline" },
      { name: "Coconut Hair Oil 250ml", brand: "Gambia Naturals", price: 380, category: "beauty", subcategory: "haircare", soldCount: 1234, rating: 4.7, reviewCount: 456, features: ["Cold pressed", "Hair growth", "Moisturizing"], tags: ["coconut oil","hair","natural","beauty"], location: "Banjul", freeShipping: false, placeholderColor: "#F5F5DC", placeholderIcon: "sparkles-outline" },
      { name: "Relaxer Kit Complete", brand: "Dark & Lovely", price: 1200, category: "beauty", subcategory: "haircare", isFeatured: false, soldCount: 678, rating: 4.3, reviewCount: 234, features: ["Complete kit", "Conditioning system", "For natural hair"], tags: ["relaxer","hair","beauty","dark&lovely"], location: "Serrekunda", freeShipping: false, placeholderColor: "#D4AF37", placeholderIcon: "sparkles-outline", vendorId: vid },
      { name: "Whitening Face Cream 50ml", brand: "Nivea Africa", price: 850, originalPrice: 1000, category: "beauty", subcategory: "skincare", isSale: true, soldCount: 4567, rating: 4.2, reviewCount: 2134, features: ["SPF 30", "Lightening", "50ml"], tags: ["face cream","whitening","skincare","nivea"], location: "Banjul", freeShipping: false, placeholderColor: "#87CEEB", placeholderIcon: "sparkles-outline", vendorId: vid },
      { name: "Baobab Body Lotion 400ml", brand: "Gambia Naturals", price: 650, category: "beauty", subcategory: "skincare", isFeatured: true, isNew: true, soldCount: 234, rating: 4.8, reviewCount: 89, features: ["Baobab extract", "Non-greasy", "24hr moisture"], tags: ["baobab","lotion","skincare","natural"], location: "Banjul", freeShipping: false, placeholderColor: "#DEB887", placeholderIcon: "sparkles-outline" },
      { name: "Malaria Prevention Kit", brand: "HealthFirst", price: 1800, category: "beauty", subcategory: "health", isFeatured: true, soldCount: 456, rating: 4.7, reviewCount: 189, features: ["Mosquito repellent", "Net treatment", "DEET spray"], tags: ["malaria","health","prevention","safety"], location: "Banjul", freeShipping: false, placeholderColor: "#3A7D44", placeholderIcon: "medical-outline" },
      { name: "Moringa Capsules 60pc", brand: "Nature's Best", price: 1500, category: "beauty", subcategory: "health", isNew: true, soldCount: 234, rating: 4.6, reviewCount: 78, features: ["Organic moringa", "60 capsules", "Immune boost", "Energy"], tags: ["moringa","health","supplement","organic"], location: "Serrekunda", freeShipping: false, placeholderColor: "#3A7D44", placeholderIcon: "medical-outline" },
      { name: "Aloe Vera Gel 200ml", brand: "Africa Beauty", price: 420, category: "beauty", subcategory: "skincare", soldCount: 789, rating: 4.6, reviewCount: 312, features: ["Pure aloe vera", "Cooling effect", "Multipurpose"], tags: ["aloe vera","skincare","natural","soothing"], location: "Banjul", freeShipping: false, placeholderColor: "#90EE90", placeholderIcon: "sparkles-outline" },
      { name: "Perfume - Arabian Oud 100ml", brand: "Arabian Nights", price: 4500, originalPrice: 5500, category: "beauty", subcategory: "fragrance", isSale: true, isFeatured: true, soldCount: 178, rating: 4.9, reviewCount: 89, colors: ["#D4AF37"], features: ["Eau de parfum", "Long-lasting", "100ml spray", "Unisex"], tags: ["perfume","oud","fragrance","arabic"], location: "Banjul", freeShipping: false, placeholderColor: "#D4AF37", placeholderIcon: "sparkles-outline", vendorId: vid },

      // ── FURNITURE & HOME (10) ─────────────────────────────────────────────
      { name: "L-Shaped Sofa Set", brand: "Banjul Furniture", price: 65000, originalPrice: 78000, category: "furniture", subcategory: "living room", isSale: true, isFeatured: true, soldCount: 23, rating: 4.7, reviewCount: 12, colors: ["#8B4513","#1A1A2E","#C0C0C0"], features: ["6-seater", "Premium fabric", "Foam cushions", "Delivery included"], tags: ["sofa","living room","furniture"], location: "Serrekunda", freeShipping: true, placeholderColor: "#8B4513", placeholderIcon: "home-outline", vendorId: vid },
      { name: "Queen Bed Frame + Mattress", brand: "Dream Rest", price: 38000, originalPrice: 45000, category: "furniture", subcategory: "bedroom", isSale: true, isFeatured: true, soldCount: 34, rating: 4.8, reviewCount: 18, colors: ["#8B4513","#FFFFFF"], features: ["Queen size", "Orthopedic mattress", "Solid wood frame"], tags: ["bed","mattress","bedroom","queen"], location: "Banjul", freeShipping: false, placeholderColor: "#DEB887", placeholderIcon: "home-outline", vendorId: vid },
      { name: "Dining Table Set 6-Seater", brand: "Banjul Furniture", price: 45000, category: "furniture", subcategory: "dining", isFeatured: true, soldCount: 12, rating: 4.6, reviewCount: 7, colors: ["#8B4513","#000000"], features: ["6 chairs", "Glass top", "Solid legs", "Easy assembly"], tags: ["dining","table","furniture","6-seater"], location: "Serrekunda", freeShipping: false, placeholderColor: "#8B4513", placeholderIcon: "home-outline", vendorId: vid },
      { name: "Wardrobe 4-Door", brand: "Home Style", price: 28000, originalPrice: 34000, category: "furniture", subcategory: "bedroom", isSale: true, soldCount: 34, rating: 4.5, reviewCount: 15, colors: ["#FFFFFF","#8B4513","#1A1A2E"], features: ["4 sliding doors", "Mirror", "Multiple compartments"], tags: ["wardrobe","bedroom","storage","furniture"], location: "Banjul", freeShipping: false, placeholderColor: "#8B4513", placeholderIcon: "home-outline" },
      { name: "Office Chair Ergonomic", brand: "Office Pro", price: 12000, originalPrice: 15000, category: "furniture", subcategory: "office", isSale: true, isFeatured: false, soldCount: 67, rating: 4.6, reviewCount: 34, colors: ["#000000","#C0C0C0"], features: ["Lumbar support", "Height adjustable", "Armrests", "Swivel"], tags: ["chair","office","ergonomic","work"], location: "Serrekunda", freeShipping: false, placeholderColor: "#000000", placeholderIcon: "home-outline", vendorId: vid },
      { name: "Ceiling Fan with Light", brand: "Binatone", price: 8500, originalPrice: 10000, category: "furniture", subcategory: "appliances", isSale: true, soldCount: 123, rating: 4.7, reviewCount: 56, colors: ["#FFFFFF","#8B4513"], features: ["3 blades", "LED light", "Remote control", "5 speeds"], tags: ["fan","ceiling","light","cooling"], location: "Banjul", freeShipping: false, placeholderColor: "#FFFFFF", placeholderIcon: "home-outline" },
      { name: "Kitchen Cabinet Set", brand: "Home Style", price: 55000, category: "furniture", subcategory: "kitchen", isFeatured: true, soldCount: 8, rating: 4.8, reviewCount: 5, colors: ["#FFFFFF","#8B4513"], features: ["Upper & lower units", "Soft close hinges", "Custom sizes"], tags: ["kitchen","cabinet","furniture","storage"], location: "Serrekunda", freeShipping: false, placeholderColor: "#8B4513", placeholderIcon: "home-outline", vendorId: vid },
      { name: "Reading Desk & Chair Set", brand: "Study Mate", price: 9500, category: "furniture", subcategory: "study", soldCount: 89, rating: 4.4, reviewCount: 38, colors: ["#8B4513","#FFFFFF","#1A1A2E"], features: ["Solid wood desk", "Ergonomic chair", "Storage drawer"], tags: ["desk","study","furniture","student"], location: "Banjul", freeShipping: false, placeholderColor: "#8B4513", placeholderIcon: "home-outline" },
      { name: "Curtains - Luxury Set (4 panels)", brand: "Home Décor", price: 4500, originalPrice: 5500, category: "furniture", subcategory: "decor", isSale: true, soldCount: 234, rating: 4.5, reviewCount: 98, colors: ["#87CEEB","#FFFFFF","#8B4513","#1A1A2E"], features: ["Blackout", "4 panels", "Machine washable"], tags: ["curtains","decor","home","bedroom"], location: "Serrekunda", freeShipping: false, placeholderColor: "#87CEEB", placeholderIcon: "home-outline" },
      { name: "Prayer Mat - Premium", brand: "Islamic Gifts", price: 1800, category: "furniture", subcategory: "prayer", isFeatured: true, soldCount: 567, rating: 4.9, reviewCount: 289, colors: ["#006400","#1A1A2E","#8B0000"], features: ["Soft velvet", "Non-slip base", "Compass included"], tags: ["prayer mat","islamic","velvet","religious"], location: "Banjul", freeShipping: false, placeholderColor: "#006400", placeholderIcon: "home-outline" },

      // ── SPORTS & FITNESS (8) ──────────────────────────────────────────────
      { name: "Football - Official Size 5", brand: "Adidas", price: 2500, originalPrice: 3000, category: "sports", subcategory: "football", isSale: true, isFeatured: true, soldCount: 456, rating: 4.6, reviewCount: 234, colors: ["#FFFFFF","#000000"], features: ["Size 5", "Match quality", "32 panels"], tags: ["football","ball","sport","adidas"], location: "Banjul", freeShipping: false, placeholderColor: "#FFFFFF", placeholderIcon: "football-outline" },
      { name: "Adjustable Dumbbell Set 20kg", brand: "PowerFit", price: 8500, category: "sports", subcategory: "gym", isFeatured: true, soldCount: 89, rating: 4.5, reviewCount: 45, features: ["Adjustable 2-20kg", "Cast iron", "Hex design"], tags: ["dumbbell","gym","fitness","weights"], location: "Serrekunda", freeShipping: false, placeholderColor: "#1A1A2E", placeholderIcon: "barbell-outline", vendorId: vid },
      { name: "Yoga Mat 6mm", brand: "FlexPro", price: 1800, originalPrice: 2200, category: "sports", subcategory: "yoga", isSale: true, soldCount: 234, rating: 4.7, reviewCount: 112, colors: ["#6B4C9A","#E63946","#3A7D44","#87CEEB"], features: ["6mm thickness", "Non-slip", "Carry strap", "Eco-friendly"], tags: ["yoga","mat","fitness","exercise"], location: "Banjul", freeShipping: false, placeholderColor: "#6B4C9A", placeholderIcon: "fitness-outline" },
      { name: "Cricket Set - Complete", brand: "SportsGambia", price: 6500, category: "sports", subcategory: "cricket", soldCount: 34, rating: 4.4, reviewCount: 15, features: ["Bat", "Ball", "Wickets", "Gloves", "Pads"], tags: ["cricket","sport","bat","ball"], location: "Banjul", freeShipping: false, placeholderColor: "#DEB887", placeholderIcon: "baseball-outline" },
      { name: "Skipping Rope - Speed", brand: "Jump Pro", price: 850, category: "sports", subcategory: "cardio", soldCount: 678, rating: 4.5, reviewCount: 289, colors: ["#E63946","#000000","#3A7D44"], features: ["Adjustable length", "Ball bearings", "Anti-slip handles"], tags: ["skipping rope","cardio","fitness"], location: "Serrekunda", freeShipping: false, placeholderColor: "#E63946", placeholderIcon: "fitness-outline" },
      { name: "Boxing Gloves 12oz", brand: "Champion", price: 4500, originalPrice: 5500, category: "sports", subcategory: "boxing", isSale: true, soldCount: 67, rating: 4.6, reviewCount: 34, colors: ["#E63946","#000000","#1A1A2E"], features: ["12oz", "Leather outer", "Wrist support"], tags: ["boxing","gloves","fitness","sport"], location: "Banjul", freeShipping: false, placeholderColor: "#E63946", placeholderIcon: "fitness-outline", vendorId: vid },
      { name: "Resistance Bands Set 5pc", brand: "FlexPro", price: 1200, category: "sports", subcategory: "gym", soldCount: 345, rating: 4.7, reviewCount: 178, colors: ["#FFE66D","#E63946","#3A7D44","#1A1A2E","#6B4C9A"], features: ["5 resistance levels", "Anti-snap", "Workout guide included"], tags: ["resistance bands","gym","fitness","exercise"], location: "Serrekunda", freeShipping: false, placeholderColor: "#FFE66D", placeholderIcon: "fitness-outline" },
      { name: "Tennis Racket Set", brand: "Wilson", price: 5800, originalPrice: 7000, category: "sports", subcategory: "tennis", isSale: true, soldCount: 23, rating: 4.5, reviewCount: 9, features: ["2 rackets", "4 balls", "Carry bag"], tags: ["tennis","racket","sport","wilson"], location: "Banjul", freeShipping: false, placeholderColor: "#FFE66D", placeholderIcon: "baseball-outline", vendorId: vid },

      // ── BABY & KIDS (8) ───────────────────────────────────────────────────
      { name: "Baby Cot with Mattress", brand: "Dream Babies", price: 18000, originalPrice: 22000, category: "baby", subcategory: "furniture", isSale: true, isFeatured: true, soldCount: 34, rating: 4.8, reviewCount: 17, colors: ["#FFFFFF","#87CEEB","#FFB6C1"], features: ["Safety tested", "Adjustable base", "Includes mattress", "0-3 years"], tags: ["baby cot","baby","furniture","nursery"], location: "Banjul", freeShipping: false, placeholderColor: "#87CEEB", placeholderIcon: "heart-outline", vendorId: vid },
      { name: "Pampers Diapers L 50pc", brand: "Pampers", price: 3500, category: "baby", subcategory: "diapers", isFeatured: false, soldCount: 1890, rating: 4.7, reviewCount: 678, features: ["Size L (9-14kg)", "12-hour protection", "Wetness indicator"], tags: ["diapers","pampers","baby","nappies"], location: "Serrekunda", freeShipping: false, placeholderColor: "#87CEEB", placeholderIcon: "heart-outline" },
      { name: "Educational Toy Set 3-6yrs", brand: "EduPlay", price: 3200, originalPrice: 4000, category: "baby", subcategory: "toys", isSale: true, isFeatured: true, soldCount: 145, rating: 4.6, reviewCount: 67, features: ["Age 3-6 years", "STEM learning", "Non-toxic materials"], tags: ["toys","educational","kids","learning"], location: "Banjul", freeShipping: false, placeholderColor: "#FF6B6B", placeholderIcon: "game-controller-outline" },
      { name: "Baby Food Blender", brand: "Philips Avent", price: 7500, originalPrice: 9000, category: "baby", subcategory: "feeding", isSale: true, soldCount: 89, rating: 4.7, reviewCount: 42, features: ["Steam & blend", "BPA free", "4 jars"], tags: ["blender","baby food","feeding","philips"], location: "Serrekunda", freeShipping: false, placeholderColor: "#87CEEB", placeholderIcon: "heart-outline", vendorId: vid },
      { name: "Children's School Backpack", brand: "Little Explorer", price: 1500, originalPrice: 2000, category: "baby", subcategory: "school", isSale: true, soldCount: 567, rating: 4.5, reviewCount: 234, colors: ["#E63946","#87CEEB","#90EE90","#6B4C9A"], features: ["Waterproof", "Padded straps", "Multiple pockets", "Age 5-12"], tags: ["backpack","school","kids","bag"], location: "Banjul", freeShipping: false, placeholderColor: "#E63946", placeholderIcon: "bag-outline" },
      { name: "Baby Carrier Wrap", brand: "Mamas & Papas", price: 4800, category: "baby", subcategory: "carriers", soldCount: 78, rating: 4.8, reviewCount: 34, colors: ["#6B4C9A","#0EA47A","#8B4513"], features: ["Ergonomic", "Birth-15kg", "Machine washable"], tags: ["baby carrier","wrap","newborn","ergonomic"], location: "Serrekunda", freeShipping: false, placeholderColor: "#6B4C9A", placeholderIcon: "heart-outline" },
      { name: "Kids Bicycle 20\"", brand: "Raleigh Junior", price: 9500, originalPrice: 12000, category: "baby", subcategory: "outdoor", isSale: true, isFeatured: true, soldCount: 45, rating: 4.6, reviewCount: 22, colors: ["#E63946","#87CEEB","#3A7D44"], features: ["20\" wheels", "Training wheels", "Safety gear included"], tags: ["bicycle","kids","outdoor","cycling"], location: "Banjul", freeShipping: false, placeholderColor: "#E63946", placeholderIcon: "bicycle-outline", vendorId: vid },
      { name: "Baby Monitor WiFi", brand: "VTech", price: 12000, category: "baby", subcategory: "safety", isFeatured: true, isNew: true, soldCount: 23, rating: 4.7, reviewCount: 12, features: ["720P camera", "Two-way audio", "Night vision", "App control"], tags: ["baby monitor","wifi","safety","camera"], location: "Banjul", freeShipping: false, placeholderColor: "#FFFFFF", placeholderIcon: "eye-outline", vendorId: vid },

      // ── AGRICULTURE (8) ───────────────────────────────────────────────────
      { name: "Groundnut Seeds 5kg", brand: "Gambia Seeds", price: 650, category: "agriculture", subcategory: "seeds", isFeatured: true, soldCount: 1234, rating: 4.7, reviewCount: 456, features: ["Improved variety", "High yield", "5kg pack"], tags: ["seeds","groundnut","farming","agriculture"], location: "Brikama", freeShipping: false, placeholderColor: "#DEB887", placeholderIcon: "leaf-outline" },
      { name: "Vegetable Seeds Collection", brand: "Grow Gambia", price: 380, category: "agriculture", subcategory: "seeds", soldCount: 789, rating: 4.6, reviewCount: 234, features: ["10 varieties", "Tomato, onion, pepper, okra+", "Growing guide"], tags: ["seeds","vegetables","garden","farming"], location: "Brikama", freeShipping: false, placeholderColor: "#3A7D44", placeholderIcon: "leaf-outline" },
      { name: "NPK Fertilizer 50kg", brand: "Agro Plus", price: 2800, category: "agriculture", subcategory: "fertilizer", soldCount: 345, rating: 4.5, reviewCount: 123, features: ["15-15-15 NPK", "All crops", "50kg bag"], tags: ["fertilizer","npk","farming","agriculture"], location: "Brikama", freeShipping: false, placeholderColor: "#8B4513", placeholderIcon: "leaf-outline" },
      { name: "Hand Water Pump", brand: "Farm Tools Co", price: 8500, category: "agriculture", subcategory: "irrigation", isFeatured: true, soldCount: 67, rating: 4.7, reviewCount: 34, features: ["Manual pump", "10m depth", "Easy installation"], tags: ["water pump","irrigation","farming","well"], location: "Banjul", freeShipping: false, placeholderColor: "#4169E1", placeholderIcon: "water-outline" },
      { name: "Garden Hoe Set", brand: "Farm Tools Co", price: 1200, category: "agriculture", subcategory: "tools", soldCount: 456, rating: 4.4, reviewCount: 189, features: ["3 tools included", "Hardened steel", "Long handle"], tags: ["hoe","tools","garden","farming"], location: "Serrekunda", freeShipping: false, placeholderColor: "#8B4513", placeholderIcon: "construct-outline" },
      { name: "Watering Can 10L", brand: "Garden Pro", price: 850, category: "agriculture", subcategory: "tools", soldCount: 678, rating: 4.6, reviewCount: 234, colors: ["#3A7D44","#E63946","#87CEEB"], features: ["10 Liter", "Sprinkler rose", "Durable plastic"], tags: ["watering can","garden","tools"], location: "Banjul", freeShipping: false, placeholderColor: "#3A7D44", placeholderIcon: "water-outline" },
      { name: "Pesticide Sprayer 16L", brand: "Agro Plus", price: 4500, category: "agriculture", subcategory: "sprayers", soldCount: 123, rating: 4.5, reviewCount: 56, features: ["16L capacity", "Pump action", "Adjustable nozzle"], tags: ["sprayer","pesticide","farming","agriculture"], location: "Brikama", freeShipping: false, placeholderColor: "#3A7D44", placeholderIcon: "water-outline" },
      { name: "Beekeeping Starter Kit", brand: "Gambia Honey Co", price: 15000, category: "agriculture", subcategory: "beekeeping", isFeatured: true, isNew: true, soldCount: 12, rating: 4.9, reviewCount: 6, features: ["Full suit", "Smoker", "Hive", "Beginners guide"], tags: ["beekeeping","honey","farming","bees"], location: "Brikama", freeShipping: false, placeholderColor: "#DAA520", placeholderIcon: "leaf-outline" },

      // ── AUTOMOTIVE (8) ────────────────────────────────────────────────────
      { name: "Engine Oil 5W-30 4L", brand: "Castrol", price: 2800, originalPrice: 3200, category: "automotive", subcategory: "oils", isSale: true, soldCount: 456, rating: 4.7, reviewCount: 234, features: ["Full synthetic", "4 Liters", "All engines"], tags: ["engine oil","castrol","car","maintenance"], location: "Serrekunda", freeShipping: false, placeholderColor: "#1A1A2E", placeholderIcon: "car-outline", vendorId: vid },
      { name: "Car Battery 60AH", brand: "Exide", price: 8500, category: "automotive", subcategory: "batteries", isFeatured: true, soldCount: 89, rating: 4.6, reviewCount: 45, features: ["60AH", "Maintenance free", "2-year warranty"], tags: ["car battery","battery","exide","automotive"], location: "Banjul", freeShipping: false, placeholderColor: "#1A1A2E", placeholderIcon: "car-outline", vendorId: vid },
      { name: "Car Air Freshener Set", brand: "Little Trees", price: 380, category: "automotive", subcategory: "accessories", soldCount: 1234, rating: 4.5, reviewCount: 567, features: ["Pack of 5", "Long lasting", "Various scents"], tags: ["air freshener","car","accessories"], location: "Serrekunda", freeShipping: false, placeholderColor: "#3A7D44", placeholderIcon: "car-outline" },
      { name: "Dash Camera 1080P", brand: "Vantrue", price: 12000, originalPrice: 15000, category: "automotive", subcategory: "electronics", isSale: true, isFeatured: true, soldCount: 34, rating: 4.7, reviewCount: 18, features: ["1080P recording", "Night vision", "Loop recording", "G-sensor"], tags: ["dash cam","camera","car","safety"], location: "Banjul", freeShipping: false, placeholderColor: "#1A1A2E", placeholderIcon: "videocam-outline", vendorId: vid },
      { name: "Car Floor Mats Set", brand: "AutoPro", price: 2200, category: "automotive", subcategory: "accessories", soldCount: 234, rating: 4.4, reviewCount: 112, colors: ["#000000","#8B4513","#C0C0C0"], features: ["Universal fit", "4 pieces", "Non-slip"], tags: ["floor mats","car","accessories"], location: "Serrekunda", freeShipping: false, placeholderColor: "#000000", placeholderIcon: "car-outline" },
      { name: "Jumper Cables 4M", brand: "AutoPro", price: 1800, category: "automotive", subcategory: "tools", soldCount: 189, rating: 4.5, reviewCount: 78, colors: ["#E63946","#000000"], features: ["4 meters", "Heavy duty clamps", "Carry bag"], tags: ["jumper cables","battery","car","emergency"], location: "Banjul", freeShipping: false, placeholderColor: "#E63946", placeholderIcon: "car-outline" },
      { name: "Car Seat Cover Set", brand: "AutoPro", price: 3500, originalPrice: 4500, category: "automotive", subcategory: "interiors", isSale: true, soldCount: 123, rating: 4.3, reviewCount: 56, colors: ["#000000","#8B4513","#C0C0C0"], features: ["5 seats", "Universal fit", "Washable"], tags: ["seat cover","car","interior","accessories"], location: "Serrekunda", freeShipping: false, placeholderColor: "#8B4513", placeholderIcon: "car-outline", vendorId: vid },
      { name: "Tire Inflator - Digital", brand: "AirMax", price: 4800, category: "automotive", subcategory: "tools", isFeatured: true, soldCount: 67, rating: 4.6, reviewCount: 32, features: ["Digital gauge", "Auto shutoff", "12V car plug"], tags: ["tire inflator","pump","car","tools"], location: "Banjul", freeShipping: false, placeholderColor: "#1A1A2E", placeholderIcon: "car-outline", vendorId: vid },

      // ── BOOKS & EDUCATION (8) ─────────────────────────────────────────────
      { name: "WASSCE Complete Study Pack", brand: "Gambia Study", price: 3500, originalPrice: 4500, category: "books", subcategory: "textbooks", isSale: true, isFeatured: true, soldCount: 456, rating: 4.8, reviewCount: 234, features: ["All subjects", "Past questions included", "Teacher approved"], tags: ["wassce","study","exam","textbook"], location: "Banjul", freeShipping: false, placeholderColor: "#4169E1", placeholderIcon: "book-outline" },
      { name: "Business Management Textbook", brand: "Oxford Press", price: 2800, category: "books", subcategory: "university", soldCount: 89, rating: 4.6, reviewCount: 45, features: ["Latest edition", "Gambia UTG syllabus", "Case studies"], tags: ["textbook","business","university","management"], location: "Banjul", freeShipping: false, placeholderColor: "#4169E1", placeholderIcon: "book-outline" },
      { name: "Gambian History & Culture", brand: "Banjul Publishers", price: 1500, category: "books", subcategory: "history", isFeatured: true, soldCount: 234, rating: 4.7, reviewCount: 112, features: ["Local author", "Illustrated", "From precolonial to today"], tags: ["history","gambia","culture","local"], location: "Banjul", freeShipping: false, placeholderColor: "#8B4513", placeholderIcon: "book-outline" },
      { name: "Kids Story Books Bundle 10pc", brand: "African Tales", price: 2500, originalPrice: 3500, category: "books", subcategory: "children", isSale: true, soldCount: 345, rating: 4.8, reviewCount: 167, features: ["Age 5-12", "10 books", "African stories", "Colorful illustrations"], tags: ["kids books","stories","children","reading"], location: "Serrekunda", freeShipping: false, placeholderColor: "#FF6B6B", placeholderIcon: "book-outline" },
      { name: "Coding for Beginners", brand: "TechLearn", price: 2200, category: "books", subcategory: "technology", isNew: true, soldCount: 67, rating: 4.6, reviewCount: 23, features: ["Python & JavaScript", "Projects included", "No experience needed"], tags: ["coding","programming","tech","beginner"], location: "Banjul", freeShipping: false, placeholderColor: "#6B4C9A", placeholderIcon: "book-outline", vendorId: vid },
      { name: "Holy Quran - Leather Bound", brand: "Islamic Books", price: 3800, category: "books", subcategory: "religious", isFeatured: true, soldCount: 567, rating: 4.9, reviewCount: 289, features: ["Arabic & English translation", "Large print", "Leather cover"], tags: ["quran","islamic","religion","book"], location: "Banjul", freeShipping: false, placeholderColor: "#006400", placeholderIcon: "book-outline" },
      { name: "English Dictionary & Thesaurus", brand: "Oxford", price: 1800, category: "books", subcategory: "reference", soldCount: 123, rating: 4.5, reviewCount: 56, features: ["Over 200,000 words", "Thesaurus included", "Paperback"], tags: ["dictionary","english","reference","oxford"], location: "Serrekunda", freeShipping: false, placeholderColor: "#4169E1", placeholderIcon: "book-outline" },
      { name: "Gambia Agri-Business Guide", brand: "Banjul Publishers", price: 1200, category: "books", subcategory: "business", soldCount: 89, rating: 4.6, reviewCount: 34, features: ["Local farming tips", "Market data", "Success stories"], tags: ["agriculture","business","gambia","farming"], location: "Brikama", freeShipping: false, placeholderColor: "#3A7D44", placeholderIcon: "book-outline" },

      // ── JEWELLERY & ACCESSORIES (8) ───────────────────────────────────────
      { name: "Gold Plated Necklace Set", brand: "Gambia Gold", price: 3500, originalPrice: 4500, category: "jewellery", subcategory: "necklaces", isSale: true, isFeatured: true, soldCount: 234, rating: 4.7, reviewCount: 112, colors: ["#D4AF37"], features: ["18K gold plated", "Pendant + earrings", "Gift box"], tags: ["necklace","gold","jewellery","women"], location: "Banjul", freeShipping: false, placeholderColor: "#D4AF37", placeholderIcon: "diamond-outline", vendorId: vid },
      { name: "Silver Ankle Bracelet", brand: "AfriGold", price: 1200, category: "jewellery", subcategory: "bracelets", soldCount: 456, rating: 4.6, reviewCount: 198, colors: ["#C0C0C0"], features: ["925 Sterling silver", "Adjustable", "Engraved pattern"], tags: ["anklet","silver","jewellery","women"], location: "Banjul", freeShipping: false, placeholderColor: "#C0C0C0", placeholderIcon: "diamond-outline" },
      { name: "Waist Beads Set - Traditional", brand: "Senegambia Craft", price: 850, originalPrice: 1200, category: "jewellery", subcategory: "traditional", isSale: true, isFeatured: true, soldCount: 1234, rating: 4.8, reviewCount: 567, colors: ["#FF6B6B","#3A7D44","#D4AF37","#6B4C9A"], features: ["Handmade", "Adjustable", "Traditional Gambian", "Pack of 3"], tags: ["waist beads","traditional","african","jewellery"], location: "Banjul", freeShipping: false, placeholderColor: "#D4AF37", placeholderIcon: "diamond-outline" },
      { name: "Men's Prayer Beads (Tasbih)", brand: "Islamic Gifts", price: 650, category: "jewellery", subcategory: "religious", soldCount: 789, rating: 4.9, reviewCount: 345, colors: ["#8B4513","#006400","#1A1A2E"], features: ["99 beads", "Wood finish", "With tassels"], tags: ["tasbih","prayer beads","islamic","men"], location: "Banjul", freeShipping: false, placeholderColor: "#8B4513", placeholderIcon: "diamond-outline" },
      { name: "Gold Hoop Earrings", brand: "Gambia Gold", price: 1800, category: "jewellery", subcategory: "earrings", soldCount: 345, rating: 4.7, reviewCount: 167, colors: ["#D4AF37"], features: ["18K gold plated", "Large hoops", "Hypoallergenic"], tags: ["earrings","gold","hoop","women"], location: "Banjul", freeShipping: false, placeholderColor: "#D4AF37", placeholderIcon: "diamond-outline", vendorId: vid },
      { name: "Smartwatch - Fitness Tracker", brand: "Huawei Band", price: 5500, originalPrice: 7000, category: "jewellery", subcategory: "watches", isSale: true, isFeatured: true, soldCount: 123, rating: 4.5, reviewCount: 56, colors: ["#000000","#C0C0C0","#E63946"], features: ["Heart rate", "Sleep tracking", "Waterproof", "7-day battery"], tags: ["smartwatch","fitness","watch","tracker"], location: "Banjul", freeShipping: false, placeholderColor: "#000000", placeholderIcon: "watch-outline", vendorId: vid },
      { name: "Beaded Necklace - Handmade", brand: "Senegambia Craft", price: 950, category: "jewellery", subcategory: "necklaces", soldCount: 234, rating: 4.6, reviewCount: 98, colors: ["#FF6B6B","#4ECDC4","#D4AF37","#6B4C9A"], features: ["Handmade", "Natural beads", "Unique patterns"], tags: ["necklace","beaded","handmade","african"], location: "Banjul", freeShipping: false, placeholderColor: "#4ECDC4", placeholderIcon: "diamond-outline" },
      { name: "Men's Stainless Steel Watch", brand: "Curren", price: 3200, originalPrice: 4000, category: "jewellery", subcategory: "watches", isSale: true, soldCount: 167, rating: 4.4, reviewCount: 78, colors: ["#C0C0C0","#D4AF37","#000000"], features: ["Stainless steel", "Water resistant", "Date display", "Quartz"], tags: ["watch","men","stainless","curren"], location: "Serrekunda", freeShipping: false, placeholderColor: "#C0C0C0", placeholderIcon: "watch-outline", vendorId: vid },
    ];

    const insertedProducts = await db.insert(products).values(seedProducts.map(p => ({
      ...p,
      description: p.features ? `${p.name} - ${p.features.join(". ")}.` : `Quality ${p.name} available across The Gambia.`,
      stock: p.stock ?? 100,
    }))).returning();

    console.log(`✅ Seeded ${insertedProducts.length} products`);

    // ─── FLASH DEALS ──────────────────────────────────────────────────────
    const now = new Date();
    const endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

    const flashDealProducts = insertedProducts.filter(p =>
      p.isFeatured && p.rating >= 4.5 && p.price > 1000
    ).slice(0, 12);

    if (flashDealProducts.length > 0) {
      await db.insert(flashDeals).values(flashDealProducts.map((p, i) => ({
        productId: p.id,
        discountPercent: [25, 30, 35, 40, 20, 45, 25, 30, 35, 40, 20, 30][i % 12],
        dealPrice: Math.round(p.price * [0.75, 0.70, 0.65, 0.60, 0.80, 0.55, 0.75, 0.70, 0.65, 0.60, 0.80, 0.70][i % 12]),
        originalPrice: p.price,
        startTime: now,
        endTime: endTime,
        stockLimit: [30, 20, 15, 25, 50, 10, 30, 20, 15, 25, 50, 20][i % 12],
        sold: [12, 8, 5, 15, 20, 3, 10, 7, 4, 18, 25, 9][i % 12],
        isActive: true,
        label: ["Flash Deal", "Super Deal", "Hot Deal", "Best Price"][i % 4],
      })));
      console.log(`✅ Created ${flashDealProducts.length} flash deals`);
    }

    // ─── REVIEWS ─────────────────────────────────────────────────────────
    if (regularUser) {
      const topProducts = insertedProducts.slice(0, 20);
      const reviewTexts = [
        "Excellent quality! Really happy with this purchase. Fast delivery too.",
        "Good product, matches the description. Will buy again from this store.",
        "Very satisfied! My family loves it. Great value for money in Gambia.",
        "Quality is top notch. Delivered within 2 days to my house in Serrekunda.",
        "Highly recommend! The seller was very responsive and helpful.",
        "Great product at a fair price. Packaging was secure. 5 stars!",
        "Bought this as a gift and the recipient was very pleased. Thank you!",
        "Good quality product. The size fits perfectly. Will order more.",
        "Amazing deal! Much better than what you find in the local market.",
        "Delivered as described. Very happy with my purchase from MansaMart.",
      ];

      await db.insert(reviews).values(topProducts.map((p, i) => ({
        userId: regularUser.id,
        targetId: p.id,
        targetType: "product",
        name: ["Mamadou Diallo", "Fatima Bah", "Lamin Ceesay", "Adama Touray", "Isatou Jallow",
               "Omar Sanneh", "Mariama Camara", "Bakary Drammeh", "Rohey Njie", "Modou Faye"][i % 10],
        rating: [5, 4, 5, 4, 5, 4, 5, 4, 5, 4][i % 10],
        text: reviewTexts[i % 10],
        helpful: [15, 8, 22, 5, 31, 12, 9, 18, 7, 25][i % 10],
        verified: true,
      })));
      console.log("✅ Seeded product reviews");
    }

  } else {
    console.log(`⏭️  Products already seeded (${productCount} found)`);
  }

  // ─── SERVICES ─────────────────────────────────────────────────────────────
  const existingServices = await db.select().from(services).limit(1);
  if (existingServices.length === 0 && provider) {
    const seedServices = [
      { name: "Home Deep Cleaning", description: "Professional full-home deep cleaning. We clean every room, furniture, windows, and appliances using eco-friendly products. Available 7 days a week across Greater Banjul.", price: 800, priceType: "fixed", category: "cleaning", duration: "3-5 hours", features: ["All rooms", "Bathrooms & toilets", "Kitchen deep clean", "Windows", "Eco-friendly products"], serviceAreas: ["Banjul","Serrekunda","Kanifing","Bakau","Fajara","Kotu"], providerName: "Fatou Professional Services", providerId: provider.id, isAvailable: true, isFeatured: true, rating: 4.8, reviewCount: 47, verificationStatus: "verified" },
      { name: "Plumbing Repair", description: "Expert plumbing repairs for leaks, pipe replacements, and drain unblocking. Available 7 days a week with same-day emergency service.", price: 500, priceType: "fixed", category: "plumbing", duration: "1-3 hours", features: ["Leak repair", "Pipe replacement", "Drain unblocking", "Same-day service"], serviceAreas: ["Banjul","Serrekunda","Kanifing","Bakau"], providerName: "Fatou Professional Services", providerId: provider.id, isAvailable: true, isFeatured: false, rating: 4.6, reviewCount: 28, verificationStatus: "verified" },
      { name: "Electrical Installation", description: "Certified electrician for installations, repairs, and safety checks. Licensed and insured for residential and commercial work.", price: 750, priceType: "fixed", category: "electrical", duration: "2-4 hours", features: ["Wiring", "Socket installation", "Safety checks", "Certificate provided"], serviceAreas: ["Banjul","Serrekunda","Kanifing","Bakau","Fajara"], providerName: "Fatou Professional Services", providerId: provider.id, isAvailable: true, isFeatured: true, rating: 4.9, reviewCount: 63, verificationStatus: "verified" },
      { name: "House Painting", description: "Professional interior and exterior painting. We supply high-quality paints and all materials. Any room, any size.", price: 1200, priceType: "per_room", category: "painting", duration: "1-3 days", features: ["Interior & exterior", "Paint supplied", "Free consultation", "Clean finish"], serviceAreas: ["Banjul","Serrekunda","Kanifing"], providerName: "Fatou Professional Services", providerId: provider.id, isAvailable: true, isFeatured: false, rating: 4.5, reviewCount: 19, verificationStatus: "verified" },
      { name: "Garden & Lawn Care", description: "Complete garden maintenance including mowing, trimming, planting, and watering system installation.", price: 400, priceType: "fixed", category: "gardening", duration: "2-4 hours", features: ["Lawn mowing", "Hedge trimming", "Planting", "Watering"], serviceAreas: ["Serrekunda","Bakau","Fajara","Kotu","Kololi"], providerName: "Fatou Professional Services", providerId: provider.id, isAvailable: true, isFeatured: false, rating: 4.7, reviewCount: 31, verificationStatus: "verified" },
      { name: "Air Conditioning Service", description: "AC installation, servicing, and repair for all major brands. Fast same-day booking. Annual maintenance contracts available.", price: 650, priceType: "fixed", category: "electrical", duration: "2-3 hours", features: ["All brands", "Gas refill", "Filter cleaning", "Annual contracts"], serviceAreas: ["Banjul","Serrekunda","Kanifing","Bakau","Fajara","Kotu"], providerName: "Fatou Professional Services", providerId: provider.id, isAvailable: true, isFeatured: true, rating: 4.8, reviewCount: 55, verificationStatus: "verified" },
      { name: "Pest Control Treatment", description: "Professional pest control for mosquitoes, cockroaches, bedbugs, and termites. Safe for children and pets.", price: 1500, priceType: "fixed", category: "cleaning", duration: "2-3 hours", features: ["Mosquito treatment", "Cockroach control", "Bedbug treatment", "Safe chemicals"], serviceAreas: ["Banjul","Serrekunda","Kanifing","Bakau"], providerName: "Fatou Professional Services", providerId: provider.id, isAvailable: true, isFeatured: true, rating: 4.7, reviewCount: 42, verificationStatus: "verified" },
      { name: "Moving & Relocation", description: "Reliable household moving and relocation service. We handle packing, transport, and setup at your new location.", price: 3500, priceType: "fixed", category: "moving", duration: "Half-Full day", features: ["Packing", "Safe transport", "Unpacking", "Furniture assembly"], serviceAreas: ["Banjul","Serrekunda","Kanifing","Brikama"], providerName: "Fatou Professional Services", providerId: provider.id, isAvailable: true, isFeatured: false, rating: 4.6, reviewCount: 24, verificationStatus: "verified" },
    ];
    await db.insert(services).values(seedServices);
    console.log(`✅ Seeded ${seedServices.length} services`);
  } else {
    console.log("⏭️  Services already seeded");
  }

  // ─── COUPONS ──────────────────────────────────────────────────────────────
  const existingCoupons = await db.select().from(coupons).limit(1);
  if (existingCoupons.length === 0) {
    await db.insert(coupons).values([
      { code: "WELCOME10", type: "percent", value: 10, minOrder: 1000, maxUses: 500, description: "10% off your first order!", isActive: true },
      { code: "RAMADAN25", type: "percent", value: 25, minOrder: 2000, maxUses: 200, description: "Ramadan special - 25% off!", isActive: true },
      { code: "FLAT500", type: "fixed", value: 500, minOrder: 3000, maxUses: 300, description: "D500 off on orders above D3,000", isActive: true },
      { code: "FREESHIP", type: "fixed", value: 200, minOrder: 1500, maxUses: 1000, description: "Free shipping voucher", isActive: true },
      { code: "NEWUSER", type: "percent", value: 15, minOrder: 500, maxUses: 100, description: "15% off for new users", isActive: true },
    ]);
    console.log("✅ Seeded coupons");
  }

  // ─── BANNERS ──────────────────────────────────────────────────────────────
  const existingBanners = await db.select().from(banners).limit(1);
  if (existingBanners.length === 0) {
    await db.insert(banners).values([
      { title: "Eid Sale - Up to 50% Off", subtitle: "Celebrate in style with our biggest sale!", tag: "LIMITED TIME", color1: "#E63946", color2: "#FF6B6B", icon: "gift-outline", actionRoute: "/flash-deals", isActive: true, sortOrder: 1 },
      { title: "New Tech Arrivals", subtitle: "Latest phones, laptops & gadgets in Gambia", tag: "JUST ARRIVED", color1: "#0EA47A", color2: "#2563EB", icon: "phone-portrait-outline", actionRoute: "/browse?category=electronics", isActive: true, sortOrder: 2 },
      { title: "Free Delivery on D2,000+", subtitle: "Shop more, save on shipping across The Gambia", tag: "FREE SHIPPING", color1: "#7B4FA3", color2: "#E8813A", icon: "car-outline", actionRoute: "/browse", isActive: true, sortOrder: 3 },
      { title: "Local Vendors, Best Prices", subtitle: "Support Gambian businesses. Quality guaranteed.", tag: "MADE IN GAMBIA", color1: "#2563EB", color2: "#0EA47A", icon: "star-outline", actionRoute: "/browse", isActive: true, sortOrder: 4 },
    ]);
    console.log("✅ Seeded banners");
  }

  console.log("\n🎉 Seeding complete! MansaMart is ready.");
  process.exit(0);
}

seed().catch(err => {
  console.error("❌ Seed error:", err);
  process.exit(1);
});
