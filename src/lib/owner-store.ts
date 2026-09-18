import { useSyncExternalStore, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { OwnerPeriodFilter } from "@/lib/owner";
import { logoutOwnerAction } from "@/lib/owner-auth";

export type OwnerUser = {
  id_user: string;
  email: string;
  nama_lengkap: string;
  role: string;
  barbershopName: string;
  barbershopSlug?: string;
  id_barbershop?: string;
  no_hp?: string;
  alamat?: string;
  jam_buka?: string;
  jam_tutup?: string;
  no_hp_barbershop?: string;
};

export type OwnerState = {
  isLoggedIn: boolean;
  user: OwnerUser;
  activePeriod: OwnerPeriodFilter;
  searchKeyword: string;
};

const DEFAULT_OWNER_USER: OwnerUser = {
  id_user: "",
  email: "",
  nama_lengkap: "",
  role: "owner",
  barbershopName: "",
  barbershopSlug: "",
  no_hp: "",
  alamat: "",
  jam_buka: "08:00",
  jam_tutup: "21:00",
  no_hp_barbershop: "",
};

const STORAGE_KEY = "barberin_owner_state_v1";
const COOKIE_KEY = "barberin_owner_logged_in";

export function getOwnerAuth(barbershopSlug?: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.isLoggedIn !== true) return false;
      if (barbershopSlug) {
        const matchesSlug = parsed.user?.barbershopSlug === barbershopSlug;
        const matchesId = parsed.user?.id_barbershop === barbershopSlug;
        if (!matchesSlug && !matchesId) return false;
      }
      return true;
    }
  } catch {}
  return false;
}

function loadInitialState(): OwnerState {
  if (typeof window === "undefined") {
    return {
      isLoggedIn: false,
      user: DEFAULT_OWNER_USER,
      activePeriod: "today",
      searchKeyword: "",
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...parsed,
        isLoggedIn: parsed.isLoggedIn === true,
        user: {
          ...DEFAULT_OWNER_USER,
          ...(parsed.user || {}),
        },
        activePeriod: parsed.activePeriod ?? "today",
        searchKeyword: "",
      };
    }
  } catch {
    // fallback
  }

  return {
    isLoggedIn: false,
    user: DEFAULT_OWNER_USER,
    activePeriod: "today",
    searchKeyword: "",
  };
}

let currentState: OwnerState = loadInitialState();
const listeners = new Set<() => void>();

function emitChange() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
    } catch {}
  }
  listeners.forEach((listener) => listener());
}

export const ownerActions = {
  login: (user: Partial<OwnerUser>) => {
    currentState = {
      ...currentState,
      isLoggedIn: true,
      user: {
        ...DEFAULT_OWNER_USER,
        ...user,
      },
    };
    emitChange();
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
        if (user.id_barbershop && user.id_user) {
          localStorage.setItem(
            `barberin_owner_state_${user.id_barbershop}_${user.id_user}`,
            JSON.stringify(currentState),
          );
        }
        document.cookie = `${COOKIE_KEY}=1; path=/; max-age=2592000; SameSite=Lax`;
      } catch {}
    }
  },

  updateUser: (user: Partial<OwnerUser>) => {
    currentState = {
      ...currentState,
      user: {
        ...currentState.user,
        ...user,
      },
    };
    emitChange();
  },

  logout: () => {
    const prevShopId = currentState.user.id_barbershop;
    const prevUserId = currentState.user.id_user;

    currentState = {
      isLoggedIn: false,
      user: DEFAULT_OWNER_USER,
      activePeriod: "today",
      searchKeyword: "",
    };
    emitChange();
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY);
        if (prevShopId && prevUserId) {
          localStorage.removeItem(`barberin_owner_state_${prevShopId}_${prevUserId}`);
        }
        document.cookie = `${COOKIE_KEY}=; path=/; max-age=0; SameSite=Lax`;
        document.cookie = `barberin_owner_session=; path=/; max-age=0; SameSite=Lax`;
      } catch {}
      logoutOwnerAction().catch(() => {});
    }
  },

  setPeriod: (period: OwnerPeriodFilter) => {
    currentState = {
      ...currentState,
      activePeriod: period,
    };
    emitChange();
  },

  setSearchKeyword: (searchKeyword: string) => {
    currentState = {
      ...currentState,
      searchKeyword,
    };
    emitChange();
  },
};

const SERVER_OWNER_STATE: OwnerState = {
  isLoggedIn: false,
  user: DEFAULT_OWNER_USER,
  activePeriod: "today",
  searchKeyword: "",
};

export function useOwner(): OwnerState {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => {
      if (!currentState.isLoggedIn && typeof window !== "undefined" && getOwnerAuth()) {
        currentState = loadInitialState();
      }
      return currentState;
    },
    () => SERVER_OWNER_STATE,
  );
}

export function useOwnerGuard() {
  const navigate = useNavigate();
  const state = useOwner();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasAuth = state.isLoggedIn || getOwnerAuth();
      if (!hasAuth) {
        navigate({ to: "/owner/login" as any, replace: true });
      }
    }
  }, [state.isLoggedIn, navigate]);

  return state;
}


