// Application Environment Configuration

export const BACKEND_API_URL =
  typeof import.meta !== 'undefined' && (import.meta as any).env?.PUBLIC_BACKEND_API_URL
    ? (import.meta as any).env.PUBLIC_BACKEND_API_URL
    : typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV
    ? 'http://localhost:5005'
    : 'https://operationtexas.runasp.net';

export const SALES_PORTAL_API_URL =
  typeof import.meta !== 'undefined' && (import.meta as any).env?.PUBLIC_SALES_PORTAL_API_URL
    ? (import.meta as any).env.PUBLIC_SALES_PORTAL_API_URL
    : typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV
    ? 'http://localhost:5003'
    : 'https://salestexas.runasp.net';

export const ACCOUNTS_PORTAL_API_URL =
  typeof import.meta !== 'undefined' && (import.meta as any).env?.PUBLIC_ACCOUNTS_PORTAL_API_URL
    ? (import.meta as any).env.PUBLIC_ACCOUNTS_PORTAL_API_URL
    : typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV
    ? 'http://localhost:5028'
    : 'https://accountstexas.runasp.net';

/**
 * Universal file URL builder.
 * Resolves relative uploaded document paths to the active Sales Portal API base URL.
 */
export function getFileUrl(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('data:')) {
    return filePath;
  }
  const baseUrl = SALES_PORTAL_API_URL.endsWith('/') ? SALES_PORTAL_API_URL.slice(0, -1) : SALES_PORTAL_API_URL;
  const path = filePath.startsWith('/') ? filePath : `/${filePath}`;
  return `${baseUrl}${path}`;
}
