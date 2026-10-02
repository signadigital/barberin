import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveTenantByCustomDomain } from "@/lib/tenant-resolver";
import {
  LandingNavbar,
  HeroSection,
  ProblemSection,
  ImpactSection,
  SolutionSection,
  HowItWorksSection,
  PricingSection,
  FAQSection,
  FinalCTA,
  LandingFooter,
} from "@/components/landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BARBERIN — Sistem Manajemen Barbershop" },
      {
        name: "description",
        content:
          "Kelola transaksi, layanan, Capster, komisi, pendapatan, dan antrean barbershop dalam satu sistem.",
      },
    ],
  }),
  beforeLoad: async () => {
    // Check if accessed through an active tenant custom domain
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      if (
        hostname &&
        hostname !== "localhost" &&
        hostname !== "127.0.0.1" &&
        !hostname.endsWith(".local")
      ) {
        try {
          const resolved = await resolveTenantByCustomDomain({ data: hostname });
          if (resolved) {
            if (
              resolved.shouldRedirect &&
              resolved.redirectToDomain &&
              resolved.redirectToDomain !== hostname
            ) {
              window.location.href = `https://${resolved.redirectToDomain}/`;
              return;
            }

            throw redirect({
              to: `/${resolved.barbershopSlug}/customer/services` as any,
            });
          }
        } catch (err: any) {
          if (err && typeof err === "object" && "to" in err) {
            throw err;
          }
          console.warn("[CUSTOM DOMAIN ROUTER] Error resolving domain:", err);
        }
      }
    }
  },
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-[#070D18] text-slate-100 flex flex-col antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Sticky Navigation */}
      <LandingNavbar />

      {/* Main Content Sections (Preserved BPMN sequence) */}
      <main className="flex-1">
        {/* 01. Hero (Masalah + Solusi + Penawaran) */}
        <HeroSection />

        {/* 02. Problem (Masalah yang Dihadapi Owner) */}
        <ProblemSection />

        {/* 03. Impact (Dampak Masalah) */}
        <ImpactSection />

        {/* 04. Solution & Fitur (Bagaimana BARBERIN Membantu) */}
        <SolutionSection />

        {/* 05. Cara Kerja (Alur Pelanggan, Capster, Owner) */}
        <HowItWorksSection />

        {/* 06. Offer / Harga (Paket Gratis, Pro, Enterprise) */}
        <PricingSection />

        {/* 07. FAQ (Pertanyaan Calon Pengguna) */}
        <FAQSection />

        {/* 08. Final CTA (Daftar & Mulai Menggunakan) */}
        <FinalCTA />
      </main>

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}
