export type UserRole = "user" | "vendor" | "service_provider" | "delivery_rider" | "admin";
export type NonAdminRole = Exclude<UserRole, "admin">;

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string | null;
  businessName?: string | null;
  isVerified?: boolean;
}

export interface AuthResponse {
  token: string;
  user: SessionUser;
  expiresIn?: number;
  hasPin?: boolean;
}

export interface ProductSummary {
  id: string;
  name: string;
  brand: string;
  price: number;
  category: string;
  images?: string[];
  rating?: number;
}
