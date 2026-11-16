<script lang="ts">
	import '../lib/theme/tokens.css';
	import { onMount } from 'svelte';
	import { getAccessToken, apiFetch } from '$lib/api/api-client';
	import { setSession, clearSession } from '$lib/stores/auth';
	import { initBahrainTimezoneDefaults } from '$lib/timezone-defaults';
	import type { LoginResponse } from '$lib/types/auth';

	let { children } = $props();

	onMount(() => {
		initBahrainTimezoneDefaults();

		// Hydrate theme from localStorage or system preference
		if (typeof window !== 'undefined') {
			const savedTheme = localStorage.getItem('theme');
			if (
				savedTheme === 'dark' ||
				(!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
			) {
				document.documentElement.classList.add('dark');
			} else {
				document.documentElement.classList.remove('dark');
			}
		}

		// Prevent mouse wheel scrolling from inadvertently changing number input values
		const handleWheel = (e: WheelEvent) => {
			const active = document.activeElement;
			if (active instanceof HTMLInputElement && active.type === 'number') {
				active.blur();
			}
			if (e.target instanceof HTMLInputElement && e.target.type === 'number') {
				e.target.blur();
			}
		};

		window.addEventListener('wheel', handleWheel, { passive: true });

		// Hydrate user session
		const token = getAccessToken();
		if (token) {
			apiFetch<LoginResponse>('/api/auth/me', { token })
				.then((me) => {
					setSession({
						id: (me as any).id ?? 0,
						name: me.name,
						email: me.email,
						userType: me.userType,
						permissions: me.permissions,
						avatarUrl: me.avatarUrl
					});
				})
				.catch(() => {
					clearSession();
				});
		}

		return () => {
			window.removeEventListener('wheel', handleWheel);
		};
	});
</script>

<svelte:head>
	<title>Texas Operational Portal</title>
</svelte:head>

{@render children()}
