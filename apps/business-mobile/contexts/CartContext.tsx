import React, { createContext, useContext, useState, useMemo, ReactNode, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getToken } from "@/lib/auth-token";
import { getApiUrl } from "@/lib/query-client";

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
}

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  addToCart: (product: any, colorOrOptions?: string | CartItem["selectedOptions"]) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = async () => {
    try {
      const token = getToken();
      if (token) {
        const url = new URL("/api/cart", getApiUrl()).toString();
        const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (resp.ok) {
          const data: any[] = await resp.json();
          const serverItems: CartItem[] = data.map((row: any) => ({
            product: row.product,
            quantity: row.cartItem.quantity,
            selectedColor: row.cartItem.selectedColor ?? undefined,
            _cartId: row.cartItem.id,
          }));
          setItems(serverItems);
          await AsyncStorage.setItem("gambia_cart", JSON.stringify(serverItems));
          return;
        }
      }
    } catch {}
    try {
      const stored = await AsyncStorage.getItem("gambia_cart");
      if (stored) setItems(JSON.parse(stored));
    } catch {}
  };

  const saveCart = async (newItems: CartItem[]) => {
    try {
      await AsyncStorage.setItem("gambia_cart", JSON.stringify(newItems));
    } catch {}
  };

  const apiCall = (method: string, path: string, body?: any) => {
    const token = getToken();
    if (!token) return;
    fetch(new URL(path, getApiUrl()).toString(), {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => {});
  };

  const addToCart = (product: any, colorOrOptions?: string | CartItem["selectedOptions"]) => {
    const selectedOptions = typeof colorOrOptions === "string" ? { color: colorOrOptions } : (colorOrOptions || {});
    const selectedColor = selectedOptions.color;
    const optionKey = JSON.stringify(selectedOptions || {});
    setItems(prev => {
      const existing = prev.find(i => i.product.id === product.id && JSON.stringify(i.selectedOptions || { color: i.selectedColor } || {}) === optionKey);
      let next: CartItem[];
      if (existing) {
        next = prev.map(i =>
          i.product.id === product.id && JSON.stringify(i.selectedOptions || { color: i.selectedColor } || {}) === optionKey ? { ...i, quantity: i.quantity + 1 } : i
        );
      } else {
        next = [...prev, { product, quantity: 1, selectedColor, selectedOptions }];
      }
      saveCart(next);
      apiCall("POST", "/api/cart", { productId: product.id, quantity: 1, selectedColor });
      return next;
    });
  };

  const removeFromCart = (productId: string) => {
    setItems(prev => {
      const item = prev.find(i => i.product.id === productId);
      const next = prev.filter(i => i.product.id !== productId);
      saveCart(next);
      if (item?._cartId) {
        apiCall("DELETE", `/api/cart/${item._cartId}`);
      }
      return next;
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setItems(prev => {
      const item = prev.find(i => i.product.id === productId);
      const next = prev.map(i =>
        i.product.id === productId ? { ...i, quantity } : i
      );
      saveCart(next);
      if (item?._cartId) {
        apiCall("PUT", `/api/cart/${item._cartId}`, { quantity });
      }
      return next;
    });
  };

  const clearCart = () => {
    setItems([]);
    AsyncStorage.setItem("gambia_cart", "[]").catch(() => {});
    apiCall("DELETE", "/api/cart");
  };

  const totalItems = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);
  const subtotal = useMemo(() => items.reduce((s, i) => s + (i.product?.price ?? 0) * i.quantity, 0), [items]);

  const value = useMemo(() => ({
    items, totalItems, subtotal,
    addToCart, removeFromCart, updateQuantity, clearCart,
  }), [items, totalItems, subtotal]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
