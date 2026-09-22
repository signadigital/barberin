import { createFileRoute, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import {
  MobileShell,
  PrimaryButton,
  SkeletonCard,
} from "@/components/barberin/ui";
import {
  CapsterAuthGuard,
  CapsterBottomNav,
  CapsterHeader,
  CapsterTransactionCard,
} from "@/components/capster/ui";
import {
  capsterActions,
  useCapster,
  type CapsterTransaction,
} from "@/lib/capster-store";
import { getCapsterTransactions } from "@/lib/capster-transactions";

export const Route = createFileRoute("/$barbershopSlug/capster/transactions")({
  head: () => ({
    meta: [
      { title: "Daftar Transaksi — BARBERIN Capster" },
      {
        name: "description",
        content: "Daftar seluruh transaksi yang ditangani Capster.",
      },
    ],
  }),
  component: CapsterTransactionsPage,
});

function CapsterTransactionsPage() {
  const { barbershopSlug } = (Route as any).useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { transactions, capsterId } = useCapster();
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<
    "Semua" | "Selesai" | "Menunggu" | "Batal"
  >("Semua");

  useEffect(() => {
    if (!capsterId) {
      setLoading(false);
      return;
    }
    let mounted = true;

    const fetchTransactions = async (isInitial = false) => {
      if (isInitial) setLoading(true);
      try {
        const data = await getCapsterTransactions({ data: { capsterId } });
        if (!mounted) return;
        capsterActions.setTransactions(data as CapsterTransaction[]);
      } catch (err) {
        console.error("Gagal memuat transaksi:", err);
      } finally {
        if (mounted && isInitial) setLoading(false);
      }
    };

    fetchTransactions(true);
    const intervalId = setInterval(() => {
      fetchTransactions(false);
    }, 8000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [capsterId]);

  const currentPath = location.pathname.replace(/\/$/, "");
  const targetPath = `/${barbershopSlug}/capster/transactions`;

  if (currentPath !== targetPath) {
    return <Outlet />;
  }

  const capsterTransactions = transactions.filter(
    (t) => !capsterId || !t.capsterId || t.capsterId === capsterId,
  );

  const filtered = capsterTransactions.filter((t) => {
    const matchSearch =
      t.id.toLowerCase().includes(search.toLowerCase()) ||
      t.customerName.toLowerCase().includes(search.toLowerCase()) ||
      t.serviceNames.toLowerCase().includes(search.toLowerCase());

    if (!matchSearch) return false;
    if (activeFilter === "Semua") return true;
    return t.status === activeFilter;
  });

  return (
    <CapsterAuthGuard>
      <MobileShell>
      <CapsterHeader
        title="Daftar Transaksi"
        backTo={`/${barbershopSlug}/capster/dashboard`}
        showBack={true}
        showActions={true}
      />

      <main className="flex-1 space-y-4 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+160px)] pt-3">
        {/* Search Bar */}
        <div className="relative flex items-center">
          <span className="absolute left-3.5 text-muted-foreground">
            <Search className="h-4 w-4" strokeWidth={2} />
          </span>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari transaksi..."
            className="min-h-[46px] w-full rounded-[12px] border border-white/16 bg-white/8 pl-10 pr-4 text-[14px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary-soft"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(["Semua", "Menunggu", "Selesai", "Batal"] as const).map((filter) => {
            const active = activeFilter === filter;
            const count =
              filter === "Semua"
                ? capsterTransactions.length
                : capsterTransactions.filter((t) => t.status === filter).length;

            return (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={
                  active
                    ? filter === "Menunggu"
                      ? "flex items-center gap-1.5 whitespace-nowrap rounded-full bg-warning px-3.5 py-1.5 text-[12px] font-bold text-black shadow-md transition-all"
                      : "flex items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-3.5 py-1.5 text-[12px] font-bold text-white shadow-md transition-all"
                    : "glass-1 flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-all"
                }
              >
                <span>{filter}</span>
                {count > 0 && filter !== "Semua" ? (
                  <span
                    className={
                      active
                        ? "rounded-full bg-black/20 px-1.5 py-0.2 text-[10px] font-bold"
                        : "rounded-full bg-white/10 px-1.5 py-0.2 text-[10px] font-semibold text-foreground"
                    }
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* List of Transactions */}
        <div className="space-y-3">
          {filtered.map((trx) => (
            <CapsterTransactionCard
              key={trx.id}
              trx={trx}
              onClick={() =>
                navigate({
                  to: `/${barbershopSlug}/capster/transactions/${trx.id}` as any,
                })
              }
            />
          ))}

          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-[14px] font-semibold">
                Belum Ada Transaksi
              </p>

              <p className="mt-1 text-[12px]">
                Tidak ada transaksi yang sesuai kriteria pencarian.
              </p>
            </div>
          ) : null}
        </div>
      </main>

      {/* BOTTOM CONTAINER (Satu Kesatuan: Tombol Buat Transaksi + Bottom Navigation) */}
      <div className="sticky bottom-0 z-20 mt-auto w-full pointer-events-none">
        {/* Area Tombol Buat Transaksi */}
        <div className="px-4 pb-2.5 pointer-events-auto">
          <PrimaryButton
            onClick={() => {
              capsterActions.initManualDraft();

              navigate({ to: `/${barbershopSlug}/capster/transactions/manual/services` as any,
              });
            }}
            className="shadow-[0_8px_24px_rgba(78,120,255,0.45)]"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
            BUAT TRANSAKSI
          </PrimaryButton>
        </div>

        {/* Existing Bottom Navigation */}
        <div className="pointer-events-auto">
          <CapsterBottomNav activeTab="transactions" />
        </div>
      </div>
    </MobileShell>
    </CapsterAuthGuard>
  );
}