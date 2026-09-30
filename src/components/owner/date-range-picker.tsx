import React, { useState, useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";

export type PresetKey =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "month"
  | "last_month"
  | "custom";

export interface DateRangeResult {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  preset: PresetKey;
  label: string;
}

export interface OwnerDateRangePickerProps {
  isOpen: boolean;
  onClose: () => void;
  appliedStart: string; // YYYY-MM-DD
  appliedEnd: string;   // YYYY-MM-DD
  appliedPreset: PresetKey;
  onApply: (result: DateRangeResult) => void;
}

// Helpers for timezone-safe date math (Asia/Jakarta, UTC+7)
function getJakartaTodayStr(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
}

function parseLocalDate(str: string): Date {
  const parts = str.split("-").map(Number);
  const y = parts[0] || new Date().getFullYear();
  const m = (parts[1] || 1) - 1;
  const d = parts[2] || 1;
  return new Date(y, m, d, 12, 0, 0);
}

function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function isBeforeDay(d1: Date, d2: Date): boolean {
  const t1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate()).getTime();
  const t2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate()).getTime();
  return t1 < t2;
}

function isAfterDay(d1: Date, d2: Date): boolean {
  const t1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate()).getTime();
  const t2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate()).getTime();
  return t1 > t2;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function OwnerDateRangePicker({
  isOpen,
  onClose,
  appliedStart,
  appliedEnd,
  appliedPreset,
  onApply,
}: OwnerDateRangePickerProps) {
  const todayStr = useMemo(() => getJakartaTodayStr(), []);

  // Draft state (separate from applied state)
  const [draftStart, setDraftStart] = useState<Date | null>(() =>
    appliedStart ? parseLocalDate(appliedStart) : parseLocalDate(todayStr)
  );
  const [draftEnd, setDraftEnd] = useState<Date | null>(() =>
    appliedEnd ? parseLocalDate(appliedEnd) : parseLocalDate(todayStr)
  );
  const [draftPreset, setDraftPreset] = useState<PresetKey>(appliedPreset || "today");
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [compareChecked, setCompareChecked] = useState(false);

  // Month navigation: viewMonth is the left month (1st day)
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const start = appliedStart ? parseLocalDate(appliedStart) : parseLocalDate(todayStr);
    return new Date(start.getFullYear(), start.getMonth(), 1, 12);
  });

  // Synchronize draft state when popover opens
  useEffect(() => {
    if (isOpen) {
      const s = appliedStart ? parseLocalDate(appliedStart) : parseLocalDate(todayStr);
      const e = appliedEnd ? parseLocalDate(appliedEnd) : parseLocalDate(todayStr);
      setDraftStart(s);
      setDraftEnd(e);
      setDraftPreset(appliedPreset || "today");
      setHoveredDate(null);
      setViewMonth(new Date(s.getFullYear(), s.getMonth(), 1, 12));
    }
  }, [isOpen, appliedStart, appliedEnd, appliedPreset, todayStr]);

  // Next month (right side)
  const rightMonth = useMemo(() => {
    return new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1, 12);
  }, [viewMonth]);

  const handlePrevMonth = () => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1, 12));
  };

  const handleNextMonth = () => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1, 12));
  };

  // Preset calculation
  const applyPresetDates = (preset: PresetKey) => {
    const todayD = parseLocalDate(todayStr);

    if (preset === "today") {
      setDraftStart(todayD);
      setDraftEnd(todayD);
      setDraftPreset("today");
      setViewMonth(new Date(todayD.getFullYear(), todayD.getMonth(), 1, 12));
    } else if (preset === "yesterday") {
      const yesterday = new Date(todayD.getTime() - 86400000);
      setDraftStart(yesterday);
      setDraftEnd(yesterday);
      setDraftPreset("yesterday");
      setViewMonth(new Date(yesterday.getFullYear(), yesterday.getMonth(), 1, 12));
    } else if (preset === "7d") {
      const start7d = new Date(todayD.getTime() - 6 * 86400000);
      setDraftStart(start7d);
      setDraftEnd(todayD);
      setDraftPreset("7d");
      setViewMonth(new Date(start7d.getFullYear(), start7d.getMonth(), 1, 12));
    } else if (preset === "30d") {
      const start30d = new Date(todayD.getTime() - 29 * 86400000);
      setDraftStart(start30d);
      setDraftEnd(todayD);
      setDraftPreset("30d");
      setViewMonth(new Date(start30d.getFullYear(), start30d.getMonth(), 1, 12));
    } else if (preset === "month") {
      const first = new Date(todayD.getFullYear(), todayD.getMonth(), 1, 12);
      const last = new Date(todayD.getFullYear(), todayD.getMonth() + 1, 0, 12);
      setDraftStart(first);
      setDraftEnd(last);
      setDraftPreset("month");
      setViewMonth(new Date(first.getFullYear(), first.getMonth(), 1, 12));
    } else if (preset === "last_month") {
      const first = new Date(todayD.getFullYear(), todayD.getMonth() - 1, 1, 12);
      const last = new Date(todayD.getFullYear(), todayD.getMonth(), 0, 12);
      setDraftStart(first);
      setDraftEnd(last);
      setDraftPreset("last_month");
      setViewMonth(new Date(first.getFullYear(), first.getMonth(), 1, 12));
    } else {
      setDraftPreset("custom");
    }
  };

  // Day click logic
  const handleDayClick = (dayDate: Date) => {
    // REQUIREMENT: Custom otomatis saat tanggal diedit
    setDraftPreset("custom");

    if (!draftStart || (draftStart && draftEnd)) {
      // First click: sets start date, clears end date
      setDraftStart(dayDate);
      setDraftEnd(null);
    } else if (draftStart && !draftEnd) {
      // Second click: sets end date
      if (isBeforeDay(dayDate, draftStart)) {
        setDraftStart(dayDate);
        setDraftEnd(draftStart);
      } else {
        setDraftEnd(dayDate);
      }
    }
  };

  // Apply button handler
  const handleApply = () => {
    if (!draftStart) return;
    const finalStart = draftStart;
    const finalEnd = draftEnd || draftStart;
    const sStr = formatLocalDate(finalStart);
    const eStr = formatLocalDate(finalEnd);

    let label = "";
    if (draftPreset === "today" || sStr === eStr) {
      label = finalStart.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } else {
      label = `${finalStart.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })} – ${finalEnd.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}`;
    }

    onApply({
      startDate: sStr,
      endDate: eStr,
      preset: draftPreset,
      label,
    });
    onClose();
  };

  if (!isOpen) return null;

  // Render month grid
  const renderMonth = (monthDate: Date, isLeft: boolean) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month, d, 12, 0, 0));
    }

    return (
      <div className="flex-1 min-w-[280px]">
        {/* Month Header */}
        <div className="flex items-center justify-between h-9 mb-2">
          {isLeft ? (
            <button
              type="button"
              onClick={handlePrevMonth}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Bulan sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : (
            <div className="w-8" />
          )}

          <div className="text-sm font-semibold text-foreground tracking-wide">
            {MONTH_NAMES[month]} {year}
          </div>

          {!isLeft ? (
            <button
              type="button"
              onClick={handleNextMonth}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Bulan berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="w-8" />
          )}
        </div>

        {/* Weekday Labels */}
        <div className="grid grid-cols-7 mb-1.5 text-center">
          {WEEKDAY_NAMES.map((w, idx) => (
            <div key={idx} className="text-[11px] font-medium text-muted-foreground py-1">
              {w}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-y-1">
          {days.map((dayDate, idx) => {
            if (!dayDate) {
              return <div key={`empty-${idx}`} className="h-8 w-full" />;
            }

            const isStart = draftStart && isSameDay(dayDate, draftStart);
            const isEnd = draftEnd && isSameDay(dayDate, draftEnd);
            const isSingle = isStart && isEnd;

            // Range highlighting
            let inRange = false;
            if (draftStart && draftEnd) {
              inRange = isAfterDay(dayDate, draftStart) && isBeforeDay(dayDate, draftEnd);
            } else if (draftStart && !draftEnd && hoveredDate) {
              if (isAfterDay(hoveredDate, draftStart)) {
                inRange = isAfterDay(dayDate, draftStart) && (isBeforeDay(dayDate, hoveredDate) || isSameDay(dayDate, hoveredDate));
              } else if (isBeforeDay(hoveredDate, draftStart)) {
                inRange = isBeforeDay(dayDate, draftStart) && (isAfterDay(dayDate, hoveredDate) || isSameDay(dayDate, hoveredDate));
              }
            }

            const isRangeStartConnected = isStart && ((draftEnd && isAfterDay(draftEnd, draftStart)) || (hoveredDate && isAfterDay(hoveredDate, draftStart)));
            const isRangeEndConnected = isEnd && draftStart && isBeforeDay(draftStart, draftEnd);

            return (
              <div
                key={dayDate.toISOString()}
                className={`relative flex items-center justify-center h-8 w-full ${
                  inRange ? "bg-primary/20" : ""
                } ${isRangeStartConnected ? "bg-gradient-to-r from-transparent to-primary/20" : ""} ${
                  isRangeEndConnected ? "bg-gradient-to-l from-transparent to-primary/20" : ""
                }`}
                onMouseEnter={() => setHoveredDate(dayDate)}
                onMouseLeave={() => setHoveredDate(null)}
              >
                <button
                  type="button"
                  onClick={() => handleDayClick(dayDate)}
                  className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs transition-colors cursor-pointer select-none ${
                    isStart || isEnd
                      ? "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/30 ring-1 ring-primary/40"
                      : inRange
                        ? "text-primary font-semibold hover:bg-primary/20"
                        : "text-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {dayDate.getDate()}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const startFormatted = draftStart ? formatDisplayDate(draftStart) : "";
  const endFormatted = draftEnd ? formatDisplayDate(draftEnd) : (draftStart ? formatDisplayDate(draftStart) : "");

  return (
    <div
      className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-2xl text-foreground w-full max-w-[660px] max-h-[85vh] overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 2-Month Dual Calendar */}
      <div className="flex flex-col sm:flex-row gap-6 pb-4 border-b border-border">
        {renderMonth(viewMonth, true)}
        {renderMonth(rightMonth, false)}
      </div>

      {/* Compare Checkbox */}
      <div className="flex items-center gap-2 pt-3.5 pb-2">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={compareChecked}
            onChange={(e) => setCompareChecked(e.target.checked)}
            className="h-4 w-4 rounded border-input bg-background text-primary focus:ring-0 cursor-pointer"
          />
          <span className="text-xs text-muted-foreground font-medium">Compare</span>
        </label>
      </div>

      {/* Preset Dropdown & Date Input Boxes */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 pb-3">
        {/* Preset Selector */}
        <div className="relative min-w-[140px]">
          <select
            value={draftPreset}
            onChange={(e) => applyPresetDates(e.target.value as PresetKey)}
            className="w-full appearance-none px-3 py-2 pr-8 bg-background border border-input rounded-xl text-xs font-semibold text-foreground focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="today">Hari ini</option>
            <option value="yesterday">Kemarin</option>
            <option value="7d">7 Hari Terakhir</option>
            <option value="30d">30 Hari Terakhir</option>
            <option value="month">Bulan ini</option>
            <option value="last_month">Bulan lalu</option>
            <option value="custom">Custom</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        </div>

        {/* Start Date & End Date Inputs */}
        <div className="flex items-center gap-2 flex-1">
          <div className="flex-1 px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs font-medium text-foreground text-center select-none">
            {startFormatted || "Start Date"}
          </div>
          <span className="text-muted-foreground text-xs font-bold">-</span>
          <div className="flex-1 px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs font-medium text-foreground text-center select-none">
            {endFormatted || "End Date"}
          </div>
        </div>
      </div>

      {/* Footer: Timezone notice & Action buttons */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <span className="text-[11px] text-muted-foreground font-medium">
          Dates are shown in WIB
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 border border-border transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors cursor-pointer shadow-md shadow-primary/20"
          >
            Update
          </button>
        </div>
      </div>
    </div>
  );
}
