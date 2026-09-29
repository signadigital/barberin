import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveTenantByCustomDomain } from "@/lib/tenant-resolver";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      // Jika hostname bukan localhost, cek apakah merupakan Custom Domain aktif
      if (
        hostname &&
        hostname !== "localhost" &&
        hostname !== "127.0.0.1" &&
        !hostname.endsWith(".local")
      ) {
        try {
          const resolved = await resolveTenantByCustomDomain({ data: hostname });
          if (resolved) {
            // Requirement 19: Jika bukan primary domain dan ada primary domain yang aktif, redirect ke primary domain
            if (resolved.shouldRedirect && resolved.redirectToDomain && resolved.redirectToDomain !== hostname) {
              window.location.href = `https://${resolved.redirectToDomain}/`;
              return;
            }

            // Route langsung ke customer portal tenant yang bersangkutan
            throw redirect({ to: `/${resolved.barbershopSlug}/customer/services` as any });
          }
        } catch (err: any) {
          if (err && typeof err === "object" && "to" in err) {
            throw err;
          }
          console.warn("[CUSTOM DOMAIN ROUTER] Error resolving domain:", err);
        }
      }
    }

    throw redirect({ to: "/barberin/customer/services" as any });
  },
});
