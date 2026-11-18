<script lang="ts">
	import { onMount } from 'svelte';
	import AssignmentBadge from './AssignmentBadge.svelte';
	import StartProcessingButton from './StartProcessingButton.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { formatAmount, formatDate } from '$lib/utils';
	import type { PendingQueueItem } from '../types/assignment-types';
	import { fetchWorkloadSummary } from '../api/assignments-api';
	import type { OperatorWorkloadSummary } from '../api/assignments-api';

	let {
		items = [],
		isLoading = false,
		startIndex = 0,
		showService = true,
		onClaimError,
		onClaimSuccess
	}: {
		items: PendingQueueItem[];
		isLoading?: boolean;
		startIndex?: number;
		showService?: boolean;
		onClaimError?: (msg: string) => void;
		onClaimSuccess?: () => void;
	} = $props();

	let workload = $state<OperatorWorkloadSummary | null>(null);

	async function loadWorkload() {
		workload = await fetchWorkloadSummary();
	}

	onMount(() => {
		loadWorkload();
	});

	function checkLimit(entityType: string): { isLimitReached: boolean; limitText: string } {
		if (!workload) return { isLimitReached: false, limitText: '' };

		const type = entityType.toUpperCase();
		if (type.includes('VISA')) {
			const reached = workload.visaActiveCount >= workload.visaMaxLimit;
			return { isLimitReached: reached, limitText: `${workload.visaActiveCount}/${workload.visaMaxLimit}` };
		}
		if (type.includes('VFS')) {
			const reached = workload.vfsActiveCount >= workload.vfsMaxLimit;
			return { isLimitReached: reached, limitText: `${workload.vfsActiveCount}/${workload.vfsMaxLimit}` };
		}
		if (type.includes('HOLIDAY')) {
			const reached = workload.holidayActiveCount >= workload.holidayMaxLimit;
			return { isLimitReached: reached, limitText: `${workload.holidayActiveCount}/${workload.holidayMaxLimit}` };
		}
		return { isLimitReached: false, limitText: '' };
	}
</script>

