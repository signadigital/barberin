import "dotenv/config";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL is not set!");
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false });

async function run() {
  console.log("🚀 Menjalankan migrasi audit_log (RLS, Indexes, & Historical Event Logging)...");

  // 1. Pastikan index komposit id_barbershop + created_at
  console.log("1. Membuat index komposit audit_log (id_barbershop, created_at DESC)...");
  await sql`
    CREATE INDEX IF NOT EXISTS audit_log_barbershop_created_idx 
    ON audit_log (id_barbershop, created_at DESC);
  `;

  // 2. Aktifkan Row Level Security (RLS) pada audit_log
  console.log("2. Mengaktifkan Row Level Security (RLS) pada audit_log...");
  await sql`
    ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
  `;

  // 3. Konfigurasi RLS policy untuk audit_log
  console.log("3. Membuat RLS policy audit_log_all untuk server queries...");
  await sql.unsafe(`
    DO $$ BEGIN
      CREATE POLICY "audit_log_all" ON audit_log FOR ALL USING (true);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  // 4. Backfill historical transactions yang belum memiliki record di audit_log
  console.log("4. Menyinkronkan audit_log untuk riwayat transaksi...");
  const txResult = await sql`
    INSERT INTO audit_log (id_barbershop, id_user, aksi, entity_type, entity_id, alasan, created_at)
    SELECT 
      t.id_barbershop, 
      c.id_user, 
      CASE WHEN t.status_transaksi::text = 'cancelled' THEN 'cancel request' ELSE 'transaction completion' END,
      CASE WHEN t.status_transaksi::text = 'cancelled' THEN 'pembatalan' ELSE 'transaksi' END,
      t.id_transaksi,
      'Riwayat transaksi ' || COALESCE(t.status_transaksi::text, 'completed'),
      t.created_at
    FROM transaksi t
    LEFT JOIN shift_capster s ON t.id_shift = s.id_shift
    LEFT JOIN capster c ON s.id_capster = c.id_capster
    WHERE t.id_barbershop IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM audit_log a WHERE a.entity_id = t.id_transaksi
    )
    RETURNING id_audit;
  `;
  console.log(`✓ ${txResult.length} riwayat transaksi lama disinkronkan ke audit_log.`);

  // 5. Backfill historical shifts yang belum memiliki record di audit_log
  console.log("5. Menyinkronkan audit_log untuk riwayat shift capster...");
  const shiftResult = await sql`
    INSERT INTO audit_log (id_barbershop, id_user, aksi, entity_type, entity_id, alasan, created_at)
    SELECT 
      s.id_barbershop, 
      c.id_user, 
      CASE WHEN s.status = 'completed' THEN 'Menutup shift' ELSE 'Membuka shift' END,
      'shift',
      s.id_shift,
      'Shift status: ' || s.status,
      s.created_at
    FROM shift_capster s
    LEFT JOIN capster c ON s.id_capster = c.id_capster
    WHERE s.id_barbershop IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM audit_log a WHERE a.entity_id = s.id_shift
    )
    RETURNING id_audit;
  `;
  console.log(`✓ ${shiftResult.length} riwayat shift lama disinkronkan ke audit_log.`);

  console.log("✅ Migrasi audit_log selesai dengan sukses!");
  await sql.end();
}

run().catch((err) => {
  console.error("❌ Gagal menjalankan migrasi audit_log:", err);
  process.exit(1);
});
