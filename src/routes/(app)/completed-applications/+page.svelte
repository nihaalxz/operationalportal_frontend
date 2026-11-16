<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { fetchCompletedApplications } from '$lib/features/assignments/api/assignments-api';
	import type { CompletedQueueItem } from '$lib/features/assignments/api/assignments-api';
	import AssignmentBadge from '$lib/features/assignments/components/AssignmentBadge.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import PaginationControls from '$lib/components/PaginationControls.svelte';
	import {
		formatAmount,
		formatDate,
		formatDateTime,
		matchesSearch,
		isCompletedToday,
		getBahrainDateString,
		parseDate
	} from '$lib/utils';

	type DatePreset = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom';

	let items = $state<CompletedQueueItem[]>([]);
	let isLoading = $state(true);
	let errorMessage = $state('');
	let searchQuery = $state('');
	let datePreset = $state<DatePreset>('all');
	let customStartDate = $state('');
	let customEndDate = $state('');
	let selectedCountry = $state('');
	let activeService = $state<'all' | 'visa' | 'vfs' | 'holiday'>('all');
	let currentPage = $state(1);
	let pageSize = $state(15);

	function getTodayBahrain(): string {
		return getBahrainDateString(new Date());
	}

	function getYesterdayBahrain(): string {
		const d = new Date();
		d.setDate(d.getDate() - 1);
		return getBahrainDateString(d);
	}

	function getWeekStartBahrain(): string {
		const d = new Date();
		d.setDate(d.getDate() - 6);
		return getBahrainDateString(d);
	}

	function getMonthStartBahrain(): string {
		const today = getTodayBahrain();
		return today.substring(0, 7) + '-01';
	}

	function getItemDateBahrain(completedAt: string | null | undefined): string | null {
		if (!completedAt) return null;
		const d = parseDate(completedAt);
		if (!d) return null;
		return getBahrainDateString(d);
	}

	function checkDateMatch(
		item: CompletedQueueItem,
		preset: DatePreset,
		customStart: string,
		customEnd: string
	): boolean {
		if (preset === 'all') return true;
		const itemDate = getItemDateBahrain(item.completedAt);
		if (!itemDate) return false;

		const today = getTodayBahrain();

		if (preset === 'today') {
			return itemDate === today || isCompletedToday(item.completedAt);
		}
		if (preset === 'yesterday') {
			return itemDate === getYesterdayBahrain();
		}
		if (preset === 'week') {
			return itemDate >= getWeekStartBahrain() && itemDate <= today;
		}
		if (preset === 'month') {
			return itemDate >= getMonthStartBahrain() && itemDate <= today;
		}
		if (preset === 'custom') {
			if (customStart && itemDate < customStart) return false;
			if (customEnd && itemDate > customEnd) return false;
			return true;
		}
		return true;
	}

	$effect(() => {
		const paramFilter = $page.url.searchParams.get('filter');
		const paramFrom = $page.url.searchParams.get('from');
		const paramTo = $page.url.searchParams.get('to');
		const paramService = $page.url.searchParams.get('service');
		const paramCountry = $page.url.searchParams.get('country');

		if (paramFrom || paramTo) {
			datePreset = 'custom';
			customStartDate = paramFrom || '';
			customEndDate = paramTo || '';
		} else if (paramFilter && ['all', 'today', 'yesterday', 'week', 'month'].includes(paramFilter)) {
			datePreset = paramFilter as DatePreset;
		}

		if (paramService && ['all', 'visa', 'vfs', 'holiday'].includes(paramService.toLowerCase())) {
			activeService = paramService.toLowerCase() as 'all' | 'visa' | 'vfs' | 'holiday';
		}

		if (paramCountry) {
			selectedCountry = paramCountry;
		}
	});

	function updateUrlParams(preset: DatePreset, start = customStartDate, end = customEndDate) {
		const url = new URL($page.url);
		if (preset === 'custom') {
			url.searchParams.delete('filter');
			if (start) url.searchParams.set('from', start);
			else url.searchParams.delete('from');
			if (end) url.searchParams.set('to', end);
			else url.searchParams.delete('to');
		} else {
			url.searchParams.delete('from');
			url.searchParams.delete('to');
			if (preset === 'all') {
				url.searchParams.delete('filter');
			} else {
				url.searchParams.set('filter', preset);
			}
		}
		goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
	}

	function selectPreset(preset: DatePreset) {
		datePreset = preset;
		currentPage = 1;
		if (preset === 'custom') {
			if (!customStartDate) customStartDate = getWeekStartBahrain();
			if (!customEndDate) customEndDate = getTodayBahrain();
			updateUrlParams('custom', customStartDate, customEndDate);
		} else {
			updateUrlParams(preset);
		}
	}

	function onCustomDateChange() {
		datePreset = 'custom';
		currentPage = 1;
		updateUrlParams('custom', customStartDate, customEndDate);
	}

	function clearCustomDates() {
		customStartDate = '';
		customEndDate = '';
		datePreset = 'all';
		currentPage = 1;
		updateUrlParams('all');
	}

	async function loadCompleted() {
		isLoading = true;
		errorMessage = '';
		try {
			items = await fetchCompletedApplications();
		} catch (err: any) {
			errorMessage = err?.message || 'Failed to load completed applications.';
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		loadCompleted();
	});

	const availableCountries = $derived.by(() => {
		const set = new Set<string>();
		for (const item of items) {
			const c = (item.country || item.destination || '').trim();
			if (c && c !== '—' && !c.includes('Service') && !c.includes('Appointment') && !c.includes('Package')) {
				set.add(c);
			}
		}
		return Array.from(set).sort((a, b) => a.localeCompare(b));
	});

	const filteredItems = $derived.by(() => {
		let list = [...items];

		// Filter by Date
		list = list.filter((item) => checkDateMatch(item, datePreset, customStartDate, customEndDate));

		// Filter by Service
		if (activeService !== 'all') {
			const serviceUpper = activeService.toUpperCase();
			list = list.filter((item) => item.entityType === serviceUpper);
		}

		// Filter by Country
		if (selectedCountry) {
			const countryFilter = selectedCountry.toLowerCase();
			list = list.filter((item) => {
				const c = (item.country || item.destination || '').trim().toLowerCase();
				return c === countryFilter;
			});
		}

		// Filter by Search Query (including passport no!)
		if (searchQuery.trim()) {
			list = list.filter((item) =>
				matchesSearch(
					[
						item.refNo,
						item.customer,
						item.salesmanName,
						item.govtId,
						item.applicantFirstName,
						item.passenger,
						item.passportNo,
						item.passportNo?.replace(/\s+/g, ''),
						item.country,
						item.details,
						item.destination,
						item.processingStatus
					],
					searchQuery
				)
			);
		}

		return list;
	});

	const paginatedItems = $derived.by(() => {
		const start = (currentPage - 1) * pageSize;
		return filteredItems.slice(start, start + pageSize);
	});

	const todayCount = $derived(items.filter((i) => checkDateMatch(i, 'today', '', '')).length);
	const yesterdayCount = $derived(items.filter((i) => checkDateMatch(i, 'yesterday', '', '')).length);
	const weekCount = $derived(items.filter((i) => checkDateMatch(i, 'week', '', '')).length);
	const monthCount = $derived(items.filter((i) => checkDateMatch(i, 'month', '', '')).length);

	const visaCount = $derived(items.filter((i) => i.entityType === 'VISA').length);
	const vfsCount = $derived(items.filter((i) => i.entityType === 'VFS').length);
	const holidayCount = $derived(items.filter((i) => i.entityType === 'HOLIDAY').length);
