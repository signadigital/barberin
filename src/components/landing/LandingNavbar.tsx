import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X, ArrowRight } from "lucide-react";
import { BarberinLogo } from "@/components/barberin/ui";

// Single Source of Truth for Navigation
export const NAV_LINKS = [
  { id: "home", label: "Home", href: "#home" },
  { id: "problem", label: "Problem", href: "#problem" },
  { id: "solusi", label: "Solusi", href: "#solusi" },
  { id: "cara-kerja", label: "Cara Kerja", href: "#cara-kerja" },
  { id: "harga", label: "Harga", href: "#harga" },
  { id: "faq", label: "FAQ", href: "#faq" },
] as const;

// DOM order of sections with mapping (Impact maps to Problem)
export const SECTION_DOM_CONFIG = [
  { id: "home", mappedNavId: "home" },
  { id: "problem", mappedNavId: "problem" },
  { id: "impact", mappedNavId: "problem" },
  { id: "solusi", mappedNavId: "solusi" },
  { id: "cara-kerja", mappedNavId: "cara-kerja" },
  { id: "harga", mappedNavId: "harga" },
  { id: "faq", mappedNavId: "faq" },
] as const;

export function LandingNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("home");

  const headerRef = useRef<HTMLElement | null>(null);
  const activeSectionRef = useRef<string>("home");

  // Pure position-based active section calculator based on viewport geometry
  const calculateActiveSection = useCallback(() => {
    if (typeof window === "undefined") return;

    const scrollY = window.scrollY;
    const navbarHeight = headerRef.current?.offsetHeight || 80;
    const activationPoint = navbarHeight + 80;

    let currentNavId = "home";

    // 1. If at the very top of the page, Home is always active
    if (scrollY < 50) {
      currentNavId = "home";
    }
    // 2. If at the bottom of the page (FAQ / CTA), FAQ is active
    else if (
      window.innerHeight + scrollY >=
      document.documentElement.scrollHeight - 60
    ) {
      currentNavId = "faq";
    }
    // 3. Otherwise find which section currently intersects the activation point
    else {
      let matched = false;
      for (const item of SECTION_DOM_CONFIG) {
        const el = document.getElementById(item.id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= activationPoint && rect.bottom > activationPoint) {
          currentNavId = item.mappedNavId;
          matched = true;
          break;
        }
      }

      // Edge-case fallback: choose the section closest to activation point
      if (!matched) {
        let maxTop = -Infinity;
        for (const item of SECTION_DOM_CONFIG) {
          const el = document.getElementById(item.id);
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          if (rect.top <= activationPoint && rect.top > maxTop) {
            maxTop = rect.top;
            currentNavId = item.mappedNavId;
          }
        }
      }
    }

    // Only update state if active section has genuinely changed
    if (currentNavId !== activeSectionRef.current) {
      activeSectionRef.current = currentNavId;
      setActiveSection(currentNavId);
    }
  }, []);

  useEffect(() => {
    let rafId: number | null = null;

    const handleScroll = () => {
      // Toggle navbar glassmorphism
      setScrolled(window.scrollY > 20);

      // Throttle viewport calculations to requestAnimationFrame (no per-pixel re-renders)
      if (rafId === null) {
        rafId = window.requestAnimationFrame(() => {
          calculateActiveSection();
          rafId = null;
        });
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });

    // Initial check on mount
    calculateActiveSection();

    // Check direct hash URL on initial load (e.g. /#harga)
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash.replace("#", "");
      const targetElement = document.getElementById(hash);
      if (targetElement) {
        setTimeout(() => {
          targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
          calculateActiveSection();
        }, 150);
      }
    }

    // Handle browser back/forward navigation
    const handlePopState = () => {
      if (window.location.hash) {
        const hash = window.location.hash.replace("#", "");
        const targetElement = document.getElementById(hash);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
      window.requestAnimationFrame(calculateActiveSection);
    };
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      window.removeEventListener("popstate", handlePopState);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [calculateActiveSection]);

  // Click handler: initiates smooth scroll without artificially forcing activeSection state
  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    e.preventDefault();
    setMobileMenuOpen(false);

    const targetId = href.replace("#", "");
    const targetElement = document.getElementById(targetId);

    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth", block: "start" });

      if (window.history.pushState) {
        window.history.pushState(null, "", href);
      } else {
        window.location.hash = href;
      }
    }
  };

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#070D18]/90 backdrop-blur-md border-b border-slate-800 shadow-xl shadow-black/30"
          : "bg-[#070D18]/60 backdrop-blur-xs border-b border-slate-800/50"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Brand Logo */}
          <Link
            to="/"
            onClick={(e) => handleNavClick(e as any, "#home")}
            className="flex items-center gap-2.5 group focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg p-1"
          >
            <BarberinLogo className="h-8 w-8 sm:h-9 sm:w-9 transition-transform duration-300 group-hover:scale-105" />
            <div className="flex flex-col">
              <span className="text-lg sm:text-xl font-extrabold tracking-tight text-white flex items-center gap-1.5">
                BARBERIN
                <span className="text-[10px] uppercase font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.2 rounded">
                  SaaS
                </span>
              </span>
              <span className="text-[9px] text-slate-400 -mt-1 hidden sm:inline">
                Sistem Manajemen Barbershop
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-1.5">
            {NAV_LINKS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                  className={`px-3 py-1.5 text-xs lg:text-sm font-semibold rounded-lg transition-all duration-200 border ${
                    isActive
                      ? "text-blue-400 bg-blue-500/10 border-blue-500/25 shadow-xs font-bold"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/60 border-transparent"
                  } focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* Desktop CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/owner/login"
              className="px-4 py-2 text-xs lg:text-sm font-bold text-slate-200 hover:text-white hover:bg-slate-800/70 border border-slate-700/80 rounded-xl transition-all focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Masuk
            </Link>
            <Link
              to="/owner/register"
              search={{ plan: "basic" }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs lg:text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/25 transition-all hover:shadow-blue-500/40 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
            >
              <span>Mulai Gratis</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Mobile Hamburger Toggle */}
          <div className="flex md:hidden items-center gap-2">
            <Link
              to="/owner/login"
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-300 border border-slate-800 rounded-lg hover:bg-slate-800/60"
            >
              Masuk
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label={mobileMenuOpen ? "Tutup menu" : "Buka menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-800 bg-[#0A1322] px-4 pt-3 pb-6 space-y-4 animate-in slide-in-from-top-4 duration-200 shadow-2xl">
          <nav className="flex flex-col space-y-1">
            {NAV_LINKS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                  className={`px-3.5 py-2.5 text-sm font-semibold rounded-xl transition-colors border ${
                    isActive
                      ? "text-blue-400 bg-blue-500/10 border-blue-500/20 font-bold"
                      : "text-slate-300 hover:text-white hover:bg-slate-800 border-transparent"
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          <div className="pt-3 border-t border-slate-800 flex flex-col gap-2.5">
            <Link
              to="/owner/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 text-sm font-bold text-slate-200 border border-slate-700 rounded-xl hover:bg-slate-800 transition-colors"
            >
              Masuk ke Akun
            </Link>
            <Link
              to="/owner/register"
              search={{ plan: "basic" }}
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
            >
              <span>Mulai Gratis</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
