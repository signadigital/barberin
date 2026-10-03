import "dotenv/config";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ DATABASE_URL is not defined");
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false });

async function run() {
  console.log("🚀 Applying Superadmin Performance Indexes...");

  try {
    // 1. Composite index for fast owner join: users(id_barbershop, role)
    console.log("1. Creating index users_barbershop_role_idx...");
    await sql.unsafe(`
      CREATE INDEX IF NOT EXISTS users_barbershop_role_idx
      ON users (id_barbershop, role);
    `);
    console.log("✓ users_barbershop_role_idx ready.");

    // 2. Composite index for barbershop status filtering & created_at sorting
    console.log("2. Creating index barbershop_status_created_idx...");
    await sql.unsafe(`
      CREATE INDEX IF NOT EXISTS barbershop_status_created_idx
      ON barbershop (status, created_at DESC);
    `);
    console.log("✓ barbershop_status_created_idx ready.");

    // 3. Composite index for subscription lookup by business & status
    console.log("3. Creating index subscription_biz_status_idx...");
    await sql.unsafe(`
      CREATE INDEX IF NOT EXISTS subscription_biz_status_idx
      ON subscription (business_id, status);
    `);
    console.log("✓ subscription_biz_status_idx ready.");

    console.log("🎉 Performance indexes migration completed successfully!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
