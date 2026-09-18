export type PublicBarbershopInfo = {
  id_barbershop?: string | undefined;
  slug?: string | undefined;
  nama_barbershop: string;
  alamat: string;
  no_hp: string;
  jam_buka: string;
  jam_tutup: string;
  isOpen: boolean;
  currentWibTime: string;
  statusMessage?: string | undefined;
};

/**
 * Parses time strings like "08:00 WIB", "08:00", "08:00 AM", "09:00 PM" into total minutes from midnight (0 - 1439).
 */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.replace(/WIB|WITA|WIT/gi, "").trim();
  const isPM = /pm/i.test(clean);
  const isAM = /am/i.test(clean);
  const numOnly = clean.replace(/am|pm/gi, "").trim();

  const [hStr, mStr] = numOnly.split(":");
  let hour = parseInt(hStr || "0", 10);
  const minute = parseInt(mStr || "0", 10);

  if (isPM && hour < 12) {
    hour += 12;
  } else if (isAM && hour === 12) {
    hour = 0;
  }

  return hour * 60 + minute;
}

/**
 * Gets current hour, minute, and formatted string in Asia/Jakarta (WIB) timezone.
 */
export function getWibTimeParts(date = new Date()): {
  hour: number;
  minute: number;
  timeString: string;
} {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const timeString = formatter.format(date); // e.g. "17:55"
  const [hStr, mStr] = timeString.split(":");
  return {
    hour: parseInt(hStr || "0", 10),
    minute: parseInt(mStr || "0", 10),
    timeString,
  };
}

/**
 * Checks if the barbershop is currently open based on operating hours.
 */
export function isBarbershopOpen(
  jamBukaStr: string,
  jamTutupStr: string,
  checkDate?: Date,
): {
  isOpen: boolean;
  currentWibTime: string;
  openMinutes: number;
  closeMinutes: number;
  currentMinutes: number;
} {
  const { hour, minute, timeString } = getWibTimeParts(checkDate);
  const currentMinutes = hour * 60 + minute;
  const openMinutes = parseTimeToMinutes(jamBukaStr || "08:00");
  const closeMinutes = parseTimeToMinutes(jamTutupStr || "21:00");

  let isOpen = false;
  if (openMinutes < closeMinutes) {
    isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  } else {
    // Overnight operation (e.g. 18:00 to 02:00)
    isOpen = currentMinutes >= openMinutes || currentMinutes < closeMinutes;
  }

  return {
    isOpen,
    currentWibTime: timeString,
    openMinutes,
    closeMinutes,
    currentMinutes,
  };
}
