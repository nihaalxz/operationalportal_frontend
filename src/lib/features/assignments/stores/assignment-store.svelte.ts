import { fetchPendingQueueItems } from '../api/assignments-api';

let pendingCountState = $state(0);
let pendingVisasCountState = $state(0);
let pendingVfsCountState = $state(0);
let pendingHolidaysCountState = $state(0);
let hasLoadedPendingState = $state(false);
let isRefreshingState = $state(false);

export function getPendingCounts() {
	return {
		total: pendingCountState,
		visas: pendingVisasCountState,
		vfs: pendingVfsCountState,
		holidays: pendingHolidaysCountState,
		hasLoaded: hasLoadedPendingState
	};
}

export function getPendingCount() {
	return pendingCountState;
}

export function isRefreshingPending() {
	return isRefreshingState;
}

export async function refreshPendingCount() {
	isRefreshingState = true;
	try {
		const res = await fetchPendingQueueItems();
		const items = res.items || [];
		pendingCountState = items.length;
		pendingVisasCountState = items.filter((i) => i.entityType === 'VISA').length;
		pendingVfsCountState = items.filter((i) => i.entityType === 'VFS').length;
		pendingHolidaysCountState = items.filter((i) => i.entityType === 'HOLIDAY').length;
		hasLoadedPendingState = true;
	} catch {
		// silent error
	} finally {
		isRefreshingState = false;
	}
}

