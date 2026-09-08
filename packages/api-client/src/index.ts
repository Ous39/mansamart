import type { AuthResponse } from "@mansamart/shared-types";

export type AppAudience = "customer" | "business" | "rider" | "web" | "admin";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export class MansaMartApi {
  constructor(
    private readonly baseUrl: string,
    private readonly audience: AppAudience,
    private readonly getToken: () => string | null,
  ) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const response = await fetch(new URL(path, this.baseUrl), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-MansaMart-App": this.audience,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(response.status, body.message || "Request failed");
    return body as T;
  }

  login(email: string, password: string): Promise<AuthResponse> {
    const endpoint = this.audience === "admin" ? "/api/admin/auth/login" : "/api/auth/login";
    return this.request<AuthResponse>(endpoint, { method: "POST", body: JSON.stringify({ email, password }) });
  }

  me(): Promise<{ user: AuthResponse["user"] }> { return this.request("/api/auth/me"); }
  logout(): Promise<{ success: boolean }> { return this.request("/api/auth/logout", { method: "POST" }); }
}
