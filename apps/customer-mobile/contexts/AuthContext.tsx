import React, { createContext, useContext, useState, useMemo, ReactNode, useEffect } from "react";
import { loadToken, saveToken, clearToken, getToken } from "@/lib/auth-token";
import { apiRequest, getApiUrl, queryClient } from "@/lib/query-client";

export type UserRole = "user" | "vendor" | "service_provider" | "delivery_rider" | "admin"; // user = shopper/customer account

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  area?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracy?: number | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  bio?: string | null;
  businessName?: string | null;
  businessType?: string | null;
  avatar?: string | null;
  isVerified?: boolean;
  createdAt?: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone?: string;
  address?: string;
  city?: string;
  region?: string;
  area?: string;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
  gender?: string;
  dateOfBirth?: string;
  role: UserRole;
  businessName?: string;
  businessType?: string;
  bio?: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasPin: boolean;
  pinVerified: boolean;
  login: (email: string, password: string) => Promise<{ hasPin: boolean; user: User }>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  setupPin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<void>;
  setPinVerified: (v: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const APP_AUDIENCE = process.env.EXPO_PUBLIC_APP_AUDIENCE || "customer";
const APP_ROLES: Record<string, UserRole[]> = {
  customer: ["user"], business: ["vendor", "service_provider"], rider: ["delivery_rider"],
};
const roleAllowed = (role: UserRole) => (APP_ROLES[APP_AUDIENCE] || []).includes(role);

async function authedGet(path: string) {
  const token = getToken();
  const url = new URL(path, getApiUrl());
  const res = await fetch(url.toString(), {
    headers: {
      "X-MansaMart-App": process.env.EXPO_PUBLIC_APP_AUDIENCE || "customer",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  return res;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPin, setHasPin] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);

  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    try {
      await loadToken();
      const token = getToken();
      if (!token) { setIsLoading(false); return; }

      const res = await authedGet("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (!roleAllowed(data.user.role)) { await clearToken(); setIsLoading(false); return; }
        setUser(data.user);
        setHasPin(!!data.hasPin);
        setPinVerified(!data.hasPin);
      } else {
        await clearToken();
      }
    } catch {
      await clearToken();
    }
    setIsLoading(false);
  };

  const login = async (email: string, password: string): Promise<{ hasPin: boolean; user: User }> => {
    const res = await apiRequest("POST", "/api/auth/login", { email, password });
    const data = await res.json();
    await saveToken(data.token);
    setUser(data.user);
    setHasPin(!!data.hasPin);
    setPinVerified(!data.hasPin);
    queryClient.clear();
    return { hasPin: !!data.hasPin, user: data.user };
  };

  const register = async (registerData: RegisterData): Promise<void> => {
    const res = await apiRequest("POST", "/api/auth/register", registerData);
    const data = await res.json();
    await saveToken(data.token);
    setUser(data.user);
    setHasPin(false);
    setPinVerified(true);
    queryClient.clear();
  };

  const logout = async () => {
    try { await apiRequest("POST", "/api/auth/logout"); } catch {}
    await clearToken();
    setUser(null);
    setHasPin(false);
    setPinVerified(false);
    queryClient.clear();
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) return;
    const res = await apiRequest("PUT", "/api/auth/profile", updates);
    const data = await res.json();
    setUser(data.user);
  };

  const setupPin = async (pin: string) => {
    await apiRequest("POST", "/api/auth/set-pin", { pin });
    setHasPin(true);
    setPinVerified(true);
  };

  const verifyPin = async (pin: string) => {
    await apiRequest("POST", "/api/auth/verify-pin", { pin });
    setPinVerified(true);
  };

  const value = useMemo(() => ({
    user, isLoading, isAuthenticated: !!user,
    hasPin, pinVerified,
    login, register, logout, updateProfile,
    setupPin, verifyPin, setPinVerified,
  }), [user, isLoading, hasPin, pinVerified]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
