<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { apiFetch } from '$lib/api/api-client';
	import { NetworkError, DownstreamUnavailableError, TimeoutError } from '$lib/api/problem-details';
	import { parseQueueParams, updateQueueParams } from '$lib/utils/query-state';
	import { formatDate, formatAmount, matchesSearch } from '$lib/utils';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import PaginationControls from '$lib/components/PaginationControls.svelte';
	import { authState } from '$lib/stores/auth';
	import ContinueProcessingButton from '$lib/features/assignments/components/ContinueProcessingButton.svelte';
	import { fetchAllPages } from '$lib/features/assignments/api/assignments-api';
	import type { VfsAppointmentSummaryResponse, OperationalAssignmentResponse } from '$lib/types/api';

	let allVfs = $state<VfsAppointmentSummaryResponse[]>([]);
	let isLoading = $state(true);
	let errorMessage = $state('');
	let searchDraft = $state('');
	let currentPage = $state(1);
	let pageSize = $state(15);

	let assignmentsMap = $state<Record<number, OperationalAssignmentResponse>>({});

	let params = $derived(parseQueueParams($page.url));

	$effect(() => { searchDraft = params.search; });

	async function load() {
		isLoading = true;
		errorMessage = '';
		try {
			const [vfsList, assignmentsList] = await Promise.all([
				fetchAllPages<VfsAppointmentSummaryResponse>('/api/vfs-appointments'),
				apiFetch<OperationalAssignmentResponse[]>('/api/assignments').catch(() => [])
			]);

			allVfs = vfsList;

			const map: Record<number, OperationalAssignmentResponse> = {};
			for (const item of assignmentsList) {
				if (item.entityType.toLowerCase() === 'vfs') {
					map[item.entityId] = item;
				}
			}
			assignmentsMap = map;
		} catch (err) {
			if (err instanceof DownstreamUnavailableError || err instanceof TimeoutError) {
				errorMessage = 'The booking service is temporarily unavailable. Please retry in a moment.';
			} else if (err instanceof NetworkError) {
				errorMessage = 'Unable to load VFS appointments. Please check your connection.';
			} else {
				errorMessage = 'Failed to load VFS appointments. Please retry.';
			}
		} finally {
			isLoading = false;
		}
	}

	onMount(() => { load(); });

	function onSearchInput(e: Event) {
		searchDraft = (e.target as HTMLInputElement).value;
		currentPage = 1;
		updateQueueParams({ search: searchDraft }, true);
	}
	function onStatusChange(e: Event) {
		currentPage = 1;
		updateQueueParams({ status: (e.target as HTMLSelectElement).value }, true);
	}

	const statusOptions = [
		{ value: '', label: 'All Statuses' },
		{ value: 'pending', label: 'Pending' },
		{ value: 'under_review', label: 'Under Review' },
		{ value: 'completed', label: 'Completed' },
		{ value: 'cancelled', label: 'Cancelled' }
	];

	// Filter strictly to MY claimed VFS appointments with instant search
	let rawDisplayItems = $derived(allVfs);
	let displayItems = $derived.by(() => {
		const currentUserId = $authState.user?.id;
		let list = rawDisplayItems.filter((appt) => assignmentsMap[appt.id]?.assignedToUserId === currentUserId);

		if (searchDraft.trim()) {
			list = list.filter((appt) =>
				matchesSearch([appt.documentNumber, appt.headName, appt.name, appt.country, appt.visaType, appt.processingStatus], searchDraft)
			);
		}

		if (params.status) {
			const statusFilter = params.status.toLowerCase().replace(/_/g, ' ');
			list = list.filter((appt) => (appt.processingStatus || '').toLowerCase().replace(/_/g, ' ') === statusFilter);
		}

		return list;
	});

	const paginatedItems = $derived.by(() => {
		const start = (currentPage - 1) * pageSize;
		return displayItems.slice(start, start + pageSize);
	});
</script>

<svelte:head><title>My VFS Appointments — Texas Operational Portal</title></svelte:head>

