import { useSyncExternalStore } from "react";
import { CAPSTERS, type Capster } from "@/lib/barberin-store";

export { CAPSTERS, type Capster };

export type CapsterService = {
  id: string;
  name: string;
  price: number;
  category: string;
};

export const CAPSTER_SERVICES: CapsterService[] = [
  { id: "haircut", name: "Haircut", price: 30000, category: "Potong Rambut" },
  { id: "hair-wash", name: "Hair Wash", price: 20000, category: "Perawatan" },
  { id: "styling", name: "Styling", price: 25000, category: "Tata Rambut" },
  { id: "shaving", name: "Shaving", price: 15000, category: "Cukur" },
  { id: "hair-coloring", name: "Hair Coloring", price: 60000, category: "Pewarnaan" },
  { id: "beard-trim", name: "Beard Trim", price: 15000, category: "Cukur" },
  { id: "kids-haircut", name: "Kids Haircut", price: 25000, category: "Potong Rambut" },
];

export type TransactionStatus = "Selesai" | "Menunggu" | "Batal";
export type PaymentMethod = "tunai" | "qris" | "transfer";

export type CapsterTransaction = {
  id: string;
  date: string;
  time: string;
  customerName: string;
  customerId?: string | undefined;
  customerPhone?: string | undefined;
  notes?: string | undefined;
  items: { service: CapsterService; quantity: number }[];
  serviceNames: string;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  cashReceived?: number | undefined;
  change?: number | undefined;
  status: TransactionStatus;
  capsterId?: string | undefined;
  capsterName: string;
};

export type ShiftInfo = {
  date: string;
  day: string;
  startTime: string;
  endTime: string;
  isCheckedIn: boolean;
  checkedInAt: string | null;
  hasOtherCheckedIn: boolean;
  isShiftEnded: boolean;
};

export type DashboardMetrics = {
  totalTransaksi: number;
  deltaTransaksi: string;
  totalPendapatan: number;
  deltaPendapatan: string;
  totalLayanan: number;
  deltaLayanan: string;
  capsterAktif: number;
  deltaCapster: string;
  statusLayanan: {
    selesai: number;
    sedangDikerjakan: number;
    menunggu: number;
    dibatalkan: number;
  };
  ringkasanHariIni: {
    totalPendapatan: number;
    totalTransaksi: number;
    totalLayanan: number;
    selesai: number;
    belumSelesai: number;
  };
};

export type ManualTransactionDraft = {
  capsterId: string | null;
  capsterName: string;
  capsterRole: string;
  selectedServiceIds: string[];
  selectedServices: CapsterService[];
  customerName: string;
  customerPhone: string;
  notes: string;
  paymentMethod: PaymentMethod | null;
  cashReceived: number;
  status: "DRAFT";
};

export type CapsterState = {
  isLoggedIn: boolean;
  userId: string | null;
  capsterId: string | null;
  barbershopId: string | null;
  barbershopSlug: string | null;
  shiftId: string | null;
  capsterName: string;
  capsterRole: string;
  shiftInfo: ShiftInfo;
  dashboardMetrics: DashboardMetrics;
  transactions: CapsterTransaction[];
  manualDraft: ManualTransactionDraft;
  lastCreatedTransaction: CapsterTransaction | null;
};

export const EMPTY_METRICS: DashboardMetrics = {
  totalTransaksi: 0,
  deltaTransaksi: "Hari ini",
  totalPendapatan: 0,
  deltaPendapatan: "Hari ini",
  totalLayanan: 0,
  deltaLayanan: "Hari ini",
  capsterAktif: 0,
  deltaCapster: "Aktif",
  statusLayanan: {
    selesai: 0,
    sedangDikerjakan: 0,
    menunggu: 0,
    dibatalkan: 0,
  },
  ringkasanHariIni: {
    totalPendapatan: 0,
    totalTransaksi: 0,
    totalLayanan: 0,
    selesai: 0,
    belumSelesai: 0,
  },
};

const INITIAL_METRICS: DashboardMetrics = EMPTY_METRICS;

const INITIAL_TRANSACTIONS: CapsterTransaction[] = [];

export function getTodayShiftDate() {
  const now = new Date();
  return {
    date: now.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    }),
    day: now.toLocaleDateString("id-ID", {
      weekday: "long",
      timeZone: "Asia/Jakarta",
    }),
  };
}

const todayShift = getTodayShiftDate();

