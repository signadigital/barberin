import "dotenv/config";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ DATABASE_URL is not defined in environment");
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false });

async function run() {
  console.log("🚀 Menjalankan migrasi database White Labeling, Branding, dan Custom Domain...");

  try {
    // 1. Tabel barbershop_brandings
    console.log("1. Membuat tabel barbershop_brandings...");
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS barbershop_brandings (
        id_branding UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        id_barbershop UUID NOT NULL UNIQUE REFERENCES barbershop(id_barbershop) ON DELETE CASCADE,
        nama_brand VARCHAR(100) NOT NULL,
        tagline VARCHAR(150),
        logo_url TEXT,
        favicon_url TEXT,
        warna_primary VARCHAR(20) DEFAULT '#2563EB',
        warna_secondary VARCHAR(20) DEFAULT '#1E293B',
        warna_background VARCHAR(20) DEFAULT '#070D18',
        theme VARCHAR(50) DEFAULT 'default',
        hide_barberin_brand BOOLEAN DEFAULT FALSE,
        meta_title VARCHAR(150),
        meta_description TEXT,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS barbershop_brandings_shop_idx ON barbershop_brandings(id_barbershop);
    `);
    console.log("✓ Tabel barbershop_brandings siap.");

    // 2. Tabel branding_histories
    console.log("2. Membuat tabel branding_histories...");
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS branding_histories (
        id_history UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        id_branding UUID NOT NULL REFERENCES barbershop_brandings(id_branding) ON DELETE CASCADE,
        changed_by UUID REFERENCES users(id_user) ON DELETE SET NULL,
        data_before JSONB,
        data_after JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS branding_histories_branding_idx ON branding_histories(id_branding);
    `);
    console.log("✓ Tabel branding_histories siap.");

    // 3. Tabel custom_domains
    console.log("3. Membuat tabel custom_domains...");
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS custom_domains (
        id_domain UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        id_barbershop UUID NOT NULL REFERENCES barbershop(id_barbershop) ON DELETE CASCADE,
        domain VARCHAR(255) NOT NULL UNIQUE,
        domain_type VARCHAR(50) DEFAULT 'primary',
        dns_name VARCHAR(100) NOT NULL DEFAULT '@',
        dns_value VARCHAR(255) NOT NULL DEFAULT 'cname.barberin.id',
        verification_token VARCHAR(100),
        status VARCHAR(50) DEFAULT 'pending',
        ssl_status VARCHAR(50) DEFAULT 'pending',
        is_primary BOOLEAN DEFAULT FALSE,
        verified_at TIMESTAMPTZ,
        activated_at TIMESTAMPTZ,
        created_by UUID REFERENCES users(id_user) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS custom_domains_shop_idx ON custom_domains(id_barbershop);
      CREATE INDEX IF NOT EXISTS custom_domains_domain_idx ON custom_domains(domain);
    `);
    console.log("✓ Tabel custom_domains siap.");

    // 4. Tabel domain_verification_logs
    console.log("4. Membuat tabel domain_verification_logs...");
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS domain_verification_logs (
        id_log UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        id_domain UUID NOT NULL REFERENCES custom_domains(id_domain) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL,
        response_message TEXT,
        checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS domain_verif_logs_domain_idx ON domain_verification_logs(id_domain);
    `);
    console.log("✓ Tabel domain_verification_logs siap.");

    // 5. Seed default branding record for existing barbershops
    console.log("5. Menyiapkan default branding untuk barbershop yang ada...");
    const shops = await sql`SELECT id_barbershop, nama_barbershop, foto FROM barbershop;`;
    for (const shop of shops) {
      await sql`
        INSERT INTO barbershop_brandings (
          id_barbershop, nama_brand, tagline, logo_url, warna_primary, warna_secondary, warna_background, theme, status
        )
        VALUES (
          ${shop.id_barbershop},
          ${shop.nama_barbershop},
          'Modern Barbershop Management System',
          ${shop.foto || null},
          '#2563EB',
          '#1E293B',
          '#070D18',
          'default',
          'active'
        )
        ON CONFLICT (id_barbershop) DO NOTHING;
      `;
    }
    console.log(`✓ Default branding siap untuk ${shops.length} barbershop.`);

    console.log("\n🎉 SELURUH MIGRASI BRANDING & CUSTOM DOMAIN BERHASIL!");
  } catch (error) {
    console.error("❌ Error saat migrasi:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
