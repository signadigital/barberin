import "dotenv/config";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ DATABASE_URL is not set in environment!");
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false });

async function run() {
  console.log("🚀 Menjalankan migrasi PRICING & SUBSCRIPTION SYSTEM...");

  // 1. ALTER TABLE business: tambah id_barbershop
  console.log("1. Memperbarui tabel business...");
  await sql.unsafe(`
    ALTER TABLE business ADD COLUMN IF NOT EXISTS id_barbershop UUID REFERENCES barbershop(id_barbershop) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS business_barbershop_idx ON business(id_barbershop);
  `);

  // 2. ALTER TABLE plan: tambah is_free & sort_order
  console.log("2. Memperbarui tabel plan...");
  await sql.unsafe(`
    ALTER TABLE plan ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT false;
    ALTER TABLE plan ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 1;
  `);

  // 3. Normalisasi data PLAN sesuai SOURCE OF TRUTH (FREE: 0, PRO: 99.000, ENTERPRISE: 199.000)
  console.log("3. Normalisasi paket langganan (FREE = 0, PRO = 99000, ENTERPRISE = 199000)...");
  await sql.unsafe(`
    INSERT INTO plan (plan_name, description, price, billing_period, status, is_free, sort_order)
    VALUES 
      ('FREE', 'Paket dasar gratis untuk operasional barbershop mandiri.', 0.00, 'monthly', 'active', true, 1),
      ('PRO', 'Paket profesional dengan laporan audit lengkap, komisi capster, dan kuota lebih besar.', 99000.00, 'monthly', 'active', false, 2),
      ('ENTERPRISE', 'Paket enterprise tanpa batas dengan kustomisasi white-label identitas barbershop.', 199000.00, 'monthly', 'active', false, 3)
    ON CONFLICT (plan_name) DO UPDATE SET
      price = EXCLUDED.price,
      billing_period = 'monthly',
      status = 'active',
      is_free = EXCLUDED.is_free,
      sort_order = EXCLUDED.sort_order,
      description = EXCLUDED.description,
      updated_at = NOW();
  `);

  // 4. ALTER TABLE feature: tambah feature_key
  console.log("4. Memperbarui tabel feature...");
  await sql.unsafe(`
    ALTER TABLE feature ADD COLUMN IF NOT EXISTS feature_key VARCHAR(100);
    CREATE UNIQUE INDEX IF NOT EXISTS feature_key_idx ON feature(feature_key);
  `);

  // 5. Seed 14 Master Feature Keys
  console.log("5. Menyiapkan 14 feature keys standar...");
  const standardFeatures = [
    { key: "monthly_cuts", name: "Batas Cukur Bulanan", desc: "Batas jumlah transaksi cukur per bulan kalender", module: "transaksi" },
    { key: "active_capsters", name: "Capster Aktif", desc: "Batas jumlah akun capster aktif yang dapat melayani", module: "capster" },
    { key: "service_catalog", name: "Katalog Layanan", desc: "Batas varian item jasa layanan yang dapat didaftarkan", module: "layanan" },
    { key: "customer_qr_booking", name: "Pemesanan QR Pelanggan", desc: "Pemesanan mandiri via scan QR code pelanggan", module: "booking" },
    { key: "digital_receipt", name: "Struk Digital", desc: "Penerbitan struk transaksi digital pelanggan", module: "struk" },
    { key: "queue_estimation", name: "Estimasi Waktu Antrean", desc: "Kalkulasi estimasi tunggu antrean (simple / dynamic_live)", module: "antrean" },
    { key: "gross_revenue", name: "Total Pendapatan Kotor", desc: "Laporan omzet dan pendapatan kotor harian/bulanan", module: "finance" },
    { key: "payment_audit", name: "Audit Metode Pembayaran", desc: "Pemeriksaan rincian pembayaran tunai, QRIS, dan transfer", module: "audit" },
    { key: "cash_on_hand", name: "Cek Selisih Kas Tunai", desc: "Rekonsiliasi kas fisik di laci dengan sistem kasir", module: "audit" },
    { key: "capster_commission", name: "Komisi Capster", desc: "Perhitungan dan pelaporan komisi bagi hasil capster", module: "komisi" },
    { key: "activity_audit", name: "Log Audit Aktivitas", desc: "Pencatatan jejak audit aktivitas pengguna dan sistem", module: "audit" },
    { key: "financial_audit", name: "Jejak Audit Riwayat Keuangan", desc: "Audit trail mendalam rekonsiliasi dan transaksi kas", module: "audit" },
    { key: "export_data", name: "Ekspor Data (CSV/Excel/PDF)", desc: "Kuota token ekspor data laporan bisnis bulanan", module: "export" },
    { key: "data_retention", name: "Masa Simpan Data & Riwayat", desc: "Batas hari rentang penyimpanan riwayat data transaksi", module: "retention" },
  ];

  for (const f of standardFeatures) {
    await sql`
      INSERT INTO feature (feature_key, feature_name, description, module, status)
      VALUES (${f.key}, ${f.name}, ${f.desc}, ${f.module}, 'active')
      ON CONFLICT (feature_key) DO UPDATE SET
        feature_name = EXCLUDED.feature_name,
        description = EXCLUDED.description,
        module = EXCLUDED.module,
        status = 'active',
        updated_at = NOW();
    `;
  }

  // 6. Buat Tabel plan_feature_limits
  console.log("6. Menyiapkan tabel plan_feature_limits...");
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS plan_feature_limits (
      id_limit BIGSERIAL PRIMARY KEY,
      plan_id BIGINT NOT NULL REFERENCES plan(plan_id) ON DELETE CASCADE,
      feature_key VARCHAR(100) NOT NULL,
      is_enabled BOOLEAN NOT NULL DEFAULT true,
      limit_value INTEGER,
      limit_type VARCHAR(50) NOT NULL DEFAULT 'quota',
      config_value VARCHAR(100),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT plan_feature_limit_unique UNIQUE (plan_id, feature_key)
    );
    CREATE INDEX IF NOT EXISTS pfl_plan_idx ON plan_feature_limits(plan_id);
    CREATE INDEX IF NOT EXISTS pfl_feature_key_idx ON plan_feature_limits(feature_key);
  `);

  // Ambil ID Plan
  const planRows = await sql`SELECT plan_id, plan_name FROM plan;`;
  const planMap = Object.fromEntries(planRows.map((r) => [r.plan_name, r.plan_id]));

  // 7. Seed Matrix Limits Final (Section 10)
  console.log("7. Mengisi konfigurasi Plan Feature Limits...");
  const matrix = [
    // FREE
    { plan: "FREE", key: "monthly_cuts", enabled: true, limit: 50, type: "quota", config: null },
    { plan: "FREE", key: "active_capsters", enabled: true, limit: 1, type: "quota", config: null },
    { plan: "FREE", key: "service_catalog", enabled: true, limit: 4, type: "quota", config: null },
    { plan: "FREE", key: "customer_qr_booking", enabled: true, limit: null, type: "boolean", config: "enabled" },
    { plan: "FREE", key: "digital_receipt", enabled: true, limit: null, type: "boolean", config: "enabled" },
    { plan: "FREE", key: "queue_estimation", enabled: true, limit: null, type: "tier", config: "simple" },
    { plan: "FREE", key: "gross_revenue", enabled: true, limit: null, type: "boolean", config: "enabled" },
    { plan: "FREE", key: "payment_audit", enabled: false, limit: null, type: "boolean", config: "disabled" },
    { plan: "FREE", key: "cash_on_hand", enabled: false, limit: null, type: "boolean", config: "disabled" },
    { plan: "FREE", key: "capster_commission", enabled: false, limit: null, type: "boolean", config: "disabled" },
    { plan: "FREE", key: "activity_audit", enabled: false, limit: null, type: "boolean", config: "disabled" },
    { plan: "FREE", key: "financial_audit", enabled: false, limit: null, type: "boolean", config: "disabled" },
    { plan: "FREE", key: "export_data", enabled: true, limit: 2, type: "quota", config: "2_tokens" },
    { plan: "FREE", key: "data_retention", enabled: true, limit: 14, type: "quota", config: "14_days" },

    // PRO
    { plan: "PRO", key: "monthly_cuts", enabled: true, limit: null, type: "unlimited", config: "unlimited" },
    { plan: "PRO", key: "active_capsters", enabled: true, limit: 5, type: "quota", config: null },
    { plan: "PRO", key: "service_catalog", enabled: true, limit: null, type: "unlimited", config: "unlimited" },
    { plan: "PRO", key: "customer_qr_booking", enabled: true, limit: null, type: "boolean", config: "enabled" },
    { plan: "PRO", key: "digital_receipt", enabled: true, limit: null, type: "boolean", config: "enabled" },
    { plan: "PRO", key: "queue_estimation", enabled: true, limit: null, type: "tier", config: "dynamic_live" },
    { plan: "PRO", key: "gross_revenue", enabled: true, limit: null, type: "boolean", config: "enabled" },
    { plan: "PRO", key: "payment_audit", enabled: true, limit: null, type: "boolean", config: "enabled" },
    { plan: "PRO", key: "cash_on_hand", enabled: true, limit: null, type: "boolean", config: "enabled" },
    { plan: "PRO", key: "capster_commission", enabled: true, limit: null, type: "boolean", config: "enabled" },
    { plan: "PRO", key: "activity_audit", enabled: true, limit: null, type: "boolean", config: "enabled" },
    { plan: "PRO", key: "financial_audit", enabled: true, limit: null, type: "boolean", config: "enabled" },
    { plan: "PRO", key: "export_data", enabled: true, limit: 30, type: "quota", config: "30_tokens" },
    { plan: "PRO", key: "data_retention", enabled: true, limit: 30, type: "quota", config: "30_days" },

    // ENTERPRISE
    { plan: "ENTERPRISE", key: "monthly_cuts", enabled: true, limit: null, type: "unlimited", config: "unlimited" },
    { plan: "ENTERPRISE", key: "active_capsters", enabled: true, limit: null, type: "unlimited", config: "unlimited" },
    { plan: "ENTERPRISE", key: "service_catalog", enabled: true, limit: null, type: "unlimited", config: "unlimited" },
    { plan: "ENTERPRISE", key: "customer_qr_booking", enabled: true, limit: null, type: "boolean", config: "enabled" },
    { plan: "ENTERPRISE", key: "digital_receipt", enabled: true, limit: null, type: "boolean", config: "enabled" },
    { plan: "ENTERPRISE", key: "queue_estimation", enabled: true, limit: null, type: "tier", config: "dynamic_live" },
    { plan: "ENTERPRISE", key: "gross_revenue", enabled: true, limit: null, type: "boolean", config: "enabled" },
    { plan: "ENTERPRISE", key: "payment_audit", enabled: true, limit: null, type: "boolean", config: "enabled" },
    { plan: "ENTERPRISE", key: "cash_on_hand", enabled: true, limit: null, type: "boolean", config: "enabled" },
    { plan: "ENTERPRISE", key: "capster_commission", enabled: true, limit: null, type: "boolean", config: "enabled" },
    { plan: "ENTERPRISE", key: "activity_audit", enabled: true, limit: null, type: "boolean", config: "enabled" },
    { plan: "ENTERPRISE", key: "financial_audit", enabled: true, limit: null, type: "boolean", config: "enabled" },
    { plan: "ENTERPRISE", key: "export_data", enabled: true, limit: null, type: "unlimited", config: "unlimited" },
    { plan: "ENTERPRISE", key: "data_retention", enabled: true, limit: null, type: "unlimited", config: "unlimited" },
  ];

  for (const m of matrix) {
    const planId = planMap[m.plan];
    if (planId) {
      await sql`
        INSERT INTO plan_feature_limits (plan_id, feature_key, is_enabled, limit_value, limit_type, config_value)
        VALUES (${planId}, ${m.key}, ${m.enabled}, ${m.limit}, ${m.type}, ${m.config})
        ON CONFLICT (plan_id, feature_key) DO UPDATE SET
          is_enabled = EXCLUDED.is_enabled,
          limit_value = EXCLUDED.limit_value,
          limit_type = EXCLUDED.limit_type,
          config_value = EXCLUDED.config_value,
          updated_at = NOW();
      `;
    }
  }

  // 8. Buat Tabel subscription_codes (Section 12)
  console.log("8. Menyiapkan tabel subscription_codes...");
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS subscription_codes (
      id_code UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(100) NOT NULL UNIQUE,
      plan_id BIGINT NOT NULL REFERENCES plan(plan_id) ON DELETE RESTRICT,
      jenis VARCHAR(50) NOT NULL DEFAULT 'upgrade',
      durasi_hari INTEGER NOT NULL DEFAULT 30,
      status VARCHAR(50) NOT NULL DEFAULT 'unused',
      id_used_by UUID REFERENCES barbershop(id_barbershop) ON DELETE SET NULL,
      used_at TIMESTAMPTZ,
      expired_at TIMESTAMPTZ,
      created_by UUID REFERENCES users(id_user) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS sub_codes_code_idx ON subscription_codes(code);
    CREATE INDEX IF NOT EXISTS sub_codes_status_idx ON subscription_codes(status);
    CREATE INDEX IF NOT EXISTS sub_codes_plan_idx ON subscription_codes(plan_id);
  `);

  // 9. Buat Tabel subscription_redemptions (Section 13)
  console.log("9. Menyiapkan tabel subscription_redemptions...");
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS subscription_redemptions (
      id_redemption UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      id_barbershop UUID NOT NULL REFERENCES barbershop(id_barbershop) ON DELETE CASCADE,
      id_code UUID NOT NULL REFERENCES subscription_codes(id_code) ON DELETE RESTRICT,
      id_subscription BIGINT NOT NULL REFERENCES subscription(subscription_id) ON DELETE CASCADE,
      redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS sub_redemptions_barbershop_idx ON subscription_redemptions(id_barbershop);
    CREATE INDEX IF NOT EXISTS sub_redemptions_code_idx ON subscription_redemptions(id_code);
    CREATE INDEX IF NOT EXISTS sub_redemptions_subscription_idx ON subscription_redemptions(id_subscription);
  `);

  // 10. Buat Tabel subscription_histories (Section 14)
  console.log("10. Menyiapkan tabel subscription_histories...");
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS subscription_histories (
      id_history UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      id_barbershop UUID NOT NULL REFERENCES barbershop(id_barbershop) ON DELETE CASCADE,
      id_subscription BIGINT NOT NULL REFERENCES subscription(subscription_id) ON DELETE CASCADE,
      id_plan BIGINT NOT NULL REFERENCES plan(plan_id) ON DELETE RESTRICT,
      status VARCHAR(50) NOT NULL,
      start_date TIMESTAMPTZ NOT NULL,
      end_date TIMESTAMPTZ,
      jenis VARCHAR(50) NOT NULL,
      keterangan TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS sub_histories_barbershop_idx ON subscription_histories(id_barbershop);
    CREATE INDEX IF NOT EXISTS sub_histories_subscription_idx ON subscription_histories(id_subscription);
    CREATE INDEX IF NOT EXISTS sub_histories_created_at_idx ON subscription_histories(created_at);
  `);

  // 11. Buat Tabel subscription_usage (Token Ekspor & Penggunaan Bulanan)
  console.log("11. Menyiapkan tabel subscription_usage...");
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS subscription_usage (
      id_usage UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      id_barbershop UUID NOT NULL REFERENCES barbershop(id_barbershop) ON DELETE CASCADE,
      period_month VARCHAR(7) NOT NULL,
      export_token_used INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT sub_usage_barbershop_period_unique UNIQUE (id_barbershop, period_month)
    );
    CREATE INDEX IF NOT EXISTS sub_usage_barbershop_period_idx ON subscription_usage(id_barbershop, period_month);
  `);

  // 12. Update subscription_payment (Tambah kolom id_barbershop, proof_image, notes, verified_by, verified_at)
  console.log("12. Memperbarui tabel subscription_payment...");
  await sql.unsafe(`
    ALTER TABLE subscription_payment ADD COLUMN IF NOT EXISTS id_barbershop UUID REFERENCES barbershop(id_barbershop) ON DELETE CASCADE;
    ALTER TABLE subscription_payment ADD COLUMN IF NOT EXISTS proof_image TEXT;
    ALTER TABLE subscription_payment ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE subscription_payment ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id_user) ON DELETE SET NULL;
    ALTER TABLE subscription_payment ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
  `);

  // 13. Backfill Deterministic untuk Semua Barbershop (Section 6 & 7)
  console.log("13. Melakukan backfill aman & deterministik untuk seluruh tenant barbershop...");
  const barbershops = await sql`
    SELECT b.id_barbershop, b.nama_barbershop, b.created_at, u.id_user, u.email, u.nama_lengkap
    FROM barbershop b
    LEFT JOIN users u ON u.id_barbershop = b.id_barbershop AND u.role = 'owner';
  `;

  const freePlanId = planMap["FREE"];
  if (!freePlanId) {
    throw new Error("FREE plan tidak ditemukan di database!");
  }

  for (const shop of barbershops) {
    // a. Pastikan ada owner record di tabel owner
    let ownerId = null;
    if (shop.id_user) {
      const existingOwner = await sql`
        SELECT owner_id FROM owner WHERE email = ${shop.email} LIMIT 1;
      `;
      if (existingOwner.length > 0) {
        ownerId = existingOwner[0].owner_id;
      } else {
        const [newOwner] = await sql`
          INSERT INTO owner (name, email, password_hash, status)
          VALUES (${shop.nama_lengkap || "Owner " + shop.nama_barbershop}, ${shop.email}, 'MANAGED_VIA_USERS_TABLE', 'active')
          RETURNING owner_id;
        `;
        ownerId = newOwner.owner_id;
      }
    } else {
      // Fallback owner jika belum ada user owner
      const fallbackEmail = `owner_${shop.id_barbershop.slice(0, 8)}@barberin.id`;
      const existingFallback = await sql`
        SELECT owner_id FROM owner WHERE email = ${fallbackEmail} LIMIT 1;
      `;
      if (existingFallback.length > 0) {
        ownerId = existingFallback[0].owner_id;
      } else {
        const [newOwner] = await sql`
          INSERT INTO owner (name, email, password_hash, status)
          VALUES (${shop.nama_barbershop + " Owner"}, ${fallbackEmail}, 'MANAGED_VIA_USERS_TABLE', 'active')
          RETURNING owner_id;
        `;
        ownerId = newOwner.owner_id;
      }
    }

    // b. Pastikan ada business record yang terhubung dengan id_barbershop
    let businessId = null;
    const existingBusiness = await sql`
      SELECT business_id FROM business WHERE id_barbershop = ${shop.id_barbershop} LIMIT 1;
    `;
    if (existingBusiness.length > 0) {
      businessId = existingBusiness[0].business_id;
    } else {
      const [newBusiness] = await sql`
        INSERT INTO business (owner_id, business_name, id_barbershop, status)
        VALUES (${ownerId}, ${shop.nama_barbershop}, ${shop.id_barbershop}, 'active')
        RETURNING business_id;
      `;
      businessId = newBusiness.business_id;
    }

    // c. Pastikan ada subscription aktif (FREE) untuk business ini
    const existingSub = await sql`
      SELECT subscription_id, status FROM subscription 
      WHERE business_id = ${businessId} AND status = 'active' 
      LIMIT 1;
    `;

    if (existingSub.length === 0) {
      const [newSub] = await sql`
        INSERT INTO subscription (business_id, plan_id, status, start_date, end_date)
        VALUES (${businessId}, ${freePlanId}, 'active', ${shop.created_at || new Date()}, NULL)
        RETURNING subscription_id;
      `;

      // d. Rekam riwayat subscription_histories
      await sql`
        INSERT INTO subscription_histories (id_barbershop, id_subscription, id_plan, status, start_date, end_date, jenis, keterangan)
        VALUES (
          ${shop.id_barbershop}, 
          ${newSub.subscription_id}, 
          ${freePlanId}, 
          'active', 
          ${shop.created_at || new Date()}, 
          NULL, 
          'register_free', 
          'Inisialisasi paket gratis (Free) bawaan tenant'
        );
      `;
    }
  }

  console.log("✅ Migrasi dan backfill sistem subscription berhasil diselesaikan!");
  await sql.end();
}

run().catch((err) => {
  console.error("❌ Gagal migrasi pricing & subscription:", err);
  process.exit(1);
});
