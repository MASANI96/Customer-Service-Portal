import type { DateRange, PresetPeriodType } from '@/types';

export function parseDateParts(dateStr: string): { y: number; m: number; d: number } | null {
  if (!dateStr) return null;
  const match = String(dateStr).trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!match) return null;
  return {
    y: parseInt(match[1], 10),
    m: parseInt(match[2], 10),
    d: parseInt(match[3], 10),
  };
}

export function createLocalDate(dateStr: string): Date | null {
  const parts = parseDateParts(dateStr);
  if (!parts) return null;
  return new Date(parts.y, parts.m - 1, parts.d);
}

export function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatSlashDate(dateStr: string): string {
  return dateStr.replace(/-/g, '/');
}

export function formatYearMonth(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function formatDateTimeNow(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${y}/${m}/${day} ${hh}:${mm}:${ss}`;
}

export function normalizeYearMonth(val: string | Date): string {
  if (!val) return '';
  if (val instanceof Date) return formatYearMonth(val);
  const str = String(val).trim();
  const match = str.match(/^(\d{4})[-/](\d{1,2})/);
  if (match) {
    const y = match[1];
    const m = String(match[2]).padStart(2, '0');
    return `${y}-${m}`;
  }
  return str;
}

export function addDays(d: Date, days: number): Date {
  const result = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  result.setDate(result.getDate() + days);
  return result;
}

export function addYears(d: Date, years: number): Date {
  const result = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  result.setFullYear(result.getFullYear() + years);
  return result;
}

export function daysBetweenInclusive(startStr: string, endStr: string): number {
  const d1 = createLocalDate(startStr);
  const d2 = createLocalDate(endStr);
  if (!d1 || !d2) return 1;
  const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : 1;
}

export function computeDateRangeFromPreset(
  presetType: PresetPeriodType,
  presetValue: number,
  activeYearForQuarters: number,
  customFrom: string,
  customTo: string,
  referenceNow: Date = new Date()
): DateRange {
  const now = new Date(referenceNow.getFullYear(), referenceNow.getMonth(), referenceNow.getDate());

  if (presetType === 'custom') {
    const fallbackStart = formatDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
    const fallbackEnd = formatDateKey(now);
    const s = customFrom || fallbackStart;
    const e = customTo || fallbackEnd;
    return s <= e ? { start: s, end: e } : { start: e, end: s };
  }

  if (presetType === 'year') {
    const y = presetValue;
    return { start: `${y}-01-01`, end: `${y}-12-31` };
  }

  if (presetType === 'half') {
    const y = activeYearForQuarters;
    return presetValue === 1
      ? { start: `${y}-01-01`, end: `${y}-06-30` }
      : { start: `${y}-07-01`, end: `${y}-12-31` };
  }

  if (presetType === 'quarter') {
    const y = activeYearForQuarters;
    if (presetValue === 1) return { start: `${y}-01-01`, end: `${y}-03-31` };
    if (presetValue === 2) return { start: `${y}-04-01`, end: `${y}-06-30` };
    if (presetValue === 3) return { start: `${y}-07-01`, end: `${y}-09-30` };
    return { start: `${y}-10-01`, end: `${y}-12-31` };
  }

  if (presetType === 'month') {
    const offset = presetValue;
    if (offset === 0) {
      // 今月: 月初 〜 本日（経過日数ベース）
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        start: formatDateKey(firstDay),
        end: formatDateKey(now),
      };
    }
    const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const firstDay = new Date(target.getFullYear(), target.getMonth(), 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0);
    return {
      start: formatDateKey(firstDay),
      end: formatDateKey(lastDay),
    };
  }

  if (presetType === 'relative') {
    const months = presetValue;
    const past = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
    return {
      start: formatDateKey(past),
      end: formatDateKey(now),
    };
  }

  if (presetType === 'around') {
    const months = presetValue;
    const past = new Date(now.getFullYear(), now.getMonth() - months, 1);
    const future = new Date(now.getFullYear(), now.getMonth() + months + 1, 0);
    return {
      start: formatDateKey(past),
      end: formatDateKey(future),
    };
  }

  return {
    start: formatDateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: formatDateKey(now),
  };
}

export function computePreviousComparisonRange(
  presetType: PresetPeriodType,
  presetValue: number,
  activeRange: DateRange,
  referenceNow: Date = new Date()
): DateRange {
  const now = new Date(referenceNow.getFullYear(), referenceNow.getMonth(), referenceNow.getDate());

  if (presetType === 'month' && presetValue === 0) {
    // 今月の場合: 前月1日 〜 前月同日
    const y = now.getFullYear();
    const m = now.getMonth();
    const prevMonthFirst = new Date(y, m - 1, 1);
    const prevMonthLastDay = new Date(y, m, 0).getDate();
    const targetDay = Math.min(now.getDate(), prevMonthLastDay);
    const prevMonthSameDay = new Date(y, m - 1, targetDay);
    return {
      start: formatDateKey(prevMonthFirst),
      end: formatDateKey(prevMonthSameDay),
    };
  }

  if (presetType === 'month') {
    const offset = presetValue;
    const target = new Date(now.getFullYear(), now.getMonth() + offset - 1, 1);
    const firstDay = new Date(target.getFullYear(), target.getMonth(), 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0);
    return {
      start: formatDateKey(firstDay),
      end: formatDateKey(lastDay),
    };
  }

  const d1 = createLocalDate(activeRange.start) || now;
  const days = daysBetweenInclusive(activeRange.start, activeRange.end);
  const prevEnd = addDays(d1, -1);
  const prevStart = addDays(prevEnd, -(days - 1));
  return {
    start: formatDateKey(prevStart),
    end: formatDateKey(prevEnd),
  };
}

export function computePrevYearComparisonRange(
  presetType: PresetPeriodType,
  presetValue: number,
  activeRange: DateRange,
  referenceNow: Date = new Date()
): DateRange {
  const now = new Date(referenceNow.getFullYear(), referenceNow.getMonth(), referenceNow.getDate());

  if (presetType === 'month' && presetValue === 0) {
    const y = now.getFullYear() - 1;
    const m = now.getMonth();
    const prevYearFirst = new Date(y, m, 1);
    const prevYearMonthLastDay = new Date(y, m + 1, 0).getDate();
    const targetDay = Math.min(now.getDate(), prevYearMonthLastDay);
    const prevYearSameDay = new Date(y, m, targetDay);
    return {
      start: formatDateKey(prevYearFirst),
      end: formatDateKey(prevYearSameDay),
    };
  }

  const d1 = createLocalDate(activeRange.start) || now;
  const d2 = createLocalDate(activeRange.end) || now;
  return {
    start: formatDateKey(addYears(d1, -1)),
    end: formatDateKey(addYears(d2, -1)),
  };
}

export function listAllDatesInRange(range: DateRange): string[] {
  const dStart = createLocalDate(range.start);
  const dEnd = createLocalDate(range.end);
  if (!dStart || !dEnd || dStart > dEnd) return [];
  const dates: string[] = [];
  const curr = new Date(dStart);
  while (curr <= dEnd) {
    dates.push(formatDateKey(curr));
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

export function generateUuid(prefix = 'sub'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
