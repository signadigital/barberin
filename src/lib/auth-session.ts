import crypto from "node:crypto";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

export type OwnerSessionPayload = {
  userId: string;
  email: string;
  role: "owner";
  barbershopId: string;
  barbershopName: string;
  namaLengkap: string;
  exp: number; // Unix timestamp in seconds
};

export const OWNER_SESSION_COOKIE = "barberin_owner_session";
export const OWNER_LOGGED_IN_COOKIE = "barberin_owner_logged_in";
const SESSION_EXPIRATION_SECONDS = 7 * 24 * 60 * 60; // 7 hari

function getSecretKey(): string {
  return (
    process.env["SESSION_SECRET"] ||
    process.env["DATABASE_URL"] ||
    "barberin_secure_owner_session_secret_key_2026"
  );
}

function base64UrlEncode(data: string): string {
  return Buffer.from(data, "utf-8")
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}

function signString(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

/**
 * Membuat signed session token dari payload
 */
export function sealSessionToken(payload: Omit<OwnerSessionPayload, "exp">): string {
  const fullPayload: OwnerSessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + SESSION_EXPIRATION_SECONDS,
  };

  const payloadEncoded = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = signString(payloadEncoded, getSecretKey());
  return `${payloadEncoded}.${signature}`;
}

/**
 * Memverifikasi dan membaca session token. Mengembalikan payload jika valid, atau null jika invalid/expired.
 */
export function unsealSessionToken(token: string | undefined | null): OwnerSessionPayload | null {
  if (!token || typeof token !== "string") {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [payloadEncoded, signature] = parts;
  if (!payloadEncoded || !signature) {
    return null;
  }

  const expectedSignature = signString(payloadEncoded, getSecretKey());
  if (
    Buffer.from(signature).length !== Buffer.from(expectedSignature).length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    return null;
  }

  try {
    const jsonStr = base64UrlDecode(payloadEncoded);
    const parsed = JSON.parse(jsonStr) as OwnerSessionPayload;

    if (!parsed || parsed.role !== "owner") {
      return null;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (parsed.exp && parsed.exp < nowSeconds) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Simpan cookie sesi di server environment
 */
export function setOwnerSessionCookie(payload: Omit<OwnerSessionPayload, "exp">) {
  const token = sealSessionToken(payload);
  try {
    setCookie(OWNER_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_EXPIRATION_SECONDS,
    });
    setCookie(OWNER_LOGGED_IN_COOKIE, "1", {
      httpOnly: false,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_EXPIRATION_SECONDS,
    });
  } catch (err) {
    // Pada saat testing direct function tanpa context H3
    console.warn("Could not set session cookie (not in H3 context):", err);
  }
  return token;
}

/**
 * Ambil dan verifikasi sesi Owner dari request cookie
 */
export function getOwnerSession(): OwnerSessionPayload | null {
  try {
    const rawToken = getCookie(OWNER_SESSION_COOKIE);
    return unsealSessionToken(rawToken);
  } catch {
    return null;
  }
}

/**
 * Hapus cookie sesi Owner
 */
export function clearOwnerSessionCookie() {
  try {
    deleteCookie(OWNER_SESSION_COOKIE, {
      path: "/",
    });
    deleteCookie(OWNER_LOGGED_IN_COOKIE, {
      path: "/",
    });
  } catch (err) {
    console.warn("Could not clear session cookie:", err);
  }
}

/**
 * Memvalidasi dan mengekstrak tenant kontekstual dari sesi Owner yang sedang aktif.
 * Wajib digunakan di setiap server action / query Owner untuk mencegah kebocoran data antar-tenant.
 */
export function requireOwnerTenant(): {
  userId: string;
  email: string;
  barbershopId: string;
  barbershopName: string;
  namaLengkap: string;
} {
  const session = getOwnerSession();
  if (!session || !session.userId || !session.barbershopId) {
    throw new Error("Sesi Owner tidak valid atau belum login. Akses ditolak.");
  }
  return {
    userId: session.userId,
    email: session.email,
    barbershopId: session.barbershopId,
    barbershopName: session.barbershopName,
    namaLengkap: session.namaLengkap,
  };
}

/**
 * Mengambil ID Barbershop Owner saat ini secara aman dari sesi server.
 */
export function getCurrentOwnerBarbershopId(): string {
  return requireOwnerTenant().barbershopId;
}