const initialCapsterState: CapsterState = {
  isLoggedIn: false,
  userId: null,
  capsterId: null,
  barbershopId: null,
  barbershopSlug: null,
  shiftId: null,
  capsterName: "",
  capsterRole: "",
  shiftInfo: {
    date: todayShift.date,
    day: todayShift.day,
    startTime: "08:00 WIB",
    endTime: "17:00 WIB",
    isCheckedIn: false,
    checkedInAt: null,
    hasOtherCheckedIn: false,
    isShiftEnded: false,
  },
  dashboardMetrics: EMPTY_METRICS,
  transactions: [],
  manualDraft: {
    capsterId: null,
    capsterName: "",
    capsterRole: "",
    selectedServiceIds: [],
    selectedServices: [],
    customerName: "",
    customerPhone: "",
    notes: "",
    paymentMethod: "tunai",
    cashReceived: 0,
    status: "DRAFT",
  },
  lastCreatedTransaction: null,
};

const CAPSTER_LOCAL_KEY = "barberin_capster_state_v1";
const CAPSTER_STORAGE_KEY = "barberin-capster-state";
const COOKIE_KEY = "barberin_capster_logged_in";

export function getCapsterAuth(barbershopSlug?: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw =
      localStorage.getItem(CAPSTER_LOCAL_KEY) ||
      sessionStorage.getItem(CAPSTER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.isLoggedIn) return false;
      if (barbershopSlug) {
        const matchesSlug = parsed.barbershopSlug === barbershopSlug;
        const matchesId = parsed.barbershopId === barbershopSlug;
        if (!matchesSlug && !matchesId) return false;
      }
      return true;
    }
  } catch {}
  return false;
}

function loadInitialState(): CapsterState {
  if (typeof window === "undefined") return initialCapsterState;
  try {
    const raw =
      localStorage.getItem(CAPSTER_LOCAL_KEY) ||
      sessionStorage.getItem(CAPSTER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CapsterState;
      const today = getTodayShiftDate();
      return {
        ...initialCapsterState,
        ...parsed,
        shiftInfo: {
          ...initialCapsterState.shiftInfo,
          ...(parsed.shiftInfo || {}),
          date: today.date,
          day: today.day,
        },
      };
    }
  } catch {}
  return initialCapsterState;
}

let state: CapsterState = loadInitialState();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    if (state.isLoggedIn) {
      const serialized = JSON.stringify(state);
      localStorage.setItem(CAPSTER_LOCAL_KEY, serialized);
      sessionStorage.setItem(CAPSTER_STORAGE_KEY, serialized);
      if (state.barbershopId && state.capsterId) {
        localStorage.setItem(
          `barberin_capster_state_${state.barbershopId}_${state.capsterId}`,
          serialized,
        );
      }
      document.cookie = `${COOKIE_KEY}=1; path=/; max-age=2592000; SameSite=Lax`;
    } else {
      if (state.barbershopId && state.capsterId) {
        localStorage.removeItem(
          `barberin_capster_state_${state.barbershopId}_${state.capsterId}`,
        );
      }
      localStorage.removeItem(CAPSTER_LOCAL_KEY);
      sessionStorage.removeItem(CAPSTER_STORAGE_KEY);
      document.cookie = `${COOKIE_KEY}=; path=/; max-age=0; SameSite=Lax`;
    }
  } catch {
    /* ignore */
  }
}

function hydrate() {
  if (typeof window === "undefined") return;
  try {
    const raw =
      localStorage.getItem(CAPSTER_LOCAL_KEY) ||
      sessionStorage.getItem(CAPSTER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CapsterState;
      const today = getTodayShiftDate();
      state = {
        ...initialCapsterState,
        ...parsed,
        shiftInfo: {
          ...initialCapsterState.shiftInfo,
          ...(parsed.shiftInfo || {}),
          date: today.date,
          day: today.day,
        },
      };
    }
  } catch {
    /* ignore */
  }
}

function setState(patch: Partial<CapsterState>) {
  state = { ...state, ...patch };
  persist();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCapster(): CapsterState {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (!state.isLoggedIn && typeof window !== "undefined" && getCapsterAuth()) {
        state = loadInitialState();
      }
      return state;
    },
    () => initialCapsterState,
  );
}

