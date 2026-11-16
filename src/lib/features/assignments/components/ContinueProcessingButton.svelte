<script lang="ts">
	let { detailUrl }: { detailUrl: string } = $props();
</script>

<a href={detailUrl} class="btn-continue-processing" onclick={(e) => e.stopPropagation()}>
	<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mr-1.5">
		<polyline points="9 18 15 12 9 6"/>
	</svg>
	<span>Continue Processing</span>
</a>

<style>
	.btn-continue-processing {
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
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}
	.btn-continue-processing:hover {
		opacity: 0.92;
		transform: translateY(-1px);
	}
	.mr-1\.5 { margin-right: 0.375rem; }
</style>
