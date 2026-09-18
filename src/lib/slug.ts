import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { barbershop } from "@/db/schema";

/**
 * Sanitize a barbershop name into a clean, URL-safe slug base.
 * Rules:
 * - lowercase
 * - spaces become '-'
 * - remove characters not suitable for URL
 * - no consecutive '--'
 * - trim '-' at start and end
 */
export function formatBarbershopSlug(name: string): string {
  const cleaned = (name || "barbershop")
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // remove non-url chars
    .replace(/\s+/g, "-") // space to -
    .replace(/-+/g, "-") // no double -
    .replace(/^-+|-+$/g, ""); // trim leading/trailing -

  return cleaned || "barbershop";
}

/**
 * Generate a guaranteed unique slug for a barbershop in the database.
 * If collision occurs:
 * - base
 * - base-2
 * - base-3
 * etc.
 */
export async function generateUniqueBarbershopSlug(
  dbOrTx: any,
  name: string,
): Promise<string> {
  const base = formatBarbershopSlug(name);
  let candidate = base;
  let counter = 2;

  while (true) {
    const existing = await dbOrTx
      .select({ id: barbershop.id_barbershop })
      .from(barbershop)
      .where(eq(barbershop.slug, candidate))
      .limit(1);

    if (existing.length === 0) {
      return candidate;
    }

    candidate = `${base}-${counter}`;
    counter++;
  }
}
