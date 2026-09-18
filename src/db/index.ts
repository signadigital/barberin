import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Use a global singleton in dev to prevent connection leaks during Vite HMR
const globalForDb = globalThis as unknown as {
  conn: ReturnType<typeof postgres> | undefined;
  db: PostgresJsDatabase<typeof schema> | undefined;
};

export function getClient(): ReturnType<typeof postgres> {
  if (typeof window !== "undefined") {
    throw new Error("Cannot access database from client-side code");
  }

  if (globalForDb.conn) {
    return globalForDb.conn;
  }

  const rawUrl = process.env["DATABASE_URL"];
  if (!rawUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  // Supabase pooler pada port 5432 adalah Session Mode (limit max 15 koneksi, rentan EMAXCONNSESSION di serverless Vercel).
  // Port 6543 adalah Transaction Mode yang didesain khusus untuk serverless/Vercel.
  const connectionString = rawUrl.includes("pooler.supabase.com:5432")
    ? rawUrl.replace("pooler.supabase.com:5432", "pooler.supabase.com:6543")
    : rawUrl;

  const conn = postgres(connectionString, {
    prepare: false,
    max: 10,
    idle_timeout: 15,
    max_lifetime: 45,
    connect_timeout: 10,
  });

  if (process.env["NODE_ENV"] !== "production") {
    globalForDb.conn = conn;
  }

  return conn;
}

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (globalForDb.db) {
    return globalForDb.db;
  }

  const conn = getClient();
  const dbInstance = drizzle(conn, { schema });

  if (process.env["NODE_ENV"] !== "production") {
    globalForDb.db = dbInstance;
  }

  return dbInstance;
}

export const client = new Proxy({} as ReturnType<typeof postgres>, {
  get(_target, prop, receiver) {
    const actualClient = getClient();
    const val = Reflect.get(actualClient, prop, receiver);
    return typeof val === "function" ? val.bind(actualClient) : val;
  },
  apply(_target, thisArg, argArray) {
    const actualClient = getClient();
    return Reflect.apply(
      actualClient as unknown as (...args: unknown[]) => unknown,
      thisArg,
      argArray,
    );
  },
});

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    const actualDb = getDb();
    const val = Reflect.get(actualDb, prop, receiver);
    return typeof val === "function" ? val.bind(actualDb) : val;
  },
});
