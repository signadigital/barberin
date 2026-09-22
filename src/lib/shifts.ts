import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { capster, shiftCapster, transaksi, users } from "@/db/schema";
import { getWibTimeString } from "@/lib/format";

export const getActiveShift = createServerFn({
  method: "GET",
})
  .validator((data: { capsterId?: string; capsterName?: string } | undefined) => data)
  .handler(async ({ data }) => {
    let capsterId = data?.capsterId;

    if (!capsterId && data?.capsterName) {
      const found = await db
        .select({ id_capster: capster.id_capster })
        .from(capster)
        .innerJoin(users, eq(capster.id_user, users.id_user))
        .where(eq(users.nama_lengkap, data.capsterName))
        .limit(1);

      if (found[0]) {
        capsterId = found[0].id_capster;
      }
    }

    if (!capsterId) {
      return null;
    }

    const rows = await db
      .select()
      .from(shiftCapster)
      .where(
        and(
          eq(shiftCapster.id_capster, capsterId),
          eq(shiftCapster.status, "ongoing"),
        ),
      )
      .orderBy(desc(shiftCapster.created_at))
      .limit(1);

    return rows[0] || null;
  });

export const checkInShift = createServerFn({
  method: "POST",
})
  .validator((data: { capsterId: string }) => data)
  .handler(async ({ data }) => {
    const existing = await db
      .select()
      .from(shiftCapster)
      .where(
        and(
          eq(shiftCapster.id_capster, data.capsterId),
          eq(shiftCapster.status, "ongoing"),
        ),
      )
      .limit(1);

    if (existing[0]) {
      return existing[0];
    }

    const now = new Date();
    const timeStr = getWibTimeString(now);

    const [c] = await db
      .select({ id_barbershop: capster.id_barbershop })
      .from(capster)
      .where(eq(capster.id_capster, data.capsterId))
      .limit(1);

    const [newShift] = await db
      .insert(shiftCapster)
      .values({
        id_capster: data.capsterId,
        id_barbershop: c?.id_barbershop ?? null,
        tanggal: now,
        waktu_mulai: timeStr,
        status: "ongoing",
        total_transaksi: 0,
        total_pendapatan: "0",
      })
      .returning();

    return newShift;
  });

export const endShift = createServerFn({
  method: "POST",
})
  .validator((data: { shiftId: string }) => data)
  .handler(async ({ data }) => {
    const shiftTx = await db
      .select({
        total: transaksi.total,
        status_transaksi: transaksi.status_transaksi,
      })
      .from(transaksi)
      .where(eq(transaksi.id_shift, data.shiftId));

    const totalTransaksi = shiftTx.length;
    const totalPendapatan = shiftTx.reduce((sum, t) => {
      const isPaid = t.status_transaksi === "paid" || t.status_transaksi === "completed";
      return sum + (isPaid ? Number(t.total) : 0);
    }, 0);

    const now = new Date();
    const timeStr = getWibTimeString(now);

    const [updated] = await db
      .update(shiftCapster)
      .set({
        status: "completed",
        waktu_selesai: timeStr,
        total_transaksi: totalTransaksi,
        total_pendapatan: String(totalPendapatan),
        updated_at: now,
      })
      .where(eq(shiftCapster.id_shift, data.shiftId))
      .returning();

    return updated;
  });
