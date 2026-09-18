import { Link, useRouter } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Minus,
  Plus,
  Trash2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/format";
import {
  CAPSTER_STATUS_LABEL,
  useBarberin,
  type CartItem as CartItemType,
  type Capster,
} from "@/lib/barberin-store";

export const BarberinLogo = ({ className }: { className?: string }) => (
  <img
    src="/barberin-logo.png"
    alt="Logo BARBERIN"
    className={cn("h-8 w-8 object-contain", className)}
  />
);

export function MobileShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">{children}</div>
  );
}

export function BackButton({ to }: { to?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Kembali"
      onClick={() => (to ? router.navigate({ to }) : router.history.back())}
      className="glass-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] transition-colors active:bg-white/15"
    >
      <ArrowLeft className="h-5 w-5" strokeWidth={2} />
    </button>
  );
}

export function CustomerHeader({
  title,
  subtitle,
  backTo,
  showBack = true,
}: {
  title: string;
  subtitle?: string;
  backTo?: string;
  showBack?: boolean;
}) {
  return (
    <header className="glass-3 safe-top sticky top-0 z-20 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-x-0 border-t-0 px-4 pb-3">
      {showBack ? backTo ? <BackButton to={backTo} /> : <BackButton /> : <BarberinLogo />}
      <div className="min-w-0 text-center">
        <h1 className="truncate text-[18px] font-bold leading-tight">{title}</h1>
        {subtitle ? (
          <p className="truncate text-[12px] text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <div className="h-11 w-11 shrink-0" aria-hidden />
    </header>
  );
}

export function GlassCard({
  children,
  className,
  selected,
}: {
  children: ReactNode;
  className?: string;
  selected?: boolean;
}) {
  return (
    <div
      className={cn(
        "glass-1 rounded-[18px] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-all",
        selected && "border-primary-soft bg-primary/15 ring-1 ring-primary-soft/60",
        className,
      )}
    >
      {children}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean };

export function PrimaryButton({ className, children, loading, disabled, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        "inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[12px] bg-primary px-5 text-[15px] font-semibold text-primary-foreground shadow-[0_8px_24px_rgba(78,120,255,0.35)] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : null}
      {children}
    </button>
  );
}

export function SecondaryButton({ className, children, loading, disabled, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        "glass-2 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[12px] px-5 text-[15px] font-semibold text-foreground transition-all active:scale-[0.98] disabled:opacity-50",
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : null}
      {children}
    </button>
  );
}

export function BottomActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="glass-3 safe-bottom sticky bottom-0 z-20 mt-auto space-y-3 border-x-0 border-b-0 px-4 pt-4">
      {children}
    </div>
  );
}

type Tone = "info" | "success" | "warning" | "danger" | "neutral";

