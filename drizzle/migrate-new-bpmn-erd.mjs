import "dotenv/config";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ DATABASE_URL is not defined in environment");
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false });

async function run() {
  console.log("🚀 Menjalankan migrasi NEW_BPMN dan NEW_ERD ke Supabase PostgreSQL...");

  // 1. Tambahkan nilai baru pada PostgreSQL ENUMs jika belum ada
  console.log("1. Memperbarui PostgreSQL ENUMs...");
  await sql.unsafe(`
    DO $$ BEGIN
      ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'pending_confirmation';
      ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'waiting';
      ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'in_service';
      ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'awaiting_payment';
      ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'expired';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TYPE transaksi_status ADD VALUE IF NOT EXISTS 'ongoing';
      ALTER TYPE transaksi_status ADD VALUE IF NOT EXISTS 'completed';
      ALTER TYPE transaksi_status ADD VALUE IF NOT EXISTS 'expired';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TYPE pembayaran_status ADD VALUE IF NOT EXISTS 'expired';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  // 2. Tabel pelanggan (tambah id_barbershop, nama_pelanggan, no_hp, foto)
  console.log("2. Memperbarui tabel pelanggan...");
  await sql.unsafe(`
    ALTER TABLE pelanggan ADD COLUMN IF NOT EXISTS id_barbershop UUID REFERENCES barbershop(id_barbershop) ON DELETE CASCADE;
    ALTER TABLE pelanggan ADD COLUMN IF NOT EXISTS nama_pelanggan VARCHAR(255);
    ALTER TABLE pelanggan ADD COLUMN IF NOT EXISTS no_hp VARCHAR(50);
    ALTER TABLE pelanggan ADD COLUMN IF NOT EXISTS foto VARCHAR(500);
    CREATE INDEX IF NOT EXISTS pelanggan_barbershop_idx ON pelanggan(id_barbershop);
  `);

  // Backfill pelanggan id_barbershop dan nama dari users jika ada
  await sql.unsafe(`
    UPDATE pelanggan p
    SET 
      id_barbershop = COALESCE(p.id_barbershop, u.id_barbershop),
      nama_pelanggan = COALESCE(p.nama_pelanggan, u.nama_lengkap),
      no_hp = COALESCE(p.no_hp, u.no_hp)
    FROM users u
    WHERE p.id_user = u.id_user AND (p.id_barbershop IS NULL OR p.nama_pelanggan IS NULL);
  `);

  // 3. Tabel capster (tambah nama_capster, foto)
  console.log("3. Memperbarui tabel capster...");
  await sql.unsafe(`
    ALTER TABLE capster ADD COLUMN IF NOT EXISTS nama_capster VARCHAR(255);
    ALTER TABLE capster ADD COLUMN IF NOT EXISTS foto VARCHAR(500);
  `);
  await sql.unsafe(`
    UPDATE capster c
    SET nama_capster = u.nama_lengkap
    FROM users u
    WHERE c.id_user = u.id_user AND c.nama_capster IS NULL;
  `);

  // 4. Tabel booking (permintaan layanan)
  console.log("4. Memperbarui tabel booking (permintaan_layanan)...");
  await sql.unsafe(`
    ALTER TABLE booking ADD COLUMN IF NOT EXISTS waktu_permintaan TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE booking ADD COLUMN IF NOT EXISTS batas_konfirmasi TIMESTAMPTZ;
    ALTER TABLE booking ADD COLUMN IF NOT EXISTS waktu_konfirmasi TIMESTAMPTZ;
    ALTER TABLE booking ADD COLUMN IF NOT EXISTS waktu_mulai_layanan TIMESTAMPTZ;
    ALTER TABLE booking ADD COLUMN IF NOT EXISTS estimasi_tunggu_menit INTEGER;
    ALTER TABLE booking ADD COLUMN IF NOT EXISTS estimasi_mulai TIMESTAMPTZ;
    ALTER TABLE booking ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'scan';
    ALTER TABLE booking ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
    ALTER TABLE booking ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
    CREATE INDEX IF NOT EXISTS booking_waktu_permintaan_idx ON booking(waktu_permintaan);
    CREATE INDEX IF NOT EXISTS booking_batas_konfirmasi_idx ON booking(batas_konfirmasi);
  `);

  await sql.unsafe(`
    UPDATE booking
    SET 
      waktu_permintaan = COALESCE(waktu_permintaan, created_at, NOW()),
      batas_konfirmasi = COALESCE(batas_konfirmasi, created_at + INTERVAL '5 minutes', NOW() + INTERVAL '5 minutes')
    WHERE batas_konfirmasi IS NULL;
  `);

  // 5. Tabel detail_booking (detail_permintaan snapshot)
  console.log("5. Memperbarui tabel detail_booking (detail_permintaan)...");
  await sql.unsafe(`
    ALTER TABLE detail_booking ADD COLUMN IF NOT EXISTS id_barbershop UUID REFERENCES barbershop(id_barbershop) ON DELETE CASCADE;
    ALTER TABLE detail_booking ADD COLUMN IF NOT EXISTS nama_layanan_snapshot VARCHAR(255);
    ALTER TABLE detail_booking ADD COLUMN IF NOT EXISTS durasi_menit_snapshot INTEGER DEFAULT 30;
    CREATE INDEX IF NOT EXISTS detail_booking_barbershop_idx ON detail_booking(id_barbershop);
  `);

  // Backfill snapshot dari tabel layanan dan booking
  await sql.unsafe(`
    UPDATE detail_booking
    SET 
      id_barbershop = b.id_barbershop,
      nama_layanan_snapshot = COALESCE(detail_booking.nama_layanan_snapshot, l.nama_layanan, 'Layanan'),
      durasi_menit_snapshot = COALESCE(detail_booking.durasi_menit_snapshot, l.durasi_menit, 30)
    FROM booking b, layanan l
    WHERE detail_booking.id_booking = b.id_booking 
      AND detail_booking.id_layanan = l.id_layanan 
      AND (detail_booking.id_barbershop IS NULL OR detail_booking.nama_layanan_snapshot IS NULL);
  `);

  // 6. Tabel shift_capster
  console.log("6. Memperbarui tabel shift_capster...");
  await sql.unsafe(`
    ALTER TABLE shift_capster ADD COLUMN IF NOT EXISTS id_barbershop UUID REFERENCES barbershop(id_barbershop) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS shift_capster_barbershop_idx ON shift_capster(id_barbershop);
  `);

  await sql.unsafe(`
    UPDATE shift_capster
    SET id_barbershop = c.id_barbershop
    FROM capster c
    WHERE shift_capster.id_capster = c.id_capster AND shift_capster.id_barbershop IS NULL;
  `);

  // 7. Tabel transaksi
  console.log("7. Memperbarui tabel transaksi...");
  await sql.unsafe(`
    ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS id_capster UUID REFERENCES capster(id_capster) ON DELETE RESTRICT;
    ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS waktu_selesai_layanan TIMESTAMPTZ;
    ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS batas_pembayaran TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS transaksi_capster_idx ON transaksi(id_capster);
    CREATE INDEX IF NOT EXISTS transaksi_batas_pembayaran_idx ON transaksi(batas_pembayaran);
  `);

  // Backfill id_capster dari shift_capster
  await sql.unsafe(`
    UPDATE transaksi
    SET id_capster = sc.id_capster
    FROM shift_capster sc
    WHERE transaksi.id_shift = sc.id_shift AND transaksi.id_capster IS NULL;
  `);

  // 8. Tabel pembayaran
  console.log("8. Memperbarui tabel pembayaran...");
  await sql.unsafe(`
    ALTER TABLE pembayaran ADD COLUMN IF NOT EXISTS id_barbershop UUID REFERENCES barbershop(id_barbershop) ON DELETE CASCADE;
    ALTER TABLE pembayaran ADD COLUMN IF NOT EXISTS batas_pembayaran TIMESTAMPTZ;
    ALTER TABLE pembayaran ADD COLUMN IF NOT EXISTS dikonfirmasi_oleh UUID REFERENCES users(id_user);
    ALTER TABLE pembayaran ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    CREATE INDEX IF NOT EXISTS pembayaran_barbershop_idx ON pembayaran(id_barbershop);
  `);

  await sql.unsafe(`
    UPDATE pembayaran
    SET id_barbershop = t.id_barbershop
    FROM transaksi t
    WHERE pembayaran.id_transaksi = t.id_transaksi AND pembayaran.id_barbershop IS NULL;
  `);

  // 9. Tabel struk
  console.log("9. Memperbarui tabel struk...");
  await sql.unsafe(`
    ALTER TABLE struk ADD COLUMN IF NOT EXISTS id_barbershop UUID REFERENCES barbershop(id_barbershop) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS struk_barbershop_idx ON struk(id_barbershop);
  `);

  await sql.unsafe(`
    UPDATE struk
    SET id_barbershop = t.id_barbershop
    FROM transaksi t
    WHERE struk.id_transaksi = t.id_transaksi AND struk.id_barbershop IS NULL;
  `);

  // 10. Tabel audit_log
  console.log("10. Menyiapkan tabel audit_log...");
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id_audit UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      id_barbershop UUID NOT NULL REFERENCES barbershop(id_barbershop) ON DELETE CASCADE,
      id_user UUID REFERENCES users(id_user) ON DELETE SET NULL,
      aksi VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id UUID,
      alasan TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS audit_log_barbershop_idx ON audit_log(id_barbershop);
    CREATE INDEX IF NOT EXISTS audit_log_user_idx ON audit_log(id_user);
    CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log(created_at);
  `);

  console.log("✅ Migrasi skema database NEW_BPMN & NEW_ERD berhasil diselesaikan tanpa merusak data!");
  await sql.end();
}

run().catch((err) => {
  console.error("❌ Gagal menjalankan migrasi:", err);
  process.exit(1);
});
