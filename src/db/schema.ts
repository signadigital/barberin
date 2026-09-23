import {
  pgTable,
  varchar,
  integer,
  numeric,
  timestamp,
  pgEnum,
  text,
  uuid,
  index,
  bigint,
  bigserial,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ==============================
// ENUMS (SESUAI ERD)
// ==============================
export const userRoleEnum = pgEnum("user_role", [
  "pelanggan",
  "capster",
  "owner",
  "admin_platform",
  "superadmin",
]);

export const commonStatusEnum = pgEnum("common_status", [
  "active",
  "inactive",
  "suspended",
]);

export const bookingStatusEnum = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "pending_confirmation",
  "waiting",
  "in_service",
  "awaiting_payment",
  "expired",
]);

export const shiftStatusEnum = pgEnum("shift_status", [
  "ongoing",
  "completed",
  "cancelled",
]);

export const transaksiStatusEnum = pgEnum("transaksi_status", [
  "pending",
  "paid",
  "cancelled",
  "refunded",
  "ongoing",
  "completed",
  "expired",
]);

export const metodePembayaranEnum = pgEnum("metode_pembayaran", [
  "tunai",
  "qris",
  "transfer",
]);

export const pembayaranStatusEnum = pgEnum("pembayaran_status", [
  "pending",
  "success",
  "failed",
  "refunded",
  "expired",
]);

export const komisiStatusEnum = pgEnum("komisi_status", [
  "belum_dibayar",
  "diajukan",
  "dibayar",
  "dibatalkan",
]);

export const pengajuanKomisiStatusEnum = pgEnum("pengajuan_komisi_status", [
  "pending",
  "approved",
  "rejected",
  "paid",
  "cancelled",
]);

export const pembayaranKomisiStatusEnum = pgEnum("pembayaran_komisi_status", [
  "pending",
  "success",
  "failed",
  "cancelled",
]);

export const saldoJenisTransaksiEnum = pgEnum("saldo_jenis_transaksi", [
  "pendapatan",
  "pembayaran_komisi",
  "penyesuaian",
  "pengeluaran",
]);

export const notifikasiTipeEnum = pgEnum("notifikasi_tipe", [
  "pengajuan_komisi",
  "persetujuan_komisi",
  "penolakan_komisi",
  "pembayaran_komisi",
  "info",
  "transaksi",
]);

// ==============================
// 1. USER
// ==============================
export const users = pgTable(
  "users",
  {
    id_user: uuid("id_user").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    password: text("password"),
    nama_lengkap: varchar("nama_lengkap", { length: 255 }).notNull(),
    no_hp: varchar("no_hp", { length: 50 }),
    role: userRoleEnum("role").notNull(),
    status: commonStatusEnum("status").notNull().default("active"),
    id_barbershop: uuid("id_barbershop").references(
      () => barbershop.id_barbershop,
      { onDelete: "set null" },
    ),
    email_verified: boolean("email_verified").notNull().default(false),
    email_verified_at: timestamp("email_verified_at", { mode: "date" }),
    verification_status: varchar("verification_status", { length: 50 })
      .notNull()
      .default("pending"),
    created_at: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("users_role_idx").on(table.role),
    index("users_email_idx").on(table.email),
    index("users_barbershop_idx").on(table.id_barbershop),
  ],
);

// ==============================
// 2. PELANGGAN
// ==============================
export const pelanggan = pgTable(
  "pelanggan",
  {
    id_pelanggan: uuid("id_pelanggan").defaultRandom().primaryKey(),
    id_user: uuid("id_user")
      .notNull()
      .unique()
      .references(() => users.id_user, { onDelete: "cascade" }),
    id_barbershop: uuid("id_barbershop").references(
      () => barbershop.id_barbershop,
      { onDelete: "cascade" },
    ),
    nama_pelanggan: varchar("nama_pelanggan", { length: 255 }),
    no_hp: varchar("no_hp", { length: 50 }),
    alamat: text("alamat"),
    tanggal_lahir: timestamp("tanggal_lahir", { mode: "date" }),
    jenis_kelamin: varchar("jenis_kelamin", { length: 20 }),
    foto: varchar("foto", { length: 500 }),
    created_at: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("pelanggan_user_idx").on(table.id_user),
    index("pelanggan_barbershop_idx").on(table.id_barbershop),
  ],
);

// ==============================
// 3. BARBERSHOP
// ==============================
export const barbershop = pgTable(
  "barbershop",
  {
    id_barbershop: uuid("id_barbershop").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    nama_barbershop: varchar("nama_barbershop", { length: 255 }).notNull(),
    alamat: text("alamat"),
    no_hp: varchar("no_hp", { length: 50 }),
    foto: text("foto"),
    jam_buka: varchar("jam_buka", { length: 20 }),
    jam_tutup: varchar("jam_tutup", { length: 20 }),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    status: commonStatusEnum("status").notNull().default("active"),
    created_at: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("barbershop_slug_idx").on(table.slug)],
);

// ==============================
// 4. CAPSTER
// ==============================
export const capster = pgTable(
  "capster",
  {
    id_capster: uuid("id_capster").defaultRandom().primaryKey(),
    id_user: uuid("id_user")
      .notNull()
      .unique()
      .references(() => users.id_user, { onDelete: "cascade" }),
    id_barbershop: uuid("id_barbershop")
      .notNull()
      .references(() => barbershop.id_barbershop, { onDelete: "cascade" }),
    nama_capster: varchar("nama_capster", { length: 255 }),
    no_pegawai: varchar("no_pegawai", { length: 50 }),
    persentase_komisi: numeric("persentase_komisi", { precision: 5, scale: 2 })
      .notNull()
      .default("15.00"),
    tanggal_bergabung: timestamp("tanggal_bergabung", { mode: "date" }),
    status: commonStatusEnum("status").notNull().default("active"),
    foto: varchar("foto", { length: 500 }),
    created_at: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("capster_user_idx").on(table.id_user),
    index("capster_barbershop_idx").on(table.id_barbershop),
  ],
);

