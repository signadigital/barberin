import { useSyncExternalStore } from "react";

export type Service = {
  id: string;
  name: string;
  description: string;
  price: number;
};

export type CartItem = {
  service: Service;
  quantity: number;
};

export type CapsterStatus = "AVAILABLE" | "BUSY" | "OFFLINE";

export type Capster = {
  id: string;
  name: string;
  role: string;
  status: CapsterStatus;
};

export const CAPSTERS: Capster[] = [
  { id: "CAP001", name: "Budi", role: "Senior Barber", status: "AVAILABLE" },
  { id: "CAP002", name: "Andi", role: "Barber", status: "AVAILABLE" },
];

export const CAPSTER_STATUS_LABEL: Record<CapsterStatus, string> = {
  AVAILABLE: "Tersedia",
  BUSY: "Sedang Melayani",
  OFFLINE: "Tidak Tersedia",
};

export type PaymentMethodId = "tunai" | "qris" | "transfer";

export type TransactionStatus = "IDLE" | "PENDING" | "WAITING_CONFIRMATION" | "SUCCESS";
export type ServiceExecutionStatus =
  | "MENUNGGU"
  | "DIKERJAKAN"
  | "HAMPIR_SELESAI"
  | "DISELESAIKAN";
export type PaymentConfirmationStatus = "MENUNGGU" | "DIKONFIRMASI";

export type ReceiptData = {
  transactionId: string;
  customerId: string;
  customerName: string;
  createdAt: string;
  items: CartItem[];
  total: number;
  paymentMethod: PaymentMethodId;
  capster: Capster | null;
  status: "Berhasil";
};

export const SERVICES: Service[] = [
  {
    id: "haircut",
    name: "Haircut / Potong Rambut",
    description: "Potong rambut rapi oleh capster berpengalaman.",
    price: 30000,
  },
  {
    id: "hair-wash",
    name: "Hair Wash / Keramas",
    description: "Cuci rambut dengan shampo premium dan pijat kepala.",
    price: 20000,
  },
  {
    id: "shaving",
    name: "Shaving / Cukur Kumis & Jenggot",
    description: "Merapikan kumis dan jenggot dengan pisau steril.",
    price: 15000,
  },
];

export const PAYMENT_METHODS: { id: PaymentMethodId; name: string; description: string }[] = [
  { id: "tunai", name: "Tunai", description: "Bayar langsung di kasir barbershop." },
  { id: "qris", name: "QRIS", description: "Scan kode QRIS dari aplikasi pembayaran Anda." },
  { id: "transfer", name: "Transfer Bank", description: "Transfer ke rekening barbershop." },
];

export function paymentMethodName(id: PaymentMethodId | null): string {
  return PAYMENT_METHODS.find((m) => m.id === id)?.name ?? "-";
}

export type BarberinState = {
  shopSlug: string | null;
  shopId: string | null;
  cartItems: CartItem[];
  selectedCapster: Capster | null;
  customerName: string;
  customerId: string | null;
  paymentMethod: PaymentMethodId | null;
  transactionId: string | null;
  transactionStatus: TransactionStatus;
  serviceExecutionStatus: ServiceExecutionStatus;
  paymentConfirmationStatus: PaymentConfirmationStatus;
  receiptData: ReceiptData | null;
};

const initialState: BarberinState = {
  shopSlug: null,
  shopId: null,
  cartItems: [],
  selectedCapster: null,
  customerName: "",
  customerId: null,
  paymentMethod: null,
  transactionId: null,
  transactionStatus: "IDLE",
  serviceExecutionStatus: "MENUNGGU",
  paymentConfirmationStatus: "MENUNGGU",
  receiptData: null,
};

function getCustomerStorageKey(shopSlugOrId?: string | null): string {
  if (shopSlugOrId) {
    return `barberin_customer_state_${shopSlugOrId}`;
  }
  return "barberin-customer-state";
}

let state: BarberinState = initialState;
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    const key = getCustomerStorageKey(state.shopSlug || state.shopId);
    window.sessionStorage.setItem(key, JSON.stringify(state));
    window.sessionStorage.setItem("barberin-customer-state", JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

let hydrated = false;
function hydrate(targetSlugOrId?: string | null) {
  if (typeof window === "undefined") return;
  if (hydrated && !targetSlugOrId) return;
  hydrated = true;
  try {
    const key = getCustomerStorageKey(targetSlugOrId || state.shopSlug || state.shopId);
    const raw = window.sessionStorage.getItem(key);
    if (raw) {
      state = { ...initialState, ...(JSON.parse(raw) as BarberinState) };
    }
  } catch {
    /* ignore */
  }
}

function setState(patch: Partial<BarberinState>) {
  state = { ...state, ...patch };
  persist();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  hydrate();
  listeners.add(listener);
  listener();
  return () => listeners.delete(listener);
}

export function useBarberin(): BarberinState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => initialState,
  );
}