export function StatusBadge({
  tone = "neutral",
  icon: Icon,
  children,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  const tones: Record<Tone, string> = {
    info: "bg-info/15 text-info border-info/40",
    success: "bg-success/15 text-success border-success/40",
    warning: "bg-warning/15 text-warning border-warning/40",
    danger: "bg-danger/15 text-danger border-danger/40",
    neutral: "bg-white/10 text-muted-foreground border-white/20",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold",
        tones[tone],
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" strokeWidth={2} /> : null}
      {children}
    </span>
  );
}

export function QuantityControl({
  quantity,
  onDecrease,
  onIncrease,
  label,
}: {
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  label: string;
}) {
  return (
    <div className="glass-2 flex items-center gap-1 rounded-[12px] p-1">
      <button
        type="button"
        aria-label={`Kurangi jumlah ${label}`}
        onClick={onDecrease}
        className="flex h-9 w-9 items-center justify-center rounded-[10px] transition-colors active:bg-white/20"
      >
        <Minus className="h-4 w-4" strokeWidth={2} />
      </button>
      <span aria-live="polite" className="min-w-8 text-center text-[15px] font-semibold">
        {quantity}
      </span>
      <button
        type="button"
        aria-label={`Tambah jumlah ${label}`}
        onClick={onIncrease}
        className="flex h-9 w-9 items-center justify-center rounded-[10px] transition-colors active:bg-white/20"
      >
        <Plus className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}

export function CartItem({
  item,
  onDecrease,
  onIncrease,
  onRemove,
}: {
  item: CartItemType;
  onDecrease: () => void;
  onIncrease: () => void;
  onRemove: () => void;
}) {
  return (
    <GlassCard>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-snug">{item.service.name}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {formatRupiah(item.service.price)} × {item.quantity}
          </p>
        </div>
        <button
          type="button"
          aria-label={`Hapus ${item.service.name}`}
          onClick={onRemove}
          className="flex h-11 w-11 items-center justify-center rounded-[12px] text-danger transition-colors active:bg-danger/15"
        >
          <Trash2 className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <QuantityControl
          quantity={item.quantity}
          onDecrease={onDecrease}
          onIncrease={onIncrease}
          label={item.service.name}
        />
        <span className="text-[15px] font-bold">
          {formatRupiah(item.service.price * item.quantity)}
        </span>
      </div>
    </GlassCard>
  );
}

export function PriceSummary({ items, total }: { items: CartItemType[]; total: number }) {
  return (
    <GlassCard className="space-y-2">
      <h2 className="text-[15px] font-semibold">Ringkasan Pembayaran</h2>
      {items.map((i) => (
        <div key={i.service.id} className="flex justify-between gap-3 text-[13px]">
          <span className="min-w-0 truncate text-muted-foreground">
            {i.service.name} ({i.quantity}x)
          </span>
          <span className="shrink-0">{formatRupiah(i.service.price * i.quantity)}</span>
        </div>
      ))}
      <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-3">
        <span className="text-[14px] font-semibold">Total Pembayaran</span>
        <span className="text-[18px] font-bold text-primary-soft">{formatRupiah(total)}</span>
      </div>
    </GlassCard>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="glass-2 mb-4 flex h-16 w-16 items-center justify-center rounded-full">
        <Icon className="h-7 w-7 text-primary-soft" strokeWidth={2} />
      </div>
      <p className="text-[16px] font-semibold">{title}</p>
      {description ? (
        <p className="mt-2 text-[14px] text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-6 w-full max-w-[260px]">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ message = "Memuat..." }: { message?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center"
    >
      <Loader2 className="h-7 w-7 animate-spin text-primary-soft" strokeWidth={2} />
      <p className="text-[14px] text-muted-foreground">{message}</p>
    </div>
  );
}

export function SkeletonCard() {
  return <div className="h-[104px] animate-pulse rounded-[18px] bg-white/8" />;
}

export function ErrorState({
  title = "Terjadi kesalahan",
  message = "Silakan coba lagi.",
  action,
}: {
  title?: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-danger/15">
        <AlertCircle className="h-7 w-7 text-danger" strokeWidth={2} />
      </div>
      <p className="text-[16px] font-semibold">{title}</p>
      <p className="mt-2 text-[14px] text-muted-foreground">{message}</p>
      {action ? <div className="mt-6 w-full max-w-[260px]">{action}</div> : null}
    </div>
  );
}

export function SuccessState({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col items-center px-6 pt-10 text-center">
      <div className="flex h-20 w-20 animate-in fade-in zoom-in items-center justify-center rounded-full bg-success/15 ring-1 ring-success/40">
        <CheckCircle2 className="h-10 w-10 text-success" strokeWidth={2} />
      </div>
      <h2 className="mt-5 text-[22px] font-bold">{title}</h2>
      <p className="mt-2 text-[14px] text-muted-foreground">{message}</p>
    </div>
  );
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-[14px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right font-semibold">{value}</span>
    </div>
  );
}

export function StepBrand() {
  const { shopSlug } = useBarberin();
  const slug =
    shopSlug ||
    (typeof window !== "undefined"
      ? window.location.pathname.split("/").filter(Boolean)[0]
      : "");
  const target =
    slug &&
    slug !== "customer" &&
    slug !== "owner" &&
    slug !== "capster" &&
    slug !== "superadmin"
      ? `/${slug}/customer/services`
      : "/";

  return (
    <Link to={target as any} className="flex items-center justify-center gap-2 py-4">
      <BarberinLogo className="h-7 w-7" />
      <span className="text-[15px] font-bold tracking-wide">BARBERIN</span>
    </Link>
  );
}

export { Check, Clock };

export function CapsterAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "glass-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-primary-soft",
        className,
      )}
    >
      {name.trim().charAt(0).toUpperCase() || <UserRound className="h-5 w-5" strokeWidth={2} />}
    </div>
  );
}

export function CapsterStatusBadge({ status }: { status: Capster["status"] }) {
  const tone = status === "AVAILABLE" ? "success" : status === "BUSY" ? "warning" : "neutral";
  const icon = status === "AVAILABLE" ? CheckCircle2 : status === "BUSY" ? Clock : AlertCircle;
  return (
    <StatusBadge tone={tone} icon={icon}>
      {CAPSTER_STATUS_LABEL[status]}
    </StatusBadge>
  );
}

export function CapsterCard({
  capster,
  selected,
  onSelect,
}: {
  capster: Capster;
  selected: boolean;
  onSelect: () => void;
}) {
  const disabled = capster.status !== "AVAILABLE";
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`Pilih capster ${capster.name}, ${CAPSTER_STATUS_LABEL[capster.status]}`}
      onClick={onSelect}
      className={cn(
        "w-full text-left transition-all active:scale-[0.99]",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <GlassCard selected={selected}>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <CapsterAvatar name={capster.name} />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-snug">{capster.name}</p>
            <p className="truncate text-[13px] text-muted-foreground">{capster.role}</p>
            <span className="mt-2 inline-flex">
              <CapsterStatusBadge status={capster.status} />
            </span>
          </div>
          {selected ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success/20 text-success ring-1 ring-success/40">
              <Check className="h-4 w-4" strokeWidth={2} />
            </span>
          ) : (
            <span className="h-8 w-8" aria-hidden />
          )}
        </div>
      </GlassCard>
    </button>
  );
}

export function SelectedCapsterCard({
  capster,
  action,
}: {
  capster: Capster;
  action?: ReactNode;
}) {
  return (
    <GlassCard className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold">Capster</h2>
        {action}
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
        <CapsterAvatar name={capster.name} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{capster.name}</p>
          <p className="truncate text-[13px] text-muted-foreground">{capster.role}</p>
          <span className="mt-2 inline-flex">
            <CapsterStatusBadge status={capster.status} />
          </span>
        </div>
      </div>
    </GlassCard>
  );
}