// ==============================
// 5. LAYANAN
// ==============================
export const layanan = pgTable(
  "layanan",
  {
    id_layanan: uuid("id_layanan").defaultRandom().primaryKey(),
    id_barbershop: uuid("id_barbershop")
      .notNull()
      .references(() => barbershop.id_barbershop, { onDelete: "cascade" }),
    nama_layanan: varchar("nama_layanan", { length: 255 }).notNull(),
    deskripsi: text("deskripsi"),
    durasi_menit: integer("durasi_menit"),
    harga: numeric("harga", { precision: 12, scale: 2 }).notNull(),
    status: commonStatusEnum("status").notNull().default("active"),
    created_at: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("layanan_barbershop_idx").on(table.id_barbershop)],
);

// ==============================
// 6. BOOKING (PERMINTAAN_LAYANAN)
// ==============================
export const booking = pgTable(
  "booking",
  {
    id_booking: uuid("id_booking").defaultRandom().primaryKey(),
    id_pelanggan: uuid("id_pelanggan")
      .notNull()
      .references(() => pelanggan.id_pelanggan, { onDelete: "cascade" }),
    id_barbershop: uuid("id_barbershop")
      .notNull()
      .references(() => barbershop.id_barbershop, { onDelete: "cascade" }),
    id_capster: uuid("id_capster").references(() => capster.id_capster, {
      onDelete: "set null",
    }),
    tanggal_booking: timestamp("tanggal_booking", { mode: "date" }).notNull(),
    waktu_booking: varchar("waktu_booking", { length: 30 }).notNull(),
    status: bookingStatusEnum("status").notNull().default("pending_confirmation"),
    catatan: text("catatan"),
    waktu_permintaan: timestamp("waktu_permintaan", { mode: "date" }).notNull().defaultNow(),
    batas_konfirmasi: timestamp("batas_konfirmasi", { mode: "date" }),
    waktu_konfirmasi: timestamp("waktu_konfirmasi", { mode: "date" }),
    waktu_mulai_layanan: timestamp("waktu_mulai_layanan", { mode: "date" }),
    estimasi_tunggu_menit: integer("estimasi_tunggu_menit"),
    estimasi_mulai: timestamp("estimasi_mulai", { mode: "date" }),
    source: varchar("source", { length: 20 }).notNull().default("scan"),
    cancelled_at: timestamp("cancelled_at", { mode: "date" }),
    cancel_reason: text("cancel_reason"),
    created_at: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("booking_pelanggan_idx").on(table.id_pelanggan),
    index("booking_capster_idx").on(table.id_capster),
    index("booking_status_idx").on(table.status),
    index("booking_barbershop_idx").on(table.id_barbershop),
    index("booking_waktu_permintaan_idx").on(table.waktu_permintaan),
    index("booking_batas_konfirmasi_idx").on(table.batas_konfirmasi),
  ],
);

// ==============================
// 7. DETAIL BOOKING (DETAIL_PERMINTAAN)
// ==============================
export const detailBooking = pgTable(
  "detail_booking",
  {
    id_detail_booking: uuid("id_detail_booking").defaultRandom().primaryKey(),
    id_booking: uuid("id_booking")
      .notNull()
      .references(() => booking.id_booking, { onDelete: "cascade" }),
    id_barbershop: uuid("id_barbershop")
      .references(() => barbershop.id_barbershop, { onDelete: "cascade" }),
    id_layanan: uuid("id_layanan")
      .notNull()
      .references(() => layanan.id_layanan, { onDelete: "restrict" }),
    nama_layanan_snapshot: varchar("nama_layanan_snapshot", { length: 255 }),
    durasi_menit_snapshot: integer("durasi_menit_snapshot").default(30),
    harga_satuan: numeric("harga_satuan", { precision: 12, scale: 2 }).notNull(),
    qty: integer("qty").notNull().default(1),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  },
  (table) => [
    index("detail_booking_booking_idx").on(table.id_booking),
    index("detail_booking_layanan_idx").on(table.id_layanan),
    index("detail_booking_barbershop_idx").on(table.id_barbershop),
  ],
);

// ==============================
// 8. SHIFT CAPSTER
// ==============================
export const shiftCapster = pgTable(
  "shift_capster",
  {
    id_shift: uuid("id_shift").defaultRandom().primaryKey(),
    id_capster: uuid("id_capster")
      .notNull()
      .references(() => capster.id_capster, { onDelete: "cascade" }),
    id_barbershop: uuid("id_barbershop").references(
      () => barbershop.id_barbershop,
      { onDelete: "cascade" },
    ),
    tanggal: timestamp("tanggal", { mode: "date" }).notNull(),
    waktu_mulai: varchar("waktu_mulai", { length: 30 }).notNull(),
    waktu_selesai: varchar("waktu_selesai", { length: 30 }),
    status: shiftStatusEnum("status").notNull().default("ongoing"),
    total_transaksi: integer("total_transaksi").notNull().default(0),
    total_pendapatan: numeric("total_pendapatan", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),
    created_at: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("shift_capster_capster_idx").on(table.id_capster),
    index("shift_capster_barbershop_idx").on(table.id_barbershop),
    index("shift_capster_status_idx").on(table.status),
  ],
);

