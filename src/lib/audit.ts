import { db } from "@/db";
import { auditLog, type NewAuditLog } from "@/db/schema";

export type CreateAuditLogParams = {
  barbershopId: string;
  userId?: string | null | undefined;
  aksi:
    | "create request"
    | "confirm request"
    | "expire request"
    | "cancel request"
    | "start service"
    | "finish service"
    | "payment"
    | "payment confirmation"
    | "transaction completion"
    | "transaction expiration"
    | "Login ke sistem"
    | "Logout dari sistem"
    | string;
  entityType:
    | "permintaan_layanan"
    | "transaksi"
    | "pembayaran"
    | "shift"
    | "login"
    | "logout"
    | "layanan"
    | "keamanan_akun"
    | string;
  entityId?: string | null | undefined;
  alasan?: string | null | undefined;
};

/**
 * Catat aktivitas perubahan status, autentikasi, dan transaksi ke tabel audit_log
 * Terisolasi berdasarkan id_barbershop
 */
export async function logAudit(params: CreateAuditLogParams): Promise<string | null> {
  try {
    const newLog: NewAuditLog = {
      id_barbershop: params.barbershopId,
      id_user: params.userId ?? null,
      aksi: params.aksi,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      alasan: params.alasan ?? null,
    };

    const [inserted] = await db.insert(auditLog).values(newLog).returning({ id_audit: auditLog.id_audit });
    return inserted?.id_audit ?? null;
  } catch (err) {
    console.error("[AUDIT LOG ERROR] Gagal mencatat audit log:", err);
    // Non-blocking agar proses utama tidak gagal hanya karena audit log
    return null;
  }
}
