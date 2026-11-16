<script lang="ts">
	export interface StepperStep {
		number: number;
		label: string;
		subtitle: string;
		isDone: boolean;
		isActive?: boolean;
		isRejected?: boolean;
	}

	let props = $props<{
		title?: string;
		status?: string;
		steps: StepperStep[];
	}>();

	const title = $derived(props.title || 'Application Lifecycle');
	const status = $derived(props.status || '');
	const steps = $derived(props.steps || []);
</script>

<div class="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-xs space-y-5 w-full">
	<!-- Header -->
	{#if title || status}
		<div class="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
			<h3 class="text-xs font-bold text-muted-foreground tracking-wider uppercase flex items-center gap-2">
				<svg class="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
				</svg>
				<span>{title}</span>
			</h3>
			{#if status}
				<span class="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20">
					Status: {status.toUpperCase()}
				</span>
			{/if}
		</div>
	{/if}

	<!-- Desktop / Tablet Timeline (Horizontal Flex Connectors) -->
	<div class="hidden sm:flex items-start w-full px-2 pt-2 pb-1">
		{#each steps as step, i}
			<div class="flex-1 flex flex-col items-start min-w-0 last:flex-none">
				<!-- Top Row: Circle + Connecting Line -->
				<div class="flex items-center w-full">
					<!-- Step Circle -->
					<div
						class="flex items-center justify-center w-8 h-8 rounded-full border-2 text-xs font-bold transition-all duration-300 shrink-0 bg-card z-10
						{step.isDone
							? step.isRejected
								? 'bg-destructive border-destructive text-white shadow-xs'
								: 'bg-primary border-primary text-primary-foreground shadow-xs'
							: step.isActive
								? 'bg-amber-500 border-amber-500 text-white animate-pulse ring-4 ring-amber-500/10'
								: 'bg-background border-muted-foreground/30 text-muted-foreground'}"
					>
						{#if step.isDone}
							{#if step.isRejected}&times;{:else}✓{/if}
						{:else}
							{step.number}
						{/if}
					</div>

					<!-- Segment Connector Line (to next circle) -->
					{#if i < steps.length - 1}
						<div
							class="flex-1 h-1 mx-1.5 rounded-full transition-all duration-500
							{steps[i + 1].isDone || (step.isDone && steps[i + 1].isActive)
								? 'bg-primary'
								: 'bg-muted'}"
						></div>
					{/if}
				</div>

				<!-- Step Label & Subtitle -->
				<div class="mt-2.5 space-y-0.5 text-left pr-2">
					<p class="text-xs font-bold text-foreground leading-tight">{step.label}</p>
					<p class="text-[10px] font-medium text-muted-foreground leading-tight">{step.subtitle}</p>
				</div>
			</div>
		{/each}
	</div>

	<!-- Mobile Timeline (Vertical Flex Connectors) -->
	<div class="block sm:hidden space-y-0 px-1 py-1">
		{#each steps as step, i}
			<div class="flex items-start gap-4 relative pb-6 last:pb-0">
				<!-- Vertical Connector Line to Next Step -->
				{#if i < steps.length - 1}
					<div
						class="absolute left-3.5 top-7 bottom-0 w-0.5 transition-colors duration-300 -ml-px
						{steps[i + 1].isDone || (step.isDone && steps[i + 1].isActive)
							? 'bg-primary'
							: 'bg-muted'}"
					></div>
				{/if}

				<!-- Circle Indicator -->
				<div
					class="flex items-center justify-center w-7 h-7 rounded-full border-2 text-xs font-bold transition-all duration-300 shrink-0 bg-card z-10
					{step.isDone
						? step.isRejected
							? 'bg-destructive border-destructive text-white shadow-xs'
							: 'bg-primary border-primary text-primary-foreground shadow-xs'
						: step.isActive
							? 'bg-amber-500 border-amber-500 text-white animate-pulse ring-4 ring-amber-500/10'
							: 'bg-background border-muted-foreground/30 text-muted-foreground'}"
				>
					{#if step.isDone}
						{#if step.isRejected}&times;{:else}✓{/if}
					{:else}
						{step.number}
					{/if}
				</div>

				<!-- Step Details -->
				<div class="pt-0.5 space-y-0.5 min-w-0 flex-1">
					<div class="flex items-center justify-between gap-2">
						<p class="text-xs font-bold text-foreground">{step.label}</p>
						<span
							class="text-[10px] font-semibold px-2 py-0.5 rounded-md border
							{step.isDone
								? step.isRejected
									? 'bg-destructive/10 text-destructive border-destructive/20'
									: 'bg-primary/10 text-primary border-primary/20'
								: step.isActive
									? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
									: 'bg-muted text-muted-foreground border-border'}"
						>
							{step.subtitle}
						</span>
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>
