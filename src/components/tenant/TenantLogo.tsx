import React, { createContext, useContext, useState } from "react";
import { useMatch } from "@tanstack/react-router";
import { BarberinLogo } from "@/components/barberin/BarberinLogo";
import type { ResolvedBarbershop, TenantBrandingConfig } from "@/lib/tenant-resolver";
import { cn } from "@/lib/utils";

/**
 * Context to provide tenant branding seamlessly down the component tree
 */
export interface TenantBrandingContextType {
  shop?: ResolvedBarbershop | null | undefined;
  branding?: TenantBrandingConfig | null | undefined;
}

export const TenantBrandingContext = createContext<TenantBrandingContextType>({});

export function TenantBrandingProvider({
  shop,
  branding,
  children,
}: {
  shop?: ResolvedBarbershop | null | undefined;
  branding?: TenantBrandingConfig | null | undefined;
  children: React.ReactNode;
}) {
  return (
    <TenantBrandingContext.Provider value={{ shop, branding }}>
      {children}
    </TenantBrandingContext.Provider>
  );
}

/**
 * Hook to get tenant branding anywhere in the application
 */
export function useTenantBranding(): TenantBrandingConfig | null {
  const ctx = useContext(TenantBrandingContext);
  if (ctx && ctx.branding !== undefined) {
    return ctx.branding;
  }

  // Fallback to router match if outside explicit provider
  try {
    const parentMatch = useMatch({ from: "/$barbershopSlug", shouldThrow: false });
    return (parentMatch as any)?.loaderData?.shop?.branding ?? null;
  } catch {
    return null;
  }
}

/**
 * Hook to get tenant shop info anywhere in the application
 */
export function useTenantShop(): {
  shop: ResolvedBarbershop | null;
  branding: TenantBrandingConfig | null;
} {
  const ctx = useContext(TenantBrandingContext);
  if (ctx && ctx.shop !== undefined) {
    return {
      shop: ctx.shop ?? null,
      branding: ctx.branding ?? null,
    };
  }

  try {
    const parentMatch = useMatch({ from: "/$barbershopSlug", shouldThrow: false });
    const shop = (parentMatch as any)?.loaderData?.shop ?? null;
    return {
      shop,
      branding: shop?.branding ?? null,
    };
  } catch {
    return { shop: null, branding: null };
  }
}

export interface TenantLogoProps {
  logoUrl?: string | null | undefined;
  brandName?: string | null | undefined;
  className?: string | undefined;
  fallbackClassName?: string | undefined;
  alt?: string | undefined;
  size?: "sm" | "md" | "lg" | undefined;
}

/**
 * TenantLogo Component
 *
 * Displays the dynamic tenant logo if configured (via props or TenantBrandingContext).
 * Gracefully falls back to BARBERIN default logo if no custom logo is uploaded or if image loading fails.
 * Guarantees `object-contain` without distortion, clean transparency, and support for both Light and Dark mode.
 */
export function TenantLogo({
  logoUrl,
  brandName,
  className,
  fallbackClassName,
  alt,
  size,
}: TenantLogoProps) {
  const branding = useTenantBranding();
  const { shop } = useTenantShop();
  const [hasError, setHasError] = useState(false);

  const effectiveLogoUrl = logoUrl !== undefined ? logoUrl : branding?.logo_url;
  const effectiveBrandName =
    brandName !== undefined
      ? brandName
      : branding?.nama_brand || shop?.nama_barbershop || "BARBERIN";

  const sizeClass =
    size === "sm"
      ? "h-8 w-8"
      : size === "md"
      ? "h-12 w-12"
      : size === "lg"
      ? "h-16 w-16"
      : "";

  // If tenant has configured a logo and it hasn't errored
  if (effectiveLogoUrl && !hasError) {
    return (
      <img
        src={effectiveLogoUrl}
        alt={alt || effectiveBrandName || "Logo"}
        onError={() => setHasError(true)}
        className={cn("object-contain shrink-0", sizeClass, className)}
      />
    );
  }

  // Fallback to official BARBERIN logo
  return (
    <BarberinLogo
      className={cn("shrink-0", sizeClass, className, fallbackClassName)}
    />
  );
}

export function TenantBrandName({
  fallback = "BARBERIN",
  className,
}: {
  fallback?: string | undefined;
  className?: string | undefined;
}) {
  const branding = useTenantBranding();
  const { shop } = useTenantShop();
  const name = branding?.nama_brand || shop?.nama_barbershop || fallback;
  return <span className={className}>{name}</span>;
}

export function TenantTagline({
  fallback = "Modern Barbershop Management System",
  className,
}: {
  fallback?: string | undefined;
  className?: string | undefined;
}) {
  const branding = useTenantBranding();
  const tagline = branding?.tagline || fallback;
  return <span className={className}>{tagline}</span>;
}