{#if workload}
	<div class="capacity-banner">
		<div class="capacity-title">
			<div class="capacity-title__icon">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
					<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
				</svg>
			</div>
			<span>Your Active Workload Capacity:</span>
		</div>
		<div class="capacity-pills">
			<span class="capacity-pill capacity-pill--visa" class:capacity-pill--full={workload.visaActiveCount >= workload.visaMaxLimit}>
				<span class="pill-label">Visas:</span> <strong>{workload.visaActiveCount}/{workload.visaMaxLimit}</strong> active
			</span>
			<span class="capacity-pill capacity-pill--vfs" class:capacity-pill--full={workload.vfsActiveCount >= workload.vfsMaxLimit}>
				<span class="pill-label">VFS:</span> <strong>{workload.vfsActiveCount}/{workload.vfsMaxLimit}</strong> active
			</span>
			<span class="capacity-pill capacity-pill--holiday" class:capacity-pill--full={workload.holidayActiveCount >= workload.holidayMaxLimit}>
				<span class="pill-label">Holidays:</span> <strong>{workload.holidayActiveCount}/{workload.holidayMaxLimit}</strong> active
			</span>
		</div>
	</div>
{/if}

{#if isLoading}
	<div class="data-table-skeleton" aria-busy="true" aria-label="Loading pending queue">
		{#each Array(5) as _}
			<div class="row-skeleton">
				{#each Array(7) as _}
					<div class="skeleton-block" style="width: {Math.random() * 40 + 30}%"></div>
				{/each}
			</div>
		{/each}
	</div>
{:else if items.length === 0}
	<div class="empty-state" role="status">
		<div class="empty-state__icon" aria-hidden="true">
			<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
				<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
				<path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
			</svg>
		</div>
		<p class="empty-state__title">Queue Clear! No Pending Applications</p>
		<p class="empty-state__hint">All incoming applications have been claimed by operators or processed.</p>
	</div>
{:else}
	<!-- Desktop Table -->
	<div class="table-wrap" role="region" aria-label="Pending applications inbox">
		<table class="data-table">
			<thead>
				<tr>
					<th scope="col" class="w-12 text-center">#</th>
					{#if showService}
						<th scope="col">Service</th>
					{/if}
					<th scope="col">Ref No</th>
					<th scope="col">Head</th>
					<th scope="col">Applicant</th>
					<th scope="col">Country</th>
					<th scope="col">Visa Details</th>
					<th scope="col">Passport No</th>
					<th scope="col">Status</th>
					<th scope="col" class="text-right">Action</th>
				</tr>
			</thead>
			<tbody>
				{#each items as item, index (item.entityType + '_' + (item.refNo || item.id))}
					<tr class="data-table__row">
						<td class="text-center font-mono text-xs text-muted-foreground">{startIndex + index + 1}</td>
						{#if showService}
							<td>
								<AssignmentBadge type={item.entityType} />
							</td>
						{/if}
						<td class="data-table__id">
							<div class="font-mono text-xs font-semibold">{item.refNo}</div>
							<div class="text-[11px] text-muted-foreground font-normal">{formatDate(item.createdAt)}</div>
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
						<td>
							<div class="font-medium text-foreground">{item.applicantFirstName || item.passenger || '—'}</div>
						</td>
						<td class="text-foreground">{item.country || item.destination}</td>
						<td class="text-xs text-muted-foreground">{item.visaPackDetails || item.details}</td>
						<td class="font-mono text-xs">{item.passportNo || '—'}</td>
						<td>
							<StatusBadge status={item.processingStatus} />
						</td>
						<td class="text-right">
							<StartProcessingButton
								entityType={item.entityType}
								entityId={item.entityId}
								refNo={item.refNo}
								detailUrl={item.detailUrl}
								isLimitReached={checkLimit(item.entityType).isLimitReached}
								limitText={checkLimit(item.entityType).limitText}
								onSuccess={() => { loadWorkload(); if (onClaimSuccess) onClaimSuccess(); }}
								onError={onClaimError}
							/>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Mobile Cards -->
	<div class="mobile-cards" aria-label="Pending applications cards">
		{#each items as item, index (item.entityType + '_' + (item.refNo || item.id))}
			<div class="mobile-card">
				<div class="mobile-card__header">
					<div style="display: flex; align-items: center; gap: 0.5rem;">
						<span class="text-xs font-mono text-muted-foreground font-semibold">#{startIndex + index + 1}</span>
						{#if showService}
							<AssignmentBadge type={item.entityType} />
						{/if}
						<div>
							<span class="mobile-card__id">{item.refNo}</span>
							<span class="text-[10px] text-muted-foreground block font-normal">Submitted: {formatDate(item.createdAt)}</span>
						</div>
					</div>
					<StatusBadge status={item.processingStatus} />
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
					<span>Country: <strong class="text-foreground">{item.country || item.destination}</strong></span>
					{#if item.passportNo && item.passportNo !== '—'}
						<span>Passport: <strong class="font-mono text-foreground">{item.passportNo}</strong></span>
					{/if}
				</div>
				<p class="mobile-card__sub">{item.visaPackDetails || item.details}</p>
				<div class="mobile-card__footer">
					<StartProcessingButton
						entityType={item.entityType}
						entityId={item.entityId}
						refNo={item.refNo}
						detailUrl={item.detailUrl}
						isLimitReached={checkLimit(item.entityType).isLimitReached}
						limitText={checkLimit(item.entityType).limitText}
						onSuccess={() => { loadWorkload(); if (onClaimSuccess) onClaimSuccess(); }}
						onError={onClaimError}
					/>
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	@import '$lib/theme/queue-styles.css';

	.text-right { text-align: right; }

	.capacity-banner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.5rem;
		background: #ffffff;
		border: 1px solid hsl(var(--border));
		border-radius: 0.875rem;
		margin-bottom: 1.5rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
	}

	.capacity-title {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		font-size: 1rem;
		font-weight: 700;
		color: hsl(var(--foreground));
	}

	.capacity-title__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 0.5rem;
		background: hsl(var(--primary) / 0.1);
		color: hsl(var(--primary));
	}

	.capacity-pills {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.625rem;
	}

	.capacity-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.875rem;
		font-weight: 600;
		padding: 0.4rem 0.875rem;
		border-radius: 0.625rem;
		background: hsl(var(--muted) / 0.5);
		border: 1px solid hsl(var(--border));
		color: hsl(var(--foreground));
		transition: all 0.15s ease;
	}

	.capacity-pill .pill-label {
		font-weight: 600;
	}

	.capacity-pill--visa {
		background: hsl(215 89% 53% / 0.08);
		border-color: hsl(215 89% 53% / 0.25);
		color: hsl(215 89% 45%);
	}
	.capacity-pill--visa strong {
		color: hsl(215 89% 38%);
	}

	.capacity-pill--vfs {
		background: hsl(270 70% 55% / 0.08);
		border-color: hsl(270 70% 55% / 0.25);
		color: hsl(270 70% 45%);
	}
	.capacity-pill--vfs strong {
		color: hsl(270 70% 38%);
	}

	.capacity-pill--holiday {
		background: hsl(160 84% 39% / 0.08);
		border-color: hsl(160 84% 39% / 0.25);
		color: hsl(160 84% 30%);
	}
	.capacity-pill--holiday strong {
		color: hsl(160 84% 22%);
	}

	.capacity-pill.capacity-pill--full {
		background: hsl(0 84% 60% / 0.12);
		border-color: hsl(0 84% 60% / 0.35);
		color: hsl(0 72% 45%);
		font-weight: 700;
	}
	.capacity-pill.capacity-pill--full strong {
		color: hsl(0 84% 38%);
	}

	.empty-state {
		text-align: center;
		padding: 3.5rem 1.5rem;
		background: #ffffff;
		border: 1px solid hsl(var(--border));
		border-radius: 0.875rem;
	}
	.empty-state__icon {
		color: hsl(var(--muted-foreground));
		margin-bottom: 0.75rem;
	}
	.empty-state__title {
		font-size: 1.125rem;
		font-weight: 700;
		color: hsl(var(--foreground));
		margin: 0 0 0.375rem;
	}
	.empty-state__hint {
		font-size: 0.875rem;
		color: hsl(var(--muted-foreground));
		margin: 0;
	}
</style>
