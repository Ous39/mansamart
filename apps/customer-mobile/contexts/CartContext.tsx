import React, { createContext, useCallback, useContext, useState, useMemo, ReactNode, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getToken } from "@/lib/auth-token";
import { getApiUrl } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";

export interface CartItem {
  product: any;
  quantity: number;
  selectedColor?: string;
  selectedOptions?: {
    color?: string;
    size?: string;
    variant?: string;
    notes?: string;
    [key: string]: any;
  };
  _cartId?: string;
  optionKey: string;
}

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  addToCart: (product: any, colorOrOptions?: string | CartItem["selectedOptions"], quantity?: number) => void;
  removeFromCart: (item: CartItem) => void;
  updateQuantity: (item: CartItem, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const { user, isLoading: authLoading } = useAuth();
  const storageKey = `mansamart_cart:${user?.id || "guest"}`;

  const loadCart = useCallback(async () => {
    try {
      const token = getToken();
      if (token) {
        const url = new URL("/api/cart", getApiUrl()).toString();
        const resp = await fetch(url, { headers: { "X-MansaMart-App": "customer", Authorization: `Bearer ${token}` } });
        if (resp.ok) {
          const data: any[] = await resp.json();
          const serverItems: CartItem[] = data.map((row: any) => ({
            product: row.product,
            quantity: row.cartItem.quantity,
            selectedColor: row.cartItem.selectedColor ?? undefined,
            selectedOptions: row.cartItem.selectedOptions ?? undefined,
            _cartId: row.cartItem.id,
            optionKey: row.cartItem.optionKey || cartOptionKey(row.cartItem.selectedOptions),
          }));
          setItems(serverItems);
          await AsyncStorage.setItem(storageKey, JSON.stringify(serverItems));
          return;
        }
      }
    } catch {}
    try {
      const stored = await AsyncStorage.getItem(storageKey);
      const cached: CartItem[] = stored ? JSON.parse(stored) : [];
      setItems(Array.isArray(cached) ? cached.map((item) => {
        const selectedOptions = normalizeOptions(item.selectedOptions || { color: item.selectedColor });
        return { ...item, selectedOptions, optionKey: item.optionKey || cartOptionKey(selectedOptions) };
      }) : []);
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    if (!authLoading) void loadCart();
  }, [authLoading, loadCart]);

  const saveCart = async (newItems: CartItem[]) => {
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(newItems));
    } catch {}
  };

  const apiCall = async (method: string, path: string, body?: any) => {
    const token = getToken();
    if (!token) return null;
    const response = await fetch(new URL(path, getApiUrl()).toString(), {
      method,
      headers: { "Content-Type": "application/json", "X-MansaMart-App": "customer", Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error("Cart could not be synchronized");
    return response.status === 204 ? null : response.json();
  };

  const addToCart = (product: any, colorOrOptions?: string | CartItem["selectedOptions"], quantity = 1) => {
    const selectedOptions = normalizeOptions(typeof colorOrOptions === "string" ? { color: colorOrOptions } : (colorOrOptions || {}));
    const selectedColor = selectedOptions.color;
    const optionKey = cartOptionKey(selectedOptions);
    const safeQuantity = Math.max(1, Math.min(99, Math.trunc(quantity)));
    setItems(prev => {
      const existing = prev.find(i => i.product.id === product.id && i.optionKey === optionKey);
      let next: CartItem[];
      if (existing) {
        next = prev.map(i =>
          i.product.id === product.id && i.optionKey === optionKey ? { ...i, quantity: Math.min(99, i.quantity + safeQuantity) } : i
        );
      } else {
        next = [...prev, { product, quantity: safeQuantity, selectedColor, selectedOptions, optionKey }];
      }
      saveCart(next);
      return next;
    });
    void apiCall("POST", "/api/cart", {
      productId: product.id,
      quantity: safeQuantity,
      selectedColor,
      selectedSize: selectedOptions.size,
      selectedVariant: selectedOptions.variant,
      selectedOptions,
    }).then((serverItem) => {
      if (!serverItem) return;
      setItems((current) => {
        const next = current.map((item) => item.product.id === product.id && item.optionKey === optionKey
          ? { ...item, quantity: serverItem.quantity, _cartId: serverItem.id }
          : item);
        void saveCart(next);
        return next;
      });
    }).catch(() => void loadCart());
  };

  const removeFromCart = (target: CartItem) => {
    setItems(prev => {
      const next = prev.filter(i => !(i.product.id === target.product.id && i.optionKey === target.optionKey));
      saveCart(next);
      if (target._cartId) {
        void apiCall("DELETE", `/api/cart/${target._cartId}`).catch(() => void loadCart());
      }
      return next;
    });
  };

  const updateQuantity = (target: CartItem, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(target);
      return;
    }
    const safeQuantity = Math.min(99, Math.trunc(quantity));
    setItems(prev => {
      const next = prev.map(i =>
        i.product.id === target.product.id && i.optionKey === target.optionKey ? { ...i, quantity: safeQuantity } : i
      );
      saveCart(next);
      if (target._cartId) {
        void apiCall("PUT", `/api/cart/${target._cartId}`, { quantity: safeQuantity }).catch(() => void loadCart());
      }
      return next;
    });
  };

  const clearCart = () => {
    setItems([]);
    AsyncStorage.setItem(storageKey, "[]").catch(() => {});
    void apiCall("DELETE", "/api/cart").catch(() => void loadCart());
  };

  const totalItems = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);
  const subtotal = useMemo(() => items.reduce((s, i) => s + (i.product?.price ?? 0) * i.quantity, 0), [items]);

  const value = useMemo(() => ({
    items, totalItems, subtotal,
    addToCart, removeFromCart, updateQuantity, clearCart,
  }), [items, totalItems, subtotal]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

function normalizeOptions(options: CartItem["selectedOptions"] = {}) {
  return Object.fromEntries(Object.entries(options)
    .filter(([key, value]) => key.trim() && value !== undefined && value !== "")
    .map(([key, value]) => [key.trim(), typeof value === "string" ? value.trim() : value])
    .sort(([a], [b]) => a.localeCompare(b))) as NonNullable<CartItem["selectedOptions"]>;
}

function cartOptionKey(options: CartItem["selectedOptions"] = {}) {
  return JSON.stringify(normalizeOptions(options));
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
