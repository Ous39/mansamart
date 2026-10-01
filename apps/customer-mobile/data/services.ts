export interface Service {
  id: string;
  name: string;
  providerId: string;
  providerName: string;
  category: string;
  price: number;
  priceType: "fixed" | "hourly" | "per_room";
  rating: number;
  reviewCount: number;
  duration: string;
  description: string;
  features: string[];
  image: any;
  isAvailable: boolean;
  isFeatured?: boolean;
  tags: string[];
}

export interface Booking {
  id: string;
  serviceId: string;
  serviceName: string;
  userId: string;
  userName: string;
  providerId: string;
  providerName: string;
  date: string;
  time: string;
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
  price: number;
  notes?: string;
  address?: string;
  createdAt: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
}

export const serviceCategories: ServiceCategory[] = [
  { id: "design", name: "Interior Design", icon: "color-palette-outline", color: "#7B4FA3", bgColor: "#F3E8FF" },
  { id: "assembly", name: "Assembly", icon: "construct-outline", color: "#2B7A6E", bgColor: "#E8F5F2" },
  { id: "cleaning", name: "Cleaning", icon: "sparkles-outline", color: "#2563EB", bgColor: "#EFF6FF" },
  { id: "repair", name: "Repair", icon: "hammer-outline", color: "#D97706", bgColor: "#FFFBEB" },
  { id: "decoration", name: "Decoration", icon: "flower-outline", color: "#E8813A", bgColor: "#FEF0E6" },
  { id: "moving", name: "Moving Help", icon: "car-outline", color: "#DC2626", bgColor: "#FEF2F2" },
];

export const services: Service[] = [
  {
    id: "s1",
    name: "Full Interior Design Consultation",
    providerId: "provider-001",
    providerName: "Design Studio Pro",
    category: "design",
    price: 299,
    priceType: "fixed",
    rating: 4.9,
    reviewCount: 87,
    duration: "3-4 hours",
    description: "A comprehensive interior design consultation for your entire living space. Our expert designers will assess your space, understand your style preferences, and provide a detailed design plan with furniture recommendations, color schemes, and layout optimizations.",
    features: ["Full space assessment", "3D mood board", "Furniture recommendations", "Color palette", "Shopping list", "Follow-up call"],
    image: require("@/assets/images/products/sofa-beige.png"),
    isAvailable: true,
    isFeatured: true,
    tags: ["design", "consultation", "living room"],
  },
  {
    id: "s2",
    name: "Furniture Assembly Service",
    providerId: "provider-001",
    providerName: "Design Studio Pro",
    category: "assembly",
    price: 89,
    priceType: "fixed",
    rating: 4.8,
    reviewCount: 234,
    duration: "1-2 hours",
    description: "Professional furniture assembly for any brand. We handle IKEA, flat-pack furniture, and more. Our technicians bring all tools needed and ensure your furniture is assembled safely and correctly.",
    features: ["All tools provided", "Up to 3 pieces", "Safe assembly", "Damage protection", "90-day guarantee"],
    image: require("@/assets/images/products/bookshelf.png"),
    isAvailable: true,
    isFeatured: true,
    tags: ["assembly", "ikea", "flat-pack"],
  },
  {
    id: "s3",
    name: "Deep Home Cleaning",
    providerId: "provider-001",
    providerName: "Design Studio Pro",
    category: "cleaning",
    price: 149,
    priceType: "per_room",
    rating: 4.7,
    reviewCount: 156,
    duration: "3-5 hours",
    description: "Thorough deep cleaning service for your home. We clean every corner, including under furniture, inside appliances, windows, and bathrooms. All eco-friendly cleaning products included.",
    features: ["Eco-friendly products", "Under furniture cleaning", "Window cleaning", "Bathroom deep clean", "Kitchen degreasing"],
    image: require("@/assets/images/products/armchair-terracotta.png"),
    isAvailable: true,
    tags: ["cleaning", "deep clean", "home"],
  },
  {
    id: "s4",
    name: "Furniture Repair & Restoration",
    providerId: "provider-001",
    providerName: "Design Studio Pro",
    category: "repair",
    price: 129,
    priceType: "hourly",
    rating: 4.6,
    reviewCount: 78,
    duration: "2-4 hours",
    description: "Expert furniture repair and restoration service. We fix wobbly chairs, scratched surfaces, broken drawers, faded upholstery, and more. Breathe new life into your cherished furniture pieces.",
    features: ["Scratch repair", "Structural fixes", "Upholstery repair", "Wood refinishing", "Color matching"],
    image: require("@/assets/images/products/chair-navy.png"),
    isAvailable: true,
    tags: ["repair", "restoration", "wood"],
  },
  {
    id: "s5",
    name: "Room Decoration Setup",
    providerId: "provider-001",
    providerName: "Design Studio Pro",
    category: "decoration",
    price: 199,
    priceType: "fixed",
    rating: 4.8,
    reviewCount: 112,
    duration: "4-6 hours",
    description: "Transform your room with our professional decoration setup service. We arrange furniture, hang artwork, style shelves, and add finishing touches to create a beautifully curated space.",
    features: ["Furniture arrangement", "Artwork hanging", "Shelf styling", "Plant placement", "Lighting setup"],
    image: require("@/assets/images/products/pendant-lamp.png"),
    isAvailable: true,
    isFeatured: true,
    tags: ["decoration", "styling", "room"],
  },
  {
    id: "s6",
    name: "Furniture Moving & Rearranging",
    providerId: "provider-001",
    providerName: "Design Studio Pro",
    category: "moving",
    price: 79,
    priceType: "hourly",
    rating: 4.5,
    reviewCount: 198,
    duration: "1-3 hours",
    description: "Need to rearrange your furniture? Our strong and careful team will move heavy items safely within your home, protecting your floors and walls throughout the process.",
    features: ["Heavy lifting", "Floor protection", "Wall protection", "2-person team", "Same-day available"],
    image: require("@/assets/images/products/coffee-table.png"),
    isAvailable: true,
    tags: ["moving", "rearranging", "heavy"],
  },
];

export const getServiceById = (id: string) => services.find(s => s.id === id);
export const getFeaturedServices = () => services.filter(s => s.isFeatured);
export const getServicesByCategory = (catId: string) => services.filter(s => s.category === catId);