// ==============================
// 9. TRANSAKSI
// ==============================
export const transaksi = pgTable(
  "transaksi",
  {
    id_transaksi: uuid("id_transaksi").defaultRandom().primaryKey(),
    id_barbershop: uuid("id_barbershop").references(
      () => barbershop.id_barbershop,
      { onDelete: "restrict" },
    ),
    id_booking: uuid("id_booking").references(() => booking.id_booking, {
      onDelete: "set null",
    }),
    id_shift: uuid("id_shift")
      .notNull()
      .references(() => shiftCapster.id_shift, { onDelete: "restrict" }),
    id_pelanggan: uuid("id_pelanggan")
      .notNull()
      .references(() => pelanggan.id_pelanggan, { onDelete: "restrict" }),
    id_capster: uuid("id_capster").references(() => capster.id_capster, {
      onDelete: "restrict",
    }),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    diskon: numeric("diskon", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    status_transaksi: transaksiStatusEnum("status_transaksi")
      .notNull()
      .default("pending"),
    waktu_selesai_layanan: timestamp("waktu_selesai_layanan", { mode: "date" }),
    batas_pembayaran: timestamp("batas_pembayaran", { mode: "date" }),
    catatan_pemeriksaan: text("catatan_pemeriksaan"),
    created_at: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("transaksi_barbershop_idx").on(table.id_barbershop),
    index("transaksi_booking_idx").on(table.id_booking),
    index("transaksi_shift_idx").on(table.id_shift),
    index("transaksi_pelanggan_idx").on(table.id_pelanggan),
    index("transaksi_capster_idx").on(table.id_capster),
    index("transaksi_status_idx").on(table.status_transaksi),
    index("transaksi_batas_pembayaran_idx").on(table.batas_pembayaran),
  ],
);

// ==============================
// 10. PEMBAYARAN
// ==============================
export const pembayaran = pgTable(
  "pembayaran",
  {
    id_pembayaran: uuid("id_pembayaran").defaultRandom().primaryKey(),
    id_barbershop: uuid("id_barbershop").references(
      () => barbershop.id_barbershop,
      { onDelete: "cascade" },
    ),
    id_transaksi: uuid("id_transaksi")
      .notNull()
      .references(() => transaksi.id_transaksi, { onDelete: "cascade" }),
    metode_pembayaran: metodePembayaranEnum("metode_pembayaran").notNull(),
    jumlah_bayar: numeric("jumlah_bayar", {
      precision: 12,
      scale: 2,
    }).notNull(),
    status_pembayaran: pembayaranStatusEnum("status_pembayaran")
      .notNull()
      .default("pending"),
    waktu_bayar: timestamp("waktu_bayar", { mode: "date" }),
    batas_pembayaran: timestamp("batas_pembayaran", { mode: "date" }),
    dikonfirmasi_oleh: uuid("dikonfirmasi_oleh").references(() => users.id_user, {
      onDelete: "set null",
    }),
    referensi: varchar("referensi", { length: 255 }),
    created_at: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("pembayaran_transaksi_idx").on(table.id_transaksi),
    index("pembayaran_barbershop_idx").on(table.id_barbershop),
    index("pembayaran_status_idx").on(table.status_pembayaran),
  ],
);

// ==============================
// 11. STRUK
// ==============================
export const struk = pgTable(
  "struk",
  {
    id_struk: uuid("id_struk").defaultRandom().primaryKey(),
    id_barbershop: uuid("id_barbershop").references(
      () => barbershop.id_barbershop,
      { onDelete: "cascade" },
    ),
    id_transaksi: uuid("id_transaksi")
      .notNull()
      .unique()
      .references(() => transaksi.id_transaksi, { onDelete: "cascade" }),
    no_struk: varchar("no_struk", { length: 50 }).notNull().unique(),
    tanggal_cetak: timestamp("tanggal_cetak", { mode: "date" })
      .notNull()
      .defaultNow(),
    url_struk: text("url_struk"),
    created_at: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("struk_transaksi_idx").on(table.id_transaksi),
    index("struk_barbershop_idx").on(table.id_barbershop),
    index("struk_no_struk_idx").on(table.no_struk),
  ],
);

// ==============================
// 12. ALASAN PEMBATALAN
// ==============================
export const alasanPembatalan = pgTable(
  "alasan_pembatalan",
  {
    id_alasan: uuid("id_alasan").defaultRandom().primaryKey(),
    tipe_aktor: varchar("tipe_aktor", { length: 50 }).notNull(), // 'pelanggan' | 'admin/capster'
    alasan: varchar("alasan", { length: 100 }).notNull(),
    created_at: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  }
);

// ==============================
// 13. PEMBATALAN
// ==============================
export const pembatalan = pgTable(
  "pembatalan",
  {
    id_pembatalan: uuid("id_pembatalan").defaultRandom().primaryKey(),
    id_transaksi: uuid("id_transaksi")
      .notNull()
      .references(() => transaksi.id_transaksi, { onDelete: "cascade" }),
    id_alasan: uuid("id_alasan").references(() => alasanPembatalan.id_alasan, {
      onDelete: "set null",
    }),
    dibatalkan_oleh: varchar("dibatalkan_oleh", { length: 50 }).notNull(), // 'pelanggan' | 'admin/capster'
    waktu_pembatalan: timestamp("waktu_pembatalan", { mode: "date" })
      .notNull()
      .defaultNow(),
    catatan: text("catatan"),
    created_at: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("pembatalan_transaksi_idx").on(table.id_transaksi),
    index("pembatalan_alasan_idx").on(table.id_alasan),
  ],
);

// ==============================
// 14. PEMERIKSAAN KEUANGAN (AUDIT KEUANGAN / CASH ON HAND)
// ==============================
export const pemeriksaanKeuangan = pgTable(
  "pemeriksaan_keuangan",
  {
    id_pemeriksaan: uuid("id_pemeriksaan").defaultRandom().primaryKey(),
    id_barbershop: uuid("id_barbershop").references(
      () => barbershop.id_barbershop,
      { onDelete: "cascade" },
    ),
    tanggal: timestamp("tanggal", { mode: "date" }).notNull().defaultNow(),
    periode: varchar("periode", { length: 50 }).notNull(),
    kas_sistem: numeric("kas_sistem", { precision: 12, scale: 2 }).notNull(),
    kas_fisik: numeric("kas_fisik", { precision: 12, scale: 2 }).notNull(),
    selisih: numeric("selisih", { precision: 12, scale: 2 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(), // 'Sesuai' | 'Selisih'
    pemeriksa: varchar("pemeriksa", { length: 100 }).notNull(),
    keterangan: text("keterangan"),
    created_at: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("pemeriksaan_barbershop_idx").on(table.id_barbershop),
  ],
);

// ==============================
// 15. OWNER VERIFICATION TOKENS
// ==============================
export const ownerVerificationTokens = pgTable(
  "owner_verification_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    id_user: uuid("id_user")
      .notNull()
      .references(() => users.id_user, { onDelete: "cascade" }),
    token_hash: varchar("token_hash", { length: 255 }).notNull().unique(),
    expires_at: timestamp("expires_at", { mode: "date" }).notNull(),
    used_at: timestamp("used_at", { mode: "date" }),
    created_at: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("owner_verif_token_hash_idx").on(table.token_hash),
    index("owner_verif_user_idx").on(table.id_user),
  ],
);

// ==============================
// 16. AUDIT LOG (SESUAI NEW_ERD)
// ==============================
export const auditLog = pgTable(
  "audit_log",
  {
    id_audit: uuid("id_audit").defaultRandom().primaryKey(),
    id_barbershop: uuid("id_barbershop")
      .notNull()
      .references(() => barbershop.id_barbershop, { onDelete: "cascade" }),
    id_user: uuid("id_user").references(() => users.id_user, {
      onDelete: "set null",
    }),
    aksi: varchar("aksi", { length: 100 }).notNull(),
    entity_type: varchar("entity_type", { length: 50 }).notNull(),
    entity_id: uuid("entity_id"),
    alasan: text("alasan"),
    created_at: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_log_barbershop_idx").on(table.id_barbershop),
    index("audit_log_user_idx").on(table.id_user),
    index("audit_log_created_at_idx").on(table.created_at),
  ],
);

// ==============================
// 17. KOMISI TRANSAKSI (SESUAI ERD)
// ==============================
export const komisiTransaksi = pgTable(
  "komisi_transaksi",
  {
    id_komisi_trx: uuid("id_komisi_trx").defaultRandom().primaryKey(),
    id_transaksi: uuid("id_transaksi")
      .notNull()
      .references(() => transaksi.id_transaksi, { onDelete: "cascade" }),
    id_capster: uuid("id_capster")
      .notNull()
      .references(() => capster.id_capster, { onDelete: "cascade" }),
    id_barbershop: uuid("id_barbershop")
      .notNull()
      .references(() => barbershop.id_barbershop, { onDelete: "cascade" }),
    persentase_komisi: numeric("persentase_komisi", {
      precision: 5,
      scale: 2,
    }).notNull(),
    dasar_komisi: numeric("dasar_komisi", {
      precision: 12,
      scale: 2,
    }).notNull(),
    nominal_komisi: numeric("nominal_komisi", {
      precision: 12,
      scale: 2,
    }).notNull(),
    status: komisiStatusEnum("status").notNull().default("belum_dibayar"),
    id_pengajuan: uuid("id_pengajuan"),
    created_at: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("komisi_trx_transaksi_idx").on(table.id_transaksi),
    index("komisi_trx_capster_idx").on(table.id_capster),
    index("komisi_trx_barbershop_idx").on(table.id_barbershop),
    index("komisi_trx_status_idx").on(table.status),
    index("komisi_trx_pengajuan_idx").on(table.id_pengajuan),
  ],
);

// ==============================
// 18. PENGAJUAN KOMISI (SESUAI ERD)
// ==============================
export const pengajuanKomisi = pgTable(
  "pengajuan_komisi",
  {
    id_pengajuan: uuid("id_pengajuan").defaultRandom().primaryKey(),
    id_capster: uuid("id_capster")
      .notNull()
      .references(() => capster.id_capster, { onDelete: "cascade" }),
    id_barbershop: uuid("id_barbershop")
      .notNull()
      .references(() => barbershop.id_barbershop, { onDelete: "cascade" }),
    jumlah_pengajuan: numeric("jumlah_pengajuan", {
      precision: 12,
      scale: 2,
    }).notNull(),
    status: pengajuanKomisiStatusEnum("status").notNull().default("pending"),
    keterangan: text("keterangan"),
    diajukan_at: timestamp("diajukan_at", { mode: "date" }).notNull().defaultNow(),
    disetujui_at: timestamp("disetujui_at", { mode: "date" }),
    ditolak_at: timestamp("ditolak_at", { mode: "date" }),
    ditolak_oleh: uuid("ditolak_oleh").references(() => users.id_user, {
      onDelete: "set null",
    }),
    alasan_penolakan: text("alasan_penolakan"),
    created_at: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("pengajuan_komisi_capster_idx").on(table.id_capster),
    index("pengajuan_komisi_barbershop_idx").on(table.id_barbershop),
    index("pengajuan_komisi_status_idx").on(table.status),
    index("pengajuan_komisi_diajukan_idx").on(table.diajukan_at),
  ],
);

// ==============================
// 19. PEMBAYARAN KOMISI (SESUAI ERD)
// ==============================
export const pembayaranKomisi = pgTable(
  "pembayaran_komisi",
  {
    id_pembayaran_komisi: uuid("id_pembayaran_komisi").defaultRandom().primaryKey(),
    id_pengajuan: uuid("id_pengajuan")
      .notNull()
      .references(() => pengajuanKomisi.id_pengajuan, { onDelete: "cascade" }),
    id_barbershop: uuid("id_barbershop")
      .notNull()
      .references(() => barbershop.id_barbershop, { onDelete: "cascade" }),
    jumlah_bayar: numeric("jumlah_bayar", {
      precision: 12,
      scale: 2,
    }).notNull(),
    metode_pembayaran: metodePembayaranEnum("metode_pembayaran").notNull().default("transfer"),
    referensi: varchar("referensi", { length: 255 }),
    status: pembayaranKomisiStatusEnum("status").notNull().default("pending"),
    dibayar_at: timestamp("dibayar_at", { mode: "date" }),
    dibayar_oleh: uuid("dibayar_oleh").references(() => users.id_user, {
      onDelete: "set null",
    }),
    catatan: text("catatan"),
    created_at: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("pembayaran_komisi_pengajuan_idx").on(table.id_pengajuan),
    index("pembayaran_komisi_barbershop_idx").on(table.id_barbershop),
    index("pembayaran_komisi_status_idx").on(table.status),
  ],
);

// ==============================
// 20. SALDO BISNIS (SESUAI ERD)
// ==============================
export const saldoBisnis = pgTable(
  "saldo_bisnis",
  {
    id_saldo: uuid("id_saldo").defaultRandom().primaryKey(),
    id_barbershop: uuid("id_barbershop")
      .notNull()
      .references(() => barbershop.id_barbershop, { onDelete: "cascade" }),
    jenis_transaksi: saldoJenisTransaksiEnum("jenis_transaksi").notNull(),
    referensi_id: varchar("referensi_id", { length: 255 }),
    debit: numeric("debit", { precision: 12, scale: 2 }).notNull().default("0"),
    kredit: numeric("kredit", { precision: 12, scale: 2 }).notNull().default("0"),
    saldo: numeric("saldo", { precision: 12, scale: 2 }).notNull().default("0"),
    keterangan: text("keterangan"),
    created_at: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("saldo_bisnis_barbershop_idx").on(table.id_barbershop),
    index("saldo_bisnis_jenis_idx").on(table.jenis_transaksi),
    index("saldo_bisnis_created_idx").on(table.created_at),
  ],
);

// ==============================
// 21. NOTIFIKASI (SESUAI ERD)
// ==============================
export const notifikasi = pgTable(
  "notifikasi",
  {
    id_notifikasi: uuid("id_notifikasi").defaultRandom().primaryKey(),
    id_user: uuid("id_user")
      .notNull()
      .references(() => users.id_user, { onDelete: "cascade" }),
    id_barbershop: uuid("id_barbershop")
      .notNull()
      .references(() => barbershop.id_barbershop, { onDelete: "cascade" }),
    tipe: notifikasiTipeEnum("tipe").notNull().default("info"),
    judul: varchar("judul", { length: 255 }).notNull(),
    pesan: text("pesan").notNull(),
    is_read: boolean("is_read").notNull().default(false),
    created_at: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("notifikasi_user_idx").on(table.id_user),
    index("notifikasi_barbershop_idx").on(table.id_barbershop),
    index("notifikasi_is_read_idx").on(table.is_read),
    index("notifikasi_created_idx").on(table.created_at),
  ],
);

// ==============================
// RELATIONS
// ==============================
export const usersRelations = relations(users, ({ one, many }) => ({
  pelanggan: one(pelanggan, {
    fields: [users.id_user],
    references: [pelanggan.id_user],
  }),
  capster: one(capster, {
    fields: [users.id_user],
    references: [capster.id_user],
  }),
  barbershop: one(barbershop, {
    fields: [users.id_barbershop],
    references: [barbershop.id_barbershop],
  }),
  verificationTokens: many(ownerVerificationTokens),
}));

export const ownerVerificationTokensRelations = relations(
  ownerVerificationTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [ownerVerificationTokens.id_user],
      references: [users.id_user],
    }),
  }),
);

