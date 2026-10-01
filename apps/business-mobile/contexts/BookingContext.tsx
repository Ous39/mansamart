import React, { createContext, useContext, useState, useMemo, ReactNode, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { getToken } from "@/lib/auth-token";
import { useAuth } from "@/contexts/AuthContext";

export interface Booking {
  id: string;
  serviceId: string;
  serviceName: string;
  userId?: string;
  userName: string;
  providerId?: string;
  providerName?: string;
  date: string;
  time: string;
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
  price: number;
  address?: string;
  notes?: string;
  createdAt?: string;
}

interface BookingContextValue {
  bookings: Booking[];
  isLoading: boolean;
  addBooking: (booking: Omit<Booking, "id" | "createdAt">) => Promise<Booking>;
  updateBookingStatus: (bookingId: string, status: Booking["status"]) => Promise<void>;
  cancelBooking: (bookingId: string) => Promise<void>;
  getBookingsForUser: (userId: string) => Booking[];
  getBookingsForProvider: (providerId: string) => Booking[];
  getAllBookings: () => Booking[];
  refresh: () => Promise<void>;
}

const BookingContext = createContext<BookingContextValue | null>(null);

async function authedGet(path: string) {
  const token = getToken();
  const url = new URL(path, getApiUrl());
  const res = await fetch(url.toString(), {
    headers: {
      "X-MansaMart-App": process.env.EXPO_PUBLIC_APP_AUDIENCE || "business",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  return res;
}

export function BookingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const storageKey = user?.id ? `mansamart_business_bookings:${user.id}` : null;

  const loadBookings = useCallback(async () => {
    const token = getToken();
    if (!token || !storageKey) {
      setBookings([]);
      return;
    }

    setIsLoading(true);
    try {
      const res = await authedGet("/api/bookings");
      if (res.ok) {
        const next = await res.json();
        setBookings(next);
        await AsyncStorage.setItem(storageKey, JSON.stringify(next));
      }
    } catch {
      try {
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) setBookings(JSON.parse(stored));
      } catch {}
    }
    setIsLoading(false);
  }, [storageKey]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const addBooking = async (booking: Omit<Booking, "id" | "createdAt">): Promise<Booking> => {
    const token = getToken();
    if (token) {
      const res = await apiRequest("POST", "/api/bookings", booking);
      const newBooking: Booking = await res.json();
      setBookings(prev => [newBooking, ...prev]);
      return newBooking;
    }

    throw new Error("Bookings require a signed-in customer account.");
  };

  const updateBookingStatus = async (bookingId: string, status: Booking["status"]) => {
    const token = getToken();
    if (token) {
      await apiRequest("PUT", `/api/bookings/${bookingId}/status`, { status });
    }
    setBookings(prev => {
      const next = prev.map(b => b.id === bookingId ? { ...b, status } : b);
      if (storageKey) AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const cancelBooking = async (bookingId: string) => {
    await updateBookingStatus(bookingId, "cancelled");
  };

  const refresh = useCallback(async () => { await loadBookings(); }, [loadBookings]);

  const getBookingsForUser = (userId: string) => bookings.filter(b => b.userId === userId);
  const getBookingsForProvider = (providerId: string) => bookings.filter(b => b.providerId === providerId);
  const getAllBookings = () => bookings;

  const value = useMemo(() => ({
    bookings, isLoading,
    addBooking, updateBookingStatus, cancelBooking,
    getBookingsForUser, getBookingsForProvider, getAllBookings, refresh,
  }), [bookings, isLoading, refresh, storageKey]);

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBookings() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBookings must be used within BookingProvider");
  return ctx;
}
