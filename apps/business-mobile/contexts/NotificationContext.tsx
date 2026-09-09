import React, { createContext, useContext, useState, useMemo, ReactNode, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { io, Socket } from "socket.io-client";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { getToken } from "@/lib/auth-token";
import { useAuth } from "@/contexts/AuthContext";

export interface AppNotification {
  id: string;
  type: "order" | "booking" | "promo" | "system" | "review" | "delivery" | "payment" | "verification" | "wallet";
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  icon: string;
  color: string;
  actionRoute?: string;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  addNotification: (n: Omit<AppNotification, "id" | "createdAt" | "isRead">) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);
const WELCOME_NOTIFICATION: AppNotification = {
  id: "welcome-mansamart",
  type: "system",
  title: "Welcome to MansaMart",
  body: "Your marketplace notifications will appear here in real time.",
  isRead: true,
  createdAt: new Date().toISOString(),
  icon: "information-circle-outline",
  color: "#6B7280",
};

function normalizeNotification(row: any): AppNotification {
  return {
    id: String(row.id || `n-${Date.now()}`),
    type: row.type || "system",
    title: row.title || "Notification",
    body: row.body || row.message || "",
    isRead: Boolean(row.isRead),
    createdAt: row.createdAt || new Date().toISOString(),
    icon: row.icon || "notifications-outline",
    color: row.color || "#2563EB",
    actionRoute: row.actionRoute || row.action_route,
  };
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([WELCOME_NOTIFICATION]);
  const storageKey = user?.id ? `mansamart_business_notifications:${user.id}` : null;

  useEffect(() => {
    let mounted = true;
    let socket: Socket | null = null;

    async function loadLocalFallback() {
      if (!storageKey) return;
      try {
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored && mounted) setNotifications(JSON.parse(stored));
      } catch {}
    }

    async function loadServerNotifications() {
      try {
        const res = await apiRequest("GET", "/api/notifications");
        const rows = await res.json();
        if (mounted) {
          const normalized = (Array.isArray(rows) ? rows : []).map(normalizeNotification);
          setNotifications(normalized.length ? normalized : [WELCOME_NOTIFICATION]);
          await AsyncStorage.setItem(storageKey!, JSON.stringify(normalized));
        }
      } catch {
        await loadLocalFallback();
      }
    }

    if (isAuthenticated && user) {
      loadServerNotifications();
      const token = getToken();
      socket = io(getApiUrl(), { transports: ["websocket", "polling"], auth: { token } });
      socket.on("notification:new", (payload: any) => {
        const incoming = normalizeNotification(payload?.notification || payload);
        setNotifications(prev => {
          const next = [incoming, ...prev.filter(n => n.id !== incoming.id)];
          if (storageKey) AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
          return next;
        });
      });
    } else {
      setNotifications([WELCOME_NOTIFICATION]);
    }

    return () => {
      mounted = false;
      socket?.disconnect();
    };
  }, [isAuthenticated, user?.id, storageKey]);

  const persist = async (ns: AppNotification[]) => {
    if (!storageKey) return;
    try { await AsyncStorage.setItem(storageKey, JSON.stringify(ns)); } catch {}
  };

  const markRead = (id: string) => {
    const updated = notifications.map(n => n.id === id ? { ...n, isRead: true } : n);
    setNotifications(updated);
    persist(updated);
    if (isAuthenticated) apiRequest("PUT", `/api/notifications/${id}/read`).catch(() => {});
  };

  const markAllRead = () => {
    const updated = notifications.map(n => ({ ...n, isRead: true }));
    setNotifications(updated);
    persist(updated);
    if (isAuthenticated) apiRequest("PUT", "/api/notifications/read-all").catch(() => {});
  };

  const clearAll = () => {
    setNotifications([]);
    persist([]);
  };

  const addNotification = (n: Omit<AppNotification, "id" | "createdAt" | "isRead">) => {
    const newN: AppNotification = { ...n, id: "local-" + Date.now(), createdAt: new Date().toISOString(), isRead: false };
    const updated = [newN, ...notifications];
    setNotifications(updated);
    persist(updated);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const value = useMemo(() => ({ notifications, unreadCount, markRead, markAllRead, clearAll, addNotification }), [notifications, unreadCount, isAuthenticated]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
