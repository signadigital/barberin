import { Link } from "@tanstack/react-router";
import { BarberinLogo } from "@/components/barberin/ui";

export function LandingFooter() {
  return (
    <footer className="bg-[#050912] border-t border-slate-900 py-12 sm:py-16 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10 pb-10 border-b border-slate-800/60">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-3">
            <Link to="/" className="flex items-center gap-2.5">
              <BarberinLogo className="h-8 w-8" />
              <span className="text-xl font-extrabold text-white tracking-tight">BARBERIN</span>
            </Link>
            <p className="text-slate-400 text-xs sm:text-sm max-w-sm leading-relaxed">
              Sistem Manajemen Barbershop modern untuk mengelola transaksi, layanan, antrean,
              dan komisi Capster dalam satu platform terpadu.
            </p>
          </div>

          {/* Quick Nav Links */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-white uppercase tracking-wider">
              Navigasi
            </div>
            <ul className="space-y-2">
              <li>
                <a href="#home" className="hover:text-white transition-colors">
                  Home
                </a>
              </li>
              <li>
                <a href="#problem" className="hover:text-white transition-colors">
                  Tentang / Problem
                </a>
              </li>
              <li>
                <a href="#solusi" className="hover:text-white transition-colors">
                  Solusi & Fitur
                </a>
              </li>
              <li>
                <a href="#cara-kerja" className="hover:text-white transition-colors">
                  Cara Kerja
                </a>
              </li>
              <li>
                <a href="#harga" className="hover:text-white transition-colors">
                  Harga & Paket
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Account Links */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-white uppercase tracking-wider">
              Akun & Akses
            </div>
            <ul className="space-y-2">
              <li>
                <Link to="/owner/login" className="hover:text-white transition-colors">
                  Masuk Owner
                </Link>
              </li>
              <li>
                <Link
                  to="/owner/register"
                  search={{ plan: "basic" }}
                  className="hover:text-white transition-colors"
                >
                  Daftar Barbershop Baru
                </Link>
              </li>
              <li>
                <Link to="/superadmin/login" className="hover:text-white transition-colors">
                  Superadmin Portal
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-[11px]">
          <div>© 2026 BARBERIN. All rights reserved.</div>
          <div>Sistem Manajemen Barbershop Multi-Tenant SaaS.</div>
        </div>
      </div>
    </footer>
  );
}
