import React from "react";
import {
  formatRupiah,
  formatTanggal,
  formatWaktu,
  formatTransactionId,
  formatCustomerId,
} from "@/lib/format";
import { paymentMethodName, type ReceiptData } from "@/lib/barberin-store";
import {
  generateCustomerReceiptPdf,
  downloadCustomerReceiptPdf,
  type CustomerReceiptPdfBranding,
  type CustomerReceiptPdfShop,
} from "@/lib/customer-receipt-pdf";

export { generateCustomerReceiptPdf, downloadCustomerReceiptPdf };

export interface CustomerReceiptPdfProps {
  receipt: ReceiptData;
  branding?: CustomerReceiptPdfBranding | null;
  shop?: CustomerReceiptPdfShop | null;
  className?: string;
}

/**
 * CustomerReceiptPdfDocument
 *
 * Komponen dokumen A4 khusus untuk Struk Pelanggan dengan visual watermark 'barberin'
 * dan tata letak profesional sesuai standar laporan resmi.
 */
export function CustomerReceiptPdfDocument({
  receipt,
  branding,
  shop,
  className = "",
}: CustomerReceiptPdfProps) {
  const brandName =
    branding?.nama_brand?.trim() ||
    shop?.nama_barbershop?.trim() ||
    "BARBERIN";
  const tagline =
    branding?.tagline?.trim() || "Modern Barbershop Management System";
  const formattedTxId = formatTransactionId(
    receipt.transactionId,
    receipt.createdAt,
  );
  const formattedCustId = formatCustomerId(
    receipt.customerId,
    receipt.createdAt,
  );
  const primaryColor = branding?.warna_primary || "#2563eb";

  return (
    <div
      className={`relative w-full max-w-[794px] min-h-[1123px] bg-white text-slate-800 p-10 font-sans shadow-lg mx-auto overflow-hidden print:p-8 print:shadow-none ${className}`}
      style={{
        boxSizing: "border-box",
      }}
    >
      {/* Background Watermark Pattern: diagonal repeating 'barberin' */}
      <div
        className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="w-[160%] h-[160%] -translate-x-[20%] -translate-y-[20%] flex flex-wrap content-start gap-x-16 gap-y-12 rotate-[35deg] opacity-[0.08]"
          style={{ color: "#3b82f6" }}
        >
          {Array.from({ length: 180 }).map((_, i) => (
            <span
              key={i}
              className="text-[20px] font-black tracking-wider lowercase"
            >
              barberin
            </span>
          ))}
        </div>
      </div>

      {/* Content Container (Layered safely above the watermark) */}
      <div className="relative z-10 flex flex-col justify-between min-h-[1040px] space-y-6">
        {/* Top Decorative Border */}
        <div
          className="h-1.5 w-full rounded-full"
          style={{ backgroundColor: primaryColor }}
        />

        {/* 1. Header Card */}
        <div className="bg-white/95 border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {branding?.logo_url ? (
              <img
                src={branding.logo_url}
                alt={brandName}
                className="h-12 w-12 object-contain rounded-xl border border-slate-100 p-0.5"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    "/barberin-logo.png";
                }}
              />
            ) : (
              <img
                src="/barberin-logo.png"
                alt="BARBERIN"
                className="h-12 w-12 object-contain"
              />
            )}
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">
                {brandName}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">{tagline}</p>
              {(shop?.alamat || shop?.no_hp) && (
                <p className="text-[11px] text-slate-400 mt-1">
                  {[shop?.alamat, shop?.no_hp].filter(Boolean).join(" • ")}
                </p>
              )}
            </div>
          </div>

          <div className="text-right">
            <span
              className="text-xs font-bold tracking-wider uppercase px-2.5 py-1 rounded-md"
              style={{
                color: primaryColor,
                backgroundColor: `${primaryColor}15`,
              }}
            >
              Struk Transaksi
            </span>
            <div className="text-sm font-mono font-bold text-slate-900 mt-1.5">
              #{formattedTxId}
            </div>
            <div className="text-[11px] text-slate-400">Bukti Pembayaran Sah</div>
          </div>
        </div>

        {/* 2. Metadata Grid Card */}
        <div className="bg-white/95 border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
            Informasi Transaksi
          </h2>
          <div className="grid grid-cols-2 gap-y-2 gap-x-8 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">ID Transaksi</span>
              <span className="font-mono font-semibold text-slate-900">
                {formattedTxId}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tanggal</span>
              <span className="font-semibold text-slate-900">
                {formatTanggal(receipt.createdAt)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">ID Pelanggan</span>
              <span className="font-mono font-semibold text-slate-900">
                {formattedCustId}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Waktu</span>
              <span className="font-semibold text-slate-900">
                {formatWaktu(receipt.createdAt, true)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Nama Pelanggan</span>
              <span className="font-semibold text-slate-900">
                {receipt.customerName || "Pelanggan"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Capster</span>
              <span className="font-semibold text-slate-900">
                {receipt.capster
                  ? `${receipt.capster.name} (${receipt.capster.role || "Barber"})`
                  : "Capster"}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Detail Layanan Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white/95 shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800 text-white font-semibold">
              <tr>
                <th className="py-2.5 px-4 w-12 text-center">NO</th>
                <th className="py-2.5 px-4">LAYANAN / PAKET POTONG</th>
                <th className="py-2.5 px-4 w-16 text-center">QTY</th>
                <th className="py-2.5 px-4 text-right">HARGA SATUAN</th>
                <th className="py-2.5 px-4 text-right">SUBTOTAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {receipt.items.map((item, idx) => (
                <tr
                  key={item.service.id || idx}
                  className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}
                >
                  <td className="py-3 px-4 text-center text-slate-400 font-mono">
                    {idx + 1}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-800">
                    {item.service.name}
                  </td>
                  <td className="py-3 px-4 text-center text-slate-600">
                    {item.quantity}x
                  </td>
                  <td className="py-3 px-4 text-right text-slate-600">
                    {formatRupiah(item.service.price)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900">
                    {formatRupiah(item.service.price * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 4. Ringkasan Pembayaran & Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start pt-2">
          {/* Notes Box */}
          <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-4 text-xs space-y-1.5 text-slate-600">
            <div className="font-bold text-slate-900">Catatan Struk</div>
            <p>• Struk ini merupakan bukti pembayaran transaksi yang sah.</p>
            <p>• Terima kasih telah mempercayakan penampilan Anda kepada kami.</p>
            <p>• Diterbitkan secara resmi oleh {brandName}.</p>
          </div>

          {/* Payment Summary Box */}
          <div className="bg-white/95 border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2.5 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Metode Pembayaran</span>
              <span className="font-bold text-slate-900">
                {paymentMethodName(receipt.paymentMethod)}
              </span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Status Transaksi</span>
              <span className="font-bold text-emerald-600">Berhasil</span>
            </div>
            <div className="border-t border-slate-200 pt-2.5 flex justify-between items-center">
              <span className="text-sm font-bold text-slate-900">TOTAL BAYAR</span>
              <span
                className="text-lg font-black"
                style={{ color: primaryColor }}
              >
                {formatRupiah(receipt.total)}
              </span>
            </div>
          </div>
        </div>

        {/* 5. Footer */}
        <div className="mt-auto pt-6 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
          <div>Dokumen digital resmi diterbitkan melalui Platform BARBERIN</div>
          <div>Halaman 1 dari 1</div>
        </div>
      </div>
    </div>
  );
}
