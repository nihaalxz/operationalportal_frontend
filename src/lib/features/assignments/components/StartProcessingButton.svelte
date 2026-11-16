<script lang="ts">
	import { goto } from '$app/navigation';
	import { claimOperation } from '../api/assignments-api';
	import { refreshPendingCount } from '../stores/assignment-store.svelte';
	import type { ServiceType } from '../types/assignment-types';

	let {
		entityType,
		entityId,
		refNo,
		detailUrl,
		disabled = false,
		isLimitReached = false,
		limitText = '',
		onSuccess,
		onError
	}: {
		entityType: ServiceType;
		entityId: number;
		refNo: string;
		detailUrl: string;
		disabled?: boolean;
		isLimitReached?: boolean;
		limitText?: string;
		onSuccess?: () => void;
		onError?: (msg: string) => void;
	} = $props();

	let isClaiming = $state(false);

	async function handleClick(e: MouseEvent) {
		e.stopPropagation();
		if (isClaiming || disabled || isLimitReached) {
			if (isLimitReached) {
				const msg = `Workload limit reached for ${entityType}. Complete an active item to start processing a new application.`;
				if (onError) onError(msg);
				else alert(msg);
			}
			return;
		}

		isClaiming = true;
		try {
			await claimOperation(entityType, entityId, refNo);
			await refreshPendingCount();
			if (onSuccess) onSuccess();
			await goto(detailUrl);
		} catch (err: any) {
			let errorMsg = 'Failed to claim operation.';
			if (err?.status === 409 || err?.message?.includes('already been assigned') || err?.message?.includes('conflict') || err?.message?.includes('Workload limit')) {
				errorMsg = err.message || 'Workload limit reached or application already claimed.';
			} else if (err?.message) {
				errorMsg = err.message;
			}

			if (onError) {
				onError(errorMsg);
			} else {
				alert(errorMsg);
			}
			await refreshPendingCount();
		} finally {
			isClaiming = false;
		}
	}
</script>

<button
	type="button"
	class="btn-start-processing"
	class:btn-start-processing--limit={isLimitReached}
	disabled={isClaiming || disabled || isLimitReached}
	onclick={handleClick}
	title={isLimitReached ? `Workload limit reached (${limitText || '3/3'}). Complete an active item first.` : 'Start processing this application'}
>
	{#if isClaiming}
		<span class="spinner" aria-hidden="true"></span>
		<span>Claiming…</span>
	{:else if isLimitReached}
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mr-1.5">
			<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
		</svg>
		<span>{limitText || 'Limit Reached (3/3)'}</span>
	{:else}
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mr-1.5">
			<polygon points="5 3 19 12 5 21 5 3"/>
		</svg>
		<span>Start Processing</span>
	{/if}
</button>

<style>
	.btn-start-processing {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.4rem 0.85rem;
		border-radius: 0.375rem;
		font-size: 0.8125rem;
		font-weight: 600;
		text-decoration: none;
		border: none;
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.15s ease;
		font-family: inherit;
		background: hsl(var(--success, 142 76% 36%));
		color: hsl(var(--success-foreground, 0 0% 100%));
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}
	.btn-start-processing:hover:not(:disabled) {
		opacity: 0.92;
		transform: translateY(-1px);
	}
	.btn-start-processing:disabled {
		background: hsl(var(--muted));
		color: hsl(var(--muted-foreground));
		border: 1px solid hsl(var(--border));
		opacity: 0.7;
		cursor: not-allowed;
		transform: none;
	}
	.mr-1\.5 { margin-right: 0.375rem; }

	.spinner {
		width: 12px;
		height: 12px;
		border: 2px solid currentColor;
		border-top-color: transparent;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
		margin-right: 0.375rem;
	}

	@keyframes spin { to { transform: rotate(360deg); } }
</style>