export const capsterActions = {
  login(
    payload:
      | string
      | {
          id?: string;
          userId?: string;
          name: string;
          role?: string;
          barbershopId?: string;
          barbershopSlug?: string;
          shiftId?: string;
        },
  ) {
    if (typeof payload === "string") {
      setState({
        isLoggedIn: true,
        capsterName: payload,
        dashboardMetrics: EMPTY_METRICS,
        transactions: [],
      });
    } else {
      const isSwitchingCapster =
        Boolean(payload.id && state.capsterId && payload.id !== state.capsterId);
      setState({
        isLoggedIn: true,
        capsterName: payload.name,
        capsterRole: payload.role ?? state.capsterRole,
        capsterId: payload.id ?? state.capsterId,
        userId: payload.userId ?? state.userId,
        barbershopId: payload.barbershopId ?? state.barbershopId,
        barbershopSlug: payload.barbershopSlug ?? state.barbershopSlug,
        shiftId: payload.shiftId ?? null,
        shiftInfo: {
          ...initialCapsterState.shiftInfo,
          isCheckedIn: Boolean(payload.shiftId),
          checkedInAt: payload.shiftId ? new Date().toLocaleTimeString("id-ID") : null,
          isShiftEnded: false,
        },
        dashboardMetrics: EMPTY_METRICS,
        transactions: [],
        manualDraft: {
          ...initialCapsterState.manualDraft,
          capsterId: payload.id ?? state.capsterId,
          capsterName: payload.name,
          capsterRole: payload.role ?? state.capsterRole,
        },
      });
    }
  },

  logout() {
    state = {
      ...initialCapsterState,
    };
    persist();
    listeners.forEach((l) => l());
  },

  setDashboardMetrics(metrics: DashboardMetrics) {
    setState({ dashboardMetrics: metrics });
  },

  setTransactions(transactions: CapsterTransaction[]) {
    setState({ transactions });
  },

  setShiftId(shiftId: string | null) {
    setState({ shiftId });
  },

  checkIn(shiftId?: string) {
    setState({
      shiftId: shiftId ?? state.shiftId,
      shiftInfo: {
        ...state.shiftInfo,
        isCheckedIn: true,
        checkedInAt:
          new Date().toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Jakarta",
          }) + " WIB",
        isShiftEnded: false,
      },
    });
  },

  endShift() {
    setState({
      shiftId: null,
      shiftInfo: {
        ...state.shiftInfo,
        isCheckedIn: false,
        isShiftEnded: true,
      },
    });
  },

  resetDailyData() {
    setState({
      shiftId: null,
      shiftInfo: {
        ...state.shiftInfo,
        isCheckedIn: false,
        isShiftEnded: false,
        checkedInAt: null,
      },
    });
  },

  initManualDraft() {
    setState({
      manualDraft: {
        capsterId: null,
        capsterName: "",
        capsterRole: "",
        selectedServiceIds: [],
        selectedServices: [],
        customerName: "",
        customerPhone: "",
        notes: "",
        paymentMethod: "tunai",
        cashReceived: 0,
        status: "DRAFT",
      },
    });
  },

  setManualCapster(capster: Capster) {
    setState({
      manualDraft: {
        ...state.manualDraft,
        capsterId: capster.id,
        capsterName: capster.name,
        capsterRole: capster.role,
      },
    });
  },

  toggleManualService(serviceOrId: string | CapsterService) {
    const serviceId = typeof serviceOrId === "string" ? serviceOrId : serviceOrId.id;
    const currentIds = state.manualDraft.selectedServiceIds;
    const currentServices = state.manualDraft.selectedServices ?? [];
    const exists = currentIds.includes(serviceId);

    const updatedIds = exists
      ? currentIds.filter((id) => id !== serviceId)
      : [...currentIds, serviceId];

    let updatedServices: CapsterService[];
    if (exists) {
      updatedServices = currentServices.filter((s) => s.id !== serviceId);
    } else {
      if (typeof serviceOrId !== "string") {
        updatedServices = [...currentServices, serviceOrId];
      } else {
        const found = CAPSTER_SERVICES.find((s) => s.id === serviceId);
        updatedServices = found ? [...currentServices, found] : currentServices;
      }
    }

    setState({
      manualDraft: {
        ...state.manualDraft,
        selectedServiceIds: updatedIds,
        selectedServices: updatedServices,
      },
    });
  },

  setSelectedServices(services: CapsterService[]) {
    setState({
      manualDraft: {
        ...state.manualDraft,
        selectedServices: services,
        selectedServiceIds: services.map((s) => s.id),
      },
    });
  },

  setManualCustomerData(data: { name?: string; phone?: string; notes?: string }) {
    setState({
      manualDraft: {
        ...state.manualDraft,
        customerName: data.name ?? state.manualDraft.customerName,
        customerPhone: data.phone ?? state.manualDraft.customerPhone,
        notes: data.notes ?? state.manualDraft.notes,
      },
    });
  },

  setManualPaymentMethod(method: PaymentMethod) {
    setState({
      manualDraft: {
        ...state.manualDraft,
        paymentMethod: method,
      },
    });
  },

  setManualCashReceived(amount: number) {
    setState({
      manualDraft: {
        ...state.manualDraft,
        cashReceived: amount,
      },
    });
  },

  setLastCreatedTransaction(trx: CapsterTransaction) {
    setState({
      lastCreatedTransaction: trx,
      transactions: [trx, ...state.transactions.filter((t) => t.id !== trx.id)],
    });
  },

  clearManualDraft() {
    setState({
      manualDraft: {
        capsterId: null,
        capsterName: "",
        capsterRole: "",
        selectedServiceIds: [],
        selectedServices: [],
        customerName: "",
        customerPhone: "",
        notes: "",
        paymentMethod: "tunai",
        cashReceived: 0,
        status: "DRAFT",
      },
    });
  },

  commitManualTransaction(): CapsterTransaction {
    const selectedServices =
      state.manualDraft.selectedServices && state.manualDraft.selectedServices.length > 0
        ? state.manualDraft.selectedServices
        : state.manualDraft.selectedServiceIds
            .map((id) => CAPSTER_SERVICES.find((s) => s.id === id))
            .filter((s): s is CapsterService => Boolean(s));

    const total = selectedServices.reduce((sum, s) => sum + s.price, 0);
    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const seq = String(state.transactions.length + 1).padStart(4, "0");
    const trxId = `TRX-${ymd}-${seq}`;
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const items = selectedServices.map((service) => ({ service, quantity: 1 }));
    const serviceNames = selectedServices.map((s) => s.name).join(" + ");

    const cashReceived =
      state.manualDraft.paymentMethod === "tunai"
        ? state.manualDraft.cashReceived > 0
          ? state.manualDraft.cashReceived
          : total
        : total;
    const change = Math.max(0, cashReceived - total);

    const capsterName = state.manualDraft.capsterName || state.capsterName || "Budi";
    const capsterId = state.manualDraft.capsterId ?? "CAP001";

    const newTrx: CapsterTransaction = {
      id: trxId,
      date: state.shiftInfo.date,
      time: timeStr,
      customerName: state.manualDraft.customerName.trim() || "Pelanggan Umum",
      ...(state.manualDraft.customerPhone.trim()
        ? { customerPhone: state.manualDraft.customerPhone.trim() }
        : {}),
      ...(state.manualDraft.notes.trim() ? { notes: state.manualDraft.notes.trim() } : {}),
      items,
      serviceNames,
      subtotal: total,
      discount: 0,
      total,
      paymentMethod: state.manualDraft.paymentMethod ?? "tunai",
      cashReceived,
      change,
      status: "Selesai",
      capsterId,
      capsterName,
    };

    const updatedTransactions = [newTrx, ...state.transactions];

    const newMetrics: DashboardMetrics = {
      ...state.dashboardMetrics,
      totalTransaksi: state.dashboardMetrics.totalTransaksi + 1,
      totalPendapatan: state.dashboardMetrics.totalPendapatan + total,
      totalLayanan: state.dashboardMetrics.totalLayanan + selectedServices.length,
      statusLayanan: {
        ...state.dashboardMetrics.statusLayanan,
        selesai: state.dashboardMetrics.statusLayanan.selesai + 1,
      },
      ringkasanHariIni: {
        ...state.dashboardMetrics.ringkasanHariIni,
        totalTransaksi: state.dashboardMetrics.ringkasanHariIni.totalTransaksi + 1,
        totalPendapatan: state.dashboardMetrics.ringkasanHariIni.totalPendapatan + total,
        totalLayanan:
          state.dashboardMetrics.ringkasanHariIni.totalLayanan + selectedServices.length,
        selesai: state.dashboardMetrics.ringkasanHariIni.selesai + 1,
      },
    };

    setState({
      transactions: updatedTransactions,
      dashboardMetrics: newMetrics,
      lastCreatedTransaction: newTrx,
      manualDraft: {
        capsterId: null,
        capsterName: "",
        capsterRole: "",
        selectedServiceIds: [],
        selectedServices: [],
        customerName: "",
        customerPhone: "",
        notes: "",
        paymentMethod: "tunai",
        cashReceived: 0,
        status: "DRAFT",
      },
    });

    return newTrx;
  },
};
