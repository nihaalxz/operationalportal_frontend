<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { apiFetch } from '$lib/api/api-client';
	import { NetworkError, DownstreamUnavailableError, TimeoutError } from '$lib/api/problem-details';
	import { parseQueueParams, updateQueueParams, PAGE_SIZES } from '$lib/utils/query-state';
	import { formatDate, formatAmount, matchesSearch } from '$lib/utils';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import PaginationControls from '$lib/components/PaginationControls.svelte';
	import { authState } from '$lib/stores/auth';
	import ContinueProcessingButton from '$lib/features/assignments/components/ContinueProcessingButton.svelte';
	import { fetchAllPages } from '$lib/features/assignments/api/assignments-api';
	import type { VisaApplicationSummaryResponse, OperationalAssignmentResponse } from '$lib/types/api';

	let allVisas = $state<VisaApplicationSummaryResponse[]>([]);
	let isLoading = $state(true);
	let errorMessage = $state('');
	let searchDraft = $state('');
	let currentPage = $state(1);
	let pageSize = $state(15);

	let assignmentsMap = $state<Record<number, OperationalAssignmentResponse>>({});

	let params = $derived(parseQueueParams($page.url));

	$effect(() => {
		searchDraft = params.search;
	});

	async function load() {
		isLoading = true;
		errorMessage = '';
		try {
			const [visasList, assignmentsList] = await Promise.all([
				fetchAllPages<VisaApplicationSummaryResponse>('/api/visas'),
				apiFetch<OperationalAssignmentResponse[]>('/api/assignments').catch(() => [])
			]);

			allVisas = visasList;

			const map: Record<number, OperationalAssignmentResponse> = {};
			for (const item of assignmentsList) {
				if (item.entityType.toLowerCase() === 'visa') {
					map[item.entityId] = item;
				}
			}
			assignmentsMap = map;
		} catch (err) {
			if (err instanceof DownstreamUnavailableError || err instanceof TimeoutError) {
				errorMessage = 'The booking service is temporarily unavailable. Please retry in a moment.';
			} else if (err instanceof NetworkError) {
				errorMessage = 'Unable to load visas. Please check your connection.';
			} else {
				errorMessage = 'Failed to load visa applications. Please retry.';
			}
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		load();
	});

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
		{ value: 'approved', label: 'Approved' },
		{ value: 'rejected', label: 'Rejected' }
	];

	let selectedCountry = $state('');

	function onCountryChange(e: Event) {
		selectedCountry = (e.target as HTMLSelectElement).value;
		currentPage = 1;
	}

	const availableCountries = $derived.by(() => {
		const set = new Set<string>();
		for (const v of allVisas) {
			const c = (v.countryName || v.country || v.visaPackName || '').trim();
			if (c && c !== '—') set.add(c);
		}
		return Array.from(set).sort((a, b) => a.localeCompare(b));
	});

	// Filter strictly to MY claimed visa applications with robust instant search
	let rawDisplayItems = $derived(allVisas);

	let displayItems = $derived.by(() => {
		const currentUserId = $authState.user?.id;
		let list = rawDisplayItems.filter((v) => assignmentsMap[v.id]?.assignedToUserId === currentUserId);

		if (searchDraft.trim()) {
			list = list.filter((v) =>
				matchesSearch(
					[
						v.documentNumber,
						v.headName,
						v.salesmanName,
						v.applicantFirstName,
						v.applicantFirstNames,
						v.applicantNames,
						v.countryName,
						v.country,
						v.passportNumber,
						v.passportNo,
						v.passportNumber?.replace(/\s+/g, ''),
						v.passportNo?.replace(/\s+/g, ''),
						v.applicantNames,
						v.visaPackName,
						v.clientType,
						v.processingStatus
					],
					searchDraft
				)
			);
		}

		if (params.status) {
			const statusFilter = params.status.toLowerCase().replace(/_/g, ' ');
			list = list.filter((v) => (v.processingStatus || '').toLowerCase().replace(/_/g, ' ') === statusFilter);
		}

		if (selectedCountry) {
			const countryFilter = selectedCountry.toLowerCase();
			list = list.filter((v) => {
				const c = (v.countryName || v.country || v.visaPackName || '').trim().toLowerCase();
				return c === countryFilter;
			});
		}

		return list;
	});

	const paginatedItems = $derived.by(() => {
		const start = (currentPage - 1) * pageSize;
		return displayItems.slice(start, start + pageSize);
	});
