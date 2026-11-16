import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Timezone constant for Bahrain (UTC+3, AST) */
export const BAHRAIN_TIMEZONE = 'Asia/Bahrain';

/**
 * Safely parses any date input from server or client into a Date object.
 *
 * CRITICAL TIMEZONE HANDLING:
 * 1. If date is already a Date object, returns it.
 * 2. If date is a date-only string (e.g., '2026-07-10'), parses year/month/day at noon UTC
 *    to prevent any global timezone boundary shifting.
 * 3. If date is an ISO date-time string without a timezone designator ('Z' or '+HH:mm'/'-HH:mm'),
 *    e.g., '2026-09-25T17:43:00.123', the SQL Server database stored it in UTC (DateTime.UtcNow)
 *    via datetime2. Appending 'Z' ensures JavaScript parses it as UTC rather than the visitor's
 *    browser local timezone (e.g. IST), so converting to 'Asia/Bahrain' gives the true Bahrain time.
 */
export function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // Case A: Date-only format 'YYYY-MM-DD'
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  }

  // Case B: ISO string missing timezone offset (backend saves UTC in datetime2)
  let normalized = trimmed;
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(trimmed)) {
    normalized = trimmed.replace(' ', 'T') + 'Z';
  }

  const parsed = new Date(normalized);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/** shadcn-svelte standard utility for merging class strings */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// shadcn-svelte Svelte 5 helper types
export type WithElementRef<T, E = HTMLElement> = T & {
  ref?: E | null;
};

export type WithoutChildren<T> = Omit<T, 'children'>;

export type WithoutChild<T> = Omit<T, 'child'>;

export type WithoutChildrenOrChild<T> = Omit<T, 'children' | 'child'>;

/** Format a date string to a localized short date in Bahrain timezone */
export function formatDate(value: string | Date | null | undefined, fallback = 'Not filled by staff'): string {
  if (!value) return fallback;
  try {
    const d = parseDate(value);
    if (!d || d.getFullYear() <= 1) return fallback;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: BAHRAIN_TIMEZONE
    });
  } catch {
    return fallback;
  }
}

/** Format a date+time string in Bahrain timezone */
export function formatDateTime(value: string | Date | null | undefined, fallback = 'Not filled by staff'): string {
  if (!value) return fallback;
  try {
    const d = parseDate(value);
    if (!d || d.getFullYear() <= 1) return fallback;
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: BAHRAIN_TIMEZONE
    });
  } catch {
    return fallback;
  }
}

/** Format time-only in Bahrain AST (+03:00) */
export function formatBahrainTime(value: string | Date | null | undefined = new Date()): string {
  if (!value) return '—';
  try {
    const d = parseDate(value);
    if (!d) return '—';
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: BAHRAIN_TIMEZONE
    }).format(d);
  } catch {
    return '—';
  }
}

/** Returns current date string in Bahrain timezone (YYYY-MM-DD) */
export function getBahrainDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BAHRAIN_TIMEZONE }).format(d);
}

/** Format currency in BHD (Bahraini Dinar — 3 decimal places) */
export function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-BH', {
    style: 'currency',
    currency: 'BHD',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
  }).format(value);
}

/** Truncate long strings */
export function truncate(value: string | null | undefined, max = 40): string {
  if (!value) return '—';
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/** Capitalize first letter */
export function capitalize(value: string | null | undefined): string {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

/** Search matching helper with synonym support (e.g. imra <-> umrah <-> umra <-> imrah) */
export function matchesSearch(fields: (string | null | undefined)[], query: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;

  const synonyms = ['imra', 'imrah', 'umra', 'umrah'];
  const containsSynonym = synonyms.some((s) => q.includes(s));

  return fields.some((field) => {
    if (!field) return false;
    const text = field.toLowerCase();
    if (text.includes(q)) return true;

    if (containsSynonym) {
      return synonyms.some((s) => text.includes(s));
    }
    return false;
  });
}

/** Check if a timestamp is considered "Today" in Bahrain calendar day */
export function isCompletedToday(dateStr?: string | null): boolean {
  if (!dateStr || dateStr.trim() === '') return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;

  const now = new Date();
  const todayBahrain = getBahrainDateString(now);
  const dateBahrain = getBahrainDateString(d);
  if (todayBahrain === dateBahrain) return true;

  // Also match within rolling 24 hours
  const diffMs = now.getTime() - d.getTime();
  return diffMs >= 0 && diffMs <= 24 * 60 * 60 * 1000;
}

import { getFileUrl } from '$lib/config';

/**
 * Universal file downloader that forces file download instead of previewing in tab.
 * Correctly strips path separators from filename to prevent browser ignoring download attribute.
 */
export async function downloadFile(filePath: string | null | undefined, customFilename?: string): Promise<void> {
  if (!filePath) return;
  const fullUrl = getFileUrl(filePath) || filePath;

  // Extract raw filename from path e.g. "766d3d57-0049-4027-9730-8b71435526c4.jpg"
  const pathSegment = filePath.split('?')[0].split('#')[0];
  const rawNameFromPath = pathSegment.split('/').pop()?.split('\\').pop() || '';

  let downloadName = 'document';

  if (customFilename && !customFilename.includes('/') && !customFilename.includes('\\')) {
    if (!customFilename.includes('.') && rawNameFromPath.includes('.')) {
      const ext = rawNameFromPath.substring(rawNameFromPath.lastIndexOf('.'));
      downloadName = `${customFilename}${ext}`;
    } else {
      downloadName = customFilename;
    }
  } else if (rawNameFromPath) {
    downloadName = rawNameFromPath;
  } else if (customFilename) {
    downloadName = customFilename.split('/').pop()?.split('\\').pop() || 'document';
  }

  downloadName = downloadName.replace(/[/\\?%*:|"<>]/g, '_');

  try {
    const response = await fetch(fullUrl, { mode: 'cors' });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = blobUrl;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    }, 100);
  } catch (err) {
    console.warn('Direct blob download failed, attempting direct download link:', err);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = fullUrl;
    a.download = downloadName;
    a.target = '_self';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 100);
  }
}
