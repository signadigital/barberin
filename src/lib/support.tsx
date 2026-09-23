import React from "react";

/**
 * BARBERIN Official Support Contacts & WhatsApp Deep Link Utilities
 */

export interface SupportContact {
  name: string;
  phone: string; // International WhatsApp format without symbols, e.g. "6282135202388"
  phoneDisplay: string; // Formatted for UI, e.g. "+62 821-3520-2388"
  role: string;
  description: string;
}

export const BARBERIN_SUPPORT_CONTACTS: SupportContact[] = [
  {
    name: "Fibula",
    phone: "6282135202388",
    phoneDisplay: "+62 821-3520-2388",
    role: "Customer Support",
    description: "Bantuan operasional harian, panduan sistem, dan pertanyaan umum.",
  },
  {
    name: "Nabila",
    phone: "6282211955788",
    phoneDisplay: "+62 822-1195-5788",
    role: "Technical Support",
    description: "Bantuan teknis transaksi, data komisi capster, dan kendala fitur.",
  },
];

/**
 * Generate standard WhatsApp deep link with URL-encoded chat template
 */
export function generateWhatsAppSupportUrl(options: {
  phone: string;
  barbershopName: string;
  pageName?: string;
}): string {
  const page = options.pageName || "Pusat Bantuan";
  const cleanPhone = options.phone.replace(/[^0-9]/g, "");

  const template = `Halo Tim BARBERIN, saya membutuhkan bantuan terkait sistem BARBERIN.

Nama Barbershop: ${options.barbershopName}
Halaman: ${page}

Kendala/Pertanyaan:

[Silakan tuliskan kendala atau pertanyaan Anda]

Terima kasih.`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(template)}`;
}

/**
 * WhatsApp SVG Icon Component
 */
export function WhatsAppIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.423-14.416c-6.627 0-12 5.373-12 12 0 2.148.567 4.167 1.559 5.914l-1.567 5.726 5.867-1.539c1.684.919 3.613 1.445 5.666 1.445 6.627 0 12-5.373 12-12s-5.373-12-12-12zm0 21.6c-1.897 0-3.661-.555-5.147-1.512l-.369-.239-3.486.914.93-3.398-.263-.418c-1.077-1.569-1.665-3.434-1.665-5.347 0-5.293 4.307-9.6 9.6-9.6 5.292 0 9.6 4.307 9.6 9.6 0 5.293-4.308 9.6-9.6 9.6z" />
    </svg>
  );
}