export const pelangganRelations = relations(pelanggan, ({ one, many }) => ({
  user: one(users, {
    fields: [pelanggan.id_user],
    references: [users.id_user],
  }),
  bookings: many(booking),
  transaksi: many(transaksi),
}));

export const barbershopRelations = relations(barbershop, ({ many }) => ({
  capsters: many(capster),
  layanan: many(layanan),
  bookings: many(booking),
  transaksi: many(transaksi),
  pemeriksaanKeuangan: many(pemeriksaanKeuangan),
}));

export const capsterRelations = relations(capster, ({ one, many }) => ({
  user: one(users, {
    fields: [capster.id_user],
    references: [users.id_user],
  }),
  barbershop: one(barbershop, {
    fields: [capster.id_barbershop],
    references: [barbershop.id_barbershop],
  }),
  shifts: many(shiftCapster),
  bookings: many(booking),
}));

export const layananRelations = relations(layanan, ({ one, many }) => ({
  barbershop: one(barbershop, {
    fields: [layanan.id_barbershop],
    references: [barbershop.id_barbershop],
  }),
  detailBookings: many(detailBooking),
}));

export const bookingRelations = relations(booking, ({ one, many }) => ({
  pelanggan: one(pelanggan, {
    fields: [booking.id_pelanggan],
    references: [pelanggan.id_pelanggan],
  }),
  barbershop: one(barbershop, {
    fields: [booking.id_barbershop],
    references: [barbershop.id_barbershop],
  }),
  capster: one(capster, {
    fields: [booking.id_capster],
    references: [capster.id_capster],
  }),
  detailBookings: many(detailBooking),
  transaksi: one(transaksi, {
    fields: [booking.id_booking],
    references: [transaksi.id_booking],
  }),
}));

