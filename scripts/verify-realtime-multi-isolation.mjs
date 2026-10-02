import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const sql = postgres(process.env.DATABASE_URL, { prepare: false });

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runIsolationTest() {
  console.log("==================================================");
  console.log("🚀 TESTING MULTI-CUSTOMER & MULTI-TENANT ISOLATION");
  console.log("==================================================");

  // Get 2 shops
  const shops = await sql`
    SELECT DISTINCT b.id_barbershop, b.slug, c.id_capster, p.id_pelanggan
    FROM barbershop b
    JOIN capster c ON b.id_barbershop = c.id_barbershop
    JOIN pelanggan p ON b.id_barbershop = p.id_barbershop
    LIMIT 2;
  `;

  if (shops.length < 1) throw new Error("At least 1 barbershop needed");
  const shopA = shops[0];
  console.log(`Shop A: ${shopA.slug}`);

  // Create shift for shop A if needed
  const [shiftA] = await sql`SELECT id_shift FROM shift_capster WHERE id_capster = ${shopA.id_capster} LIMIT 1`;
  let shiftIdA = shiftA?.id_shift;
  if (!shiftIdA) {
    const [s] = await sql`
      INSERT INTO shift_capster (id_capster, id_barbershop, tanggal, waktu_mulai, waktu_selesai, status)
      VALUES (${shopA.id_capster}, ${shopA.id_barbershop}, CURRENT_DATE, '09:00', '21:00', 'ongoing')
      RETURNING id_shift;
    `;
    shiftIdA = s.id_shift;
  }

  // Create Customer 1 in Shop A
  const [b1] = await sql`
    INSERT INTO booking (id_barbershop, id_capster, id_pelanggan, tanggal_booking, waktu_booking, status, source)
    VALUES (${shopA.id_barbershop}, ${shopA.id_capster}, ${shopA.id_pelanggan}, CURRENT_DATE, '10:00', 'pending_confirmation', 'scan')
    RETURNING id_booking;
  `;
  const [tx1] = await sql`
    INSERT INTO transaksi (id_barbershop, id_booking, id_shift, id_pelanggan, id_capster, subtotal, diskon, total, status_transaksi)
    VALUES (${shopA.id_barbershop}, ${b1.id_booking}, ${shiftIdA}, ${shopA.id_pelanggan}, ${shopA.id_capster}, 50000, 0, 50000, 'pending')
    RETURNING id_transaksi;
  `;

  // Create Customer 2 in Shop A
  const [b2] = await sql`
    INSERT INTO booking (id_barbershop, id_capster, id_pelanggan, tanggal_booking, waktu_booking, status, source)
    VALUES (${shopA.id_barbershop}, ${shopA.id_capster}, ${shopA.id_pelanggan}, CURRENT_DATE, '10:30', 'pending_confirmation', 'scan')
    RETURNING id_booking;
  `;
  const [tx2] = await sql`
    INSERT INTO transaksi (id_barbershop, id_booking, id_shift, id_pelanggan, id_capster, subtotal, diskon, total, status_transaksi)
    VALUES (${shopA.id_barbershop}, ${b2.id_booking}, ${shiftIdA}, ${shopA.id_pelanggan}, ${shopA.id_capster}, 50000, 0, 50000, 'pending')
    RETURNING id_transaksi;
  `;

  console.log(`Customer 1 Tx: ${tx1.id_transaksi}`);
  console.log(`Customer 2 Tx: ${tx2.id_transaksi}`);

  let customer1Updated = false;
  let customer2Updated = false;

  // Setup channel 1 for Customer 1
  const ch1 = supabase.channel(`customer_tx_${tx1.id_transaksi}`);
  ch1.on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "transaksi",
    filter: `id_transaksi=eq.${tx1.id_transaksi}`,
  }, () => {
    customer1Updated = true;
  });

  // Setup channel 2 for Customer 2
  const ch2 = supabase.channel(`customer_tx_${tx2.id_transaksi}`);
  ch2.on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "transaksi",
    filter: `id_transaksi=eq.${tx2.id_transaksi}`,
  }, () => {
    customer2Updated = true;
  });

  await Promise.all([
    new Promise((resolve) => ch1.subscribe((s) => s === "SUBSCRIBED" && resolve())),
    new Promise((resolve) => ch2.subscribe((s) => s === "SUBSCRIBED" && resolve())),
  ]);
  console.log("✅ Both Customer 1 and Customer 2 channels subscribed.");

  await delay(1000);

  // Update ONLY Customer 1
  console.log("\nUpdating ONLY Customer 1 transaction to 'ongoing'...");
  await sql`UPDATE transaksi SET status_transaksi = 'ongoing', updated_at = NOW() WHERE id_transaksi = ${tx1.id_transaksi};`;

  await delay(2500);

  console.log(`Customer 1 received update: ${customer1Updated}`);
  console.log(`Customer 2 received update: ${customer2Updated}`);

  if (customer1Updated && !customer2Updated) {
    console.log("🎉 SUCCESS: Customer 1 received update, Customer 2 was completely unaffected!");
  } else {
    throw new Error(`Isolation failed! Customer 1: ${customer1Updated}, Customer 2: ${customer2Updated}`);
  }

  // Cleanup
  await supabase.removeChannel(ch1);
  await supabase.removeChannel(ch2);
  await sql`DELETE FROM transaksi WHERE id_transaksi IN (${tx1.id_transaksi}, ${tx2.id_transaksi});`;
  await sql`DELETE FROM booking WHERE id_booking IN (${b1.id_booking}, ${b2.id_booking});`;
  console.log("✅ Isolation test cleanup complete.");
}

runIsolationTest()
  .then(async () => {
    await sql.end();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("❌ Isolation test failed:", e);
    await sql.end();
    process.exit(1);
  });
