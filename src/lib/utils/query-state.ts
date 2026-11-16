import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { get } from 'svelte/store';

export interface QueueParams {
  page: number;
  pageSize: number;
  search: string;
  status: string;
}

const PAGE_SIZES = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 10;

/** Parse URL search params into a typed QueueParams object */
export function parseQueueParams(url: URL): QueueParams {
  const raw = url.searchParams;
  const p = parseInt(raw.get('page') ?? '1', 10);
  const ps = parseInt(raw.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10);

  return {
    page: isFinite(p) && p >= 1 ? p : 1,
    pageSize: PAGE_SIZES.includes(ps) ? ps : DEFAULT_PAGE_SIZE,
    search: raw.get('search') ?? '',
    status: raw.get('status') ?? ''
  };
}

/** Push new params to the URL without full navigation */
export async function updateQueueParams(
  updates: Partial<QueueParams>,
  resetPage = false
): Promise<void> {
  const current = get(page);
  const params = new URLSearchParams(current.url.searchParams);

  if (updates.search !== undefined) params.set('search', updates.search);
  if (updates.status !== undefined) params.set('status', updates.status);
  if (updates.pageSize !== undefined) params.set('pageSize', String(updates.pageSize));

  // Always reset to page 1 when filters change
  if (resetPage || updates.page === undefined) {
    params.set('page', '1');
  } else if (updates.page !== undefined) {
    params.set('page', String(updates.page));
  }

  // Clean empty params
  if (!params.get('search')) params.delete('search');
  if (!params.get('status')) params.delete('status');
  if (params.get('page') === '1') params.delete('page');
  if (params.get('pageSize') === String(DEFAULT_PAGE_SIZE)) params.delete('pageSize');

  const qs = params.toString();
  await goto(`?${qs}`, { replaceState: true, noScroll: true, keepFocus: true });
}

export { PAGE_SIZES };
