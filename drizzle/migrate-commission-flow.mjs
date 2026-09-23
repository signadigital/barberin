import "dotenv/config";
import dns from "node:dns";
import { Resolver } from "node:dns/promises";

// Setup DNS fallback for Supabase pooler
try {
  const origLookup = dns.lookup;
  const resolver = new Resolver();
  resolver.setServers(["8.8.8.8", "1.1.1.1"]);
  dns.lookup = (hostname, options, callback) => {
    if (typeof options === "function") {
      callback = options;
      options = {};
    }
    origLookup(hostname, options, (err, address, family) => {
      if (!err) return callback(null, address, family);
      resolver
        .resolve4(hostname)
        .then((addresses) => {
          if (options && options.all) {
            callback(
              null,
              addresses.map((a) => ({ address: a, family: 4 })),
            );
          } else {
            callback(null, addresses[0], 4);
          }
        })
        .catch(() => callback(err, address, family));
    });
  };
} catch {
  // ignore
}

import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ DATABASE_URL is not defined in environment");
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false });

async function run() {
  console.log("🚀 Menjalankan migrasi Fitur Penarikan Komisi Capster ke Supabase PostgreSQL...");

  // 1. Tambah persentase_komisi ke tabel capster
  console.log("1. Memperbarui tabel capster (persentase_komisi)...");
  await sql.unsafe(`
    ALTER TABLE capster ADD COLUMN IF NOT EXISTS persentase_komisi NUMERIC(5, 2) DEFAULT 15.00;
    UPDATE capster SET persentase_komisi = 15.00 WHERE persentase_komisi IS NULL;
  `);

  // 2. Buat ENUM PostgreSQL yang dibutuhkan
  console.log("2. Menyiapkan ENUMs...");
  await sql.unsafe(`
    DO $$ BEGIN
      CREATE TYPE komisi_status AS ENUM ('belum_dibayar', 'diajukan', 'dibayar', 'dibatalkan');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE pengajuan_komisi_status AS ENUM ('pending', 'approved', 'rejected', 'paid', 'cancelled');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE pembayaran_komisi_status AS ENUM ('pending', 'success', 'failed', 'cancelled');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE saldo_jenis_transaksi AS ENUM ('pendapatan', 'pembayaran_komisi', 'penyesuaian', 'pengeluaran');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE notifikasi_tipe AS ENUM ('pengajuan_komisi', 'persetujuan_komisi', 'penolakan_komisi', 'pembayaran_komisi', 'info', 'transaksi');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  // 3. Buat tabel komisi_transaksi
  console.log("3. Menyiapkan tabel komisi_transaksi...");
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS komisi_transaksi (
      id_komisi_trx UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      id_transaksi UUID NOT NULL REFERENCES transaksi(id_transaksi) ON DELETE CASCADE,
      id_capster UUID NOT NULL REFERENCES capster(id_capster) ON DELETE CASCADE,
      id_barbershop UUID NOT NULL REFERENCES barbershop(id_barbershop) ON DELETE CASCADE,
      persentase_komisi NUMERIC(5, 2) NOT NULL,
      dasar_komisi NUMERIC(12, 2) NOT NULL,
      nominal_komisi NUMERIC(12, 2) NOT NULL,
      status komisi_status NOT NULL DEFAULT 'belum_dibayar',
      id_pengajuan UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS komisi_trx_transaksi_idx ON komisi_transaksi(id_transaksi);
    CREATE INDEX IF NOT EXISTS komisi_trx_capster_idx ON komisi_transaksi(id_capster);
    CREATE INDEX IF NOT EXISTS komisi_trx_barbershop_idx ON komisi_transaksi(id_barbershop);
    CREATE INDEX IF NOT EXISTS komisi_trx_status_idx ON komisi_transaksi(status);
    CREATE INDEX IF NOT EXISTS komisi_trx_pengajuan_idx ON komisi_transaksi(id_pengajuan);
  `);

  // 4. Buat tabel pengajuan_komisi
  console.log("4. Menyiapkan tabel pengajuan_komisi...");
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS pengajuan_komisi (
      id_pengajuan UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      id_capster UUID NOT NULL REFERENCES capster(id_capster) ON DELETE CASCADE,
      id_barbershop UUID NOT NULL REFERENCES barbershop(id_barbershop) ON DELETE CASCADE,
      jumlah_pengajuan NUMERIC(12, 2) NOT NULL,
      status pengajuan_komisi_status NOT NULL DEFAULT 'pending',
      keterangan TEXT,
      diajukan_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      disetujui_at TIMESTAMPTZ,
      ditolak_at TIMESTAMPTZ,
      ditolak_oleh UUID REFERENCES users(id_user) ON DELETE SET NULL,
      alasan_penolakan TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS pengajuan_komisi_capster_idx ON pengajuan_komisi(id_capster);
    CREATE INDEX IF NOT EXISTS pengajuan_komisi_barbershop_idx ON pengajuan_komisi(id_barbershop);
    CREATE INDEX IF NOT EXISTS pengajuan_komisi_status_idx ON pengajuan_komisi(status);
    CREATE INDEX IF NOT EXISTS pengajuan_komisi_diajukan_idx ON pengajuan_komisi(diajukan_at);
  `);

  // Update foreign key id_pengajuan di komisi_transaksi
  await sql.unsafe(`
    DO $$ BEGIN
      ALTER TABLE komisi_transaksi
        ADD CONSTRAINT fk_komisi_pengajuan
        FOREIGN KEY (id_pengajuan) REFERENCES pengajuan_komisi(id_pengajuan) ON DELETE SET NULL;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  // 5. Buat tabel pembayaran_komisi
  console.log("5. Menyiapkan tabel pembayaran_komisi...");
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS pembayaran_komisi (
      id_pembayaran_komisi UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      id_pengajuan UUID NOT NULL REFERENCES pengajuan_komisi(id_pengajuan) ON DELETE CASCADE,
      id_barbershop UUID NOT NULL REFERENCES barbershop(id_barbershop) ON DELETE CASCADE,
      jumlah_bayar NUMERIC(12, 2) NOT NULL,
      metode_pembayaran metode_pembayaran NOT NULL DEFAULT 'transfer',
      referensi VARCHAR(255),
      status pembayaran_komisi_status NOT NULL DEFAULT 'pending',
      dibayar_at TIMESTAMPTZ,
      dibayar_oleh UUID REFERENCES users(id_user) ON DELETE SET NULL,
      catatan TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS pembayaran_komisi_pengajuan_idx ON pembayaran_komisi(id_pengajuan);
    CREATE INDEX IF NOT EXISTS pembayaran_komisi_barbershop_idx ON pembayaran_komisi(id_barbershop);
    CREATE INDEX IF NOT EXISTS pembayaran_komisi_status_idx ON pembayaran_komisi(status);
  `);

  // 6. Buat tabel saldo_bisnis
  console.log("6. Menyiapkan tabel saldo_bisnis...");
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS saldo_bisnis (
      id_saldo UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      id_barbershop UUID NOT NULL REFERENCES barbershop(id_barbershop) ON DELETE CASCADE,
      jenis_transaksi saldo_jenis_transaksi NOT NULL,
      referensi_id VARCHAR(255),
      debit NUMERIC(12, 2) NOT NULL DEFAULT 0,
      kredit NUMERIC(12, 2) NOT NULL DEFAULT 0,
      saldo NUMERIC(12, 2) NOT NULL DEFAULT 0,
      keterangan TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS saldo_bisnis_barbershop_idx ON saldo_bisnis(id_barbershop);
    CREATE INDEX IF NOT EXISTS saldo_bisnis_jenis_idx ON saldo_bisnis(jenis_transaksi);
    CREATE INDEX IF NOT EXISTS saldo_bisnis_created_idx ON saldo_bisnis(created_at);
  `);

  // 7. Buat tabel notifikasi
  console.log("7. Menyiapkan tabel notifikasi...");
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS notifikasi (
      id_notifikasi UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      id_user UUID NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
      id_barbershop UUID NOT NULL REFERENCES barbershop(id_barbershop) ON DELETE CASCADE,
      tipe notifikasi_tipe NOT NULL DEFAULT 'info',
      judul VARCHAR(255) NOT NULL,
      pesan TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS notifikasi_user_idx ON notifikasi(id_user);
    CREATE INDEX IF NOT EXISTS notifikasi_barbershop_idx ON notifikasi(id_barbershop);
    CREATE INDEX IF NOT EXISTS notifikasi_is_read_idx ON notifikasi(is_read);
    CREATE INDEX IF NOT EXISTS notifikasi_created_idx ON notifikasi(created_at);
  `);

  // 8. Inisialisasi saldo bisnis untuk barbershop yang belum memiliki saldo bisnis
  console.log("8. Memeriksa saldo awal bisnis untuk barbershop...");
  const shops = await sql`SELECT id_barbershop, nama_barbershop FROM barbershop`;
  for (const shop of shops) {
    const [existing] = await sql`
      SELECT id_saldo FROM saldo_bisnis WHERE id_barbershop = ${shop.id_barbershop} LIMIT 1
    `;
    if (!existing) {
      // Hitung total dari transaksi completed/paid yang ada
      const [rev] = await sql`
        SELECT COALESCE(SUM(total), 0) as total_rev
        FROM transaksi
        WHERE id_barbershop = ${shop.id_barbershop}
          AND status_transaksi IN ('paid', 'completed')
      `;
      const initialRevenue = Number(rev?.total_rev || 0);
      const startingBalance = Math.max(initialRevenue, 1000000); // minimal 1jt saldo awal bisnis

      await sql`
        INSERT INTO saldo_bisnis (
          id_barbershop,
          jenis_transaksi,
          referensi_id,
          debit,
          kredit,
          saldo,
          keterangan
        ) VALUES (
          ${shop.id_barbershop},
          'pendapatan',
          'INIT_BALANCE',
          ${startingBalance},
          0,
          ${startingBalance},
          ${`Saldo awal operasional ${shop.nama_barbershop}`}
        );
      `;
      console.log(`  Initialized saldo bisnis untuk ${shop.nama_barbershop}: Rp ${startingBalance.toLocaleString("id-ID")}`);
    }
  }

  // 9. Konfigurasi RLS Supabase
  console.log("9. Mengonfigurasi Row Level Security (RLS)...");
  await sql.unsafe(`
    ALTER TABLE komisi_transaksi ENABLE ROW LEVEL SECURITY;
    ALTER TABLE pengajuan_komisi ENABLE ROW LEVEL SECURITY;
    ALTER TABLE pembayaran_komisi ENABLE ROW LEVEL SECURITY;
    ALTER TABLE saldo_bisnis ENABLE ROW LEVEL SECURITY;
    ALTER TABLE notifikasi ENABLE ROW LEVEL SECURITY;

    -- Policy untuk service role / server queries (full access)
    DO $$ BEGIN
      CREATE POLICY "komisi_transaksi_all" ON komisi_transaksi FOR ALL USING (true);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE POLICY "pengajuan_komisi_all" ON pengajuan_komisi FOR ALL USING (true);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE POLICY "pembayaran_komisi_all" ON pembayaran_komisi FOR ALL USING (true);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE POLICY "saldo_bisnis_all" ON saldo_bisnis FOR ALL USING (true);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE POLICY "notifikasi_all" ON notifikasi FOR ALL USING (true);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  console.log("✅ Migrasi skema database Fitur Komisi Capster berhasil diselesaikan!");
  await sql.end();
}

run().catch((err) => {
  console.error("❌ Gagal menjalankan migrasi komisi:", err);
  process.exit(1);
});
