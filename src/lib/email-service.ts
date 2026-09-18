import { Resend } from "resend";

export type SendVerificationEmailParams = {
  toEmail: string;
  ownerName: string;
  businessName: string;
  verificationUrl: string;
  expiresInHours?: number;
};

export type EmailSendResult = {
  success: boolean;
  messageId?: string;
  provider: "resend" | "dev-fallback";
  error?: string;
};

// In-memory store untuk dev inspection
type DevEmailRecord = {
  toEmail: string;
  ownerName: string;
  businessName: string;
  verificationUrl: string;
  sentAt: Date;
  status: "sent" | "failed";
  error?: string;
};

const devEmailStore: DevEmailRecord[] = [];

/**
 * Mendapatkan record email verifikasi terakhir (untuk pengujian dev)
 */
export function getDevLatestVerificationEmail(email?: string): DevEmailRecord | undefined {
  if (!email) return devEmailStore[devEmailStore.length - 1];
  return [...devEmailStore]
    .reverse()
    .find((rec) => rec.toEmail.toLowerCase() === email.toLowerCase());
}

/**
 * Template HTML email verifikasi resmi BARBERIN
 */
export function generateVerificationEmailHtml(params: SendVerificationEmailParams): string {
  const { ownerName, businessName, verificationUrl, expiresInHours = 24 } = params;

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verifikasi Email Akun BARBERIN</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #070D18; color: #E2E8F0; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background-color: #0F1D33; border: 1px solid #1E293B; border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
    .header { padding: 32px 40px; background: linear-gradient(135deg, #0A1424 0%, #10233D 100%); text-align: center; border-bottom: 1px solid #1E293B; }
    .logo-text { font-size: 26px; font-weight: 900; letter-spacing: 3px; color: #38BDF8; margin: 0; }
    .subtitle { font-size: 12px; color: #94A3B8; margin-top: 6px; letter-spacing: 0.5px; }
    .content { padding: 40px; }
    .greeting { font-size: 20px; font-weight: 700; color: #FFFFFF; margin-top: 0; margin-bottom: 16px; }
    .text { font-size: 14px; line-height: 1.6; color: #CBD5E1; margin-bottom: 20px; }
    .badge-box { background-color: #14233D; border: 1px solid #233554; border-radius: 14px; padding: 16px 20px; margin-bottom: 28px; }
    .badge-label { font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; font-weight: 600; }
    .badge-value { font-size: 16px; font-weight: 700; color: #F1F5F9; }
    .btn-container { text-align: center; margin: 36px 0; }
    .btn { display: inline-block; background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%); color: #FFFFFF !important; font-size: 15px; font-weight: 800; text-decoration: none; padding: 16px 40px; border-radius: 14px; box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.5); letter-spacing: 1px; text-transform: uppercase; }
    .note-box { background-color: rgba(30, 41, 59, 0.5); border-left: 4px solid #38BDF8; padding: 14px 18px; border-radius: 8px; font-size: 13px; color: #94A3B8; line-height: 1.5; margin-bottom: 28px; }
    .footer { padding: 24px 40px; background-color: #0A1424; text-align: center; font-size: 12px; color: #64748B; border-top: 1px solid #1E293B; }
    .link-alt { word-break: break-all; color: #38BDF8; font-size: 12px; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-text">BARBERIN</div>
      <div class="subtitle">Sistem Manajemen Barbershop Modern</div>
    </div>
    <div class="content">
      <h1 class="greeting">Halo ${ownerName},</h1>
      <p class="text">
        Terima kasih telah mendaftarkan barbershop Anda di <strong>BARBERIN</strong>.
      </p>
      
      <div class="badge-box">
        <div class="badge-label">Barbershop Terdaftar</div>
        <div class="badge-value">${businessName}</div>
      </div>

      <p class="text">
        Untuk mengaktifkan akun Anda, silakan verifikasi alamat email dengan menekan tombol berikut:
      </p>

      <div class="btn-container">
        <a href="${verificationUrl}" class="btn" target="_blank">VERIFIKASI EMAIL</a>
      </div>

      <div class="note-box">
        Link verifikasi berlaku selama <strong>${expiresInHours} jam</strong> dan hanya dapat digunakan satu kali.
      </div>

      <p class="text" style="font-size: 12px; color: #64748B;">
        Jika tombol tidak dapat diklik, salin link berikut ke browser:<br>
        <a href="${verificationUrl}" class="link-alt">${verificationUrl}</a>
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} BARBERIN Platform. Hak cipta dilindungi undang-undang.<br>
      Jika Anda tidak merasa mendaftar di BARBERIN, silakan abaikan email ini.
    </div>
  </div>
</body>
</html>
  `.trim();
}

function cleanEnvValue(val?: string): string | undefined {
  if (!val) return undefined;
  let cleaned = val.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned || undefined;
}

/**
 * Mengirim email verifikasi ke alamat Owner melalui Resend API
 */
export async function sendVerificationEmail(
  params: SendVerificationEmailParams,
): Promise<EmailSendResult> {
  const rawKey = process.env["RESEND_API_KEY"];
  const apiKey = cleanEnvValue(rawKey);
  const fromAddress =
    cleanEnvValue(process.env["EMAIL_FROM"]) || "BARBERIN <onboarding@resend.dev>";
  const html = generateVerificationEmailHtml(params);

  // Plain-text alternative for maximal deliverability
  const text = `
Halo ${params.ownerName},

Terima kasih telah mendaftarkan barbershop Anda di BARBERIN.

Untuk mengaktifkan akun Anda, silakan verifikasi alamat email dengan menekan tautan berikut:
${params.verificationUrl}

Jika tombol tidak dapat diklik, salin link berikut ke browser:
${params.verificationUrl}

Link verifikasi berlaku selama ${params.expiresInHours || 24} jam dan hanya dapat digunakan satu kali.

Salam hangat,
Tim BARBERIN
`.trim();

  // Jika RESEND_API_KEY tersedia, panggil Resend API resmi
  if (apiKey && apiKey !== "your_resend_api_key_here") {
    try {
      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: [params.toEmail],
        subject: "Verifikasi Email Akun BARBERIN",
        html,
        text,
      });

      if (error) {
        console.error("[RESEND API ERROR]", error.name, error.message);

        let helpfulMsg = error.message;
        if (
          error.message.includes("testing emails to your own email address") ||
          error.message.includes("resend.dev")
        ) {
          helpfulMsg =
            `Resend sandbox (${fromAddress}) hanya mengizinkan pengiriman ke alamat email pemilik akun Resend. ` +
            `Untuk mengirim ke ${params.toEmail}, daftarkan dan verifikasi domain kustom di dashboard Resend (https://resend.com/domains), ` +
            `atau uji pendaftaran menggunakan email akun Resend Anda.`;
        }

        devEmailStore.push({
          toEmail: params.toEmail,
          ownerName: params.ownerName,
          businessName: params.businessName,
          verificationUrl: params.verificationUrl,
          sentAt: new Date(),
          status: "failed",
          error: helpfulMsg,
        });

        return {
          success: false,
          error: helpfulMsg,
          provider: "resend",
        };
      }

      console.log(
        `[RESEND API SUCCESS] Email verifikasi berhasil dikirim ke ${params.toEmail}. Message ID: ${data?.id}`,
      );

      devEmailStore.push({
        toEmail: params.toEmail,
        ownerName: params.ownerName,
        businessName: params.businessName,
        verificationUrl: params.verificationUrl,
        sentAt: new Date(),
        status: "sent",
      });

      return {
        success: true,
        messageId: data?.id,
        provider: "resend",
      };
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Kesalahan koneksi saat menghubungi Resend.";
      console.error("[RESEND API EXCEPTION]", msg);
      return {
        success: false,
        error: msg,
        provider: "resend",
      };
    }
  }

  // Jika RESEND_API_KEY belum dikonfigurasi di .env
  const warnMsg =
    "RESEND_API_KEY belum dikonfigurasi di file .env. Masukkan API Key dari https://resend.com/api-keys agar email verifikasi dapat dikirimkan langsung ke kotak masuk " +
    params.toEmail +
    ".";
  console.warn("[EMAIL CONFIG WARNING]", warnMsg);

  devEmailStore.push({
    toEmail: params.toEmail,
    ownerName: params.ownerName,
    businessName: params.businessName,
    verificationUrl: params.verificationUrl,
    sentAt: new Date(),
    status: "failed",
    error: warnMsg,
  });

  return {
    success: false,
    error: warnMsg,
    provider: "resend",
  };
}