<div class="page">
	<div class="page-header">
		<div>
			<h1 class="page-title">My VFS Appointments</h1>
			<p class="page-desc">Active VFS appointments currently assigned to you for processing</p>
		</div>
		<button class="btn btn--outline btn--sm" onclick={load} disabled={isLoading}>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mr-1">
				<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
			</svg>
			Refresh
		</button>
	</div>

	<div class="filter-bar" role="search" aria-label="Filter VFS appointments">
		<div class="filter-bar__search">
			<svg class="filter-bar__search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
			<input id="vfs-search" type="search" class="filter-input filter-input--search" placeholder="Search by ref no, applicant, country…" value={searchDraft} oninput={onSearchInput} aria-label="Search VFS appointments" />
		</div>
		<select id="vfs-status-filter" class="filter-input filter-input--select" value={params.status} onchange={onStatusChange} aria-label="Filter by status">
			{#each statusOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}
		</select>
	</div>

	{#if isLoading}
		<div class="data-table-skeleton" aria-busy="true" aria-label="Loading VFS appointments">
			{#each Array(5) as _}<div class="row-skeleton">{#each Array(6) as _}<div class="skeleton-block" style="width:{Math.random()*40+30}%"></div>{/each}</div>{/each}
		</div>
	{:else if errorMessage}
		<div class="error-state" role="alert">
			<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
			<p class="error-state__msg">{errorMessage}</p>
			<button class="retry-btn" onclick={load}>Retry</button>
		</div>
	{:else if !isLoading}
		{#if displayItems.length === 0}
			<div class="empty-state" role="status">
				<div class="empty-state__icon" aria-hidden="true">
					<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
						<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
					</svg>
				</div>
				<p class="empty-state__title">No VFS Appointments Found</p>
				<p class="empty-state__hint">
					{#if searchDraft.trim() || params.status}
						No active VFS appointments match your search criteria. Try clearing search filters.
					{:else}
						You currently have no claimed VFS appointments. Visit the <a href="/pending-applications" class="font-semibold text-primary underline">Pending Applications</a> queue and click <strong>"Start Processing"</strong> to begin working.
					{/if}
				</p>
			</div>
		{:else}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div class="table-wrap" role="region" aria-label="My VFS appointments list" tabindex="0">
				<table class="data-table">
					<thead>
						<tr>
							<th scope="col">Ref No</th>
							<th scope="col">Applicant</th>
							<th scope="col">Customer</th>
							<th scope="col">Country</th>
							<th scope="col">Visa Type</th>
							<th scope="col">Status</th>
							<th scope="col">Amount</th>
							<th scope="col" class="text-right">Action</th>
						</tr>
					</thead>
					<tbody>
						{#each paginatedItems as appt}
							<tr class="data-table__row" onclick={() => goto(`/vfs/${appt.id}`)}>
								<td class="data-table__id">{appt.documentNumber}</td>
								<td class="data-table__primary">{appt.headName ?? '—'}</td>
								<td>{appt.name}</td>
								<td>{appt.country}</td>
								<td>{appt.visaType}</td>
								<td class="data-table__center"><StatusBadge status={appt.processingStatus} /></td>
								<td class="data-table__right font-mono">{formatAmount(appt.payableAmount)}</td>
								<td class="text-right">
									<ContinueProcessingButton detailUrl="/vfs/{appt.id}" />
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="mobile-cards" aria-label="My VFS appointments">
				{#each paginatedItems as appt}
					<a href="/vfs/{appt.id}" class="mobile-card">
						<div class="mobile-card__header">
							<span class="mobile-card__id">{appt.documentNumber}</span>
							<StatusBadge status={appt.processingStatus} />
						</div>
						<p class="mobile-card__title">{appt.name}</p>
						<p class="mobile-card__sub">{appt.country} · {appt.visaType} · {formatDate(appt.appointmentDate)}</p>
						<div class="mobile-card__footer"><span class="mobile-card__amount">{formatAmount(appt.payableAmount)}</span></div>
					</a>
				{/each}
			</div>

			<PaginationControls
				currentPage={currentPage}
				pageSize={pageSize}
				totalItems={displayItems.length}
				itemLabel="VFS appointment"
				pageSizeOptions={[10, 15, 25, 50]}
				onPageChange={(p) => (currentPage = p)}
				onPageSizeChange={(sz) => { pageSize = sz; currentPage = 1; }}
			/>
		{/if}
	{/if}
</div>

<style>
	@import '$lib/theme/queue-styles.css';

	.text-right { text-align: right; }
	.mr-1 { margin-right: 0.25rem; }

	.pagination-info-footer {
		padding: 0.75rem 0;
	}

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
