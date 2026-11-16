<script lang="ts">
	let { waitingMinutes = 0, priority = 'Normal' }: { waitingMinutes?: number; priority?: 'Urgent' | 'High' | 'Normal' } = $props();

	function formatWaiting(minutes: number): string {
		if (minutes < 1) return '< 1m';
		if (minutes < 60) return `${minutes}m`;
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
		const days = Math.floor(hours / 24);
		const remHours = hours % 24;
		return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
	}

	const waitingText = $derived(formatWaiting(waitingMinutes));
</script>

<div class="waiting-badge-container">
	<span class="waiting-time">{waitingText}</span>
	<span class="priority-tag priority-tag--{priority.toLowerCase()}">{priority}</span>
</div>

<style>
	.waiting-badge-container {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
	}
	.waiting-time {
		font-family: inherit;
		font-size: 0.8125rem;
		font-weight: 600;
		color: hsl(var(--foreground));
	}
	.priority-tag {
		font-size: 0.65rem;
		font-weight: 700;
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.priority-tag--urgent {
		background: hsl(0 84.2% 60.2% / 0.15);
		color: hsl(0 84.2% 50%);
		border: 1px solid hsl(0 84.2% 60.2% / 0.3);
	}
	.priority-tag--high {
		background: hsl(38 92% 50% / 0.15);
		color: hsl(38 92% 40%);
		border: 1px solid hsl(38 92% 50% / 0.3);
	}
	.priority-tag--normal {
		background: hsl(var(--muted));
		color: hsl(var(--muted-foreground));
		border: 1px solid hsl(var(--border));
	}
</style>
