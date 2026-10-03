import "dotenv/config";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ DATABASE_URL is not defined in environment");
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false });

async function run() {
  console.log("🚀 Menjalankan migrasi database First-Party Website Analytics...");

  try {
    // 1. Tabel analytics_visitors
    console.log("1. Membuat tabel analytics_visitors...");
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS analytics_visitors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        anonymous_id VARCHAR(255) NOT NULL UNIQUE,
        first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS analytics_visitors_anonymous_id_idx ON analytics_visitors(anonymous_id);
    `);
    console.log("✓ Tabel analytics_visitors siap.");

    // 2. Tabel analytics_sessions
    console.log("2. Membuat tabel analytics_sessions...");
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS analytics_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        visitor_id UUID NOT NULL REFERENCES analytics_visitors(id) ON DELETE CASCADE,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ended_at TIMESTAMPTZ,
        last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        landing_page TEXT,
        referrer TEXT,
        utm_source VARCHAR(255),
        utm_medium VARCHAR(255),
        utm_campaign VARCHAR(255),
        utm_content VARCHAR(255),
        utm_term VARCHAR(255),
        device_type VARCHAR(50),
        browser VARCHAR(50),
        operating_system VARCHAR(50)
      );
      CREATE INDEX IF NOT EXISTS analytics_sessions_visitor_idx ON analytics_sessions(visitor_id);
      CREATE INDEX IF NOT EXISTS analytics_sessions_started_at_idx ON analytics_sessions(started_at);
      CREATE INDEX IF NOT EXISTS analytics_sessions_utm_source_idx ON analytics_sessions(utm_source);
      CREATE INDEX IF NOT EXISTS analytics_sessions_utm_medium_idx ON analytics_sessions(utm_medium);
      CREATE INDEX IF NOT EXISTS analytics_sessions_utm_campaign_idx ON analytics_sessions(utm_campaign);
    `);
    console.log("✓ Tabel analytics_sessions siap.");

    // 3. Tabel analytics_page_views
    console.log("3. Membuat tabel analytics_page_views...");
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS analytics_page_views (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES analytics_sessions(id) ON DELETE CASCADE,
        path TEXT NOT NULL,
        page_title TEXT,
        viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        duration_seconds INTEGER
      );
      CREATE INDEX IF NOT EXISTS analytics_page_views_session_idx ON analytics_page_views(session_id);
      CREATE INDEX IF NOT EXISTS analytics_page_views_path_idx ON analytics_page_views(path);
      CREATE INDEX IF NOT EXISTS analytics_page_views_viewed_at_idx ON analytics_page_views(viewed_at);
    `);
    console.log("✓ Tabel analytics_page_views siap.");

    // 4. Tabel analytics_events
    console.log("4. Membuat tabel analytics_events...");
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES analytics_sessions(id) ON DELETE CASCADE,
        event_name VARCHAR(100) NOT NULL,
        path TEXT,
        properties JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS analytics_events_session_idx ON analytics_events(session_id);
      CREATE INDEX IF NOT EXISTS analytics_events_name_idx ON analytics_events(event_name);
      CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON analytics_events(created_at);
    `);
    console.log("✓ Tabel analytics_events siap.");

    console.log("🎉 Migrasi analytics selesai dengan sukses!");
  } catch (err) {
    console.error("❌ Gagal migrasi analytics:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
