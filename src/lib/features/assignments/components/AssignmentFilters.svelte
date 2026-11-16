<script lang="ts">
	import type { ModuleTab, ServiceFilterTab, QueueSortOption } from '../types/assignment-types';

	let {
		activeTab,
		onTabChange,
		activeService,
		onServiceChange,
		searchQuery = '',
		onSearchChange,
		sortOption,
		onSortChange,
		selectedCountry = '',
		onCountryChange,
		countries = [],
		showModuleTabs = false,
		showServiceTabs = false
	}: {
		activeTab?: ModuleTab;
		onTabChange?: (tab: ModuleTab) => void;
		activeService?: ServiceFilterTab;
		onServiceChange?: (service: ServiceFilterTab) => void;
		searchQuery?: string;
		onSearchChange?: (q: string) => void;
		sortOption?: QueueSortOption;
		onSortChange?: (sort: QueueSortOption) => void;
		selectedCountry?: string;
		onCountryChange?: (country: string) => void;
		countries?: string[];
		showModuleTabs?: boolean;
		showServiceTabs?: boolean;
	} = $props();

	let searchInput = $state(searchQuery);

	$effect(() => {
		searchInput = searchQuery;
	});

	function handleInput(e: Event) {
		const val = (e.target as HTMLInputElement).value;
		searchInput = val;
		if (onSearchChange) onSearchChange(val);
	}

	const moduleTabs: { id: ModuleTab; label: string }[] = [
		{ id: 'my', label: 'My Items' },
		{ id: 'team', label: 'Team Items' },
		{ id: 'all', label: 'All Items' }
	];

	const serviceTabs: { id: ServiceFilterTab; label: string }[] = [
		{ id: 'all', label: 'All Services' },
		{ id: 'visa', label: 'Visas' },
		{ id: 'vfs', label: 'VFS' },
		{ id: 'holiday', label: 'Holidays' }
	];
</script>

<div class="filters-container">
	{#if showModuleTabs}
		<div class="tabs-bar" role="tablist" aria-label="Module workload tabs">
			{#each moduleTabs as tab}
				<button
					type="button"
					role="tab"
					aria-selected={activeTab === tab.id}
					class="tab-btn"
					class:tab-btn--active={activeTab === tab.id}
					onclick={() => onTabChange?.(tab.id)}
				>
					{tab.label}
				</button>
			{/each}
		</div>
	{/if}

	{#if showServiceTabs}
		<div class="tabs-bar" role="tablist" aria-label="Service filter tabs">
			{#each serviceTabs as tab}
				<button
					type="button"
					role="tab"
					aria-selected={activeService === tab.id}
					class="tab-btn"
					class:tab-btn--active={activeService === tab.id}
					onclick={() => onServiceChange?.(tab.id)}
				>
					{tab.label}
				</button>
			{/each}
		</div>
	{/if}

	<div class="search-sort-bar">
		<div class="search-box">
			<svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
			</svg>
			<input
				type="search"
				class="search-input"
				placeholder="Search by ref no, customer, passport no, country…"
				value={searchInput}
				oninput={handleInput}
				aria-label="Search items"
			/>
		</div>

		{#if onCountryChange && countries && countries.length > 0}
			<select
				class="sort-select"
				value={selectedCountry || ''}
				onchange={(e) => onCountryChange?.((e.target as HTMLSelectElement).value)}
				aria-label="Filter by country"
			>
				<option value="">All Countries</option>
				{#each countries as c}
					<option value={c}>{c}</option>
				{/each}
			</select>
		{/if}

		{#if onSortChange}
			<select
				class="sort-select"
				value={sortOption || 'newest'}
				onchange={(e) => onSortChange((e.target as HTMLSelectElement).value as QueueSortOption)}
				aria-label="Sort queue items"
			>
				<option value="newest">Newest First</option>
				<option value="oldest">Oldest First</option>
			</select>
		{/if}
	</div>
</div>

<style>
	.filters-container {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}

	.tabs-bar {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		background: hsl(var(--muted) / 0.5);
		padding: 0.25rem;
		border-radius: 0.625rem;
		border: 1px solid hsl(var(--border));
		width: fit-content;
	}

	.tab-btn {
		padding: 0.4rem 0.85rem;
		border-radius: 0.5rem;
		font-size: 0.8125rem;
		font-weight: 600;
		color: hsl(var(--muted-foreground));
		background: transparent;
		border: none;
		cursor: pointer;
		transition: all 0.15s ease;
		font-family: inherit;
	}

	.tab-btn:hover {
		color: hsl(var(--foreground));
	}

	.tab-btn--active {
		background: #ffffff;
		color: hsl(var(--foreground));
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}

	.search-sort-bar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.search-box {
		position: relative;
		flex: 1;
		min-width: 240px;
	}

	.search-icon {
		position: absolute;
		left: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		color: hsl(var(--muted-foreground));
		pointer-events: none;
	}

	.search-input {
		width: 100%;
		padding: 0.5rem 0.75rem 0.5rem 2.25rem;
		border-radius: 0.5rem;
		border: 1px solid hsl(var(--border));
		background: #ffffff;
		font-size: 0.875rem;
		color: hsl(var(--foreground));
		outline: none;
		transition: border-color 0.15s;
		font-family: inherit;
	}

	.search-input:focus {
		border-color: hsl(var(--ring));
		box-shadow: 0 0 0 2px hsl(var(--ring) / 0.15);
	}

	.sort-select {
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		border: 1px solid hsl(var(--border));
		background: #ffffff;
		font-size: 0.8125rem;
		font-weight: 600;
		color: hsl(var(--foreground));
		outline: none;
		cursor: pointer;
		font-family: inherit;
	}
</style>
