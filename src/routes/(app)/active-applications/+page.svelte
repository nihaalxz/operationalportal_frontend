<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { fetchMyActiveAssignments } from '$lib/features/assignments/api/assignments-api';
	import type { OperationalAssignmentResponse } from '$lib/types/api';
	import AssignmentBadge from '$lib/features/assignments/components/AssignmentBadge.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import PaginationControls from '$lib/components/PaginationControls.svelte';
	import { formatDateTime, matchesSearch } from '$lib/utils';

	let items = $state<OperationalAssignmentResponse[]>([]);
	let isLoading = $state(true);
	let errorMessage = $state('');
	let searchQuery = $state('');
	let currentPage = $state(1);
	let pageSize = $state(15);

	function onSearchChange(val: string) {
		searchQuery = val;
		currentPage = 1;
	}

	async function loadActive() {
		isLoading = true;
		errorMessage = '';
		try {
			const result = await fetchMyActiveAssignments();
			items = [...result.assignments].sort((a, b) => {
				if (!a.assignedAt) return 1;
				if (!b.assignedAt) return -1;
				return new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime();
			});
		} catch (err: any) {
			errorMessage = err?.message || 'Failed to load active applications.';
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		loadActive();
	});

	const filteredItems = $derived.by(() => {
		if (!searchQuery.trim()) return items;
		return items.filter((item) =>
			matchesSearch([item.entityDocumentNumber ?? '', item.entityType, item.status, item.assignedToUserName], searchQuery)
		);
	});

	const paginatedItems = $derived.by(() => {
		const start = (currentPage - 1) * pageSize;
		return filteredItems.slice(start, start + pageSize);
	});

	function moduleLabel(type: string): string {
		const t = type.toUpperCase();
		if (t.includes('VISA')) return 'Visa';
		if (t.includes('VFS')) return 'VFS';
		if (t.includes('HOLIDAY')) return 'Holiday';
		return type;
	}

	function detailUrl(item: OperationalAssignmentResponse): string {
		const t = item.entityType.toUpperCase();
		if (t.includes('VISA')) return `/visas/${item.entityId}`;
		if (t.includes('VFS')) return `/vfs/${item.entityId}`;
		if (t.includes('HOLIDAY')) return `/holidays/${item.entityId}`;
		return '#';
	}

	function refNo(item: OperationalAssignmentResponse): string {
		return item.entityDocumentNumber || `#${moduleLabel(item.entityType)}-${item.entityId}`;
	}
</script>

<svelte:head>
	<title>Active Applications — Texas Operational Portal</title>
</svelte:head>

