<script lang="ts">
	import { goto, afterNavigate } from '$app/navigation';
	import { authState } from '$lib/stores/auth';
	import { onMount } from 'svelte';
	import Sidebar from '$lib/layout/Sidebar.svelte';
	import Header from '$lib/layout/Header.svelte';
	import MobileBottomNav from '$lib/layout/MobileBottomNav.svelte';
	import { refreshPendingCount } from '$lib/features/assignments/stores/assignment-store.svelte';

	let { children } = $props();

	let sidebarCollapsed = $state(false);

	afterNavigate(() => {
		const mainEl = document.getElementById('main-content');
		if (mainEl) {
			mainEl.scrollTop = 0;
		}
	});

	// Reactive route guard — redirect to login only after initialization is done
	onMount(() => {
		const unsubscribe = authState.subscribe((state) => {
			if (!state.isInitializing && !state.isAuthenticated) {
				goto('/login', { replaceState: true });
			}
		});
		return unsubscribe;
	});

	async function loadPendingBadge() {
		if (!$authState.isAuthenticated) return;
		try {
			await refreshPendingCount();
		} catch {
			// ignore initial error
		}
	}

	onMount(() => {
		const timer = setTimeout(() => {
			loadPendingBadge();
		}, 100);
		const interval = setInterval(loadPendingBadge, 30000);
		return () => {
			clearTimeout(timer);
			clearInterval(interval);
		};
	});
</script>

{#if $authState.isInitializing}
	<!-- Verifying stored session — spinner only for returning users -->
	<div
		class="min-h-[100dvh] flex items-center justify-center bg-background"
		aria-busy="true"
		aria-label="Loading application"
	>
		<div
			class="w-10 h-10 border-3 border-muted border-t-primary rounded-full animate-spin"
			aria-hidden="true"
		></div>
	</div>
{:else if $authState.isAuthenticated}
	<div
		class="min-h-[100dvh] h-[100dvh] bg-background text-foreground antialiased flex flex-row overflow-hidden"
	>
		<!-- Desktop Sidebar -->
		<div class="hidden lg:block h-[100dvh] sticky top-0">
			<Sidebar bind:collapsed={sidebarCollapsed} />
		</div>

		<!-- Main Workspace Area -->
		<div class="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden">
			<Header />
			<main
				id="main-content"
				class="flex-1 overflow-y-auto px-4 sm:px-6 pt-5 pb-24 lg:pb-6 bg-muted/10 outline-none"
				tabindex="-1"
			>
				{@render children()}
			</main>
		</div>
	</div>

	<!-- Mobile Bottom Navigation -->
	<MobileBottomNav />
{/if}
