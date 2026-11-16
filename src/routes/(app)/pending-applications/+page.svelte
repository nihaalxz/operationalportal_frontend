<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchPendingQueueItems } from '$lib/features/assignments/api/assignments-api';
	import { refreshPendingCount } from '$lib/features/assignments/stores/assignment-store.svelte';
	import { matchesSearch } from '$lib/utils';
	import AssignmentFilters from '$lib/features/assignments/components/AssignmentFilters.svelte';
	import PendingQueueTable from '$lib/features/assignments/components/PendingQueueTable.svelte';
	import PaginationControls from '$lib/components/PaginationControls.svelte';
	import type { PendingQueueItem, ServiceFilterTab, QueueSortOption } from '$lib/features/assignments/types/assignment-types';

	import { page } from '$app/stores';

	let rawItems = $state<PendingQueueItem[]>([]);
	let isLoading = $state(true);
	let isRefreshing = $state(false);
	let errorMessage = $state('');
	let toastMessage = $state('');

	let activeService = $state<ServiceFilterTab>('all');
	let searchQuery = $state('');
	let selectedCountry = $state('');
	let sortOption = $state<QueueSortOption>('newest');
	let currentPage = $state(1);
	let pageSize = $state(15);

	function handleServiceChange(s: ServiceFilterTab) {
		activeService = s;
		selectedCountry = '';
		currentPage = 1;
	}

	function handleCountryChange(country: string) {
		selectedCountry = country;
		currentPage = 1;
	}

	function handleSearchChange(q: string) {
		searchQuery = q;
		currentPage = 1;
	}

	function handleSortChange(sort: QueueSortOption) {
		sortOption = sort;
		currentPage = 1;
	}

	async function loadQueue(showRefreshSpinner = false) {
		if (showRefreshSpinner) {
			isRefreshing = true;
		} else {
			isLoading = true;
		}
		errorMessage = '';
		try {
			const res = await fetchPendingQueueItems();
			rawItems = res.items;
			await refreshPendingCount();
		} catch (err: any) {
			errorMessage = err?.message || 'Failed to load pending applications inbox.';
		} finally {
			isLoading = false;
			isRefreshing = false;
		}
	}

	onMount(() => {
		const serviceParam = $page.url.searchParams.get('service');
		if (serviceParam && ['visa', 'vfs', 'holiday', 'all'].includes(serviceParam.toLowerCase())) {
			activeService = serviceParam.toLowerCase() as ServiceFilterTab;
		}
		loadQueue();
		const interval = setInterval(() => loadQueue(true), 15000);
		return () => clearInterval(interval);
	});

	function handleClaimError(msg: string) {
		toastMessage = msg;
		setTimeout(() => {
			if (toastMessage === msg) toastMessage = '';
		}, 5000);
	}

	const availableCountries = $derived.by(() => {
		const set = new Set<string>();
		const itemsToScan = activeService === 'all'
			? rawItems
			: rawItems.filter((i) => i.entityType === activeService.toUpperCase());
		for (const item of itemsToScan) {
			const c = (item.country || item.destination || '').trim();
			if (c && c !== '—' && !c.includes('Service') && !c.includes('Appointment') && !c.includes('Package')) {
				set.add(c);
			}
		}
		return Array.from(set).sort((a, b) => a.localeCompare(b));
	});

	// Filtered & Sorted items
	const filteredItems = $derived.by(() => {
		let list = [...rawItems];

		// Filter by Service
		if (activeService !== 'all') {
			const serviceUpper = activeService.toUpperCase();
			list = list.filter((item) => item.entityType === serviceUpper);
		}

		// Filter by Country
		if (selectedCountry) {
			const cFilter = selectedCountry.toLowerCase();
			list = list.filter((item) => {
				const c = (item.country || item.destination || '').trim().toLowerCase();
				return c === cFilter;
			});
		}

		// Filter by Search Query
		if (searchQuery.trim()) {
			list = list.filter((item) =>
				matchesSearch(
					[
						item.refNo,
						item.customer,
						item.salesmanName,
						item.applicantFirstName,
						item.passenger,
						item.passportNo,
						item.passportNo?.replace(/\s+/g, ''),
						item.country,
						item.visaPackDetails,
						item.details,
						item.destination
					],
					searchQuery
				)
			);
		}

		// Sort
		if (sortOption === 'newest') {
			list.sort((a, b) => (new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
		} else if (sortOption === 'oldest') {
			list.sort((a, b) => (new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()));
		} else if (sortOption === 'priority') {
			const priorityRank: Record<string, number> = { Urgent: 3, High: 2, Normal: 1 };
			list.sort((a, b) => (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0));
		}

		return list;
	});

	const paginatedItems = $derived.by(() => {
		const start = (currentPage - 1) * pageSize;
		return filteredItems.slice(start, start + pageSize);
	});

	const visaCount = $derived(rawItems.filter((i) => i.entityType === 'VISA').length);
	const vfsCount = $derived(rawItems.filter((i) => i.entityType === 'VFS').length);
	const holidayCount = $derived(rawItems.filter((i) => i.entityType === 'HOLIDAY').length);
</script>

<svelte:head>
	<title>Pending Applications Inbox — Texas Operational Portal</title>
</svelte:head>

<div class="pending-page">
	<div class="page-header">
		<div>
			<div class="header-badge">
				<span class="live-pulse"></span>
				Single Operational Inbox
			</div>
			<h1 class="page-title">Pending Applications</h1>
			<p class="page-desc">
				Unclaimed applications awaiting operator assignment ({rawItems.length} total: {visaCount} Visas, {vfsCount} VFS, {holidayCount} Holidays)
			</p>
		</div>

		<button
			class="btn btn--outline btn--sm"
			onclick={() => loadQueue(true)}
			disabled={isLoading || isRefreshing}
		>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mr-1" class:spin={isRefreshing}>
				<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
			</svg>
			{isRefreshing ? 'Refreshing…' : 'Refresh Queue'}
		</button>
	</div>

	{#if toastMessage}
		<div class="toast toast--error" role="alert">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
			</svg>
			<span>{toastMessage}</span>
		</div>
	{/if}

	{#if errorMessage}
		<div class="error-state" role="alert">
			<div class="error-state__icon" aria-hidden="true">
				<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
			</div>
			<p class="error-state__msg">{errorMessage}</p>
			<button class="retry-btn" onclick={() => loadQueue()}>Retry</button>
		</div>
	{:else}
		<AssignmentFilters
			showServiceTabs={true}
			activeService={activeService}
			onServiceChange={handleServiceChange}
			selectedCountry={selectedCountry}
			onCountryChange={handleCountryChange}
			countries={availableCountries}
			searchQuery={searchQuery}
			onSearchChange={handleSearchChange}
			sortOption={sortOption}
			onSortChange={handleSortChange}
		/>

		<PendingQueueTable
			items={paginatedItems}
			isLoading={isLoading}
			startIndex={(currentPage - 1) * pageSize}
			showService={activeService === 'all'}
			onClaimError={handleClaimError}
			onClaimSuccess={() => loadQueue(true)}
		/>

		{#if !isLoading && filteredItems.length > 0}
			<PaginationControls
				currentPage={currentPage}
				pageSize={pageSize}
				totalItems={filteredItems.length}
				itemLabel="pending application"
				pageSizeOptions={[10, 15, 25, 50, 100]}
				onPageChange={(p) => (currentPage = p)}
				onPageSizeChange={(sz) => { pageSize = sz; currentPage = 1; }}
			/>
		{/if}
	{/if}
</div>

<style>
	@import '$lib/theme/queue-styles.css';

	.pending-page {
		max-width: 1280px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.header-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		background: hsl(var(--primary) / 0.1);
		color: hsl(var(--primary));
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.5rem;
	}

	.live-pulse {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: hsl(142 76% 45%);
		box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
		animation: pulse-ring 2s infinite;
	}

	@keyframes pulse-ring {
		0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
		70% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
		100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
	}

	.toast {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
	}
	.toast--error {
		background: hsl(var(--destructive) / 0.15);
		color: hsl(var(--destructive));
		border: 1px solid hsl(var(--destructive) / 0.3);
	}

	.spin { animation: spin 0.8s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }

	.mr-1 { margin-right: 0.25rem; }

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		border: 1px solid transparent;
		cursor: pointer;
		transition: all 0.15s;
		font-family: inherit;
	}
	.btn--outline {
		background: transparent;
		border-color: hsl(var(--border));
		color: hsl(var(--foreground));
	}
	.btn--outline:hover {
		background: hsl(var(--muted));
	}
	.btn--sm {
		padding: 0.375rem 0.75rem;
		font-size: 0.8125rem;
	}
</style>