</script>

<svelte:head>
	<title>My Visas — Texas Operational Portal</title>
</svelte:head>

<div class="page">
	<div class="page-header">
		<div>
			<h1 class="page-title">My Visas</h1>
			<p class="page-desc">Active visa applications currently assigned to you for processing</p>
		</div>
		<button class="btn btn--outline btn--sm" onclick={load} disabled={isLoading}>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mr-1">
				<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
			</svg>
			Refresh
		</button>
	</div>

	<!-- Filters -->
	<div class="filter-bar" role="search" aria-label="Filter visa applications">
		<div class="filter-bar__search">
			<svg class="filter-bar__search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
				<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
			</svg>
			<input
				id="visa-search"
				type="search"
				class="filter-input filter-input--search"
				placeholder="Search by ref no, customer, passport no, country…"
				value={searchDraft}
				oninput={onSearchInput}
				aria-label="Search visa applications"
			/>
		</div>
		{#if availableCountries.length > 0}
			<select
				id="visa-country-filter"
				class="filter-input filter-input--select"
				value={selectedCountry}
				onchange={onCountryChange}
				aria-label="Filter by country"
			>
				<option value="">All Countries</option>
				{#each availableCountries as country}
					<option value={country}>{country}</option>
				{/each}
			</select>
		{/if}
		<select
			id="visa-status-filter"
			class="filter-input filter-input--select"
			value={params.status}
			onchange={onStatusChange}
			aria-label="Filter by status"
		>
			{#each statusOptions as opt}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
	</div>

	{#if isLoading}
		<div class="data-table-skeleton" aria-busy="true" aria-label="Loading visa applications">
			{#each Array(5) as _}
				<div class="row-skeleton">
					{#each Array(6) as _}
						<div class="skeleton-block" style="width: {Math.random() * 40 + 30}%"></div>
					{/each}
				</div>
			{/each}
		</div>
	{:else if errorMessage}
		<div class="error-state" role="alert">
			<div class="error-state__icon" aria-hidden="true">
				<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
			</div>
			<p class="error-state__msg">{errorMessage}</p>
			<button class="retry-btn" onclick={load}>Retry</button>
		</div>
	{:else if !isLoading}
		{#if displayItems.length === 0}
			<div class="empty-state" role="status">
				<div class="empty-state__icon" aria-hidden="true">
					<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
						<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
					</svg>
				</div>
				<p class="empty-state__title">No Visas Found</p>
				<p class="empty-state__hint">
					{#if searchDraft.trim() || params.status || selectedCountry}
						No active visas match your search criteria. Try clearing filters.
					{:else}
						You currently have no claimed visa applications. Visit the <a href="/pending-applications" class="font-semibold text-primary underline">Pending Applications</a> queue and click <strong>"Start Processing"</strong> to begin working.
					{/if}
				</p>
			</div>
		{:else}
			<!-- Desktop table -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div class="table-wrap" role="region" aria-label="My visa applications list" tabindex="0">
				<table class="data-table">
					<thead>
						<tr>
							<th scope="col" class="w-12 text-center">#</th>
							<th scope="col">Ref No</th>
							<th scope="col">Head</th>
							<th scope="col">Applicant</th>
							<th scope="col">Country</th>
							<th scope="col">Passport No</th>
							<th scope="col">Status</th>
							<th scope="col">Amount</th>
							<th scope="col" class="text-right">Action</th>
						</tr>
					</thead>
					<tbody>
						{#each paginatedItems as visa, index (visa.id)}
							<tr
								class="data-table__row"
								onclick={() => goto(`/visas/${visa.id}`)}
								role="button"
								tabindex="0"
								aria-label="View visa application {visa.documentNumber || visa.id}"
								onkeydown={(e) => e.key === 'Enter' && goto(`/visas/${visa.id}`)}
							>
								<td class="text-center font-mono text-xs text-muted-foreground">{((currentPage - 1) * pageSize) + index + 1}</td>
								<td class="data-table__id">
									<div class="font-mono text-xs font-semibold">{visa.documentNumber}</div>
									<div class="text-[11px] text-muted-foreground font-normal">{formatDate(visa.createdAt)}</div>
								</td>
								<td class="data-table__primary">
									<div class="font-medium text-foreground">{visa.headName ?? '—'}</div>
									{#if visa.salesmanName}
										<div class="text-[11px] text-muted-foreground font-normal flex items-center gap-1 mt-0.5">
											<span class="text-muted-foreground/70">Sales:</span>
											<span class="font-medium text-foreground/80">{visa.salesmanName}</span>
										</div>
									{/if}
								</td>
								<td>
									{#if (visa.applicantFirstName || visa.applicantFirstNames)?.trim()}
										<div class="font-medium text-foreground">{visa.applicantFirstName || visa.applicantFirstNames}</div>
									{:else}
										<span class="italic text-muted-foreground/80 text-xs">Not filled</span>
									{/if}
								</td>
								<td class="text-foreground">{visa.countryName || visa.country || visa.visaPackName || '—'}</td>
								<td class="font-mono text-xs">{visa.passportNumber || visa.passportNo || '—'}</td>
								<td>
									<div class="flex items-center gap-1.5 flex-wrap">
										<StatusBadge status={visa.processingStatus} />
										{#if ['approved', 'completed'].includes((visa.processingStatus || '').toLowerCase()) && !visa.visaDocument}
											<span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 uppercase tracking-wider" title="Approved without visa document attached">
												Doc Pending
											</span>
										{/if}
									</div>
								</td>
								<td class="data-table__amount">{formatAmount(visa.payableAmount)}</td>
								<td class="text-right">
									<ContinueProcessingButton detailUrl="/visas/{visa.id}" />
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Mobile cards -->
			<div class="mobile-cards" aria-label="My visa applications">
				{#each paginatedItems as visa, index (visa.id)}
					<a href="/visas/{visa.id}" class="mobile-card">
						<div class="mobile-card__header">
							<div class="flex items-center gap-2">
								<span class="text-xs font-mono text-muted-foreground font-semibold">#{((currentPage - 1) * pageSize) + index + 1}</span>
								<div>
									<span class="mobile-card__id">{visa.documentNumber}</span>
									<span class="text-[10px] text-muted-foreground block font-normal">Submitted: {formatDate(visa.createdAt)}</span>
								</div>
							</div>
							<div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
								<StatusBadge status={visa.processingStatus} />
								{#if ['approved', 'completed'].includes((visa.processingStatus || '').toLowerCase()) && !visa.visaDocument}
									<span class="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 uppercase" title="Approved without visa document attached">
										Doc Pending
									</span>
								{/if}
							</div>
						</div>
						<div class="space-y-0.5">
							<p class="mobile-card__title">{visa.headName ?? 'Unknown Customer'}</p>
							{#if visa.salesmanName}
								<span class="text-xs text-muted-foreground block">Sales: {visa.salesmanName}</span>
							{/if}
							<div class="text-xs text-muted-foreground">
								<span>Applicant: </span>
								{#if (visa.applicantFirstName || visa.applicantFirstNames)?.trim()}
									<strong class="text-foreground">{visa.applicantFirstName || visa.applicantFirstNames}</strong>
								{:else}
									<span class="italic text-muted-foreground/80">Not filled</span>
								{/if}
							</div>
						</div>
						<div class="text-xs text-muted-foreground flex items-center gap-3">
							<span>Country: <strong class="text-foreground">{visa.countryName || visa.country || visa.visaPackName || '—'}</strong></span>
							{#if (visa.passportNumber || visa.passportNo)}
								<span>Passport: <strong class="font-mono text-foreground">{visa.passportNumber || visa.passportNo}</strong></span>
							{/if}
						</div>
						<p class="mobile-card__sub">{visa.visaPackName ?? 'No Pack'} · {visa.applicantCount} applicant{visa.applicantCount !== 1 ? 's' : ''}</p>
						<div class="mobile-card__footer">
							<span class="mobile-card__amount">{formatAmount(visa.payableAmount)}</span>
						</div>
					</a>
				{/each}
			</div>

			<PaginationControls
				currentPage={currentPage}
				pageSize={pageSize}
				totalItems={displayItems.length}
				itemLabel="visa application"
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
