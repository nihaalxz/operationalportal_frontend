<script lang="ts">
	import { derived } from 'svelte/store';
	import { goto } from '$app/navigation';
	import { authState, isInitializing } from '$lib/stores/auth';
	import { onMount } from 'svelte';

	let { children } = $props();

	// If already authenticated, redirect to dashboard
	onMount(() => {
		const unsubscribe = authState.subscribe((state) => {
			if (!state.isInitializing && state.isAuthenticated) {
				goto('/dashboard', { replaceState: true });
			}
		});
		return unsubscribe;
	});
</script>

{@render children()}