export const detailBookingRelations = relations(detailBooking, ({ one }) => ({
  booking: one(booking, {
    fields: [detailBooking.id_booking],
    references: [booking.id_booking],
  }),
  layanan: one(layanan, {
    fields: [detailBooking.id_layanan],
    references: [layanan.id_layanan],
  }),
}));

export const shiftCapsterRelations = relations(shiftCapster, ({ one, many }) => ({
  capster: one(capster, {
    fields: [shiftCapster.id_capster],
    references: [capster.id_capster],
  }),
  transaksi: many(transaksi),
}));

export const transaksiRelations = relations(transaksi, ({ one, many }) => ({
  barbershop: one(barbershop, {
    fields: [transaksi.id_barbershop],
    references: [barbershop.id_barbershop],
  }),
  booking: one(booking, {
    fields: [transaksi.id_booking],
    references: [booking.id_booking],
  }),
  shift: one(shiftCapster, {
    fields: [transaksi.id_shift],
    references: [shiftCapster.id_shift],
  }),
  pelanggan: one(pelanggan, {
    fields: [transaksi.id_pelanggan],
    references: [pelanggan.id_pelanggan],
  }),
  pembayaran: many(pembayaran),
  struk: one(struk, {
    fields: [transaksi.id_transaksi],
    references: [struk.id_transaksi],
  }),
  pembatalan: one(pembatalan, {
    fields: [transaksi.id_transaksi],
    references: [pembatalan.id_transaksi],
  }),
}));

