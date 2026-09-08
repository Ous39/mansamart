import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getToken } from "@/lib/auth-token";
import { API_BASE_URL } from "@/lib/config";

export function getApiUrl(): string {
  return API_BASE_URL;
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = {
    "X-MansaMart-App": process.env.EXPO_PUBLIC_APP_AUDIENCE || "business",
    ...extra,
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);
  const headers = authHeaders(data ? { "Content-Type": "application/json" } : {});

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
  } catch (error: any) {
    throw new Error(`Network request failed. API=${baseUrl}. URL=${url.toString()}. Check backend, phone/laptop network, firewall, and EXPO_PUBLIC_API_URL / EXPO_PUBLIC_DOMAIN. Original: ${error?.message || error}`);
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        headers: authHeaders(),
      });
    } catch (error: any) {
      throw new Error(`Network request failed. API=${baseUrl}. URL=${url.toString()}. Check backend, phone/laptop network, firewall, and EXPO_PUBLIC_API_URL / EXPO_PUBLIC_DOMAIN. Original: ${error?.message || error}`);
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
