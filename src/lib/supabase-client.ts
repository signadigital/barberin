import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function cleanEnv(val?: string | null): string {
  if (!val) return "";
  let cleaned = val.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

export type SupabaseConfig = {
  url: string;
  anonKey: string;
  keyType: "publishable" | "anon" | "none";
  isConfigured: boolean;
};

/**
 * Membaca konfigurasi Supabase secara aman baik di client (Vite/Browser) maupun server (Node.js/Nitro).
 * Memprioritaskan import.meta.env di client browser dan process.env di server.
 */
export function getSupabaseConfig(): SupabaseConfig {
  let url = "";
  let anonKey = "";
  let keyType: "publishable" | "anon" | "none" = "none";

  // 1. Client-side Vite (import.meta.env)
  if (typeof import.meta !== "undefined" && import.meta.env) {
    url = cleanEnv(import.meta.env["VITE_SUPABASE_URL"]);

    const pubKey = cleanEnv(import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]);
    const legKey = cleanEnv(import.meta.env["VITE_SUPABASE_ANON_KEY"]);

    if (pubKey) {
      anonKey = pubKey;
      keyType = "publishable";
    } else if (legKey) {
      anonKey = legKey;
      keyType = "anon";
    }
  }

  // 2. Server-side Node / SSR fallback (process.env)
  if (typeof process !== "undefined" && process.env) {
    if (!url) {
      url =
        cleanEnv(process.env["VITE_SUPABASE_URL"]) ||
        cleanEnv(process.env["SUPABASE_URL"]);
    }

    if (!anonKey) {
      const pubKey =
        cleanEnv(process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]) ||
        cleanEnv(process.env["SUPABASE_PUBLISHABLE_KEY"]);
      const legKey =
        cleanEnv(process.env["VITE_SUPABASE_ANON_KEY"]) ||
        cleanEnv(process.env["SUPABASE_ANON_KEY"]);

      if (pubKey) {
        anonKey = pubKey;
        keyType = "publishable";
      } else if (legKey) {
        anonKey = legKey;
        keyType = "anon";
      }
    }
  }

  // Fallback default project URL jika tidak dispesifikasikan
  if (!url) {
    url = "https://ppyyebodwmvxtbdaazbm.supabase.co";
  }

  // 3. Keamanan: Larang keras service role key atau secret key di client
  if (
    anonKey.startsWith("sb_secret_") ||
    anonKey.toLowerCase().includes("service_role")
  ) {
    throw new Error(
      "Keamanan: SUPABASE_SERVICE_ROLE_KEY atau secret key tidak boleh digunakan pada client Supabase.",
    );
  }

  const isConfigured = Boolean(url && anonKey);

  return { url, anonKey, keyType, isConfigured };
}

/**
 * Diagnostic helper untuk memeriksa status ketersediaan variabel environment Supabase
 * tanpa pernah mengekspos nilai kredensial.
 */
export function getSupabaseDiagnostics(): {
  SUPABASE_URL_PRESENT: boolean;
  SUPABASE_KEY_PRESENT: boolean;
  KEY_TYPE: "publishable" | "anon" | "none";
} {
  const cfg = getSupabaseConfig();
  return {
    SUPABASE_URL_PRESENT: Boolean(cfg.url),
    SUPABASE_KEY_PRESENT: Boolean(cfg.anonKey),
    KEY_TYPE: cfg.keyType,
  };
}

let supabaseInstance: SupabaseClient | null = null;

/**
 * Inisialisasi Supabase Client nyata ketika konfigurasi tersedia.
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const { url, anonKey, isConfigured } = getSupabaseConfig();

  if (!isConfigured) {
    throw new Error("Supabase environment variables belum dikonfigurasi.");
  }

  supabaseInstance = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });

  return supabaseInstance;
}

// Properti internal JS / React / Vite yang tidak boleh memicu inisialisasi client
const IGNORED_PROPS = new Set([
  "then",
  "catch",
  "finally",
  "toJSON",
  "$$typeof",
  "valueOf",
  "toString",
  "constructor",
  "length",
  "name",
  "prototype",
]);

/**
 * Proxy Supabase Client singleton.
 * Aman di-import dan tidak memicu error saat modul dimuat, SSR, atau sebelum form di-submit.
 * Error validasi hanya akan dilempar saat operasi auth/database nyata dipanggil jika env belum diatur.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    if (typeof prop === "symbol" || IGNORED_PROPS.has(prop as string)) {
      return undefined;
    }

    const { isConfigured } = getSupabaseConfig();

    if (!isConfigured) {
      // Jika dipanggil prop 'auth' namun env belum disetel, kembalikan proxy auth yang melempar error saat method dipanggil
      if (prop === "auth") {
        return new Proxy(
          {},
          {
            get(_authTarget, authMethod) {
              if (
                typeof authMethod === "symbol" ||
                IGNORED_PROPS.has(authMethod as string)
              ) {
                return undefined;
              }
              return () => {
                throw new Error(
                  "Supabase environment variables belum dikonfigurasi.",
                );
              };
            },
          },
        );
      }

      return () => {
        throw new Error("Supabase environment variables belum dikonfigurasi.");
      };
    }

    const client = getSupabaseClient();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
