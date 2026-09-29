import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useOwner, getOwnerAuth } from "@/lib/owner-store";

export const Route = createFileRoute("/owner/verify-email-change")({
  validateSearch: (search: Record<string, unknown>) => search,
  component: GlobalVerifyEmailChangeRedirect,
});

function GlobalVerifyEmailChangeRedirect() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const ownerState = useOwner();

  useEffect(() => {
    const slug = ownerState.user?.barbershopSlug || "barberin";
    const queryString = new URLSearchParams(search as any).toString();
    const hashString = typeof window !== "undefined" ? window.location.hash : "";
    const targetUrl = `/${slug}/owner/verify-email-change${queryString ? `?${queryString}` : ""}${hashString}`;

    navigate({ to: targetUrl as any, replace: true });
  }, [search, ownerState, navigate]);

  return (
    <div className="min-h-screen bg-[#070D18] flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        <p className="text-xs text-slate-400 font-medium">Mengarahkan ke halaman verifikasi...</p>
      </div>
    </div>
  );
}
