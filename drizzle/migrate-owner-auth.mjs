import "dotenv/config";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not defined in environment");
  process.exit(1);
}

const sql = postgres(connectionString);

async function run() {
  console.log("Menjalankan migrasi kolom dan tabel untuk Owner Registration & Verification...");

  // 1. Kolom baru di tabel users
  await sql.unsafe(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'pending';
  `);
  console.log("Kolom tabel users berhasil diperbarui.");

  // 2. Kolom baru di tabel barbershop
  await sql.unsafe(`
    ALTER TABLE barbershop ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7);
    ALTER TABLE barbershop ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);
  `);
  console.log("Kolom tabel barbershop berhasil diperbarui.");

  // 3. Tabel owner_verification_tokens
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS owner_verification_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      id_user UUID NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS owner_verif_token_hash_idx ON owner_verification_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS owner_verif_user_idx ON owner_verification_tokens(id_user);
  `);
  console.log("Tabel owner_verification_tokens berhasil disiapkan.");

  // 4. Update data existing Owner agar tidak terblokir
  await sql.unsafe(`
    UPDATE users 
    SET email_verified = TRUE, verification_status = 'verified' 
    WHERE role = 'owner' AND (email_verified IS FALSE OR email_verified IS NULL);
  `);
  console.log("Data Owner existing berhasil ditandai sebagai terverifikasi.");

  // 5. Jembatani existing Owner ke tabel SaaS owner & business jika belum ada
  const existingOwners = await sql`
    SELECT u.id_user, u.email, u.nama_lengkap, u.no_hp, u.password, u.status, u.id_barbershop, b.nama_barbershop
    FROM users u
    LEFT JOIN barbershop b ON u.id_barbershop = b.id_barbershop
    WHERE u.role = 'owner';
  `;

  for (const o of existingOwners) {
    const existingSaasOwner = await sql`
      SELECT owner_id FROM owner WHERE email = ${o.email} LIMIT 1;
    `;
    let ownerId;
    if (existingSaasOwner.length === 0) {
      const [insertedOwner] = await sql`
        INSERT INTO owner (name, email, phone, password_hash, status)
        VALUES (${o.nama_lengkap}, ${o.email}, ${o.no_hp || "081200000000"}, ${o.password || "password"}, ${o.status})
        RETURNING owner_id;
      `;
      ownerId = insertedOwner.owner_id;
      console.log(`Synced existing owner ${o.email} to SaaS owner table (ID: ${ownerId})`);
    } else {
      ownerId = existingSaasOwner[0].owner_id;
    }

    const existingSaasBusiness = await sql`
      SELECT business_id FROM business WHERE owner_id = ${ownerId} LIMIT 1;
    `;
    if (existingSaasBusiness.length === 0) {
      const bName = o.nama_barbershop || "BARBERIN Barbershop";
      await sql`
        INSERT INTO business (owner_id, business_name, status)
        VALUES (${ownerId}, ${bName}, ${o.status});
      `;
      console.log(`Synced business '${bName}' to SaaS business table.`);
    }
  }

  console.log("Migrasi selesai dengan sukses!");
  await sql.end();
}

run().catch(async (err) => {
  console.error("Migration error:", err);
  await sql.end();
  process.exit(1);
});
