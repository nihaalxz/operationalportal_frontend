<script lang="ts">
	import type { ServiceType } from '../types/assignment-types';

	let { type }: { type: ServiceType | string } = $props();

	const formattedType = $derived((type || '').toUpperCase());
</script>

<span class="service-badge service-badge--{formattedType.toLowerCase()}">
	{formattedType}
</span>

<style>
	.service-badge {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.2rem 0.55rem;
		border-radius: 9999px;
		display: inline-flex;
		align-items: center;
		line-height: 1;
		white-space: nowrap;
	}
	.service-badge--visa {
		background: hsl(215 89% 53% / 0.12);
		color: hsl(215 89% 50%);
		border: 1px solid hsl(215 89% 53% / 0.25);
	}
	.service-badge--vfs {
		background: hsl(270 70% 55% / 0.12);
		color: hsl(270 70% 50%);
		border: 1px solid hsl(270 70% 55% / 0.25);
	}
	.service-badge--holiday {
		background: hsl(160 84% 39% / 0.12);
		color: hsl(160 84% 35%);
		border: 1px solid hsl(160 84% 39% / 0.25);
	}
</style>
