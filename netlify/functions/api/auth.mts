import { createHmac, createHash, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "wv_session";
const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

function env(name: string): string | undefined {
  const value = Netlify.env.get(name);
  return value && value.length > 0 ? value : undefined;
}

/**
 * The API is password protected exactly when APP_PASSWORD is set. Without it
 * the app runs open, so protection can be switched on and off through the
 * environment alone.
 */
export function isProtected(): boolean {
  return env("APP_PASSWORD") !== undefined;
}

/** A half-configured setup must not silently serve data unprotected. */
export function authConfigError(): string | null {
  if (!isProtected()) return null;
  if (!env("SESSION_SECRET")) return "SESSION_SECRET ist nicht konfiguriert.";
  return null;
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function checkPassword(input: unknown): boolean {
  const expected = env("APP_PASSWORD");
  if (!expected || typeof input !== "string") return false;
  // Hashing first keeps the compared buffers the same length.
  return timingSafeEqual(sha256(input), sha256(expected));
}

function sign(payload: string): string {
  return createHmac("sha256", env("SESSION_SECRET")!).update(payload).digest("hex");
}

export function createSessionToken(): string {
  const expiresAt = String(Date.now() + SESSION_MS);
  return `${expiresAt}.${sign(expiresAt)}`;
}

function verifySessionToken(token: string): boolean {
  const [expiresAt, signature] = token.split(".");
  if (!expiresAt || !signature) return false;

  const expected = sign(expiresAt);
  if (signature.length !== expected.length) return false;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;

  const expiry = Number(expiresAt);
  return Number.isFinite(expiry) && expiry > Date.now();
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function isAuthenticated(req: Request): boolean {
  if (!isProtected()) return true;
  const token = readCookie(req, COOKIE_NAME);
  return token !== null && verifySessionToken(token);
}

export function sessionCookie(token: string): string {
  const maxAge = Math.floor(SESSION_MS / 1000);
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export function clearedCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}
