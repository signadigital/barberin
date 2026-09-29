import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { resolveBarbershopBySlug } from "@/lib/tenant-resolver";
import { BarbershopNotFound } from "@/components/barberin/barbershop-not-found";

export const Route = createFileRoute("/$barbershopSlug")({
  staleTime: 60_000,
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

  // Runtime application of dynamic branding (Favicon, Title, CSS Variables)
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
    if (branding.nama_brand && typeof document !== "undefined") {
      const originalTitle = document.title;
      document.title = `${branding.nama_brand}${branding.tagline ? ` — ${branding.tagline}` : ""}`;
      return () => {
        document.title = originalTitle;
      };
    }
  }, [branding]);

  // CSS variables for branding color presets
  const styleVars = branding
    ? ({
        "--brand-primary": branding.warna_primary,
        "--brand-secondary": branding.warna_secondary,
        "--brand-background": branding.warna_background,
      } as React.CSSProperties)
    : undefined;

  return (
    <div
      style={styleVars}
      data-tenant-slug={shop.slug}
      data-theme={branding?.theme || "default"}
      data-display-mode={branding?.display_mode || "dark"}
      data-color-preset={branding?.color_preset || "blue"}
      className={`min-h-screen ${branding?.display_mode === "light" ? "light-mode" : "dark-mode"}`}
    >
      <Outlet />
    </div>
  );
}
