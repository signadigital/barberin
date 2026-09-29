import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { resolveBarbershopBySlug } from "@/lib/tenant-resolver";
import { BarbershopNotFound } from "@/components/barberin/barbershop-not-found";

export const Route = createFileRoute("/$barbershopSlug")({
  staleTime: 10_000,
  loader: async ({ params }) => {
    const shop = await resolveBarbershopBySlug({
      data: params.barbershopSlug,
    });

    if (!shop) {
      throw notFound();
    }

    return { shop };
  },
  notFoundComponent: BarbershopNotFound,
  component: BarbershopLayout,
});

function BarbershopLayout() {
  const { shop } = Route.useLoaderData();
  const branding = shop.branding;

  // Single tenant theme system: supply --brand-* properties
  const styleVars = (branding
    ? {
        "--brand-primary": branding.warna_primary,
        "--brand-secondary": branding.warna_secondary,
        "--brand-background": branding.warna_background,
      }
    : {
        "--brand-primary": "#2563EB",
        "--brand-secondary": "#1E40AF",
        "--brand-background": "#070D18",
      }) as React.CSSProperties;

  // Runtime application of dynamic branding (Favicon, Title, Body/HTML sync)
  useEffect(() => {
    if (!branding) return;

    // 1. Dynamic Favicon
    if (branding.favicon_url && typeof document !== "undefined") {
      let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = branding.favicon_url;
    }

    // 2. Dynamic Title
    let restoreTitle: (() => void) | undefined;
    if (branding.nama_brand && typeof document !== "undefined") {
      const originalTitle = document.title;
      document.title = `${branding.nama_brand}${branding.tagline ? ` — ${branding.tagline}` : ""}`;
      restoreTitle = () => {
        document.title = originalTitle;
      };
    }

    // 3. Document-level theme sync (variables on documentElement & body for portals and modals)
    if (typeof document !== "undefined") {
      const mode = branding.display_mode === "light" ? "light" : "dark";
      const preset = branding.color_preset || "blue";

      document.documentElement.setAttribute("data-tenant-theme", "true");
      document.documentElement.setAttribute("data-tenant-slug", shop.slug);
      document.documentElement.setAttribute("data-display-mode", mode);
      document.documentElement.setAttribute("data-color-preset", preset);

      document.body.setAttribute("data-tenant-theme", "true");
      document.body.setAttribute("data-display-mode", mode);
      document.body.setAttribute("data-color-preset", preset);

      if (styleVars) {
        Object.entries(styleVars).forEach(([key, val]) => {
          if (typeof val === "string") {
            document.documentElement.style.setProperty(key, val);
            document.body.style.setProperty(key, val);
          }
        });
      }
    }

    return () => {
      restoreTitle?.();
      if (typeof document !== "undefined") {
        document.documentElement.removeAttribute("data-tenant-theme");
        document.documentElement.removeAttribute("data-tenant-slug");
        document.documentElement.removeAttribute("data-display-mode");
        document.documentElement.removeAttribute("data-color-preset");
        document.body.removeAttribute("data-tenant-theme");
        document.body.removeAttribute("data-display-mode");
        document.body.removeAttribute("data-color-preset");

        if (styleVars) {
          Object.keys(styleVars).forEach((key) => {
            document.documentElement.style.removeProperty(key);
            document.body.style.removeProperty(key);
          });
        }
      }
    };
  }, [branding, styleVars, shop.slug]);

  return (
    <div
      data-tenant-theme="true"
      data-tenant-slug={shop.slug}
      data-theme={branding?.theme || "default"}
      data-display-mode={branding?.display_mode || "dark"}
      data-color-preset={branding?.color_preset || "blue"}
      style={styleVars}
      className={`min-h-screen bg-background text-foreground transition-colors duration-150 ${
        branding?.display_mode === "light" ? "light-mode" : "dark-mode"
      }`}
    >
      <Outlet />
    </div>
  );
}
