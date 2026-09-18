import { useSyncExternalStore } from "react";
import { getIndonesianMonthYear } from "@/lib/format";
import type { OwnerCapsterItem } from "@/lib/capsters";
import type { LiveSalarySummary } from "@/lib/salary";

export type CapsterCommissionItem = {
  id: string;
  capsterId: string;
  name: string;
  noPegawai: string;
  avatarLetter: string;
  period: string; // e.g. "Mei 2025"
  transactionCount: number;
  serviceRevenue: number;
  commissionPercentage: number | null; // null if Belum Diatur
  statusCommission: "Diatur" | "Belum Diatur";
  totalCommission: number;
  paymentStatus: "Belum Dibayar" | "Sudah Dibayar" | "Diproses" | "Belum Diatur";
};

export type CommissionPaymentHistory = {
  id: string;
  paymentDate: string; // e.g. "15 Mei 2025 14:30"
  capsterName: string;
  capsterId: string;
  noPegawai: string;
  period: string; // e.g. "Mei 2025"
  serviceRevenue: number;
  commissionPercentage: number;
  commissionAmount: number;
  paidBy: string; // e.g. "Owner"
  status: "Sudah Dibayar";
  notes?: string;
};

export type CapsterBaseTransaction = {
  id: string;
  transactionNumber: string; // e.g. "TRX-001"
  dateTime: string; // e.g. "20 Mei 2025 10:24"
  customerName: string;
  serviceName: string;
  amount: number;
  paymentMethod: "Tunai" | "QRIS" | "Transfer";
  status: "Berhasil" | "Dibatalkan";
  paymentStatus: "Lunas" | "Batal";
  countedInCommission: boolean;
};

export type CommissionStoreState = {
  capsters: CapsterCommissionItem[];
  paymentHistory: CommissionPaymentHistory[];
  baseTransactions: Record<string, CapsterBaseTransaction[]>;
};

export const CURRENT_COMMISSION_PERIOD = getIndonesianMonthYear(0);
export const PREV_COMMISSION_PERIOD_1 = getIndonesianMonthYear(-1);
export const PREV_COMMISSION_PERIOD_2 = getIndonesianMonthYear(-2);

const STORAGE_KEY = "barberin_commission_store_v8";

const DEFAULT_CAPSTERS: CapsterCommissionItem[] = [];
const DEFAULT_PAYMENT_HISTORY: CommissionPaymentHistory[] = [];
const DEFAULT_BASE_TRANSACTIONS: Record<string, CapsterBaseTransaction[]> = {};

function loadInitialState(): CommissionStoreState {
  if (typeof window === "undefined") {
    return {
      capsters: DEFAULT_CAPSTERS,
      paymentHistory: DEFAULT_PAYMENT_HISTORY,
      baseTransactions: DEFAULT_BASE_TRANSACTIONS,
    };
  }

  try {
    localStorage.removeItem("barberin_commission_store_v5");
    localStorage.removeItem("barberin_commission_store_v6");
    localStorage.removeItem("barberin_commission_store_v7");
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.capsters)) {
        return {
          capsters: parsed.capsters,
          paymentHistory: Array.isArray(parsed.paymentHistory) ? parsed.paymentHistory : [],
          baseTransactions: parsed.baseTransactions || {},
        };
      }
    }
  } catch {
    // fallback
  }

  return {
    capsters: DEFAULT_CAPSTERS,
    paymentHistory: DEFAULT_PAYMENT_HISTORY,
    baseTransactions: DEFAULT_BASE_TRANSACTIONS,
  };
}

let currentState: CommissionStoreState = loadInitialState();
const listeners = new Set<() => void>();

function emitChange() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
    } catch (e) {
      console.warn("Gagal menyimpan commission store ke localStorage:", e);
    }
  }
  listeners.forEach((listener) => listener());
}

