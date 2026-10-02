import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Download,
  Printer,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Sparkles,
  Info,
  CheckCircle2,
} from "lucide-react";
import { TenantLogo } from "@/components/tenant/TenantLogo";

interface CustomerQRCodeCardProps {
  barbershopSlug: string;
  barbershopName: string;
  logoUrl?: string | null | undefined;
  alamat?: string | null | undefined;
  noHp?: string | null | undefined;
}

export function CustomerQRCodeCard({
  barbershopSlug,
  barbershopName,
  logoUrl,
  alamat,
  noHp,
}: CustomerQRCodeCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrGenerated, setQrGenerated] = useState(false);

  // Dynamic Destination URL (Origin + Tenant Customer Services Path)
  const [customerUrl, setCustomerUrl] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/${barbershopSlug}/customer/services`;
    }
    return `/${barbershopSlug}/customer/services`;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const fullUrl = `${window.location.origin}/${barbershopSlug}/customer/services`;
      setCustomerUrl(fullUrl);

      if (canvasRef.current) {
        QRCode.toCanvas(
          canvasRef.current,
          fullUrl,
          {
            width: 320,
            margin: 2,
            color: {
              dark: "#0F172A",
              light: "#FFFFFF",
            },
            errorCorrectionLevel: "H",
          },
          (err) => {
            if (err) {
              console.error("[QR CODE] Failed to generate QR canvas:", err);
            } else {
              setQrGenerated(true);
            }
          }
        );
      }
    }
  }, [barbershopSlug]);

  const handleCopyUrl = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(customerUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy URL:", err);
    }
  };

  const handleDownload = async () => {
    try {
      // High-resolution 1024x1024 PNG for crisp printing
      const highResDataUrl = await QRCode.toDataURL(customerUrl, {
        width: 1024,
        margin: 3,
        color: {
          dark: "#0F172A",
          light: "#FFFFFF",
        },
        errorCorrectionLevel: "H",
      });

      const downloadLink = document.createElement("a");
      downloadLink.download = `QR-Pelanggan-${barbershopSlug}.png`;
      downloadLink.href = highResDataUrl;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (err) {
      console.error("[QR CODE] Failed to download QR:", err);
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="space-y-6">
      {/* Print Styles: isolates #printable-qr-card when window.print() is called */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-qr-card,
          #printable-qr-card * {
            visibility: visible !important;
          }
          #printable-qr-card {
            position: fixed !important;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-50%, -50%) !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: 2px solid #000000 !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: 90mm !important;
            max-width: 90mm !important;
            padding: 8mm !important;
            border-radius: 6mm !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Main Grid: Card QR on Left, Actions & Guides on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Printable QR Code Display Card */}
        <div className="lg:col-span-6 flex justify-center">
          <div
            id="printable-qr-card"
            className="w-full max-w-sm rounded-3xl bg-white border border-slate-200/90 shadow-2xl p-6 sm:p-8 text-center text-slate-900 transition-all"
          >
            {/* Brand Header inside QR Card */}
            <div className="flex flex-col items-center gap-2 mb-4">
              <TenantLogo
                logoUrl={logoUrl}
                brandName={barbershopName}
                className="h-14 w-14 object-contain rounded-2xl shadow-sm"
              />
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                  {barbershopName}
                </h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full mt-1">
                  <Sparkles className="h-3 w-3" />
                  <span>Menu & Pemesanan Mandiri</span>
                </span>
              </div>
            </div>

            {/* QR Canvas Container with Clean Quiet Zone */}
            <div className="my-5 p-3 rounded-2xl bg-white border-2 border-slate-100 inline-block shadow-inner">
              <canvas
                ref={canvasRef}
                className="w-[240px] h-[240px] sm:w-[260px] sm:h-[260px] max-w-full block mx-auto rounded-lg"
              />
            </div>

            {/* Instructions */}
            <div className="space-y-1.5 pt-1">
              <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Arahkan Kamera HP ke QR Code
              </p>
              <p className="text-[11px] text-slate-500 max-w-[260px] mx-auto leading-relaxed">
                Scan langsung menggunakan kamera smartphone untuk melihat layanan dan antrean. Tanpa perlu download aplikasi.
              </p>
            </div>

            {alamat && (
              <p className="text-[10px] text-slate-400 mt-4 pt-3 border-t border-slate-100 truncate">
                {alamat}
              </p>
            )}
          </div>
        </div>

        {/* Action Controls & Implementation Tips (Hidden during print) */}
        <div className="lg:col-span-6 space-y-5 no-print">
          {/* Quick Actions Card */}
          <div className="rounded-3xl bg-card border border-border p-5 sm:p-6 shadow-sm text-card-foreground space-y-4">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" />
              <span>Aksi QR Pelanggan</span>
            </h4>

            {/* Primary Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs sm:text-sm shadow-md shadow-primary/20 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>Download PNG</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-card hover:bg-muted border border-border text-foreground font-bold text-xs sm:text-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                <Printer className="h-4 w-4 text-muted-foreground" />
                <span>Cetak QR Code</span>
              </button>
            </div>

            {/* URL Display with Copy and Preview */}
            <div className="pt-3 border-t border-border space-y-2">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Tautan Halaman Pelanggan (Target QR):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={customerUrl}
                  className="flex-1 bg-muted/60 border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground select-all focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  title="Salin Tautan"
                  className="p-2.5 rounded-xl bg-muted hover:bg-muted/80 border border-border text-foreground transition-colors cursor-pointer"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                <a
                  href={customerUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Buka Tautan di Tab Baru"
                  className="p-2.5 rounded-xl bg-muted hover:bg-muted/80 border border-border text-foreground transition-colors"
                >
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </a>
              </div>
              {copied && (
                <p className="text-[11px] text-emerald-500 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Tautan berhasil disalin ke clipboard!</span>
                </p>
              )}
            </div>
          </div>

          {/* Placement Best Practice Guide */}
          <div className="rounded-3xl bg-muted/40 border border-border p-5 space-y-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 text-foreground font-bold">
              <Info className="h-4 w-4 text-primary shrink-0" />
              <span>Petunjuk Penggunaan & Pemasangan</span>
            </div>
            <ul className="space-y-2 pl-5 list-disc leading-relaxed">
              <li>
                <strong className="text-foreground">Meja Capster:</strong> Cetak dan tempatkan pada cermin di setiap kursi pangkas agar pelanggan dapat memindai langsung saat duduk.
              </li>
              <li>
                <strong className="text-foreground">Meja Kasir & Ruang Tunggu:</strong> Tempatkan standee akrilik berisi QR code di area tunggu untuk antrean mandiri.
              </li>
              <li>
                <strong className="text-foreground">Tanpa Login:</strong> Pelanggan cukup memindai dengan kamera smartphone bawaan (iPhone / Android) tanpa instalasi aplikasi.
              </li>
              <li>
                <strong className="text-foreground">Otomatis Terisolasi:</strong> QR Code ini hanya memuat layanan, Capster, dan pesanan barbershop <span className="font-semibold text-foreground">{barbershopName}</span>.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
