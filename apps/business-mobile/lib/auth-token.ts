import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "mansamart_business_auth_token";
let _token: string | null = null;

export async function loadToken(): Promise<string | null> {
  if (_token) return _token;
  if (Platform.OS === "web") {
    _token = await AsyncStorage.getItem(TOKEN_KEY);
    return _token;
  }
  _token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!_token) {
    const legacyToken = await AsyncStorage.getItem(TOKEN_KEY);
    if (legacyToken) {
      await SecureStore.setItemAsync(TOKEN_KEY, legacyToken, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
      await AsyncStorage.removeItem(TOKEN_KEY);
      _token = legacyToken;
    }
  }
  return _token;
}

export async function saveToken(token: string): Promise<void> {
  _token = token;
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  _token = null;
  if (Platform.OS !== "web") await SecureStore.deleteItemAsync(TOKEN_KEY);
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return _token;
}
