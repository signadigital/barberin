import React, { useState } from "react";
import {
  Layers,
  Globe,
  Palette,
  Database,
  ArrowRight,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Info,
  Maximize2,
  Minimize2,
  Shield,
  User,
  Cpu,
  Server,
  FileCheck,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from "lucide-react";

export type BPMNViewMode = "white_label" | "custom_domain" | "erd";

interface BPMNViewerProps {
  initialMode?: BPMNViewMode;
  allowSwitching?: boolean;
  className?: string;
  onClose?: () => void;
}

export function BPMNViewer({
  initialMode = "white_label",
  allowSwitching = true,
  className = "",
  onClose,
}: BPMNViewerProps) {
  const [activeTab, setActiveTab] = useState<BPMNViewMode>(initialMode);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeStep, setActiveStep] = useState<number | null>(null);

  return (
    <div
      className={`bg-[#070D18] text-slate-100 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col ${
        isFullscreen ? "fixed inset-2 z-50 overflow-y-auto" : ""
      } ${className}`}
    >
      {/* Top Header */}
      <div className="bg-[#0A1424] border-b border-slate-800 px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-extrabold tracking-wider text-blue-400">
                Arsitektur & Spesifikasi Proses Bisnis
              </span>
              <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-mono border border-blue-500/30">
                Versi 1.0
              </span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              BPMN — White Labeling, Custom Design & Custom Domain
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {allowSwitching && (
            <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab("white_label")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "white_label"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Palette className="h-3.5 w-3.5" />
                <span>01. White Labeling</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("custom_domain")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "custom_domain"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                <span>02. Custom Domain</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("erd")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "erd"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Database className="h-3.5 w-3.5" />
                <span>03. ERD & Schema</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
            title={isFullscreen ? "Kecilkan" : "Layar Penuh"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Tutup
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-5 md:p-6 space-y-6 overflow-x-auto">
        {activeTab === "white_label" && (
          <WhiteLabelingBpmnDiagram
            activeStep={activeStep}
            onSelectStep={setActiveStep}
          />
        )}

        {activeTab === "custom_domain" && (
          <CustomDomainBpmnDiagram
            activeStep={activeStep}
            onSelectStep={setActiveStep}
          />
        )}

        {activeTab === "erd" && <ErdDiagramView />}

        {/* Legend & Guidelines Component */}
        <BpmnLegendAndNotes activeTab={activeTab} />
      </div>
    </div>
  );
}

// ============================================================================
// 1. BPMN 01 — WHITE LABELING / CUSTOM DESIGN (OWNER)
// ============================================================================
function WhiteLabelingBpmnDiagram({
  activeStep,
  onSelectStep,
}: {
  activeStep: number | null;
  onSelectStep: (step: number | null) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Title Header Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm shadow-md">
            01
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              BPMN — WHITE LABELING / CUSTOM DESIGN
              <span className="text-xs font-normal text-amber-400 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                Dikelola oleh Owner
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Owner mengatur identitas brand dan tampilan website barbershop miliknya secara visual dan mandiri.
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
          <Info className="h-3.5 w-3.5 text-blue-400" />
          <span>Klik elemen proses untuk melihat detail teknis</span>
        </div>
      </div>

      {/* Swimlane Container */}
      <div className="border border-slate-800 rounded-2xl bg-[#09111E] overflow-hidden min-w-[960px] shadow-xl">
        {/* Swimlane 1: Owner */}
        <div className="grid grid-cols-[140px_1fr] border-b border-slate-800/80">
          <div className="bg-[#0F1E36] p-4 flex flex-col justify-center items-center text-center border-r border-slate-800">
            <div className="h-9 w-9 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mb-2 shadow-sm">
              <User className="h-4 w-4" />
            </div>
            <div className="text-xs font-bold text-white">Owner</div>
            <div className="text-[10px] text-amber-400 font-medium">Barbershop</div>
          </div>

          <div className="p-5 flex items-center gap-3 overflow-x-auto relative">
            {/* Start Event */}
            <div className="flex flex-col items-center shrink-0">
              <div className="h-10 w-10 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 flex items-center justify-center font-bold text-xs shadow-md shadow-emerald-500/10">
                ●
              </div>
              <span className="text-[10px] text-emerald-400 mt-1 font-semibold">Mulai</span>
            </div>

            <ArrowRight className="h-4 w-4 text-slate-600 shrink-0" />

            {/* Step: Buka menu Pengaturan Branding */}
            <div className="bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 rounded-xl p-3 w-40 shrink-0 text-center shadow-md">
              <div className="text-[11px] font-bold text-white">Buka menu</div>
              <div className="text-xs font-semibold text-blue-400 mt-0.5">Pengaturan Branding</div>
            </div>

            <ArrowRight className="h-4 w-4 text-slate-600 shrink-0" />

            {/* Step 1: Ubah konfigurasi brand dan desain */}
            <div
              onClick={() => onSelectStep(activeStep === 1 ? null : 1)}
              className={`cursor-pointer transition-all border rounded-xl p-3.5 w-60 shrink-0 shadow-lg ${
                activeStep === 1
                  ? "bg-blue-950/80 border-blue-400 ring-2 ring-blue-500/30"
                  : "bg-[#0E1A2D] hover:bg-[#13233D] border-blue-600/40"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="h-4 w-4 rounded-full bg-blue-600 text-[10px] font-bold flex items-center justify-center text-white">
                  1
                </span>
                <span className="text-xs font-bold text-white">Ubah Konfigurasi</span>
              </div>
              <div className="text-[10px] text-slate-300 space-y-0.5 font-mono leading-tight bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                <div>• Nama brand & tagline</div>
                <div>• Logo & Favicon (URL/Upload)</div>
                <div>• Warna: Primary, Secondary, Bg</div>
                <div>• Theme preset & Mode Light/Dark</div>
                <div>• Meta Title & Description</div>
              </div>
            </div>

            <ArrowRight className="h-4 w-4 text-slate-600 shrink-0" />

            {/* Step: Klik Preview */}
            <div className="bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 rounded-xl p-3 w-32 shrink-0 text-center shadow-md">
              <div className="text-xs font-bold text-white flex items-center justify-center gap-1.5">
                <span>👁️</span> Klik Preview
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Modal visualisasi</div>
            </div>

            <ArrowRight className="h-4 w-4 text-slate-600 shrink-0" />

            {/* Decision 3: Sesuai? */}
            <div className="flex flex-col items-center shrink-0">
              <div className="w-16 h-16 bg-amber-500/10 border-2 border-amber-400 rotate-45 flex items-center justify-center shadow-md">
                <div className="-rotate-45 text-center">
                  <div className="text-[10px] font-bold text-amber-300 leading-tight">Sesuai?</div>
                  <div className="text-[8px] text-slate-400 font-mono">Decision</div>
                </div>
              </div>
              <span className="text-[10px] text-amber-300 font-semibold mt-1">3</span>
            </div>

            {/* Decision branch: Tidak -> Kembali Edit */}
            <div className="flex flex-col items-center gap-1 shrink-0 bg-rose-950/20 border border-rose-500/30 p-2.5 rounded-xl ml-2">
              <div className="text-[10px] text-rose-400 font-bold uppercase">Jika Tidak:</div>
              <div className="text-xs font-semibold text-white">Kembali Edit</div>
              <span className="text-[9px] text-rose-300">↩ Kembali ke input formulir</span>
            </div>

            <div className="flex flex-col items-center shrink-0 ml-2">
              <span className="text-[10px] text-emerald-400 font-bold uppercase mb-1">Jika Ya:</span>
              <div className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/30">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Klik Simpan</span>
              </div>
            </div>

            {/* End Event */}
            <div className="flex flex-col items-center shrink-0 ml-auto pl-4">
              <div className="h-10 w-10 rounded-full bg-emerald-500/20 border-4 border-emerald-400 text-emerald-400 flex items-center justify-center font-bold text-xs shadow-md shadow-emerald-500/10">
                ■
              </div>
              <span className="text-[10px] text-emerald-400 mt-1 font-semibold">Selesai</span>
            </div>
          </div>
        </div>

        {/* Swimlane 2: System BARBERIN */}
        <div className="grid grid-cols-[140px_1fr] border-b border-slate-800/80 bg-[#070E1A]">
          <div className="bg-[#0B172A] p-4 flex flex-col justify-center items-center text-center border-r border-slate-800">
            <div className="h-9 w-9 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center mb-2 shadow-sm">
              <Cpu className="h-4 w-4" />
            </div>
            <div className="text-xs font-bold text-white">System</div>
            <div className="text-[10px] text-blue-400 font-medium">BARBERIN Engine</div>
          </div>

          <div className="p-5 flex items-center gap-3 overflow-x-auto">
            {/* Spacer aligned with preview */}
            <div className="w-[380px] shrink-0 flex items-center justify-center text-slate-600 text-xs italic">
              — Menunggu instruksi simpan dari Owner —
            </div>

            <ArrowRight className="h-4 w-4 text-blue-500 shrink-0" />

            {/* Step 5: Validasi Konfigurasi */}
            <div
              onClick={() => onSelectStep(activeStep === 5 ? null : 5)}
              className={`cursor-pointer transition-all border rounded-xl p-3.5 w-56 shrink-0 shadow-lg ${
                activeStep === 5
                  ? "bg-blue-950 border-blue-400 ring-2 ring-blue-500/30"
                  : "bg-[#0E1E38] hover:bg-[#132747] border-blue-500/40"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="h-4 w-4 rounded-full bg-blue-500 text-[10px] font-bold flex items-center justify-center text-white">
                  5
                </span>
                <span className="text-xs font-bold text-white">Validasi Konfigurasi</span>
              </div>
              <div className="text-[10px] text-slate-300 space-y-0.5 font-mono leading-tight bg-slate-900/70 p-2 rounded-lg border border-slate-800">
                <div>✓ Cek data wajib (nama brand)</div>
                <div>✓ Cek format gambar (JPG/PNG/SVG)</div>
                <div>✓ Cek ukuran maksimal</div>
                <div>✓ Cek format warna HEX</div>
                <div>✓ Cek panjang karakter &lt;= 150</div>
              </div>
            </div>

            <ArrowRight className="h-4 w-4 text-slate-600 shrink-0" />

            {/* Decision 6: Valid? */}
            <div className="flex flex-col items-center shrink-0">
              <div className="w-16 h-16 bg-amber-500/10 border-2 border-amber-400 rotate-45 flex items-center justify-center shadow-md">
                <div className="-rotate-45 text-center">
                  <div className="text-[10px] font-bold text-amber-300 leading-tight">Valid?</div>
                  <div className="text-[8px] text-slate-400 font-mono">Gateway</div>
                </div>
              </div>
              <span className="text-[10px] text-amber-300 font-semibold mt-1">6</span>
            </div>

            {/* Decision branch: Tidak -> Error 7 */}
            <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-3 w-52 shrink-0 shadow-md">
              <div className="flex items-center gap-1.5 mb-1 text-rose-400 font-bold text-xs">
                <span className="h-4 w-4 rounded-full bg-rose-600 text-[10px] text-white flex items-center justify-center">
                  7
                </span>
                <span>Pesan Kesalahan</span>
              </div>
              <div className="text-[10px] text-rose-300 leading-tight">
                Format file tidak valid, ukuran file terlalu besar, warna tidak valid, dll.
              </div>
              <div className="text-[9px] text-slate-400 mt-1 italic">
                ↳ Kembali ke form konfigurasi
              </div>
            </div>

            <ArrowRight className="h-4 w-4 text-emerald-500 shrink-0" />

            {/* Step 8 & 9: Simpan & Terapkan */}
            <div className="bg-blue-900/40 border border-blue-500/40 rounded-xl p-3 w-48 shrink-0 shadow-md">
              <div className="text-xs font-bold text-white mb-1">Simpan Konfigurasi</div>
              <div className="text-[11px] text-blue-300">
                Pembaruan identitas brand diverifikasi &amp; diproses
              </div>
            </div>

            <ArrowRight className="h-4 w-4 text-emerald-500 shrink-0" />

            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3 w-52 shrink-0 shadow-md">
              <div className="flex items-center gap-1 text-emerald-400 font-bold text-xs mb-1">
                <span className="h-4 w-4 rounded-full bg-emerald-600 text-[10px] text-white flex items-center justify-center">
                  9
                </span>
                <span>Terapkan Konfigurasi</span>
              </div>
              <div className="text-[10px] text-emerald-300">
                Tampilan website barbershop &amp; portal customer langsung terbarui
              </div>
            </div>
          </div>
        </div>

        {/* Swimlane 3: Database Sistem */}
        <div className="grid grid-cols-[140px_1fr] bg-[#050A14]">
          <div className="bg-[#081220] p-4 flex flex-col justify-center items-center text-center border-r border-slate-800">
            <div className="h-9 w-9 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center mb-2 shadow-sm">
              <Database className="h-4 w-4" />
            </div>
            <div className="text-xs font-bold text-white">Database</div>
            <div className="text-[10px] text-indigo-400 font-medium">PostgreSQL / Supabase</div>
          </div>

          <div className="p-5 flex items-center gap-4 overflow-x-auto">
            <div className="w-[660px] shrink-0 text-slate-600 text-xs italic">
              — Operasi atomik ACID saat proses simpan disetujui —
            </div>

            {/* DB Step 10: barbershop_brandings */}
            <div className="bg-slate-900/90 border border-blue-500/30 rounded-xl p-3.5 w-60 shrink-0 shadow-md">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="h-4 w-4 rounded-full bg-blue-600 text-[10px] font-bold flex items-center justify-center text-white">
                  10
                </span>
                <span className="text-xs font-bold text-white font-mono">
                  barbershop_brandings
                </span>
              </div>
              <div className="text-[10px] text-slate-300 font-mono bg-slate-950/70 p-1.5 rounded border border-slate-800">
                UPDATE / INSERT WHERE id_barbershop = :id
              </div>
              <div className="text-[10px] text-emerald-400 mt-1">
                ✓ 1 : 1 dengan tabel barbershops
              </div>
            </div>

            <ArrowRight className="h-4 w-4 text-indigo-500 shrink-0" />

            {/* DB Step 11: branding_histories */}
            <div className="bg-slate-900/90 border border-indigo-500/30 rounded-xl p-3.5 w-64 shrink-0 shadow-md">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="h-4 w-4 rounded-full bg-indigo-600 text-[10px] font-bold flex items-center justify-center text-white">
                  11
                </span>
                <span className="text-xs font-bold text-white font-mono">
                  branding_histories
                </span>
              </div>
              <div className="text-[10px] text-slate-300 font-mono bg-slate-950/70 p-1.5 rounded border border-slate-800">
                INSERT (id_branding, changed_by, data_before, data_after)
              </div>
              <div className="text-[10px] text-indigo-400 mt-1">
                ✓ 1 : N riwayat audit perubahan JSONB
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 2. BPMN 02 — CUSTOM DOMAIN (SUPERADMIN)
// ============================================================================
function CustomDomainBpmnDiagram({
  activeStep,
  onSelectStep,
}: {
  activeStep: number | null;
  onSelectStep: (step: number | null) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Title Header Banner */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-600 text-white font-black flex items-center justify-center text-sm shadow-md">
            02
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              BPMN — CUSTOM DOMAIN
              <span className="text-xs font-normal text-blue-400 bg-blue-500/20 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                Dikelola oleh Admin Platform / Superadmin
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Admin Platform menambah, memvalidasi format, mengecek ketersediaan, dan memverifikasi propagasi DNS domain barbershop.
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
          <Shield className="h-3.5 w-3.5 text-blue-400" />
          <span>Multi-tenant Isolation &amp; CNAME Routing</span>
        </div>
      </div>

      {/* Swimlane Container */}
      <div className="border border-slate-800 rounded-2xl bg-[#09111E] overflow-hidden min-w-[1024px] shadow-xl">
        {/* Swimlane 1: Superadmin */}
        <div className="grid grid-cols-[150px_1fr] border-b border-slate-800/80">
          <div className="bg-[#0F1E36] p-4 flex flex-col justify-center items-center text-center border-r border-slate-800">
            <div className="h-9 w-9 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center mb-2 shadow-sm">
              <Shield className="h-4 w-4" />
            </div>
            <div className="text-xs font-bold text-white">Admin Platform</div>
            <div className="text-[10px] text-blue-400 font-medium">Superadmin</div>
          </div>

          <div className="p-5 flex items-center gap-3 overflow-x-auto">
            {/* Start Event */}
            <div className="flex flex-col items-center shrink-0">
              <div className="h-10 w-10 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 flex items-center justify-center font-bold text-xs shadow-md shadow-emerald-500/10">
                ●
              </div>
              <span className="text-[10px] text-emerald-400 mt-1 font-semibold">Mulai</span>
            </div>

            <ArrowRight className="h-4 w-4 text-slate-600 shrink-0" />

            {/* Step: Pilih Barbershop */}
            <div className="bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 rounded-xl p-3 w-36 shrink-0 text-center shadow-md">
              <div className="text-xs font-bold text-white flex items-center justify-center gap-1.5">
                <span>🏢</span> Pilih Barbershop
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Tenant target</div>
            </div>

            <ArrowRight className="h-4 w-4 text-slate-600 shrink-0" />

            {/* Step 2: Tambah / Edit Custom Domain */}
            <div
              onClick={() => onSelectStep(activeStep === 2 ? null : 2)}
              className={`cursor-pointer transition-all border rounded-xl p-3.5 w-56 shrink-0 shadow-lg ${
                activeStep === 2
                  ? "bg-blue-950 border-blue-400 ring-2 ring-blue-500/30"
                  : "bg-[#0E1A2D] hover:bg-[#13233D] border-blue-600/40"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="h-4 w-4 rounded-full bg-blue-600 text-[10px] font-bold flex items-center justify-center text-white">
                  2
                </span>
                <span className="text-xs font-bold text-white">Tambah / Edit Domain</span>
              </div>
              <div className="text-[10px] text-slate-300 space-y-0.5 font-mono leading-tight bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                <div>• Input domain (e.g. cukur.id)</div>
                <div>• Pilih tipe (utama/tambahan)</div>
                <div>• (Opsional) Setting SSL</div>
              </div>
            </div>

            <div className="w-80 shrink-0 flex items-center justify-center text-slate-600 text-xs italic">
              — Sistem memproses validasi &amp; ketersediaan —
            </div>

            {/* Step 8: Verifikasi DNS */}
            <div className="bg-blue-900/40 border border-blue-500/40 rounded-xl p-3 w-48 shrink-0 text-center shadow-md">
              <div className="flex items-center justify-center gap-1 text-blue-300 font-bold text-xs mb-1">
                <span className="h-4 w-4 rounded-full bg-blue-600 text-[10px] text-white flex items-center justify-center">
                  8
                </span>
                <span>Verifikasi DNS</span>
              </div>
              <div className="text-[10px] text-slate-300">
                Klik tombol "Verifikasi Domain" di dashboard
              </div>
            </div>

            {/* End Event */}
            <div className="flex flex-col items-center shrink-0 ml-auto pl-4">
              <div className="h-10 w-10 rounded-full bg-emerald-500/20 border-4 border-emerald-400 text-emerald-400 flex items-center justify-center font-bold text-xs shadow-md shadow-emerald-500/10">
                ■
              </div>
              <span className="text-[10px] text-emerald-400 mt-1 font-semibold">Selesai</span>
            </div>
          </div>
        </div>

        {/* Swimlane 2: System BARBERIN */}
        <div className="grid grid-cols-[150px_1fr] border-b border-slate-800/80 bg-[#070E1A]">
          <div className="bg-[#0B172A] p-4 flex flex-col justify-center items-center text-center border-r border-slate-800">
            <div className="h-9 w-9 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center mb-2 shadow-sm">
              <Cpu className="h-4 w-4" />
            </div>
            <div className="text-xs font-bold text-white">System</div>
            <div className="text-[10px] text-blue-400 font-medium">BARBERIN Engine</div>
          </div>

          <div className="p-5 flex items-center gap-3 overflow-x-auto">
            {/* Step 3: Validasi Format */}
            <div className="bg-[#0E1E38] border border-blue-500/40 rounded-xl p-3 w-52 shrink-0 shadow-md">
              <div className="flex items-center gap-1.5 mb-1 text-white font-bold text-xs">
                <span className="h-4 w-4 rounded-full bg-blue-500 text-[10px] text-white flex items-center justify-center">
                  3
                </span>
                <span>Validasi Format Domain</span>
              </div>
              <div className="text-[10px] text-slate-300 font-mono space-y-0.5 bg-slate-950/60 p-1.5 rounded">
                <div>• Regex Karakter (a-z, 0-9, -)</div>
                <div>• Ekstensi valid (.com, .id, dll)</div>
                <div>• Tanpa spasi / path / protocol</div>
              </div>
            </div>

            <ArrowRight className="h-4 w-4 text-slate-600 shrink-0" />

            {/* Decision 4: Format Valid? */}
            <div className="flex flex-col items-center shrink-0">
              <div className="w-16 h-16 bg-amber-500/10 border-2 border-amber-400 rotate-45 flex items-center justify-center shadow-md">
                <div className="-rotate-45 text-center">
                  <div className="text-[10px] font-bold text-amber-300 leading-tight">Format?</div>
                  <div className="text-[8px] text-slate-400 font-mono">Valid</div>
                </div>
              </div>
              <span className="text-[10px] text-amber-300 font-semibold mt-1">4</span>
            </div>

            {/* Error 7: Format Tidak Valid */}
            <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-2.5 w-44 shrink-0 shadow-md">
              <div className="flex items-center gap-1 text-rose-400 font-bold text-xs mb-0.5">
                <span className="h-4 w-4 rounded-full bg-rose-600 text-[10px] text-white flex items-center justify-center">
                  7
                </span>
                <span>Format Error</span>
              </div>
              <div className="text-[9px] text-rose-300 leading-tight">
                Tampilkan pesan kesalahan format domain
              </div>
            </div>

            <ArrowRight className="h-4 w-4 text-emerald-500 shrink-0" />

            {/* Step 5: Cek Ketersediaan Domain */}
            <div className="bg-[#0E1E38] border border-blue-500/40 rounded-xl p-3 w-48 shrink-0 shadow-md">
              <div className="flex items-center gap-1.5 mb-1 text-white font-bold text-xs">
                <span className="h-4 w-4 rounded-full bg-blue-500 text-[10px] text-white flex items-center justify-center">
                  5
                </span>
                <span>Cek Ketersediaan</span>
              </div>
              <div className="text-[10px] text-slate-300 leading-tight">
                Cek apakah domain sudah dipakai oleh barbershop lain
              </div>
            </div>

            <ArrowRight className="h-4 w-4 text-slate-600 shrink-0" />

            {/* Decision 6: Tersedia? */}
            <div className="flex flex-col items-center shrink-0">
              <div className="w-16 h-16 bg-amber-500/10 border-2 border-amber-400 rotate-45 flex items-center justify-center shadow-md">
                <div className="-rotate-45 text-center">
                  <div className="text-[10px] font-bold text-amber-300 leading-tight">Tersedia?</div>
                  <div className="text-[8px] text-slate-400 font-mono">Unik</div>
                </div>
              </div>
              <span className="text-[10px] text-amber-300 font-semibold mt-1">6</span>
            </div>

            {/* Error 8: Domain Sudah Digunakan */}
            <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-2.5 w-44 shrink-0 shadow-md">
              <div className="flex items-center gap-1 text-rose-400 font-bold text-xs mb-0.5">
                <span className="h-4 w-4 rounded-full bg-rose-600 text-[10px] text-white flex items-center justify-center">
                  8
                </span>
                <span>Sudah Digunakan</span>
              </div>
              <div className="text-[9px] text-rose-300 leading-tight">
                Domain sudah terdaftar di tenant lain
              </div>
            </div>

            <ArrowRight className="h-4 w-4 text-emerald-500 shrink-0" />

            {/* Step 7: Konfigurasi DNS */}
            <div className="bg-slate-900/90 border border-blue-500/40 rounded-xl p-3 w-56 shrink-0 shadow-md">
              <div className="flex items-center gap-1.5 mb-1 text-white font-bold text-xs">
                <span className="h-4 w-4 rounded-full bg-blue-500 text-[10px] text-white flex items-center justify-center">
                  7
                </span>
                <span>Konfigurasi DNS</span>
              </div>
              <div className="text-[10px] text-slate-300 font-mono bg-slate-950/70 p-1.5 rounded space-y-0.5">
                <div>• Type: CNAME atau A</div>
                <div>• Value: cname.barberin.id</div>
                <div>• Tampilkan instruksi di dashboard</div>
              </div>
            </div>

            <ArrowRight className="h-4 w-4 text-blue-500 shrink-0" />

            {/* Decision 9: Cek DNS & Valid? */}
            <div className="flex flex-col items-center shrink-0">
              <div className="w-16 h-16 bg-amber-500/10 border-2 border-amber-400 rotate-45 flex items-center justify-center shadow-md">
                <div className="-rotate-45 text-center">
                  <div className="text-[10px] font-bold text-amber-300 leading-tight">DNS Valid?</div>
                  <div className="text-[8px] text-slate-400 font-mono">Resolve</div>
                </div>
              </div>
              <span className="text-[10px] text-amber-300 font-semibold mt-1">9</span>
            </div>

            {/* Error 10: DNS Belum Sesuai */}
            <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-2.5 w-44 shrink-0 shadow-md">
              <div className="flex items-center gap-1 text-rose-400 font-bold text-xs mb-0.5">
                <span className="h-4 w-4 rounded-full bg-rose-600 text-[10px] text-white flex items-center justify-center">
                  10
                </span>
                <span>Propagasi DNS</span>
              </div>
              <div className="text-[9px] text-rose-300 leading-tight">
                DNS belum sesuai, masih masa propagasi
              </div>
            </div>

            <ArrowRight className="h-4 w-4 text-emerald-500 shrink-0" />

            {/* Step: Update Status Active */}
            <div className="bg-emerald-950/50 border border-emerald-500/40 rounded-xl p-3 w-48 shrink-0 shadow-md">
              <div className="text-xs font-bold text-emerald-400 mb-1 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Domain "Active"</span>
              </div>
              <div className="text-[10px] text-emerald-300 leading-tight">
                Domain langsung dialihkan ke tenant barbershop
              </div>
            </div>
          </div>
        </div>

        {/* Swimlane 3: Database Sistem */}
        <div className="grid grid-cols-[150px_1fr] bg-[#050A14]">
          <div className="bg-[#081220] p-4 flex flex-col justify-center items-center text-center border-r border-slate-800">
            <div className="h-9 w-9 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center mb-2 shadow-sm">
              <Database className="h-4 w-4" />
            </div>
            <div className="text-xs font-bold text-white">Database</div>
            <div className="text-[10px] text-indigo-400 font-medium">PostgreSQL / Supabase</div>
          </div>

          <div className="p-5 flex items-center gap-4 overflow-x-auto">
            <div className="w-[500px] shrink-0 text-slate-600 text-xs italic">
              — Sinkronisasi record multi-tenant custom domain —
            </div>

            {/* DB Step 12: Simpan Data Domain */}
            <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-3.5 w-56 shrink-0 shadow-md">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="h-4 w-4 rounded-full bg-amber-500 text-[10px] font-bold flex items-center justify-center text-slate-950">
                  12
                </span>
                <span className="text-xs font-bold text-white font-mono">
                  custom_domains
                </span>
              </div>
              <div className="text-[10px] text-slate-300 font-mono bg-slate-950/70 p-1.5 rounded border border-slate-800">
                INSERT (status: 'pending', is_primary)
              </div>
              <div className="text-[10px] text-amber-400 mt-1">
                🟡 Menunggu konfigurasi DNS
              </div>
            </div>

            <div className="w-[200px] shrink-0 text-slate-600 text-xs italic text-center">
              — Verifikasi berhasil —
            </div>

            {/* DB Step 13: Update status domain active */}
            <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-3.5 w-60 shrink-0 shadow-md">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="h-4 w-4 rounded-full bg-emerald-600 text-[10px] font-bold flex items-center justify-center text-white">
                  13
                </span>
                <span className="text-xs font-bold text-white font-mono">
                  custom_domains
                </span>
              </div>
              <div className="text-[10px] text-slate-300 font-mono bg-slate-950/70 p-1.5 rounded border border-slate-800">
                UPDATE status = 'active', verified_at = NOW()
              </div>
              <div className="text-[10px] text-emerald-400 mt-1">
                🟢 Domain aktif &amp; siap diakses
              </div>
            </div>

            <ArrowRight className="h-4 w-4 text-indigo-500 shrink-0" />

            {/* DB Step 14: Insert log domain_verification_logs */}
            <div className="bg-slate-900/90 border border-indigo-500/30 rounded-xl p-3.5 w-64 shrink-0 shadow-md">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="h-4 w-4 rounded-full bg-indigo-600 text-[10px] font-bold flex items-center justify-center text-white">
                  14
                </span>
                <span className="text-xs font-bold text-white font-mono">
                  domain_verification_logs
                </span>
              </div>
              <div className="text-[10px] text-slate-300 font-mono bg-slate-950/70 p-1.5 rounded border border-slate-800">
                INSERT (id_domain, status, response_message)
              </div>
              <div className="text-[10px] text-indigo-400 mt-1">
                📜 Log audit verifikasi DNS
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 3. ERD & DATABASE RELATIONSHIPS (IMAGE 2 VIEW)
// ============================================================================
function ErdDiagramView() {
  return (
    <div className="space-y-6">
      <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white font-black flex items-center justify-center text-sm shadow-md">
            ERD
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              ERD BARBERIN — White Labeling, Custom Design &amp; Custom Domain
            </h3>
            <p className="text-xs text-slate-400">
              Konfigurasi identitas brand, tampilan website, dan domain kustom untuk setiap tenant barbershop.
            </p>
          </div>
        </div>
        <div className="text-xs text-indigo-300 bg-indigo-950/60 px-3 py-1.5 rounded-lg border border-indigo-500/30 font-mono">
          Multi-Tenant Isolated (id_barbershop)
        </div>
      </div>

      {/* Grid of Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Table: barbershops */}
        <div className="bg-[#0B1526] border border-amber-500/30 rounded-2xl overflow-hidden shadow-xl">
          <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-black">🏢</span>
              <span className="font-bold text-sm text-white font-mono">barbershops</span>
            </div>
            <span className="text-[10px] text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded font-mono font-bold">
              Parent Entity
            </span>
          </div>
          <div className="p-4 space-y-1.5 font-mono text-xs text-slate-300 divide-y divide-slate-800/60">
            <div className="flex justify-between py-1 text-amber-300 font-bold">
              <span>PK id_barbershop</span>
              <span className="text-slate-500">UUID</span>
            </div>
            <div className="flex justify-between py-1">
              <span>nama_barbershop</span>
              <span className="text-slate-500">VARCHAR(100)</span>
            </div>
            <div className="flex justify-between py-1">
              <span>slug</span>
              <span className="text-slate-500">VARCHAR(100) UNIQUE</span>
            </div>
            <div className="flex justify-between py-1">
              <span>alamat</span>
              <span className="text-slate-500">TEXT</span>
            </div>
            <div className="flex justify-between py-1">
              <span>status</span>
              <span className="text-slate-500">ENUM</span>
            </div>
          </div>
        </div>

        {/* Table: barbershop_brandings */}
        <div className="bg-[#0B1526] border border-blue-500/30 rounded-2xl overflow-hidden shadow-xl">
          <div className="bg-blue-500/20 border-b border-blue-500/30 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-blue-400 font-black">🎨</span>
              <span className="font-bold text-sm text-white font-mono">barbershop_brandings</span>
            </div>
            <span className="text-[10px] text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded font-mono font-bold">
              1 : 1 Relation
            </span>
          </div>
          <div className="p-4 space-y-1.5 font-mono text-xs text-slate-300 divide-y divide-slate-800/60">
            <div className="flex justify-between py-1 text-amber-300 font-bold">
              <span>PK id_branding</span>
              <span className="text-slate-500">UUID</span>
            </div>
            <div className="flex justify-between py-1 text-blue-300 font-semibold">
              <span>FK id_barbershop</span>
              <span className="text-slate-500">UUID (1:1)</span>
            </div>
            <div className="flex justify-between py-1">
              <span>nama_brand</span>
              <span className="text-slate-500">VARCHAR(100)</span>
            </div>
            <div className="flex justify-between py-1">
              <span>tagline</span>
              <span className="text-slate-500">VARCHAR(150)</span>
            </div>
            <div className="flex justify-between py-1">
              <span>logo_url / favicon_url</span>
              <span className="text-slate-500">TEXT</span>
            </div>
            <div className="flex justify-between py-1">
              <span>warna_primary / secondary / bg</span>
              <span className="text-slate-500">VARCHAR(20)</span>
            </div>
            <div className="flex justify-between py-1">
              <span>theme (default/sec/tert/nat)</span>
              <span className="text-slate-500">ENUM</span>
            </div>
            <div className="flex justify-between py-1">
              <span>hide_barberin_brand</span>
              <span className="text-slate-500">BOOLEAN</span>
            </div>
            <div className="flex justify-between py-1">
              <span>status (active/inactive/draft)</span>
              <span className="text-slate-500">ENUM</span>
            </div>
          </div>
        </div>

        {/* Table: branding_histories */}
        <div className="bg-[#0B1526] border border-indigo-500/30 rounded-2xl overflow-hidden shadow-xl">
          <div className="bg-indigo-500/20 border-b border-indigo-500/30 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-indigo-400 font-black">🕒</span>
              <span className="font-bold text-sm text-white font-mono">branding_histories</span>
            </div>
            <span className="text-[10px] text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded font-mono font-bold">
              1 : N Audit
            </span>
          </div>
          <div className="p-4 space-y-1.5 font-mono text-xs text-slate-300 divide-y divide-slate-800/60">
            <div className="flex justify-between py-1 text-amber-300 font-bold">
              <span>PK id_history</span>
              <span className="text-slate-500">UUID</span>
            </div>
            <div className="flex justify-between py-1 text-indigo-300 font-semibold">
              <span>FK id_branding</span>
              <span className="text-slate-500">UUID</span>
            </div>
            <div className="flex justify-between py-1">
              <span>FK changed_by</span>
              <span className="text-slate-500">UUID (Owner)</span>
            </div>
            <div className="flex justify-between py-1">
              <span>data_before</span>
              <span className="text-slate-500">JSONB</span>
            </div>
            <div className="flex justify-between py-1">
              <span>data_after</span>
              <span className="text-slate-500">JSONB</span>
            </div>
            <div className="flex justify-between py-1">
              <span>created_at</span>
              <span className="text-slate-500">TIMESTAMP</span>
            </div>
          </div>
        </div>

        {/* Table: custom_domains */}
        <div className="bg-[#0B1526] border border-emerald-500/30 rounded-2xl overflow-hidden shadow-xl">
          <div className="bg-emerald-500/20 border-b border-emerald-500/30 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-black">🌐</span>
              <span className="font-bold text-sm text-white font-mono">custom_domains</span>
            </div>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded font-mono font-bold">
              1 : N Relation
            </span>
          </div>
          <div className="p-4 space-y-1.5 font-mono text-xs text-slate-300 divide-y divide-slate-800/60">
            <div className="flex justify-between py-1 text-amber-300 font-bold">
              <span>PK id_domain</span>
              <span className="text-slate-500">UUID</span>
            </div>
            <div className="flex justify-between py-1 text-emerald-300 font-semibold">
              <span>FK id_barbershop</span>
              <span className="text-slate-500">UUID</span>
            </div>
            <div className="flex justify-between py-1">
              <span>domain</span>
              <span className="text-slate-500">VARCHAR(255) UNIQUE</span>
            </div>
            <div className="flex justify-between py-1">
              <span>domain_type</span>
              <span className="text-slate-500">ENUM (primary/addon)</span>
            </div>
            <div className="flex justify-between py-1">
              <span>dns_name / dns_value</span>
              <span className="text-slate-500">VARCHAR(100/255)</span>
            </div>
            <div className="flex justify-between py-1">
              <span>status</span>
              <span className="text-slate-500">pending/verifying/active/failed</span>
            </div>
            <div className="flex justify-between py-1">
              <span>is_primary</span>
              <span className="text-slate-500">BOOLEAN</span>
            </div>
            <div className="flex justify-between py-1">
              <span>verified_at / activated_at</span>
              <span className="text-slate-500">TIMESTAMP</span>
            </div>
          </div>
        </div>

        {/* Table: domain_verification_logs */}
        <div className="bg-[#0B1526] border border-purple-500/30 rounded-2xl overflow-hidden shadow-xl md:col-span-2">
          <div className="bg-purple-500/20 border-b border-purple-500/30 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-purple-400 font-black">📜</span>
              <span className="font-bold text-sm text-white font-mono">domain_verification_logs</span>
            </div>
            <span className="text-[10px] text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded font-mono font-bold">
              1 : N Verification Log
            </span>
          </div>
          <div className="p-4 space-y-1.5 font-mono text-xs text-slate-300 divide-y divide-slate-800/60">
            <div className="flex justify-between py-1 text-amber-300 font-bold">
              <span>PK id_log</span>
              <span className="text-slate-500">UUID</span>
            </div>
            <div className="flex justify-between py-1 text-purple-300 font-semibold">
              <span>FK id_domain</span>
              <span className="text-slate-500">UUID</span>
            </div>
            <div className="flex justify-between py-1">
              <span>status</span>
              <span className="text-slate-500">ENUM (pending/verifying/active/failed)</span>
            </div>
            <div className="flex justify-between py-1">
              <span>response_message</span>
              <span className="text-slate-500">TEXT (Log hasil lookup DNS / propagasi)</span>
            </div>
            <div className="flex justify-between py-1">
              <span>checked_at / created_at</span>
              <span className="text-slate-500">TIMESTAMP</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 4. LEGEND & BUSINESS RULES REFERENCE (IMAGE 1 & SPEC SECTION 3, 4, 7)
// ============================================================================
function BpmnLegendAndNotes({ activeTab }: { activeTab: BPMNViewMode }) {
  return (
    <div className="space-y-6 pt-4 border-t border-slate-800">
      {/* Legend Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#0B1526] border border-emerald-500/30 p-3 rounded-xl flex items-center gap-2.5">
          <div className="h-6 w-6 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
            ●
          </div>
          <div>
            <div className="text-xs font-bold text-white">Start / End</div>
            <div className="text-[10px] text-slate-400">Awal &amp; akhir proses</div>
          </div>
        </div>

        <div className="bg-[#0B1526] border border-blue-500/30 p-3 rounded-xl flex items-center gap-2.5">
          <div className="h-6 w-6 rounded-lg bg-blue-500/20 border border-blue-400 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
            👤
          </div>
          <div>
            <div className="text-xs font-bold text-white">User Activity</div>
            <div className="text-[10px] text-slate-400">Owner / Superadmin</div>
          </div>
        </div>

        <div className="bg-[#0B1526] border border-indigo-500/30 p-3 rounded-xl flex items-center gap-2.5">
          <div className="h-6 w-6 rounded-lg bg-indigo-500/20 border border-indigo-400 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
            ⚙️
          </div>
          <div>
            <div className="text-xs font-bold text-white">System Process</div>
            <div className="text-[10px] text-slate-400">Engine BARBERIN</div>
          </div>
        </div>

        <div className="bg-[#0B1526] border border-amber-500/30 p-3 rounded-xl flex items-center gap-2.5">
          <div className="h-6 w-6 rounded-sm bg-amber-500/20 border border-amber-400 text-amber-400 flex items-center justify-center font-bold text-[10px] rotate-45 shrink-0">
            <span className="-rotate-45">?</span>
          </div>
          <div>
            <div className="text-xs font-bold text-white">Decision Gateway</div>
            <div className="text-[10px] text-slate-400">Percabangan Ya/Tidak</div>
          </div>
        </div>

        <div className="bg-[#0B1526] border border-indigo-500/30 p-3 rounded-xl flex items-center gap-2.5">
          <div className="h-6 w-6 rounded-lg bg-indigo-500/20 border border-indigo-400 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
            🗄️
          </div>
          <div>
            <div className="text-xs font-bold text-white">Database</div>
            <div className="text-[10px] text-slate-400">Penyimpanan entitas</div>
          </div>
        </div>

        <div className="bg-[#0B1526] border border-rose-500/30 p-3 rounded-xl flex items-center gap-2.5">
          <div className="h-6 w-6 rounded-lg bg-rose-500/20 border border-rose-400 text-rose-400 flex items-center justify-center font-bold text-xs shrink-0">
            🔴
          </div>
          <div>
            <div className="text-xs font-bold text-white">Error Process</div>
            <div className="text-[10px] text-slate-400">Umpan balik gagal</div>
          </div>
        </div>
      </div>

      {/* Role Responsibility Badges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-amber-950/20 border border-amber-500/20 p-3.5 rounded-xl text-xs text-amber-200">
          <strong className="block font-bold text-amber-400 mb-1">👑 Peran Owner Barbershop</strong>
          Owner bertanggung jawab atas konfigurasi branding dan white-label barbershop miliknya (nama, logo, favicon, warna preset, dan tema). Owner tidak dapat mengelola custom domain.
        </div>
        <div className="bg-blue-950/20 border border-blue-500/20 p-3.5 rounded-xl text-xs text-blue-200">
          <strong className="block font-bold text-blue-400 mb-1">🛡️ Peran Admin Platform / Superadmin</strong>
          Admin Platform / Superadmin bertanggung jawab atas konfigurasi, verifikasi propagasi DNS, ketersediaan, dan pengelolaan status custom domain antar tenant.
        </div>
        <div className="bg-indigo-950/20 border border-indigo-500/20 p-3.5 rounded-xl text-xs text-indigo-200">
          <strong className="block font-bold text-indigo-400 mb-1">⚙️ Peran System BARBERIN</strong>
          System BARBERIN melakukan validasi konfigurasi, penyimpanan atomik, audit logging history, rendering preview, dan verifikasi otomatis record DNS.
        </div>
      </div>

      {/* Reference Tables for Custom Domain Rules (Matching Image 1) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Card 1: Kategori Format Domain */}
        <div className="bg-[#0B1526] border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
            <Globe className="h-4 w-4" />
            <span>Kategori Format Domain</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-300">Domain utama</span>
              <span className="text-emerald-400 font-mono">barberinsinggah.com</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-300">Subdomain</span>
              <span className="text-emerald-400 font-mono">cukur.singgah.com</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-300">Domain bisnis</span>
              <span className="text-emerald-400 font-mono">barberin-singgah.id</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-300">Subdomain custom</span>
              <span className="text-emerald-400 font-mono">app.barberin.co.id</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-300">Domain hyphen</span>
              <span className="text-emerald-400 font-mono">barberin-vip.com</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-300">Domain angka</span>
              <span className="text-emerald-400 font-mono">barberin123.com</span>
            </div>
          </div>
        </div>

        {/* Card 2: Aturan Format Domain */}
        <div className="bg-[#0B1526] border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <FileCheck className="h-4 w-4" />
            <span>Aturan Format Domain</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="text-[11px] font-bold text-emerald-400 uppercase">Diperbolehkan:</div>
            <div className="text-slate-300 pl-2 space-y-0.5 font-mono text-[11px]">
              <div>✓ Huruf a-z &amp; Angka 0-9</div>
              <div>✓ Tanda hubung (-)</div>
              <div>✓ Titik (.) sebagai pemisah</div>
              <div>✓ Ekstensi valid (.com, .id, dll)</div>
            </div>
            <div className="text-[11px] font-bold text-rose-400 uppercase pt-1">Dilarang:</div>
            <div className="text-slate-300 pl-2 space-y-0.5 font-mono text-[11px]">
              <div>✗ Spasi atau simbol (@, #, _)</div>
              <div>✗ Diawali/diakhiri tanda minus</div>
              <div>✗ Double dot (..) &amp; path (/)</div>
              <div>✗ Protokol http:// atau https://</div>
            </div>
          </div>
        </div>

        {/* Card 3: Contoh Domain Valid vs Tidak */}
        <div className="bg-[#0B1526] border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider">
            <CheckCircle2 className="h-4 w-4" />
            <span>Contoh Valid / Tidak</span>
          </div>
          <div className="space-y-1.5 text-xs font-mono">
            <div className="text-emerald-400 flex items-center justify-between">
              <span>barberinsinggah.com</span>
              <span>✓</span>
            </div>
            <div className="text-emerald-400 flex items-center justify-between">
              <span>app.barberin.co.id</span>
              <span>✓</span>
            </div>
            <div className="text-emerald-400 flex items-center justify-between">
              <span>cukur.barberin123.com</span>
              <span>✓</span>
            </div>
            <div className="text-rose-400 flex items-center justify-between border-t border-slate-800/80 pt-1">
              <span>barberin_com</span>
              <span>✗</span>
            </div>
            <div className="text-rose-400 flex items-center justify-between">
              <span>-barberin.com</span>
              <span>✗</span>
            </div>
            <div className="text-rose-400 flex items-center justify-between">
              <span>https://barberin.com</span>
              <span>✗</span>
            </div>
            <div className="text-rose-400 flex items-center justify-between">
              <span>barberin.com/login</span>
              <span>✗</span>
            </div>
          </div>
        </div>

        {/* Card 4: Status Domain (ENUM) */}
        <div className="bg-[#0B1526] border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
            <RefreshCw className="h-4 w-4" />
            <span>Status Domain (ENUM)</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <span className="font-bold text-amber-400">🟡 Pending</span>
              <p className="text-[10px] text-slate-300 mt-0.5">
                Domain sudah disimpan, DNS belum dikonfigurasi.
              </p>
            </div>
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <span className="font-bold text-blue-400">🔵 Verifying</span>
              <p className="text-[10px] text-slate-300 mt-0.5">
                Sistem sedang melakukan pengecekan propagasi DNS.
              </p>
            </div>
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <span className="font-bold text-emerald-400">🟢 Active</span>
              <p className="text-[10px] text-slate-300 mt-0.5">
                DNS valid dan domain siap digunakan sebagai routing barbershop.
              </p>
            </div>
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
              <span className="font-bold text-rose-400">🔴 Failed</span>
              <p className="text-[10px] text-slate-300 mt-0.5">
                Verifikasi DNS gagal atau CNAME belum mengarah ke platform.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
