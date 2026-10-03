import { useEffect, useState } from "react";
import {
  Download,
  Printer,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Info,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { QRPoster, downloadQRPoster } from "@/components/barberin/QRPoster";

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
}: CustomerQRCodeCardProps) {
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

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
    }
  }, [barbershopSlug]);

  const handleCopyUrl = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(customerUrl);
        setCopied(true);
        toast.success("Tautan berhasil disalin ke clipboard!");
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy URL:", err);
      toast.error("Gagal menyalin tautan.");
    }
  };

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      await downloadQRPoster({
        barbershopSlug,
        barbershopName,
        logoUrl,
        customerUrl,
      });
      toast.success("Poster QR berhasil diunduh!");
    } catch (err) {
      console.error("[QR CODE] Failed to download poster QR:", err);
      toast.error("Gagal mengunduh poster QR. Silakan coba lagi.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="space-y-6">
      {/* Print Styles: isolates #qr-poster-preview when window.print() is called */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #qr-poster-preview,
          #qr-poster-preview * {
            visibility: visible !important;
          }
          #qr-poster-preview {
            position: fixed !important;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-50%, -50%) !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: 1.5px solid #cbd5e1 !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: 125mm !important;
            max-width: 90% !important;
            padding: 10mm !important;
            border-radius: 6mm !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Main Grid: Card QR Poster Preview on Left, Actions & Guides on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Printable & Downloadable QR Poster Preview */}
        <div className="lg:col-span-6 flex justify-center">
          <QRPoster
            id="qr-poster-preview"
            barbershopSlug={barbershopSlug}
            barbershopName={barbershopName}
            logoUrl={logoUrl}
            customerUrl={customerUrl}
          />
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
                disabled={isDownloading}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-70 text-primary-foreground font-bold text-xs sm:text-sm shadow-md shadow-primary/20 transition-all active:scale-[0.98] cursor-pointer"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>Download QR</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-card hover:bg-muted border border-border text-foreground font-bold text-xs sm:text-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                <Printer className="h-4 w-4 text-muted-foreground" />
                <span>Cetak QR</span>
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
                <strong className="text-foreground">Poster Siap Pakai:</strong> Hasil unduhan sudah berupa poster lengkap beresolusi tinggi (1080 × 1440 px), siap dicetak atau dibagikan via WhatsApp.
              </li>
              <li>
                <strong className="text-foreground">Meja Capster:</strong> Cetak dan tempatkan pada cermin di setiap kursi pangkas agar pelanggan dapat memindai langsung saat duduk.
              </li>
              <li>
                <strong className="text-foreground">Meja Kasir & Ruang Tunggu:</strong> Tempatkan standee akrilik berisi QR poster ini di area tunggu untuk antrean mandiri.
              </li>
              <li>
                <strong className="text-foreground">Tanpa Aplikasi:</strong> Pelanggan cukup memindai dengan kamera smartphone bawaan tanpa perlu mengunduh aplikasi tambahan.
              </li>
              <li>
                <strong className="text-foreground">Otomatis Terisolasi:</strong> QR Code ini hanya memuat layanan dan antrean barbershop <span className="font-semibold text-foreground">{barbershopName}</span>.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
