import "dotenv/config";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ DATABASE_URL is not defined");
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false });

async function run() {
  console.log("🔍 Checking columns of barbershop_brandings...");
  const cols = await sql`
    SELECT column_name, data_type, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'barbershop_brandings' 
    ORDER BY ordinal_position
  `;
  console.log("Current columns:", cols.map(c => c.column_name));

  // Add display_mode column if not exists
  const hasDisplayMode = cols.some(c => c.column_name === "display_mode");
  if (!hasDisplayMode) {
    console.log("➕ Adding display_mode column (varchar(20) DEFAULT 'dark')...");
    await sql`
      ALTER TABLE barbershop_brandings 
      ADD COLUMN IF NOT EXISTS display_mode VARCHAR(20) NOT NULL DEFAULT 'dark'
    `;
    console.log("✅ display_mode added.");
  } else {
    console.log("ℹ️ display_mode already exists.");
  }

  // Add color_preset column if not exists
  const hasColorPreset = cols.some(c => c.column_name === "color_preset");
  if (!hasColorPreset) {
    console.log("➕ Adding color_preset column (varchar(50) DEFAULT 'purple')...");
    await sql`
      ALTER TABLE barbershop_brandings 
      ADD COLUMN IF NOT EXISTS color_preset VARCHAR(50) NOT NULL DEFAULT 'purple'
    `;
    console.log("✅ color_preset added.");
  } else {
    console.log("ℹ️ color_preset already exists.");
  }

  // Check custom_domains columns
  const domainCols = await sql`
    SELECT column_name, data_type, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'custom_domains' 
    ORDER BY ordinal_position
  `;
  console.log("Current custom_domains columns:", domainCols.map(c => c.column_name));

  await sql.end();
  console.log("🎉 Database migration completed successfully!");
}

run().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
