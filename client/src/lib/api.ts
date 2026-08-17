const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
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