export const pemeriksaanKeuanganRelations = relations(
  pemeriksaanKeuangan,
  ({ one }) => ({
    barbershop: one(barbershop, {
      fields: [pemeriksaanKeuangan.id_barbershop],
      references: [barbershop.id_barbershop],
    }),
  }),
);

export const pembayaranRelations = relations(pembayaran, ({ one }) => ({
  transaksi: one(transaksi, {
    fields: [pembayaran.id_transaksi],
    references: [transaksi.id_transaksi],
  }),
}));

export const strukRelations = relations(struk, ({ one }) => ({
  transaksi: one(transaksi, {
    fields: [struk.id_transaksi],
    references: [transaksi.id_transaksi],
  }),
}));

export const pembatalanRelations = relations(pembatalan, ({ one }) => ({
  transaksi: one(transaksi, {
    fields: [pembatalan.id_transaksi],
    references: [transaksi.id_transaksi],
  }),
  alasan: one(alasanPembatalan, {
    fields: [pembatalan.id_alasan],
    references: [alasanPembatalan.id_alasan],
  }),
}));

export const alasanPembatalanRelations = relations(alasanPembatalan, ({ many }) => ({
  pembatalan: many(pembatalan),
}));

// ==============================
// TYPE HELPERS
// ==============================
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Pelanggan = typeof pelanggan.$inferSelect;
export type NewPelanggan = typeof pelanggan.$inferInsert;

export type Barbershop = typeof barbershop.$inferSelect;
export type NewBarbershop = typeof barbershop.$inferInsert;

export type Capster = typeof capster.$inferSelect;
export type NewCapster = typeof capster.$inferInsert;

export type Layanan = typeof layanan.$inferSelect;
export type NewLayanan = typeof layanan.$inferInsert;

export type Booking = typeof booking.$inferSelect;
export type NewBooking = typeof booking.$inferInsert;

export type DetailBooking = typeof detailBooking.$inferSelect;
export type NewDetailBooking = typeof detailBooking.$inferInsert;

export type ShiftCapster = typeof shiftCapster.$inferSelect;
export type NewShiftCapster = typeof shiftCapster.$inferInsert;

export type Transaksi = typeof transaksi.$inferSelect;
export type NewTransaksi = typeof transaksi.$inferInsert;

export type Pembayaran = typeof pembayaran.$inferSelect;
export type NewPembayaran = typeof pembayaran.$inferInsert;

export type Struk = typeof struk.$inferSelect;
export type NewStruk = typeof struk.$inferInsert;

export type Pembatalan = typeof pembatalan.$inferSelect;
export type NewPembatalan = typeof pembatalan.$inferInsert;

export type AlasanPembatalan = typeof alasanPembatalan.$inferSelect;
export type NewAlasanPembatalan = typeof alasanPembatalan.$inferInsert;

export type OwnerVerificationToken = typeof ownerVerificationTokens.$inferSelect;
export type NewOwnerVerificationToken = typeof ownerVerificationTokens.$inferInsert;

