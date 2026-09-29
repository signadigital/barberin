import { createFileRoute, Link } from "@tanstack/react-router";
import React from "react";
import { ArrowLeft, ExternalLink, Palette, Globe, Layers } from "lucide-react";
import { BPMNViewer } from "@/components/bpmn/bpmn-viewer";
import { BarberinLogo } from "@/components/barberin/ui";

export const Route = createFileRoute("/bpmn")({
  head: () => ({
    meta: [
      { title: "Dokumentasi BPMN & Arsitektur — BARBERIN" },
      {
        name: "description",
        content:
          "Dokumentasi alur proses bisnis BPMN untuk White Labeling, Custom Design, dan Custom Domain BARBERIN.",
      },
    ],
  }),
  component: BpmnDocsPage,
});

function BpmnDocsPage() {
  return (
    <div className="min-h-screen bg-[#070D18] text-slate-100 p-4 sm:p-6 lg:p-8 flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      <div className="max-w-7xl w-full mx-auto space-y-6">
        {/* Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0A1424] border border-slate-800 p-4 rounded-2xl shadow-lg">
          <div className="flex items-center gap-3">
            <BarberinLogo className="h-9 w-9 shrink-0" />
            <div>
              <div className="font-extrabold text-white text-base leading-none tracking-wider">
                BARBERIN
              </div>
              <div className="text-[11px] text-blue-400 font-bold uppercase tracking-wider mt-0.5">
                Dokumentasi Modul BPMN &amp; Arsitektur
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/superadmin/domains"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-blue-300 border border-blue-500/30 transition-all shadow-xs"
            >
              <Globe className="h-3.5 w-3.5" />
              <span>Portal Superadmin (Domains)</span>
              <ExternalLink className="h-3 w-3 opacity-60" />
            </Link>

            <Link
              to="/owner/login"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-purple-300 border border-purple-500/30 transition-all shadow-xs"
            >
              <Palette className="h-3.5 w-3.5" />
              <span>Portal Owner (Branding)</span>
              <ExternalLink className="h-3 w-3 opacity-60" />
            </Link>
          </div>
        </div>

        {/* BPMN Interactive Viewer */}
        <BPMNViewer initialMode="white_label" allowSwitching={true} />
      </div>

      <footer className="text-center text-xs text-slate-500 pt-8 pb-4">
        BARBERIN — Sistem Manajemen Barbershop Modern • Dokumentasi BPMN &amp; ERD Versi 1.0
      </footer>
    </div>
  );
}
