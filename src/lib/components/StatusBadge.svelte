<script lang="ts">
	import { getProcessingStatus, getPaymentStatus, type StatusVariant } from '$lib/utils/status';

	interface Props {
		status: string | null | undefined;
		type?: 'processing' | 'payment';
	}

	let { status, type = 'processing' }: Props = $props();

	const config = $derived(
		type === 'payment' ? getPaymentStatus(status) : getProcessingStatus(status)
	);

	const variantClass = $derived(`badge--${config.variant}`);
</script>

<span
	class="badge {variantClass}"
	aria-label={config.ariaLabel}
	role="status"
>
	{config.label}
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		padding: 0.2em 0.65em;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		white-space: nowrap;
	}

	.badge--default {
		background: hsl(var(--muted));
		color: hsl(var(--muted-foreground));
	}
	.badge--success {
		background: hsl(var(--success) / 0.15);
		color: hsl(var(--success));
		border: 1px solid hsl(var(--success) / 0.3);
	}
	.badge--warning {
		background: hsl(var(--warning) / 0.15);
		color: hsl(var(--warning));
		border: 1px solid hsl(var(--warning) / 0.3);
	}
	.badge--destructive {
		background: hsl(var(--destructive) / 0.12);
		color: hsl(var(--destructive));
		border: 1px solid hsl(var(--destructive) / 0.25);
	}
	.badge--processing {
		background: hsl(var(--processing) / 0.12);
		color: hsl(var(--processing));
		border: 1px solid hsl(var(--processing) / 0.25);
	}
	.badge--outline {
		background: transparent;
		color: hsl(var(--muted-foreground));
		border: 1px solid hsl(var(--border));
	}
</style>
