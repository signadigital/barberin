import { useSyncExternalStore } from "react";

export type SuperadminUser = {
  id_user: string;
  email: string;
  nama_lengkap: string;
  role: string;
};

export type SuperadminState = {
  isLoggedIn: boolean;
  user: SuperadminUser | null;
};

const AUTH_STORAGE_KEY = "barberin_superadmin_auth_v1";
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
    };
  }

  try {
    const rawAuth = localStorage.getItem(AUTH_STORAGE_KEY);
    const user = rawAuth ? JSON.parse(rawAuth) : null;

    return {
      isLoggedIn: Boolean(user),
      user: user,
    };
  } catch {
    return {
      isLoggedIn: false,
      user: null,
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
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch {}
  }
  listeners.forEach((listener) => listener());
}

export const superadminActions = {
  login: (user: SuperadminUser) => {
    currentState = {
      isLoggedIn: true,
      user,
    };
    emitChange();
  },

  logout: () => {
    currentState = {
      isLoggedIn: false,
      user: null,
    };
    emitChange();
  },
};

const SERVER_SUPERADMIN_STATE: SuperadminState = {
  isLoggedIn: false,
  user: null,
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
