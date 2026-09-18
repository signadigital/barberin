import { useSyncExternalStore } from "react";
import { ownerActions, type OwnerUser } from "@/lib/owner-store";

export type SuperadminUser = {
  id_user: string;
  email: string;
  nama_lengkap: string;
  role: string;
};

export type ImpersonateContext = {
  isImpersonating: boolean;
  targetTenant: {
    id_barbershop: string;
    nama_barbershop: string;
    ownerName?: string | undefined;
    ownerEmail?: string | undefined;
  } | null;
  originalSuperadmin: SuperadminUser | null;
};

export type SuperadminState = {
  isLoggedIn: boolean;
  user: SuperadminUser | null;
  impersonation: ImpersonateContext;
};

const DEFAULT_SUPERADMIN_USER: SuperadminUser = {
  id_user: "superadmin-system-id",
  email: "superadmin@barberin.test",
  nama_lengkap: "Superadmin Platform",
  role: "superadmin",
};

const AUTH_STORAGE_KEY = "barberin_superadmin_auth_v1";
const IMPERSONATE_STORAGE_KEY = "barberin_superadmin_impersonate_v1";
const COOKIE_KEY = "barberin_superadmin_logged_in";

export function getSuperadminAuth(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const rawAuth = localStorage.getItem(AUTH_STORAGE_KEY);
    if (rawAuth) {
      const user = JSON.parse(rawAuth);
      return Boolean(user && user.email);
    }
  } catch {}
  return false;
}

function loadInitialState(): SuperadminState {
  if (typeof window === "undefined") {
    return {
      isLoggedIn: false,
      user: null,
      impersonation: {
        isImpersonating: false,
        targetTenant: null,
        originalSuperadmin: null,
      },
    };
  }

  try {
    const rawAuth = localStorage.getItem(AUTH_STORAGE_KEY);
    const rawImpersonate = localStorage.getItem(IMPERSONATE_STORAGE_KEY);

    const user = rawAuth ? JSON.parse(rawAuth) : null;
    const impersonation = rawImpersonate
      ? JSON.parse(rawImpersonate)
      : {
          isImpersonating: false,
          targetTenant: null,
          originalSuperadmin: null,
        };

    return {
      isLoggedIn: Boolean(user),
      user: user,
      impersonation: impersonation,
    };
  } catch {
    return {
      isLoggedIn: false,
      user: null,
      impersonation: {
        isImpersonating: false,
        targetTenant: null,
        originalSuperadmin: null,
      },
    };
  }
}

let currentState: SuperadminState = loadInitialState();
const listeners = new Set<() => void>();

function emitChange() {
  if (typeof window !== "undefined") {
    try {
      if (currentState.user) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentState.user));
        document.cookie = `${COOKIE_KEY}=1; path=/; max-age=2592000; SameSite=Lax`;
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        document.cookie = `${COOKIE_KEY}=; path=/; max-age=0; SameSite=Lax`;
      }

      if (currentState.impersonation.isImpersonating) {
        localStorage.setItem(
          IMPERSONATE_STORAGE_KEY,
          JSON.stringify(currentState.impersonation),
        );
      } else {
        localStorage.removeItem(IMPERSONATE_STORAGE_KEY);
      }
    } catch {}
  }
  listeners.forEach((listener) => listener());
}

export const superadminActions = {
  login: (user: SuperadminUser) => {
    currentState = {
      ...currentState,
      isLoggedIn: true,
      user,
    };
    emitChange();
  },

  logout: () => {
    currentState = {
      isLoggedIn: false,
      user: null,
      impersonation: {
        isImpersonating: false,
        targetTenant: null,
        originalSuperadmin: null,
      },
    };
    emitChange();
  },

  startImpersonate: (
    targetTenant: {
      id_barbershop: string;
      nama_barbershop: string;
      slug?: string | null;
      alamat?: string | null;
      no_hp?: string | null;
    },
    targetOwner?: {
      id_user: string;
      nama_lengkap: string;
      email: string;
      no_hp?: string | null;
    } | null,
  ) => {
    const currentAdmin = currentState.user || DEFAULT_SUPERADMIN_USER;

    const impersonationContext: ImpersonateContext = {
      isImpersonating: true,
      targetTenant: {
        id_barbershop: targetTenant.id_barbershop,
        nama_barbershop: targetTenant.nama_barbershop,
        ownerName: targetOwner?.nama_lengkap,
        ownerEmail: targetOwner?.email,
      },
      originalSuperadmin: currentAdmin,
    };

    currentState = {
      ...currentState,
      impersonation: impersonationContext,
    };
    emitChange();

    // Alihkan konteks Owner store ke toko target
    ownerActions.login({
      id_user: targetOwner?.id_user || `impersonated-owner-${targetTenant.id_barbershop}`,
      id_barbershop: targetTenant.id_barbershop,
      barbershopSlug: targetTenant.slug || targetTenant.id_barbershop,
      email: targetOwner?.email || `owner-${targetTenant.id_barbershop.slice(0, 6)}@barberin.test`,
      nama_lengkap: targetOwner?.nama_lengkap || `Owner ${targetTenant.nama_barbershop}`,
      role: "owner",
      barbershopName: targetTenant.nama_barbershop,
      alamat: targetTenant.alamat || "Alamat barbershop",
      no_hp: targetOwner?.no_hp || targetTenant.no_hp || "0812-3456-7890",
      no_hp_barbershop: targetTenant.no_hp || "0812-3456-7890",
    });
  },

  stopImpersonate: () => {
    const originalAdmin = currentState.impersonation.originalSuperadmin;

    currentState = {
      ...currentState,
      isLoggedIn: true,
      user: originalAdmin || currentState.user,
      impersonation: {
        isImpersonating: false,
        targetTenant: null,
        originalSuperadmin: null,
      },
    };
    emitChange();
  },
};

const SERVER_SUPERADMIN_STATE: SuperadminState = {
  isLoggedIn: false,
  user: null,
  impersonation: {
    isImpersonating: false,
    targetTenant: null,
    originalSuperadmin: null,
  },
};

export function useSuperadmin(): SuperadminState {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => {
      if (!currentState.isLoggedIn && typeof window !== "undefined" && getSuperadminAuth()) {
        currentState = loadInitialState();
      }
      return currentState;
    },
    () => SERVER_SUPERADMIN_STATE,
  );
}

