import React, { createContext, useCallback, useContext, useState, useMemo, ReactNode, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getToken } from "@/lib/auth-token";
import { getApiUrl } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";

interface WishlistContextValue {
  items: any[];
  isWishlisted: (productId: string) => boolean;
  toggle: (product: any) => void;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<any[]>([]);
  const { user, isLoading: authLoading } = useAuth();
  const storageKey = `mansamart_wishlist:${user?.id || "guest"}`;

  const loadWishlist = useCallback(async () => {
    try {
      const token = getToken();
      if (token) {
        const url = new URL("/api/wishlist", getApiUrl()).toString();
        const resp = await fetch(url, { headers: { "X-MansaMart-App": "customer", Authorization: `Bearer ${token}` } });
        if (resp.ok) {
          const data: any[] = await resp.json();
          const serverItems = data.map((row: any) => row.product ?? row);
          setItems(serverItems);
          await AsyncStorage.setItem(storageKey, JSON.stringify(serverItems));
          return;
        }
      }
    } catch {}
    try {
      const stored = await AsyncStorage.getItem(storageKey);
      setItems(stored ? JSON.parse(stored) : []);
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    if (!authLoading) void loadWishlist();
  }, [authLoading, loadWishlist]);

  const saveWishlist = async (newItems: any[]) => {
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(newItems));
    } catch {}
  };

  const apiCall = (method: string, path: string, body?: any) => {
    const token = getToken();
    if (!token) return;
    fetch(new URL(path, getApiUrl()).toString(), {
      method,
      headers: { "Content-Type": "application/json", "X-MansaMart-App": "customer", Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => {});
  };

  const isWishlisted = (productId: string) => items.some(i => i.id === productId);

  const toggle = (product: any) => {
    setItems(prev => {
      const exists = prev.some(i => i.id === product.id);
      const next = exists ? prev.filter(i => i.id !== product.id) : [...prev, product];
      saveWishlist(next);
      if (exists) {
        apiCall("DELETE", `/api/wishlist/${product.id}`);
      } else {
        apiCall("POST", "/api/wishlist", { productId: product.id });
      }
      return next;
    });
  };

  const value = useMemo(() => ({ items, isWishlisted, toggle }), [items]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
