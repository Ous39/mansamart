import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "mansamart_customer_auth_token";
let _token: string | null = null;

export async function loadToken(): Promise<string | null> {
  if (_token) return _token;
  _token = await AsyncStorage.getItem(TOKEN_KEY);
  return _token;
}

export async function saveToken(token: string): Promise<void> {
  _token = token;
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  _token = null;
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return _token;
}
