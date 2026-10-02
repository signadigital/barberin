import { useState, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X, ArrowRight } from "lucide-react";
import { BarberinLogo } from "@/components/barberin/ui";

const navLinks = [
  { id: "home", label: "Home", href: "#home" },
  { id: "problem", label: "Problem", href: "#problem" },
  { id: "solusi", label: "Solusi", href: "#solusi" },
  { id: "cara-kerja", label: "Cara Kerja", href: "#cara-kerja" },
  { id: "harga", label: "Harga", href: "#harga" },
  { id: "faq", label: "FAQ", href: "#faq" },
];

const sectionIds = ["home", "problem", "impact", "solusi", "cara-kerja", "harga", "faq"];

export function LandingNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("home");
  const isClickScrolling = useRef(false);

  useEffect(() => {
    // Initial scroll check for header glassmorphism
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
      if (window.scrollY < 50 && !isClickScrolling.current) {
        setActiveSection("home");
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Initial hash navigation check on mount
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash.replace("#", "");
      const targetElement = document.getElementById(hash);
      if (targetElement) {
        const mappedId = hash === "impact" ? "problem" : hash;
        setActiveSection(mappedId);
        setTimeout(() => {
          targetElement.scrollIntoView({ behavior: "smooth" });
        }, 150);
      }
    }

    // Hash change handler for browser Back/Forward navigation
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash) {
        const mappedId = hash === "impact" ? "problem" : hash;
        setActiveSection(mappedId);
        const targetElement = document.getElementById(hash);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: "smooth" });
        }
      } else {
        setActiveSection("home");
      }
    };
    window.addEventListener("popstate", handleHashChange);

    // IntersectionObserver to detect active section without per-pixel scroll listeners
    const intersectingMap = new Map<string, boolean>();

    const observer = new IntersectionObserver(
      (entries) => {
        if (isClickScrolling.current) return;

        entries.forEach((entry) => {
          intersectingMap.set(entry.target.id, entry.isIntersecting);
        });

        // Determine which observed section is currently visible in document order
        for (const id of sectionIds) {
          if (intersectingMap.get(id)) {
            const mappedId = id === "impact" ? "problem" : id;
            setActiveSection(mappedId);
            break;
          }
        }
      },
      {
        rootMargin: "-80px 0px -55% 0px",
        threshold: 0,
      }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("popstate", handleHashChange);
      observer.disconnect();
    };
  }, []);

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string,
    id: string
  ) => {
    e.preventDefault();
    setActiveSection(id);
    setMobileMenuOpen(false);

    const targetId = href.replace("#", "");
    const targetElement = document.getElementById(targetId);

    if (targetElement) {
      isClickScrolling.current = true;
      targetElement.scrollIntoView({ behavior: "smooth" });

      if (window.history.pushState) {
        window.history.pushState(null, "", href);
      } else {
        window.location.hash = href;
      }

      // Re-enable observer after smooth scroll finishes
      setTimeout(() => {
        isClickScrolling.current = false;
      }, 800);
    }
  };

  return (
    <header
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
            onClick={(e) => handleNavClick(e as any, "#home", "home")}
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
            {navLinks.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href, item.id)}
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
            {navLinks.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href, item.id)}
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