export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;

export type KomisiTransaksi = typeof komisiTransaksi.$inferSelect;
export type NewKomisiTransaksi = typeof komisiTransaksi.$inferInsert;

export type PengajuanKomisi = typeof pengajuanKomisi.$inferSelect;
export type NewPengajuanKomisi = typeof pengajuanKomisi.$inferInsert;

export type PembayaranKomisi = typeof pembayaranKomisi.$inferSelect;
export type NewPembayaranKomisi = typeof pembayaranKomisi.$inferInsert;

export type SaldoBisnis = typeof saldoBisnis.$inferSelect;
export type NewSaldoBisnis = typeof saldoBisnis.$inferInsert;

export type Notifikasi = typeof notifikasi.$inferSelect;
export type NewNotifikasi = typeof notifikasi.$inferInsert;

// ============================================================================
// SAAS PLATFORM / ADMIN PLATFORM SCHEMA (SESUAI GAMBAR 2)
// ============================================================================

// SaaS Platform Enums
export const saasAccountStatusEnum = pgEnum("saas_account_status", [
  "active",
  "inactive",
  "suspended",
]);

export const saasPlanStatusEnum = pgEnum("saas_plan_status", [
  "active",
  "archived",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "pending",
  "active",
  "expired",
  "cancelled",
]);

export const subscriptionPaymentStatusEnum = pgEnum(
  "subscription_payment_status",
  ["pending", "success", "failed", "refunded"],
);

export const demoRequestStatusEnum = pgEnum("demo_request_status", [
  "pending",
  "diproses",
  "selesai",
  "ditolak",
]);

// 1. OWNER (Menyimpan data pemilik akun platform customer yang menggunakan BARBERIN)
export const owner = pgTable(
  "owner",
  {
    owner_id: bigserial("owner_id", { mode: "number" }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    phone: varchar("phone", { length: 50 }),
    password_hash: varchar("password_hash", { length: 255 }).notNull(),
    status: saasAccountStatusEnum("status").notNull().default("active"),
    created_at: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("owner_email_idx").on(table.email),
    index("owner_status_idx").on(table.status),
  ],
);

// 2. BUSINESS (Menyimpan data barbershop/bisnis di bawah Owner)
export const business = pgTable(
  "business",
  {
    business_id: bigserial("business_id", { mode: "number" }).primaryKey(),
    owner_id: bigint("owner_id", { mode: "number" })
      .notNull()
      .references(() => owner.owner_id, { onDelete: "cascade" }),
    business_name: varchar("business_name", { length: 255 }).notNull(),
    status: saasAccountStatusEnum("status").notNull().default("active"),
    created_at: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("business_owner_idx").on(table.owner_id),
    index("business_status_idx").on(table.status),
  ],
);

// 3. PLAN (Menyimpan paket SaaS: FREE, PRO, ENTERPRISE)
export const plan = pgTable(
  "plan",
  {
    plan_id: bigserial("plan_id", { mode: "number" }).primaryKey(),
    plan_name: varchar("plan_name", { length: 100 }).notNull().unique(),
    description: text("description"),
    price: numeric("price", { precision: 12, scale: 2 }).notNull().default("0"),
    billing_period: varchar("billing_period", { length: 50 })
      .notNull()
      .default("monthly"),
    status: saasPlanStatusEnum("status").notNull().default("active"),
    created_at: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("plan_name_idx").on(table.plan_name),
    index("plan_status_idx").on(table.status),
  ],
);

// 4. FEATURE (Menyimpan daftar fitur platform BARBERIN)
export const feature = pgTable(
  "feature",
  {
    feature_id: bigserial("feature_id", { mode: "number" }).primaryKey(),
    feature_name: varchar("feature_name", { length: 255 }).notNull(),
    description: text("description"),
    module: varchar("module", { length: 100 }).notNull(),
    status: commonStatusEnum("status").notNull().default("active"),
    created_at: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("feature_module_idx").on(table.module),
    index("feature_status_idx").on(table.status),
  ],
);

// 5. PLAN_FEATURE (Relasi banyak-ke-banyak antara paket dan fitur)
export const planFeature = pgTable(
  "plan_feature",
  {
    plan_feature_id: bigserial("plan_feature_id", { mode: "number" }).primaryKey(),
    plan_id: bigint("plan_id", { mode: "number" })
      .notNull()
      .references(() => plan.plan_id, { onDelete: "cascade" }),
    feature_id: bigint("feature_id", { mode: "number" })
      .notNull()
      .references(() => feature.feature_id, { onDelete: "cascade" }),
  },
  (table) => [
    index("plan_feature_plan_idx").on(table.plan_id),
    index("plan_feature_feature_idx").on(table.feature_id),
  ],
);

// 6. SUBSCRIPTION (Menyimpan histori langganan business terhadap paket)
export const subscription = pgTable(
  "subscription",
  {
    subscription_id: bigserial("subscription_id", { mode: "number" }).primaryKey(),
    business_id: bigint("business_id", { mode: "number" })
      .notNull()
      .references(() => business.business_id, { onDelete: "cascade" }),
    plan_id: bigint("plan_id", { mode: "number" })
      .notNull()
      .references(() => plan.plan_id, { onDelete: "restrict" }),
    status: subscriptionStatusEnum("status").notNull().default("pending"),
    start_date: timestamp("start_date", { mode: "date" }).notNull().defaultNow(),
    end_date: timestamp("end_date", { mode: "date" }),
    created_at: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("subscription_business_idx").on(table.business_id),
    index("subscription_plan_idx").on(table.plan_id),
    index("subscription_status_idx").on(table.status),
  ],
);

// 7. SUBSCRIPTION_PAYMENT (Menyimpan pembayaran untuk subscription SaaS)
export const subscriptionPayment = pgTable(
  "subscription_payment",
  {
    subscription_payment_id: bigserial("subscription_payment_id", {
      mode: "number",
    }).primaryKey(),
    subscription_id: bigint("subscription_id", { mode: "number" })
      .notNull()
      .references(() => subscription.subscription_id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    payment_method: varchar("payment_method", { length: 50 }).notNull(),
    status: subscriptionPaymentStatusEnum("status").notNull().default("pending"),
    payment_date: timestamp("payment_date", { mode: "date" }).notNull().defaultNow(),
    reference_id: varchar("reference_id", { length: 255 }).notNull().unique(),
    created_at: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("sub_payment_subscription_idx").on(table.subscription_id),
    index("sub_payment_status_idx").on(table.status),
    index("sub_payment_reference_idx").on(table.reference_id),
  ],
);

// 8. DEMO_REQUEST (Menyimpan permintaan demo dari calon pelanggan)
export const demoRequest = pgTable(
  "demo_request",
  {
    demo_request_id: bigserial("demo_request_id", { mode: "number" }).primaryKey(),
    owner_id: bigint("owner_id", { mode: "number" }).references(
      () => owner.owner_id,
      { onDelete: "set null" },
    ),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }).notNull(),
    business_name: varchar("business_name", { length: 255 }),
    status: demoRequestStatusEnum("status").notNull().default("pending"),
    notes: text("notes"),
    created_at: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("demo_request_owner_idx").on(table.owner_id),
    index("demo_request_status_idx").on(table.status),
  ],
);

