<script lang="ts">
	import { page } from '$app/stores';
</script>

<svelte:head>
	<title>{$page.status} Error — Texas Operational Portal</title>
</svelte:head>

<div class="error-page">
	<div class="error-page__card">
		{#if $page.status === 403}
			<div class="error-page__icon error-page__icon--forbidden" aria-hidden="true">
				<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
				</svg>
			</div>
			<h1 class="error-page__code">403</h1>
			<p class="error-page__title">Access Forbidden</p>
			<p class="error-page__desc">You don't have permission to access this page. Contact your administrator if you believe this is an error.</p>
		{:else if $page.status === 404}
			<div class="error-page__icon error-page__icon--not-found" aria-hidden="true">
				<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
					<line x1="8" y1="11" x2="14" y2="11"/>
				</svg>
			</div>
			<h1 class="error-page__code">404</h1>
			<p class="error-page__title">Page Not Found</p>
			<p class="error-page__desc">The page you're looking for doesn't exist or has been moved.</p>
		{:else}
			<div class="error-page__icon error-page__icon--error" aria-hidden="true">
				<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
				</svg>
			</div>
			<h1 class="error-page__code">{$page.status}</h1>
			<p class="error-page__title">Something Went Wrong</p>
			<p class="error-page__desc">{$page.error?.message ?? 'An unexpected error occurred.'}</p>
		{/if}
		<a href="/dashboard" class="error-page__btn">Go to Dashboard</a>
	</div>
</div>

<style>
	.error-page {
		min-height: 100dvh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		background: hsl(var(--background));
		font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
	}
	.error-page__card {
		max-width: 400px;
		width: 100%;
		background: hsl(var(--card));
		border: 1px solid hsl(var(--border));
		border-radius: 1rem;
		padding: 2.5rem 2rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}
	.error-page__icon { color: hsl(var(--muted-foreground)); }
	.error-page__icon--forbidden { color: hsl(var(--warning)); }
	.error-page__icon--not-found { color: hsl(var(--primary)); }
	.error-page__icon--error { color: hsl(var(--destructive)); }
	.error-page__code {
		font-size: 3rem;
		font-weight: 800;
		color: hsl(var(--foreground));
		margin: 0;
		line-height: 1;
	}
	.error-page__title { font-size: 1.125rem; font-weight: 600; color: hsl(var(--foreground)); margin: 0; }
	.error-page__desc { font-size: 0.875rem; color: hsl(var(--muted-foreground)); margin: 0; max-width: 300px; line-height: 1.5; }
	.error-page__btn {
		margin-top: 0.5rem;
		display: inline-block;
		padding: 0.5625rem 1.25rem;
		border-radius: 0.5rem;
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
		font-size: 0.875rem;
		font-weight: 600;
		text-decoration: none;
		transition: opacity 0.15s;
	}
	.error-page__btn:hover { opacity: 0.9; }
	.error-page__btn:focus-visible { outline: 2px solid hsl(var(--ring)); outline-offset: 2px; }
</style>
