<script lang="ts">
	import { page } from '$app/stores';
	import { authState, hasPermission } from '$lib/stores/auth';
	import { getPendingCount } from '$lib/features/assignments/stores/assignment-store.svelte';
	import { cn } from '$lib/utils';

	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import Inbox from '@lucide/svelte/icons/inbox';
	import FileText from '@lucide/svelte/icons/file-text';
	import Calendar from '@lucide/svelte/icons/calendar';
	import Map from '@lucide/svelte/icons/map';
	import User from '@lucide/svelte/icons/user';

	const pendingCount = $derived(getPendingCount());

	const isDashboardActive = $derived($page.url.pathname === '/dashboard');
	const isPendingActive = $derived($page.url.pathname.startsWith('/pending-applications'));
	const isVisasActive = $derived($page.url.pathname.startsWith('/visas'));
	const isVfsActive = $derived($page.url.pathname.startsWith('/vfs'));
	const isHolidaysActive = $derived($page.url.pathname.startsWith('/holidays'));
	const isProfileActive = $derived($page.url.pathname.startsWith('/profile'));
</script>

{#if $authState.isAuthenticated}
	<div
		class="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-md lg:hidden shadow-lg select-none"
		style="padding-bottom: env(safe-area-inset-bottom);"
	>
		<nav class="flex items-center justify-around h-16 w-full px-1" aria-label="Mobile Navigation">
			<!-- 1. Dashboard -->
			<a
				href="/dashboard"
				class={cn(
					'flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200 text-center touch-manipulation',
					isDashboardActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
				)}
				aria-label="Dashboard"
			>
				<LayoutDashboard class="h-5 w-5 shrink-0" />
				<span class="text-[10px] font-medium tracking-tight">Dashboard</span>
			</a>

			<!-- 2. Pending Applications -->
			<a
				href="/pending-applications"
				class={cn(
					'flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200 text-center touch-manipulation relative',
					isPendingActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
				)}
				aria-label="Pending Applications"
			>
				<div class="relative">
					<Inbox class="h-5 w-5 shrink-0" />
					{#if pendingCount > 0}
						<span
							class="absolute -top-1 -right-2 h-3.5 min-w-3.5 px-0.5 flex items-center justify-center rounded-full text-[8px] font-bold bg-amber-500 text-white"
						>
							{pendingCount}
						</span>
					{/if}
				</div>
				<span class="text-[10px] font-medium tracking-tight">Pending</span>
			</a>

			<!-- 3. Visas -->
			{#if hasPermission('visas')}
				<a
					href="/visas"
					class={cn(
						'flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200 text-center touch-manipulation',
						isVisasActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
					)}
					aria-label="Visas"
				>
					<FileText class="h-5 w-5 shrink-0" />
					<span class="text-[10px] font-medium tracking-tight">Visas</span>
				</a>
			{/if}

			<!-- 4. VFS -->
			{#if hasPermission('vfs')}
				<a
					href="/vfs"
					class={cn(
						'flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200 text-center touch-manipulation',
						isVfsActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
					)}
					aria-label="VFS"
				>
					<Calendar class="h-5 w-5 shrink-0" />
					<span class="text-[10px] font-medium tracking-tight">VFS</span>
				</a>
			{/if}

			<!-- 5. Holidays -->
			{#if hasPermission('holidays')}
				<a
					href="/holidays"
					class={cn(
						'flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200 text-center touch-manipulation',
						isHolidaysActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
					)}
					aria-label="Holidays"
				>
					<Map class="h-5 w-5 shrink-0" />
					<span class="text-[10px] font-medium tracking-tight">Holidays</span>
				</a>
			{/if}

			<!-- 6. Profile -->
			<a
				href="/profile"
				class={cn(
					'flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200 text-center touch-manipulation',
					isProfileActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
				)}
				aria-label="Profile"
			>
				<User class="h-5 w-5 shrink-0" />
				<span class="text-[10px] font-medium tracking-tight">Profile</span>
			</a>
		</nav>
	</div>
{/if}

