import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { WishlistProvider } from "@/contexts/WishlistContext";
import { BookingProvider } from "@/contexts/BookingContext";
import { NotificationProvider } from "@/contexts/NotificationContext";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="(auth)"
        options={{ headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen name="product/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="service/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="cart" options={{ headerShown: false }} />
      <Stack.Screen name="checkout" options={{ headerShown: false }} />
      <Stack.Screen name="payment-status" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="order-confirmed" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="order-tracking" options={{ headerShown: false }} />
        <Stack.Screen name="scan-order" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="my-reviews" options={{ headerShown: false }} />
      <Stack.Screen name="returns" options={{ headerShown: false }} />
      <Stack.Screen name="support" options={{ headerShown: false }} />
      <Stack.Screen name="information" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="wallet" options={{ headerShown: false }} />
      <Stack.Screen name="pin-setup" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="pin-entry" options={{ headerShown: false, gestureEnabled: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <AuthProvider>
              <CartProvider>
                <WishlistProvider>
                  <BookingProvider>
                    <NotificationProvider>
                      <RootLayoutNav />
                    </NotificationProvider>
                  </BookingProvider>
                </WishlistProvider>
              </CartProvider>
            </AuthProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
