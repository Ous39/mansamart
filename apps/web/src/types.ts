import type { ProductSummary, SessionUser } from "@mansamart/shared-types";

export type User = SessionUser;

export interface Product extends ProductSummary {
  description?: string | null;
  originalPrice?: number | null;
  subcategory?: string | null;
  stock?: number;
  inStock?: boolean;
  isSale?: boolean;
  isNew?: boolean;
  freeShipping?: boolean;
  colors?: string[];
  size?: string | null;
  location?: string | null;
  reviewCount?: number;
  vendorId?: string | null;
}

export interface Service {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  price: number;
  duration?: string | null;
  providerId?: string | null;
  providerName?: string | null;
  images?: string[];
  image?: string | null;
  rating?: number;
  reviewCount?: number;
  location?: string | null;
  isAvailable?: boolean;
}

export interface CartRow {
  cartItem: {
    id: string;
    productId: string;
    quantity: number;
    selectedColor?: string | null;
    selectedSize?: string | null;
    selectedVariant?: string | null;
    selectedOptions?: Record<string, unknown> | null;
  };
  product: Product;
}

export interface Order {
  id: string;
  status: string;
  vendorStatus?: string;
  marketplaceOrderStatus?: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  fulfillmentType?: string | null;
  subtotal: number;
  shipping: number;
  total: number;
  address?: string;
  city?: string;
  phone?: string;
  qrCode?: string | null;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
    image?: string;
    vendorName?: string;
    selectedColor?: string | null;
    selectedSize?: string | null;
  }>;
  createdAt: string;
  updatedAt?: string;
}

export interface Booking {
  id: string;
  serviceId?: string | null;
  serviceName: string;
  providerName?: string | null;
  userName?: string | null;
  date: string;
  time: string;
  address?: string;
  status: string;
  price: number;
  createdAt?: string;
}

export interface Address {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  address: string;
  city: string;
  region: string;
  isDefault: boolean;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  actionRoute?: string | null;
  createdAt: string;
}

export interface TrackingResponse {
  order: Order;
  events: Array<{ id: string; title: string; message: string; status: string; createdAt: string }>;
  qrs: Array<{ id: string; purpose: string; code: string; status: string }>;
  delivery?: Record<string, unknown> | null;
  riderLocation?: { latitude: number; longitude: number; createdAt: string } | null;
}

export interface PaymentConfig {
  wave: { enabled: boolean; ready: boolean; currency: string };
  commercialCurrency: string;
}

export interface FinanceResponse {
  wallet: { balance: number };
  summary: { availableForPayout: number; pendingPayout: number; totalSettled: number; totalPaidOut: number };
  payouts: Array<{ id: string; amount: number; method: string; status: string; createdAt: string }>;
  settlements: Array<{ id: string; amount: number; status: string; createdAt: string }>;
  transactions: Array<{ id: string; amount: number; direction: string; type: string; status: string; createdAt: string }>;
  payoutProfile: { verificationStatus: string; method: string; accountName: string; accountNumber: string; provider: string };
}