export const cartTotal = (items: CartItem[]) =>
  items.reduce((sum, i) => sum + i.service.price * i.quantity, 0);

export const cartCount = (items: CartItem[]) => items.reduce((sum, i) => sum + i.quantity, 0);

export const actions = {
  setShop(slug: string | null, shopId: string | null) {
    if (state.shopSlug !== slug || state.shopId !== shopId) {
      if (typeof window !== "undefined") {
        const key = getCustomerStorageKey(slug || shopId);
        const saved = window.sessionStorage.getItem(key);
        if (saved) {
          try {
            state = { ...initialState, ...(JSON.parse(saved) as BarberinState), shopSlug: slug, shopId };
            persist();
            listeners.forEach((l) => l());
            return;
          } catch {}
        }
      }
      setState({ shopSlug: slug, shopId, cartItems: [], selectedCapster: null });
    } else {
      setState({ shopSlug: slug, shopId });
    }
  },
  addService(service: Service) {
    const existing = state.cartItems.find((i) => i.service.id === service.id);
    if (existing) {
      actions.setQuantity(service.id, existing.quantity + 1);
      return;
    }
    setState({ cartItems: [...state.cartItems, { service, quantity: 1 }] });
  },
  removeService(serviceId: string) {
    setState({ cartItems: state.cartItems.filter((i) => i.service.id !== serviceId) });
  },
  toggleService(service: Service) {
    const exists = state.cartItems.some((i) => i.service.id === service.id);
    if (exists) actions.removeService(service.id);
    else actions.addService(service);
  },
  setQuantity(serviceId: string, quantity: number) {
    if (quantity < 1) {
      actions.removeService(serviceId);
      return;
    }
    setState({
      cartItems: state.cartItems.map((i) =>
        i.service.id === serviceId ? { ...i, quantity } : i,
      ),
    });
  },
  setCapster(capster: Capster | null) {
    setState({ selectedCapster: capster });
  },
  setCustomer(name: string, customerId: string) {
    setState({ customerName: name, customerId });
  },
  setPaymentMethod(method: PaymentMethodId) {
    setState({ paymentMethod: method });
  },
  createTransaction(transactionId: string) {
    setState({
      transactionId,
      transactionStatus: "PENDING",
      serviceExecutionStatus: "MENUNGGU",
      paymentConfirmationStatus: "MENUNGGU",
    });
  },
  setServiceExecutionStatus(status: ServiceExecutionStatus) {
    setState({ serviceExecutionStatus: status });
  },
  setPaymentConfirmationStatus(status: PaymentConfirmationStatus) {
    setState({ paymentConfirmationStatus: status });
  },
  startWaitingConfirmation() {
    setState({ transactionStatus: "WAITING_CONFIRMATION" });
  },
  confirmPayment() {
    const receiptData: ReceiptData = {
      transactionId: state.transactionId ?? generateTransactionId(),
      customerId: state.customerId ?? "-",
      customerName: state.customerName,
      createdAt: new Date().toISOString(),
      items: state.cartItems,
      total: cartTotal(state.cartItems),
      paymentMethod: state.paymentMethod ?? "tunai",
      capster: state.selectedCapster,
      status: "Berhasil",
    };
    setState({
      transactionStatus: "SUCCESS",
      paymentConfirmationStatus: "DIKONFIRMASI",
      receiptData,
    });
  },
  reset() {
    state = { ...initialState };
    persist();
    listeners.forEach((l) => l());
  },
};

function seq(): string {
  const n = Math.floor(Math.random() * 9000) + 1000;
  return String(n);
}

function yymm(): string {
  const d = new Date();
  return (
    String(d.getFullYear()).slice(-2) +
    String(d.getMonth() + 1).padStart(2, "0")
  );
}

export function generateCustomerId(): string {
  return `PLG-${yymm()}-${seq()}`;
}

export function generateTransactionId(): string {
  return `TRX-${yymm()}-${seq()}`;
}