<div class="page">
	<div class="page-header">
		<div>
			<h1 class="page-title">Active Workload</h1>
			<p class="page-desc">Applications currently assigned to you and in active processing</p>
		</div>
		<button class="btn btn--outline btn--sm" onclick={loadActive} disabled={isLoading}>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mr-1">
				<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
			</svg>
			Refresh
		</button>
	</div>

	<!-- Metrics Row -->
	<div class="metrics-row">
		<div class="metric-pill">
			<span class="metric-pill__label">Total Active</span>
			<span class="metric-pill__value">{items.length}</span>
		</div>
		<div class="metric-pill metric-pill--visa">
			<span class="metric-pill__label">Visas</span>
			<span class="metric-pill__value">{items.filter(i => i.entityType.includes('VISA')).length}</span>
		</div>
		<div class="metric-pill metric-pill--vfs">
			<span class="metric-pill__label">VFS</span>
			<span class="metric-pill__value">{items.filter(i => i.entityType.includes('VFS')).length}</span>
		</div>
		<div class="metric-pill metric-pill--holiday">
			<span class="metric-pill__label">Holidays</span>
			<span class="metric-pill__value">{items.filter(i => i.entityType.includes('HOLIDAY')).length}</span>
		</div>
	</div>

	<!-- Search -->
	<div class="search-bar">
		<svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
			<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
		</svg>
		<input
			type="search"
			class="filter-input filter-input--search"
			placeholder="Search by ref no, module type, status…"
			bind:value={searchQuery}
			oninput={() => (currentPage = 1)}
			aria-label="Search active applications"
		/>
	</div>

	{#if isLoading}
		<div class="data-table-skeleton" aria-busy="true" aria-label="Loading active applications">
			{#each Array(4) as _}
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
			<button class="retry-btn" onclick={loadActive}>Retry</button>
		</div>
	{:else if filteredItems.length === 0}
		<div class="empty-state" role="status">
			<div class="empty-state__icon" aria-hidden="true">
				<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
				</svg>
			</div>
			<p class="empty-state__title">No Active Applications</p>
			<p class="empty-state__hint">
				{#if searchQuery.trim()}
					No active applications match your search.
				{:else}
					You have no applications in active processing. Go to the <a href="/pending-applications" class="empty-link">Pending Queue</a> to start processing.
				{/if}
			</p>
		</div>
	{:else}
		<!-- Desktop Table -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div class="table-wrap" role="region" aria-label="Active applications list" tabindex="0">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">Module</th>
						<th scope="col">Ref No</th>
						<th scope="col">Status</th>
						<th scope="col">Assigned At</th>
						<th scope="col" class="text-right">Action</th>
					</tr>
				</thead>
				<tbody>
					{#each paginatedItems as item (item.entityType + '_' + item.id)}
						<tr
							class="data-table__row"
							onclick={() => goto(detailUrl(item))}
							role="button"
							tabindex="0"
							onkeydown={(e) => e.key === 'Enter' && goto(detailUrl(item))}
						>
							<td><AssignmentBadge type={item.entityType} /></td>
							<td class="data-table__id">{refNo(item)}</td>
							<td><StatusBadge status={item.status} /></td>
							<td class="data-table__date">{formatDateTime(item.assignedAt)}</td>
							<td class="text-right">
								<a href={detailUrl(item)} class="view-btn" onclick={(e) => e.stopPropagation()}>
									Open {moduleLabel(item.entityType)} &rarr;
								</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Mobile Cards -->
		<div class="mobile-cards" aria-label="Active applications cards">
			{#each paginatedItems as item (item.entityType + '_' + item.id)}
				<a href={detailUrl(item)} class="mobile-card">
					<div class="mobile-card__header">
						<div style="display: flex; align-items: center; gap: 0.5rem;">
							<AssignmentBadge type={item.entityType} />
							<span class="mobile-card__id">{refNo(item)}</span>
						</div>
						<StatusBadge status={item.status} />
					</div>
					<div class="mobile-card__footer">
						<span class="data-table__date">{formatDateTime(item.assignedAt)}</span>
						<span class="view-btn">Open &rarr;</span>
					</div>
				</a>
			{/each}
		</div>

		<PaginationControls
			currentPage={currentPage}
			pageSize={pageSize}
			totalItems={filteredItems.length}
			itemLabel="active application"
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

	.metrics-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-bottom: 1.25rem;
	}

	.metric-pill {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.5rem 1rem;
		background: hsl(var(--muted) / 0.5);
		border: 1px solid hsl(var(--border));
		border-radius: 0.625rem;
		font-size: 0.8125rem;
	}
	.metric-pill__label {
		color: hsl(var(--muted-foreground));
		font-weight: 500;
	}
	.metric-pill__value {
		font-size: 1.125rem;
		font-weight: 800;
		color: hsl(var(--foreground));
	}
	.metric-pill--visa .metric-pill__value { color: hsl(215 89% 53%); }
	.metric-pill--vfs .metric-pill__value { color: hsl(270 70% 55%); }
	.metric-pill--holiday .metric-pill__value { color: hsl(160 84% 39%); }

	.search-bar {
		position: relative;
		margin-bottom: 1.25rem;
	}
	.search-icon {
		position: absolute;
		left: 0.875rem;
		top: 50%;
		transform: translateY(-50%);
		color: hsl(var(--muted-foreground));
		pointer-events: none;
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
	.view-btn:hover { background: hsl(var(--primary) / 0.18); }

	.empty-link {
		color: hsl(var(--primary));
		text-decoration: underline;
	}

	.pagination-info-footer { padding: 0.75rem 0; }

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
	.btn--outline:hover { background: hsl(var(--muted)); }
	.btn--sm { padding: 0.375rem 0.75rem; font-size: 0.8125rem; }
</style>
