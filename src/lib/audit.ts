import { db } from "@/db";
import { auditLog, type NewAuditLog } from "@/db/schema";

export type CreateAuditLogParams = {
  barbershopId: string;
  userId?: string | null;
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
    | string;
  entityType: "permintaan_layanan" | "transaksi" | "pembayaran" | "shift" | string;
  entityId?: string | null;
  alasan?: string | null;
};

/**
 * Catat aktivitas perubahan status dan transaksi ke tabel audit_log
 * Terisolasi berdasarkan id_barbershop
 */
export async function logAudit(params: CreateAuditLogParams): Promise<void> {
  try {
    const newLog: NewAuditLog = {
      id_barbershop: params.barbershopId,
      id_user: params.userId ?? null,
      aksi: params.aksi,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      alasan: params.alasan ?? null,
    };

    await db.insert(auditLog).values(newLog);
  } catch (err) {
    console.error("[AUDIT LOG ERROR] Gagal mencatat audit log:", err);
    // Non-blocking agar proses utama tidak gagal hanya karena audit log
  }
}
