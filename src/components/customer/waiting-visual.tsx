import React from "react";
import { cn } from "@/lib/utils";

export interface WaitingVisualProps {
  /**
   * Optional video URL for future animated video replacement.
   * When provided, <video> is rendered. When omitted, the official BARBERIN logo is rendered.
   */
  videoUrl?: string | undefined;
  posterUrl?: string | undefined;
  className?: string | undefined;
  badgeText?: string | undefined;
}

/**
 * WaitingVisual Component
 * 
 * Top media area for Customer Waiting / Estimation page.
 * Currently renders the official BARBERIN logo with a sleek, clean, modern dark aesthetic.
 * Architecture is prepared so it can seamlessly switch to an animated video in the future
 * simply by providing `videoUrl` or swapping the internal render without modifying the page layout.
 */
export function WaitingVisual({
  videoUrl,
  posterUrl = "/barberin-logo.png",
  className,
  badgeText,
}: WaitingVisualProps) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-[26px] border border-white/10 bg-gradient-to-b from-slate-900/90 via-slate-950 to-slate-900 shadow-2xl transition-all duration-300",
        "h-52 sm:h-60 flex flex-col items-center justify-center",
        className,
      )}
    >
      {/* Background Ambience & Lighting */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.12)_0%,rgba(15,23,42,0)_70%)]" />
      <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 h-32 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-slate-950/80 to-transparent" />

      {/* Subtle Grid Accent */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Optional Top-Right Status Badge */}
      {badgeText && (
        <div className="absolute top-3.5 right-3.5 z-20">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-md px-2.5 py-1 text-[10px] font-bold tracking-wider text-slate-300 border border-white/10 uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-soft animate-pulse" />
            <span>{badgeText}</span>
          </span>
        </div>
      )}

      {/* Media Layer: Video vs Logo Placeholder */}
      {videoUrl ? (
        <video
          src={videoUrl}
          poster={posterUrl}
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover z-10"
        />
      ) : (
        <div className="relative z-10 flex flex-col items-center justify-center p-6 gap-2">
          {/* BARBERIN Official Logo */}
          <div className="relative flex items-center justify-center">
            {/* Subtle backlight ring */}
            <div className="absolute -inset-4 rounded-full bg-primary/15 blur-xl pointer-events-none" />
            <img
              src="/barberin-logo.png"
              alt="BARBERIN"
              className="relative max-h-24 sm:max-h-28 w-auto object-contain drop-shadow-[0_10px_25px_rgba(0,0,0,0.7)] transition-transform duration-300 hover:scale-105"
            />
          </div>

          <div className="mt-1 flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-primary-soft/60" />
            <span className="text-[10px] font-bold tracking-[0.25em] text-slate-400 uppercase">
              BARBERIN
            </span>
            <span className="h-1 w-1 rounded-full bg-primary-soft/60" />
          </div>
        </div>
      )}
    </div>
  );
}
