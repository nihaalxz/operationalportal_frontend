<script lang="ts">
	interface Props {
		currentPage: number;
		pageSize: number;
		totalItems: number;
		itemLabel?: string;
		pageSizeOptions?: number[];
		onPageChange: (page: number) => void;
		onPageSizeChange: (pageSize: number) => void;
	}

	let {
		currentPage = 1,
		pageSize = 15,
		totalItems = 0,
		itemLabel = 'application',
		pageSizeOptions = [10, 15, 25, 50, 100],
		onPageChange,
		onPageSizeChange
	}: Props = $props();

	let totalPages = $derived(Math.max(1, Math.ceil(totalItems / pageSize)));
	let showingStart = $derived(totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1);
	let showingEnd = $derived(Math.min(currentPage * pageSize, totalItems));
	let displayLabel = $derived(totalItems === 1 ? itemLabel : `${itemLabel}s`);

	function handlePrev() {
		if (currentPage > 1) {
			onPageChange(currentPage - 1);
		}
	}

	function handleNext() {
		if (currentPage < totalPages) {
			onPageChange(currentPage + 1);
		}
	}

	function handlePageSizeChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		const newSize = parseInt(target.value, 10);
		if (!isNaN(newSize)) {
			onPageSizeChange(newSize);
		}
	}
</script>

{#if totalItems > 0}
	<div class="pagination-footer" role="navigation" aria-label="Pagination Navigation">
		<div class="pagination-info">
			Showing <strong>{showingStart}</strong>–<strong>{showingEnd}</strong> of <strong>{totalItems}</strong> {displayLabel}
		</div>

		<div class="pagination-controls">
			<div class="rows-per-page">
				<label for="rows-select-{itemLabel}" class="rows-label">Rows per page:</label>
				<select
					id="rows-select-{itemLabel}"
					class="filter-input filter-input--select filter-input--small"
					value={pageSize}
					onchange={handlePageSizeChange}
					aria-label="Select number of rows per page"
				>
					{#each pageSizeOptions as opt}
						<option value={opt}>{opt}</option>
					{/each}
				</select>
			</div>

			<div class="page-buttons">
				<button
					class="btn btn--outline btn--sm pagination-btn"
					disabled={currentPage <= 1}
					onclick={handlePrev}
					aria-label="Previous Page"
				>
					&larr; Prev
				</button>

				<span class="page-indicator" aria-live="polite">
					Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
				</span>

				<button
					class="btn btn--outline btn--sm pagination-btn"
					disabled={currentPage >= totalPages}
					onclick={handleNext}
					aria-label="Next Page"
				>
					Next &rarr;
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.pagination-footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.875rem 0 0.25rem;
		margin-top: 0.5rem;
		border-top: 1px solid hsl(var(--border) / 0.4);
	}

	.pagination-info {
		font-size: 0.8125rem;
		color: hsl(var(--muted-foreground));
	}

	.pagination-info strong {
		color: hsl(var(--foreground));
		font-weight: 600;
	}

	.pagination-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1.25rem;
	}

	.rows-per-page {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.rows-label {
		font-size: 0.8125rem;
		color: hsl(var(--muted-foreground));
		white-space: nowrap;
	}

	.filter-input {
		background: hsl(var(--card));
		border: 1px solid hsl(var(--border));
		border-radius: 0.375rem;
		color: hsl(var(--foreground));
		font-size: 0.8125rem;
		font-family: inherit;
		outline: none;
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	.filter-input:focus {
		border-color: hsl(var(--primary));
		box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
	}

	.filter-input--select {
		padding: 0.3rem 0.625rem;
		cursor: pointer;
	}

	.page-buttons {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.page-indicator {
		font-size: 0.8125rem;
		color: hsl(var(--foreground));
		padding: 0 0.25rem;
		white-space: nowrap;
	}

	.page-indicator strong {
		font-weight: 600;
	}

	.pagination-btn {
		min-width: 4.25rem;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.35rem 0.75rem;
		border-radius: 0.375rem;
		font-size: 0.8125rem;
		font-weight: 600;
		border: 1px solid transparent;
		cursor: pointer;
		transition: all 0.15s;
		font-family: inherit;
	}

	.btn--outline {
		background: hsl(var(--card));
		border-color: hsl(var(--border));
		color: hsl(var(--foreground));
	}

	.btn--outline:hover:not(:disabled) {
		background: hsl(var(--muted));
		border-color: hsl(var(--primary) / 0.4);
	}

	.btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.btn:focus-visible {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}
</style>

