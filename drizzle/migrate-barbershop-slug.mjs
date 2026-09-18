import postgres from "postgres";
import "dotenv/config";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(dbUrl, { prepare: false });

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function run() {
  console.log("Checking barbershop slugs...");
  const shops = await sql`SELECT id_barbershop, nama_barbershop, slug FROM barbershop ORDER BY created_at ASC`;
  console.log(`Found ${shops.length} barbershops.`);

  const usedSlugs = new Set();

  for (const shop of shops) {
    let slug = shop.slug;
    if (!slug || slug.trim() === "") {
      let baseSlug = generateSlug(shop.nama_barbershop || "barbershop");
      if (!baseSlug) baseSlug = "barbershop";
      slug = baseSlug;
      let counter = 2;
      while (usedSlugs.has(slug)) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      console.log(`Updating shop ${shop.id_barbershop} (${shop.nama_barbershop}) with slug: ${slug}`);
      await sql`UPDATE barbershop SET slug = ${slug} WHERE id_barbershop = ${shop.id_barbershop}`;
    } else {
      if (usedSlugs.has(slug)) {
        let baseSlug = slug;
        let counter = 2;
        while (usedSlugs.has(slug)) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }
        console.log(`Resolving duplicate slug for shop ${shop.id_barbershop}: ${slug}`);
        await sql`UPDATE barbershop SET slug = ${slug} WHERE id_barbershop = ${shop.id_barbershop}`;
      }
    }
    usedSlugs.add(slug);
  }

  // Ensure NOT NULL and UNIQUE constraint
  console.log("Enforcing NOT NULL and UNIQUE on barbershop.slug...");
  try {
    await sql`ALTER TABLE barbershop ALTER COLUMN slug SET NOT NULL;`;
    console.log("Column slug is now NOT NULL.");
  } catch (err) {
    console.warn("Notice on setting NOT NULL:", err.message);
  }

  try {
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS barbershop_slug_unique_idx ON barbershop(slug);`;
    console.log("Unique index barbershop_slug_unique_idx ensured.");
  } catch (err) {
    console.warn("Notice on creating unique index:", err.message);
  }

  const updatedShops = await sql`SELECT id_barbershop, nama_barbershop, slug FROM barbershop`;
  console.table(updatedShops);

  await sql.end();
  console.log("Migration complete!");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
