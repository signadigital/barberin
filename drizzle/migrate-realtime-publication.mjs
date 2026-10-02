import "dotenv/config";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ DATABASE_URL is not defined in environment");
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false });

async function run() {
  console.log("🚀 Ensuring Supabase Realtime publication includes transaksi, booking, and pembayaran...");

  try {
    // 1. Ensure publication supabase_realtime exists
    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
          CREATE PUBLICATION supabase_realtime;
        END IF;
      END $$;
    `);

    // 2. Add tables to publication if not already present
    const tables = ["transaksi", "booking", "pembayaran"];
    for (const table of tables) {
      const check = await sql.unsafe(`
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = '${table}';
      `);

      if (check.length === 0) {
        console.log(`Adding ${table} to supabase_realtime publication...`);
        await sql.unsafe(`ALTER PUBLICATION supabase_realtime ADD TABLE ${table};`);
      } else {
        console.log(`Table ${table} is already in supabase_realtime publication.`);
      }

      // 3. Set REPLICA IDENTITY FULL so payload.new and payload.old include all columns
      await sql.unsafe(`ALTER TABLE ${table} REPLICA IDENTITY FULL;`);
      console.log(`Table ${table} REPLICA IDENTITY set to FULL.`);
    }

    console.log("✅ Supabase Realtime publication check completed successfully!");
  } catch (err) {
    console.error("❌ Migration error:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