</script>

<svelte:head>
	<title>Completed Applications — Texas Operational Portal</title>
</svelte:head>

<div class="page">
	<div class="page-header">
		<div>
			<h1 class="page-title">Completed Applications</h1>
			<p class="page-desc">Operations and applications successfully finalized and completed by you</p>
		</div>
		<button class="btn btn--outline btn--sm" onclick={loadCompleted} disabled={isLoading}>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mr-1">
				<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
			</svg>
			Refresh
		</button>
	</div>

	<!-- Date Presets, Range Picker & Search Filters -->
	<div class="space-y-3 mb-4">
		<!-- Quick Date Range Pills -->
		<div class="flex items-center justify-between flex-wrap gap-2.5">
			<div class="tab-group" role="tablist" aria-label="Date filter presets">
				<button
					type="button"
					class="tab-btn"
					class:active={datePreset === 'all'}
					onclick={() => selectPreset('all')}
					role="tab"
					aria-selected={datePreset === 'all'}
				>
					All Time ({items.length})
				</button>
				<button
					type="button"
					class="tab-btn"
					class:active={datePreset === 'today'}
					onclick={() => selectPreset('today')}
					role="tab"
					aria-selected={datePreset === 'today'}
				>
					Today ({todayCount})
				</button>
				<button
					type="button"
					class="tab-btn"
					class:active={datePreset === 'yesterday'}
					onclick={() => selectPreset('yesterday')}
					role="tab"
					aria-selected={datePreset === 'yesterday'}
				>
					Yesterday ({yesterdayCount})
				</button>
				<button
					type="button"
					class="tab-btn"
					class:active={datePreset === 'week'}
					onclick={() => selectPreset('week')}
					role="tab"
					aria-selected={datePreset === 'week'}
				>
					This Week ({weekCount})
				</button>
				<button
					type="button"
					class="tab-btn"
					class:active={datePreset === 'month'}
					onclick={() => selectPreset('month')}
					role="tab"
					aria-selected={datePreset === 'month'}
				>
					This Month ({monthCount})
				</button>
				<button
					type="button"
					class="tab-btn"
					class:active={datePreset === 'custom'}
					onclick={() => selectPreset('custom')}
					role="tab"
					aria-selected={datePreset === 'custom'}
				>
					📅 Custom Range
				</button>
			</div>

			<!-- Service Selector -->
			<div class="flex items-center gap-2">
				<select
					class="filter-input filter-input--select filter-input--small"
					bind:value={activeService}
					onchange={() => (currentPage = 1)}
					aria-label="Filter by service"
				>
					<option value="all">All Services</option>
					<option value="visa">Visas ({visaCount})</option>
					<option value="vfs">VFS ({vfsCount})</option>
					<option value="holiday">Holidays ({holidayCount})</option>
				</select>
			</div>
		</div>

		<!-- Custom Date Range Picker (shown when Custom is active or selected) -->
		{#if datePreset === 'custom'}
			<div class="p-3 bg-muted/40 border border-border rounded-lg flex items-center flex-wrap gap-3">
				<span class="text-xs font-semibold text-foreground flex items-center gap-1.5">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
					</svg>
					Custom Date Range:
				</span>
				<div class="flex items-center gap-2">
					<label for="custom-start-date" class="text-xs text-muted-foreground font-medium">From:</label>
					<input
						id="custom-start-date"
						type="date"
						class="filter-input filter-input--select filter-input--small h-8 text-xs px-2"
						bind:value={customStartDate}
						onchange={onCustomDateChange}
						aria-label="From date"
					/>
				</div>
				<div class="flex items-center gap-2">
					<label for="custom-end-date" class="text-xs text-muted-foreground font-medium">To:</label>
					<input
						id="custom-end-date"
						type="date"
						class="filter-input filter-input--select filter-input--small h-8 text-xs px-2"
						bind:value={customEndDate}
						onchange={onCustomDateChange}
						aria-label="To date"
					/>
				</div>
				{#if customStartDate || customEndDate}
					<button
						type="button"
						class="btn btn--outline btn--sm text-xs h-8 px-2.5"
						onclick={clearCustomDates}
						title="Clear date range"
					>
						Reset Dates
					</button>
				{/if}
			</div>
		{/if}

		<!-- Secondary Filter Bar (Search + Country Filter) -->
		<div class="filter-bar" role="search" aria-label="Filter completed applications">
			<div class="filter-bar__search">
				<svg class="filter-bar__search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
					<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
				</svg>
				<input
					type="search"
					class="filter-input filter-input--search"
					placeholder="Search by ref no, customer, govt id, passport no, country…"
					bind:value={searchQuery}
					oninput={() => (currentPage = 1)}
					aria-label="Search completed applications"
				/>
			</div>

			{#if availableCountries.length > 0}
				<select
					class="filter-input filter-input--select"
					bind:value={selectedCountry}
					onchange={() => (currentPage = 1)}
					aria-label="Filter by country"
				>
					<option value="">All Countries</option>
					{#each availableCountries as country}
						<option value={country}>{country}</option>
					{/each}
				</select>
			{/if}
		</div>
	</div>

	{#if isLoading}
		<div class="data-table-skeleton" aria-busy="true" aria-label="Loading completed applications">
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
			<button class="retry-btn" onclick={loadCompleted}>Retry</button>
		</div>
	{:else if filteredItems.length === 0}
		<div class="empty-state" role="status">
			<div class="empty-state__icon" aria-hidden="true">
				<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
				</svg>
			</div>
			<p class="empty-state__title">No Completed Applications Found</p>
			<p class="empty-state__hint">
				{#if searchQuery.trim() || datePreset !== 'all' || selectedCountry || activeService !== 'all'}
					No completed applications match your current filters. Try changing or clearing filters.
				{:else}
					Applications you finalize or mark as completed/approved will appear here.
				{/if}
			</p>
		</div>
	{:else}
		<!-- Desktop Table -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div class="table-wrap" role="region" aria-label="Completed applications list" tabindex="0">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col" class="w-12 text-center">#</th>
						<th scope="col">Service</th>
						<th scope="col">Ref No</th>
						<th scope="col">Head</th>
						<th scope="col">Country</th>
						<th scope="col">Passport No</th>
						<th scope="col">Govt ID</th>
						<th scope="col">Passenger / Details</th>
						<th scope="col">Status</th>
						<th scope="col">Completed Date</th>
						<th scope="col">Amount</th>
						<th scope="col" class="text-right">Action</th>
					</tr>
				</thead>
				<tbody>
					{#each paginatedItems as item, index (item.entityType + '_' + item.id)}
						<tr
							class="data-table__row"
							onclick={() => goto(item.detailUrl)}
							role="button"
							tabindex="0"
							aria-label="View application {item.refNo}"
							onkeydown={(e) => e.key === 'Enter' && goto(item.detailUrl)}
						>
							<td class="text-center font-mono text-xs text-muted-foreground">{((currentPage - 1) * pageSize) + index + 1}</td>
							<td><AssignmentBadge type={item.entityType} /></td>
							<td class="data-table__id">
								<div class="font-mono text-xs font-semibold">{item.refNo}</div>
								{#if item.createdAt}
									<div class="text-[11px] text-muted-foreground font-normal">{formatDate(item.createdAt)}</div>
								{/if}
							</td>
							<td class="data-table__primary">
								<div class="font-medium text-foreground">{item.customer}</div>
								{#if item.salesmanName}
									<div class="text-[11px] text-muted-foreground font-normal flex items-center gap-1 mt-0.5">
										<span class="text-muted-foreground/70">Sales:</span>
										<span class="font-medium text-foreground/80">{item.salesmanName}</span>
									</div>
								{/if}
							</td>
							<td class="text-foreground">{item.country || item.destination}</td>
							<td class="font-mono text-xs">{item.passportNo || '—'}</td>
							<td class="font-mono text-xs">
								{#if item.govtId && item.govtId !== '—'}
									<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
										{item.govtId}
									</span>
								{:else}
									<span class="text-muted-foreground/60">—</span>
								{/if}
							</td>
							<td>
								<div class="font-medium text-foreground">
									{item.applicantFirstName || item.passenger || '—'}
								</div>
								{#if item.details}
									<div class="text-[11px] text-muted-foreground truncate max-w-[200px]" title={item.details}>
										{item.details}
									</div>
								{/if}
							</td>
							<td>
								<div class="flex items-center gap-1.5 flex-wrap">
									<StatusBadge status={item.processingStatus} />
									{#if item.entityType === 'VISA' && ['approved', 'completed'].includes(item.processingStatus.toLowerCase()) && !item.visaDocument}
										<span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 uppercase tracking-wider" title="Approved without visa document attached">
											Doc Pending
										</span>
									{/if}
								</div>
							</td>
							<td class="data-table__date">{formatDateTime(item.completedAt)}</td>
							<td class="data-table__amount">{formatAmount(item.payableAmount)}</td>
							<td class="text-right">
								<a href={item.detailUrl} class="view-btn">View Details &rarr;</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Mobile Cards -->
		<div class="mobile-cards" aria-label="Completed applications">
			{#each paginatedItems as item, index (item.entityType + '_' + item.id)}
				<a href={item.detailUrl} class="mobile-card">
					<div class="mobile-card__header">
						<div style="display: flex; align-items: center; gap: 0.5rem;">
							<span class="text-xs font-mono text-muted-foreground font-semibold">#{((currentPage - 1) * pageSize) + index + 1}</span>
							<AssignmentBadge type={item.entityType} />
							<div>
								<span class="mobile-card__id">{item.refNo}</span>
								{#if item.createdAt}
									<span class="text-[10px] text-muted-foreground block font-normal">Submitted: {formatDate(item.createdAt)}</span>
								{/if}
							</div>
						</div>
						<div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
							<StatusBadge status={item.processingStatus} />
							{#if item.entityType === 'VISA' && ['approved', 'completed'].includes(item.processingStatus.toLowerCase()) && !item.visaDocument}
								<span class="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 uppercase" title="Approved without visa document attached">
									Doc Pending
								</span>
							{/if}
						</div>
					</div>
					<div class="space-y-0.5">
						<p class="mobile-card__title">{item.customer}</p>
						{#if item.salesmanName}
							<span class="text-xs text-muted-foreground">Sales: {item.salesmanName}</span>
						{/if}
					</div>
					<div class="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
						{#if item.applicantFirstName}
							<span>Applicant: <strong class="text-foreground">{item.applicantFirstName}</strong></span>
						{/if}
						{#if item.govtId && item.govtId !== '—'}
							<span>Govt ID: <strong class="font-mono text-emerald-600 dark:text-emerald-400">{item.govtId}</strong></span>
						{/if}
						<span>Country: <strong class="text-foreground">{item.country || item.destination}</strong></span>
						{#if item.passportNo && item.passportNo !== '—'}
							<span>Passport: <strong class="font-mono text-foreground">{item.passportNo}</strong></span>
						{/if}
					</div>
					<p class="mobile-card__sub">{item.details}</p>
					<div class="mobile-card__footer">
						<span class="data-table__date">Completed: {formatDateTime(item.completedAt)}</span>
						<span class="mobile-card__amount">{formatAmount(item.payableAmount)}</span>
					</div>
				</a>
			{/each}
		</div>

		<PaginationControls
			currentPage={currentPage}
			pageSize={pageSize}
			totalItems={filteredItems.length}
			itemLabel="completed application"
			pageSizeOptions={[10, 15, 25, 50]}
			onPageChange={(p) => (currentPage = p)}
			onPageSizeChange={(sz) => { pageSize = sz; currentPage = 1; }}
		/>
	{/if}
</div>

<style>
	@import '$lib/theme/queue-styles.css';

	.text-right { text-align: right; }
	.mr-1 { margin-right: 0.25rem; }

	.tab-group {
		display: flex;
		background: hsl(var(--muted));
		padding: 0.25rem;
		border-radius: 0.625rem;
		border: 1px solid hsl(var(--border));
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.tab-btn {
		padding: 0.375rem 0.875rem;
		font-size: 0.8125rem;
		font-weight: 600;
		color: hsl(var(--muted-foreground));
		border-radius: 0.375rem;
		border: none;
		background: transparent;
		cursor: pointer;
		transition: all 0.15s;
	}

	.tab-btn:hover {
		color: hsl(var(--foreground));
	}

	.tab-btn.active {
		background: hsl(var(--background));
		color: hsl(var(--foreground));
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.view-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.375rem 0.75rem;
		font-size: 0.75rem;
		font-weight: 700;
		color: hsl(var(--primary));
		background: hsl(var(--primary) / 0.08);
		border-radius: 0.5rem;
		text-decoration: none;
		transition: all 0.15s;
	}

	.view-btn:hover {
		background: hsl(var(--primary) / 0.18);
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
