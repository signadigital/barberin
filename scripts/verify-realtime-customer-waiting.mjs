import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Supabase URL or Key missing!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const sql = postgres(process.env.DATABASE_URL, { prepare: false });

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTest() {
  console.log("==================================================");
  console.log("🚀 TESTING CUSTOMER WAITING PAGE REALTIME AUTO-UPDATE");
  console.log("==================================================");

  // 1. Get an existing capster, customer and their barbershop
  const [target] = await sql`
    SELECT p.id_pelanggan, c.id_capster, b.id_barbershop, b.slug 
    FROM pelanggan p 
    JOIN capster c ON p.id_barbershop = c.id_barbershop 
    JOIN barbershop b ON p.id_barbershop = b.id_barbershop 
    LIMIT 1
  `;
  if (!target) throw new Error("Matching capster, customer and barbershop not found");
  console.log(`Using barbershop: ${target.slug} (${target.id_barbershop}), Capster: ${target.id_capster}, Pelanggan: ${target.id_pelanggan}`);

  const cap = { id_capster: target.id_capster, id_barbershop: target.id_barbershop, slug: target.slug };
  const cust = { id_pelanggan: target.id_pelanggan };

  const [shift] = await sql`SELECT id_shift FROM shift_capster WHERE id_capster = ${cap.id_capster} AND status = 'ongoing' LIMIT 1`;
  let shiftId = shift?.id_shift;
  if (!shiftId) {
    const [newShift] = await sql`
      INSERT INTO shift_capster (id_capster, id_barbershop, tanggal, waktu_mulai, waktu_selesai, status)
      VALUES (${cap.id_capster}, ${cap.id_barbershop}, CURRENT_DATE, '09:00', '21:00', 'ongoing')
      RETURNING id_shift;
    `;
    shiftId = newShift.id_shift;
  }

  // 2. Create a test booking in 'pending_confirmation' ("Menunggu Konfirmasi Capster")
  console.log("\n--- STEP 1: Creating Customer Booking in 'pending_confirmation' ---");
  const [testBooking] = await sql`
    INSERT INTO booking (
      id_barbershop, id_capster, id_pelanggan, tanggal_booking, waktu_booking,
      status, source, created_at, updated_at
    )
    VALUES (
      ${cap.id_barbershop}, ${cap.id_capster}, ${cust.id_pelanggan}, CURRENT_DATE, '10:00',
      'pending_confirmation', 'scan', NOW(), NOW()
    )
    RETURNING id_booking, status;
  `;
  const bookingId = testBooking.id_booking;
  console.log(`✅ Created Booking: ${bookingId} (status: ${testBooking.status})`);

  // Create corresponding transaksi
  const [testTx] = await sql`
    INSERT INTO transaksi (
      id_barbershop, id_booking, id_shift, id_pelanggan, id_capster,
      subtotal, diskon, total, status_transaksi, created_at, updated_at
    )
    VALUES (
      ${cap.id_barbershop}, ${bookingId}, ${shiftId}, ${cust.id_pelanggan}, ${cap.id_capster},
      50000, 0, 50000, 'pending', NOW(), NOW()
    )
    RETURNING id_transaksi, status_transaksi;
  `;
  const transactionId = testTx.id_transaksi;
  console.log(`✅ Created Transaksi: ${transactionId} (status: ${testTx.status_transaksi})`);

  // Create corresponding pembayaran
  const [testPay] = await sql`
    INSERT INTO pembayaran (
      id_barbershop, id_transaksi, metode_pembayaran, jumlah_bayar, status_pembayaran, created_at, updated_at
    )
    VALUES (
      ${cap.id_barbershop}, ${transactionId}, 'tunai', 50000, 'pending', NOW(), NOW()
    )
    RETURNING id_pembayaran, status_pembayaran;
  `;
  const paymentId = testPay.id_pembayaran;
  console.log(`✅ Created Pembayaran: ${paymentId} (status: ${testPay.status_pembayaran})`);

  // 3. Setup Customer Realtime Subscription exactly as service-execution.tsx does
  console.log("\n--- STEP 2: Setting up Customer Realtime Subscription ---");
  let customerCurrentState = {
    bookingStatus: "pending_confirmation",
    statusTransaksi: "pending",
    statusPembayaran: "pending",
    isPaid: false,
    navigatedToReceipt: false,
  };

  const channelName = `customer_tx_${transactionId}`;
  const channel = supabase.channel(channelName);

  let confirmEventReceived = false;
  let paymentEventReceived = false;

  channel
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "transaksi",
        filter: `id_transaksi=eq.${transactionId}`,
      },
      (payload) => {
        console.log("  📡 [REALTIME EVENT] Transaksi:", payload.eventType, payload.new?.status_transaksi);
        const newStatus = payload.new?.status_transaksi;
        customerCurrentState.statusTransaksi = newStatus;
        if (newStatus === "ongoing") {
          customerCurrentState.bookingStatus = "in_service";
          confirmEventReceived = true;
        } else if (newStatus === "completed" || newStatus === "paid") {
          customerCurrentState.isPaid = true;
          customerCurrentState.navigatedToReceipt = true;
          paymentEventReceived = true;
        }
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "pembayaran",
        filter: `id_transaksi=eq.${transactionId}`,
      },
      (payload) => {
        console.log("  📡 [REALTIME EVENT] Pembayaran:", payload.eventType, payload.new?.status_pembayaran);
        const payStatus = payload.new?.status_pembayaran;
        customerCurrentState.statusPembayaran = payStatus;
        if (payStatus === "success") {
          customerCurrentState.isPaid = true;
          customerCurrentState.navigatedToReceipt = true;
          paymentEventReceived = true;
        }
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "booking",
      },
      (payload) => {
        if (payload?.new?.id_booking === bookingId) {
          console.log("  📡 [REALTIME EVENT] Booking:", payload.eventType, payload.new?.status);
          const bStatus = payload.new?.status;
          customerCurrentState.bookingStatus = bStatus;
          if (bStatus === "in_service") {
            confirmEventReceived = true;
          }
        }
      }
    )
    .on("broadcast", { event: "*" }, (payload) => {
      console.log("  📡 [REALTIME BROADCAST]:", payload.event, payload.payload);
      if (payload.event === "status_updated" && payload.payload?.bookingStatus === "in_service") {
        customerCurrentState.bookingStatus = "in_service";
        confirmEventReceived = true;
      }
      if (payload.event === "payment_confirmed") {
        customerCurrentState.isPaid = true;
        customerCurrentState.navigatedToReceipt = true;
        paymentEventReceived = true;
      }
    });

  // Wait for subscription to be SUBSCRIBED
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Subscription timed out")), 10000);
    channel.subscribe((status) => {
      console.log(`Channel subscription status: ${status}`);
      if (status === "SUBSCRIBED") {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
  console.log("✅ Customer is now SUBSCRIBED to realtime updates!");

  // Wait a moment to ensure CDC stream is ready
  await delay(1000);

  // 4. Simulate Capster confirming booking ("KONFIRMASI LAYANAN")
  console.log("\n--- STEP 3: Capster Confirms Service (State 1 -> State 2) ---");
  console.log("Current Customer UI State: 'Menunggu Konfirmasi Capster'");

  // Update in DB as capsterConfirmBooking does:
  const now = new Date();
  await sql`
    UPDATE booking 
    SET status = 'in_service', waktu_konfirmasi = ${now}, waktu_mulai_layanan = ${now}, updated_at = ${now}
    WHERE id_booking = ${bookingId};
  `;
  await sql`
    UPDATE transaksi
    SET status_transaksi = 'ongoing', updated_at = ${now}
    WHERE id_transaksi = ${transactionId};
  `;

  // Wait up to 5 seconds for Realtime event
  console.log("Waiting for Customer page to detect state change automatically...");
  const confirmStart = Date.now();
  while (!confirmEventReceived && Date.now() - confirmStart < 6000) {
    await delay(200);
  }

  if (customerCurrentState.bookingStatus === "in_service") {
    console.log("🎉 SUCCESS: Customer waiting page automatically received Capster confirmation!");
    console.log("   New Customer UI State: 'Sedang Dilayani di Kursi' (In Service)");
  } else {
    throw new Error(`FAILED: Customer did not receive booking confirmation. State: ${JSON.stringify(customerCurrentState)}`);
  }

  // 5. Simulate Capster confirming payment ("KONFIRMASI PEMBAYARAN")
  console.log("\n--- STEP 4: Capster Confirms Payment (State 2 -> Receipt Navigation) ---");
  const payTime = new Date();
  await sql`
    UPDATE transaksi
    SET status_transaksi = 'completed', waktu_selesai_layanan = ${payTime}, updated_at = ${payTime}
    WHERE id_transaksi = ${transactionId};
  `;
  await sql`
    UPDATE pembayaran
    SET status_pembayaran = 'success', waktu_bayar = ${payTime}, updated_at = ${payTime}
    WHERE id_transaksi = ${transactionId};
  `;

  console.log("Waiting for Customer page to detect payment confirmation automatically...");
  const payStart = Date.now();
  while (!paymentEventReceived && Date.now() - payStart < 6000) {
    await delay(200);
  }

  if (customerCurrentState.isPaid && customerCurrentState.navigatedToReceipt) {
    console.log("🎉 SUCCESS: Customer page automatically detected payment confirmation!");
    console.log(`   Navigated to Receipt: /${cap.slug}/customer/receipt/${transactionId}`);
  } else {
    throw new Error(`FAILED: Customer did not receive payment confirmation. State: ${JSON.stringify(customerCurrentState)}`);
  }

  // 6. Cleanup channel and test records
  console.log("\n--- STEP 5: Cleaning up resources ---");
  await supabase.removeChannel(channel);
  console.log("✅ Realtime channel cleanly unsubscribed.");

  await sql`DELETE FROM pembayaran WHERE id_transaksi = ${transactionId};`;
  await sql`DELETE FROM transaksi WHERE id_transaksi = ${transactionId};`;
  await sql`DELETE FROM booking WHERE id_booking = ${bookingId};`;
  console.log("✅ Test database records cleanly removed.");

  console.log("\n==================================================");
  console.log("✅ ALL REALTIME TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================");
}

runTest()
  .then(async () => {
    await sql.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("❌ Test error:", err);
    await sql.end();
    process.exit(1);
  });