export const commissionActions = {
  resetStore: () => {
    currentState = {
      capsters: [],
      paymentHistory: [],
      baseTransactions: {},
    };
    emitChange();
  },

  // Sync with live database salary metrics (omset, transaction counts, period)
  syncWithLiveSalaryData: (liveData: LiveSalarySummary) => {
    if (!liveData) return;

    if (!liveData.capsters || liveData.capsters.length === 0) {
      currentState = {
        ...currentState,
        capsters: [],
        baseTransactions: {},
      };
      emitChange();
      return;
    }

    const existingMap = new Map<string, CapsterCommissionItem>();
    currentState.capsters.forEach((c) => {
      existingMap.set(c.name.toLowerCase(), c);
      existingMap.set(c.noPegawai.toLowerCase(), c);
      existingMap.set(c.capsterId.toLowerCase(), c);
      existingMap.set(c.id.toLowerCase(), c);
    });

    const updated: CapsterCommissionItem[] = liveData.capsters.map((lc) => {
      const found =
        existingMap.get(lc.name.toLowerCase()) ||
        existingMap.get(lc.noPegawai.toLowerCase()) ||
        existingMap.get(lc.capsterId.toLowerCase()) ||
        existingMap.get(lc.id.toLowerCase());

      const percent = found && found.commissionPercentage !== null
        ? found.commissionPercentage
        : (lc.noPegawai === "CAP-003" ? 10 : 15);

      const revenue = lc.serviceRevenue;
      const trxCount = lc.transactionCount;
      const totalCommission = percent !== null ? Math.round(revenue * (percent / 100)) : 0;

      return {
        id: lc.id,
        capsterId: lc.capsterId,
        name: lc.name,
        noPegawai: lc.noPegawai,
        avatarLetter: lc.avatarLetter,
        period: lc.period || liveData.periodLabel || "Bulan Ini",
        transactionCount: trxCount,
        serviceRevenue: revenue,
        commissionPercentage: percent,
        statusCommission: percent !== null ? "Diatur" : "Belum Diatur",
        totalCommission,
        paymentStatus:
          found && found.paymentStatus
            ? found.paymentStatus
            : "Belum Dibayar",
      };
    });

    currentState = {
      ...currentState,
      capsters: updated,
    };
    emitChange();
  },

  // Set live base transactions for a specific capster (detail view)
  setLiveBaseTransactions: (
    capsterId: string,
    transactions: CapsterBaseTransaction[],
  ) => {
    currentState = {
      ...currentState,
      baseTransactions: {
        ...currentState.baseTransactions,
        [capsterId]: transactions,
      },
    };
    emitChange();
  },

  // Sync with actual capsters from DB
  syncWithDatabaseCapsters: (dbCapsters: OwnerCapsterItem[]) => {
    if (!dbCapsters || dbCapsters.length === 0) {
      currentState = {
        ...currentState,
        capsters: [],
      };
      emitChange();
      return;
    }

    const existingMap = new Map<string, CapsterCommissionItem>();
    currentState.capsters.forEach((c) => {
      existingMap.set(c.name.toLowerCase(), c);
      existingMap.set(c.noPegawai.toLowerCase(), c);
      existingMap.set(c.capsterId.toLowerCase(), c);
    });

    const updated: CapsterCommissionItem[] = dbCapsters.map((dc, idx) => {
      const found =
        existingMap.get(dc.name.toLowerCase()) ||
        (dc.no_pegawai ? existingMap.get(dc.no_pegawai.toLowerCase()) : null) ||
        existingMap.get(dc.id_capster.toLowerCase());

      const percent = found ? found.commissionPercentage : 15;
      const revenue = dc.totalRevenue || 0;
      const trxCount = dc.totalTransactions || 0;
      const totalCommission = percent !== null ? Math.round(revenue * (percent / 100)) : 0;

      return {
        id: dc.id_capster,
        capsterId: dc.id_capster,
        name: dc.name,
        noPegawai: dc.no_pegawai || `CAP-00${idx + 1}`,
        avatarLetter: dc.name.charAt(0).toUpperCase() || "C",
        period: CURRENT_COMMISSION_PERIOD,
        transactionCount: trxCount,
        serviceRevenue: revenue,
        commissionPercentage: percent,
        statusCommission: percent !== null ? "Diatur" : "Belum Diatur",
        totalCommission,
        paymentStatus:
          found && found.paymentStatus !== "Diproses"
            ? found.paymentStatus
            : "Belum Dibayar",
      };
    });

    currentState = {
      ...currentState,
      capsters: updated,
    };
    emitChange();
  },

  // Update payment status for a capster (e.g. Belum Dibayar, Diproses, Sudah Dibayar)
  setPaymentStatus: (
    capsterId: string,
    status: "Belum Dibayar" | "Sudah Dibayar" | "Diproses" | "Belum Diatur",
  ) => {
    currentState = {
      ...currentState,
      capsters: currentState.capsters.map((c) => {
        if (
          c.capsterId === capsterId ||
          c.id === capsterId ||
          c.noPegawai === capsterId ||
          c.name.toLowerCase() === capsterId.toLowerCase()
        ) {
          return {
            ...c,
            paymentStatus: status,
          };
        }
        return c;
      }),
    };
    emitChange();
  },

  // Update commission percentage for a capster
  setCommissionPercentage: (capsterId: string, percentage: number) => {
    const validPercent = Math.max(0, Math.min(100, Math.round(percentage)));

    currentState = {
      ...currentState,
      capsters: currentState.capsters.map((c) => {
        if (
          c.capsterId === capsterId ||
          c.id === capsterId ||
          c.noPegawai === capsterId ||
          c.name.toLowerCase() === capsterId.toLowerCase()
        ) {
          const newTotal = Math.round(c.serviceRevenue * (validPercent / 100));
          const newStatusPayment =
            c.paymentStatus === "Belum Diatur" ? "Belum Dibayar" : c.paymentStatus;

          return {
            ...c,
            commissionPercentage: validPercent,
            statusCommission: "Diatur",
            totalCommission: newTotal,
            paymentStatus: newStatusPayment,
          };
        }
        return c;
      }),
    };
    emitChange();
  },

  // Pay commission to a capster
  payCommission: (
    capsterId: string,
    paymentDateStr?: string,
    notes?: string,
  ) => {
    const capster = currentState.capsters.find(
      (c) =>
        c.capsterId === capsterId ||
        c.id === capsterId ||
        c.noPegawai === capsterId ||
        c.name.toLowerCase() === capsterId.toLowerCase(),
    );

    if (!capster) return false;

    const now = new Date();
    const defaultDateStr =
      paymentDateStr ||
      `${now.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      })} ${now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}`;

    const newPaymentId = `PAY-${String(currentState.paymentHistory.length + 1).padStart(3, "0")}`;

    const newHistoryItem: CommissionPaymentHistory = {
      id: newPaymentId,
      paymentDate: defaultDateStr,
      capsterName: capster.name,
      capsterId: capster.capsterId,
      noPegawai: capster.noPegawai,
      period: capster.period,
      serviceRevenue: capster.serviceRevenue,
      commissionPercentage: capster.commissionPercentage || 0,
      commissionAmount: capster.totalCommission,
      paidBy: "Owner",
      status: "Sudah Dibayar",
      notes: notes || "Pembayaran komisi capster",
    };

    currentState = {
      ...currentState,
      capsters: currentState.capsters.map((c) => {
        if (
          c.capsterId === capsterId ||
          c.id === capsterId ||
          c.noPegawai === capsterId ||
          c.name.toLowerCase() === capsterId.toLowerCase()
        ) {
          return {
            ...c,
            paymentStatus: "Sudah Dibayar",
          };
        }
        return c;
      }),
      paymentHistory: [newHistoryItem, ...currentState.paymentHistory],
    };

    emitChange();
    return true;
  },

  // Reset store back to defaults
  resetToDefaults: () => {
    currentState = {
      capsters: DEFAULT_CAPSTERS,
      paymentHistory: DEFAULT_PAYMENT_HISTORY,
      baseTransactions: DEFAULT_BASE_TRANSACTIONS,
    };
    emitChange();
  },
};

const SERVER_SNAPSHOT: CommissionStoreState = {
  capsters: DEFAULT_CAPSTERS,
  paymentHistory: DEFAULT_PAYMENT_HISTORY,
  baseTransactions: DEFAULT_BASE_TRANSACTIONS,
};

export function useCommissionStore(): CommissionStoreState {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    () => currentState,
    () => SERVER_SNAPSHOT,
  );
}
