const BASE = "/api";

/**
 * Set by App so an expired session anywhere in the app sends the user back to
 * the login screen instead of surfacing a raw error.
 */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (res.status === 401) {
    onUnauthorized?.();
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Nicht angemeldet");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `Fehler ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(data) }),
  put: <T>(path: string, data: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(data) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export async function login(password: string): Promise<void> {
  const res = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Anmeldung fehlgeschlagen");
  }
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/logout`, { method: "POST" });
}

export async function checkSession(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/session`);
    if (!res.ok) return false;
    const body = (await res.json()) as { authenticated?: boolean };
    return body.authenticated === true;
  } catch {
    return false;
  }
}

export function formatCurrency(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("de-DE");
}

export function cutPrice(cut: { weight_kg: number | null; price_per_kg: number | null; fixed_price: number | null }): number {
  if (cut.fixed_price != null) return cut.fixed_price;
  if (cut.price_per_kg != null && cut.weight_kg != null) return cut.price_per_kg * cut.weight_kg;
  return 0;
}