// ============================================================================
// RELATIONS FOR SAAS PLATFORM SCHEMA
// ============================================================================

export const ownerRelations = relations(owner, ({ many }) => ({
  businesses: many(business),
  demoRequests: many(demoRequest),
}));

export const businessRelations = relations(business, ({ one, many }) => ({
  owner: one(owner, {
    fields: [business.owner_id],
    references: [owner.owner_id],
  }),
  subscriptions: many(subscription),
}));

export const planRelations = relations(plan, ({ many }) => ({
  subscriptions: many(subscription),
  planFeatures: many(planFeature),
}));

export const featureRelations = relations(feature, ({ many }) => ({
  planFeatures: many(planFeature),
}));

export const planFeatureRelations = relations(planFeature, ({ one }) => ({
  plan: one(plan, {
    fields: [planFeature.plan_id],
    references: [plan.plan_id],
  }),
  feature: one(feature, {
    fields: [planFeature.feature_id],
    references: [feature.feature_id],
  }),
}));

export const subscriptionRelations = relations(subscription, ({ one, many }) => ({
  business: one(business, {
    fields: [subscription.business_id],
    references: [business.business_id],
  }),
  plan: one(plan, {
    fields: [subscription.plan_id],
    references: [plan.plan_id],
  }),
  payments: many(subscriptionPayment),
}));

export const subscriptionPaymentRelations = relations(
  subscriptionPayment,
  ({ one }) => ({
    subscription: one(subscription, {
      fields: [subscriptionPayment.subscription_id],
      references: [subscription.subscription_id],
    }),
  }),
);

export const demoRequestRelations = relations(demoRequest, ({ one }) => ({
  owner: one(owner, {
    fields: [demoRequest.owner_id],
    references: [owner.owner_id],
  }),
}));

// ============================================================================
// TYPE HELPERS FOR SAAS PLATFORM
// ============================================================================

export type Owner = typeof owner.$inferSelect;
export type NewOwner = typeof owner.$inferInsert;

export type Business = typeof business.$inferSelect;
export type NewBusiness = typeof business.$inferInsert;

export type Plan = typeof plan.$inferSelect;
export type NewPlan = typeof plan.$inferInsert;

export type Feature = typeof feature.$inferSelect;
export type NewFeature = typeof feature.$inferInsert;

export type PlanFeature = typeof planFeature.$inferSelect;
export type NewPlanFeature = typeof planFeature.$inferInsert;

export type Subscription = typeof subscription.$inferSelect;
export type NewSubscription = typeof subscription.$inferInsert;

export type SubscriptionPayment = typeof subscriptionPayment.$inferSelect;
export type NewSubscriptionPayment = typeof subscriptionPayment.$inferInsert;

export type DemoRequest = typeof demoRequest.$inferSelect;
export type NewDemoRequest = typeof demoRequest.$inferInsert;

// ============================================================================
// SUPERADMIN PLATFORM AUDIT LOGS
// ============================================================================

export const superadminAuditLogs = pgTable(
  "superadmin_audit_logs",
  {
    id_log: uuid("id_log").defaultRandom().primaryKey(),
    action: varchar("action", { length: 100 }).notNull(),
    actor_email: varchar("actor_email", { length: 255 }).notNull(),
    target_tenant_id: uuid("target_tenant_id"),
    target_tenant_name: varchar("target_tenant_name", { length: 255 }),
    details: text("details"),
    created_at: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("superadmin_logs_action_idx").on(table.action),
    index("superadmin_logs_created_idx").on(table.created_at),
  ],
);

export type SuperadminAuditLog = typeof superadminAuditLogs.$inferSelect;
export type NewSuperadminAuditLog = typeof superadminAuditLogs.$inferInsert;