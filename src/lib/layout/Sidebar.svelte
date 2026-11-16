<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { authState, hasPermission, logout } from '$lib/stores/auth';
	import { getPendingCount } from '$lib/features/assignments/stores/assignment-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { cn } from '$lib/utils';

	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import Inbox from '@lucide/svelte/icons/inbox';
	import FileText from '@lucide/svelte/icons/file-text';
	import Calendar from '@lucide/svelte/icons/calendar';
	import Map from '@lucide/svelte/icons/map';
	import LogOut from '@lucide/svelte/icons/log-out';

	let { collapsed = $bindable(false) } = $props();

	const pendingApplicationsCount = $derived(getPendingCount());

	const navItems = $derived(
		[
			{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, always: true },
			{
				href: '/pending-applications',
				label: 'Pending Applications',
				icon: Inbox,
				always: true,
				badge: pendingApplicationsCount
			},
			{ href: '/visas', label: 'Visas', icon: FileText, permission: 'visas' },
			{ href: '/vfs', label: 'VFS Appointments', icon: Calendar, permission: 'vfs' },
			{ href: '/holidays', label: 'Holiday Packages', icon: Map, permission: 'holidays' }
		].filter((item) => item.always || hasPermission(item.permission ?? ''))
	);

	function isActive(href: string): boolean {
		if (href === '/dashboard') {
			return $page.url.pathname === '/dashboard';
		}
		return $page.url.pathname === href || $page.url.pathname.startsWith(href + '/');
	}

	async function handleLogout() {
		await logout();
		goto('/login');
	}

	const userInitials = $derived(() => {
		const name = $authState.user?.name ?? '';
		return (
			name
				.split(' ')
				.map((w) => w[0])
				.slice(0, 2)
				.join('')
				.toUpperCase() || 'OP'
		);
	});
</script>

<aside
	class={cn(
		'flex flex-col h-full bg-slate-900 border-r border-slate-800 text-slate-200 shrink-0 transition-all duration-300 select-none relative z-50',
		collapsed ? 'w-16' : 'w-64'
	)}
>
	<!-- Brand / Logo Area -->
	<div class="flex items-center gap-3 px-4 h-16 border-b border-slate-800 bg-slate-900/90 overflow-hidden">
		{#if collapsed}
			<a
				href="/dashboard"
				class="w-9 h-9 bg-white flex items-center justify-center rounded-lg shadow-sm border border-slate-700 overflow-hidden p-1 hover:border-sky-400 transition-colors shrink-0 mx-auto"
				title="Texas Travels Operations"
			>
				<img
					src="https://admin.texastravelsbh.com/assets/images/texas-logo.png"
					class="w-full h-full object-contain"
					alt="Texas Travels"
				/>
			</a>
		{:else}
			<a href="/dashboard" class="flex items-center gap-2.5 outline-none group shrink-0">
				<div
					class="h-9 bg-white flex items-center justify-center rounded-lg shadow-sm border border-slate-700 overflow-hidden p-1 px-1.5 shrink-0"
				>
					<img
						src="https://admin.texastravelsbh.com/assets/images/texas-logo.png"
						class="h-7 w-auto object-contain"
						alt="Texas Travels"
					/>
				</div>
				<div class="flex flex-col transition-opacity duration-200">
					<span
						class="font-bold text-sm tracking-tight text-white whitespace-nowrap group-hover:text-sky-400 transition-colors"
					>
						Texas Travels
					</span>
					<span
						class="text-[9px] uppercase tracking-wider font-semibold text-sky-400 leading-none mt-0.5"
					>
						Operations
					</span>
				</div>
			</a>
		{/if}
	</div>

	<!-- Navigation Scroll Container -->
	<nav class="flex-1 overflow-y-auto px-2 py-4 space-y-1">
		{#each navItems as item (item.href)}
			{#if collapsed}
				<Tooltip.Root>
					<Tooltip.Trigger class="w-full">
						<a
							href={item.href}
							class={cn(
								'w-full flex items-center justify-center h-10 rounded-lg transition-colors text-slate-400 hover:text-white hover:bg-slate-800/80 relative',
								isActive(item.href) && 'bg-sky-500/20 text-sky-400 font-semibold shadow-xs'
							)}
							aria-label={item.label}
						>
							<item.icon class="h-4.5 w-4.5 shrink-0" />
							{#if item.badge && item.badge > 0}
								<span
									class="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-white ring-2 ring-slate-900"
								></span>
							{/if}
						</a>
					</Tooltip.Trigger>
					<Tooltip.Content side="right" class="flex items-center gap-2">
						<span>{item.label}</span>
						{#if item.badge && item.badge > 0}
							<span
								class="min-w-5 h-5 px-1.5 flex items-center justify-center text-[10px] font-bold bg-white text-slate-900 rounded-full shadow-xs"
							>
								{item.badge}
							</span>
						{/if}
					</Tooltip.Content>
				</Tooltip.Root>
			{:else}
				<a
					href={item.href}
					class={cn(
						'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors',
						isActive(item.href)
							? 'bg-sky-500/15 text-sky-400 font-semibold border-l-2 border-sky-400'
							: 'text-slate-400 hover:text-white hover:bg-slate-800/60'
					)}
				>
					<item.icon class="h-4 w-4 shrink-0" />
					<span class="flex-1 truncate">{item.label}</span>
					{#if item.badge && item.badge > 0}
						<span
							class="min-w-5 h-5 px-1.5 flex items-center justify-center text-[10px] font-bold bg-white text-slate-900 rounded-full shadow-xs"
						>
							{item.badge}
						</span>
					{/if}
				</a>
			{/if}
		{/each}
	</nav>

	<!-- User / Session Footer -->
	<div class="p-3 border-t border-slate-800 bg-slate-950/40">
		{#if collapsed}
			<Tooltip.Root>
				<Tooltip.Trigger class="w-full">
					<button
						onclick={handleLogout}
						class="w-full h-10 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center cursor-pointer transition-colors"
						aria-label="Sign Out"
					>
						<LogOut class="h-4 w-4" />
					</button>
				</Tooltip.Trigger>
				<Tooltip.Content side="right">Sign Out</Tooltip.Content>
			</Tooltip.Root>
		{:else}
			<div class="flex items-center justify-between gap-2">
				<a
					href="/profile"
					class="flex items-center gap-2 overflow-hidden hover:opacity-90 transition-opacity outline-none"
				>
					{#if $authState.user?.avatarUrl}
						<img
							src={$authState.user.avatarUrl}
							class="h-8 w-8 rounded-full object-cover shrink-0 border border-sky-500/30"
							alt="Profile Avatar"
						/>
					{:else}
						<div
							class="h-8 w-8 rounded-full bg-sky-500/20 text-sky-300 flex items-center justify-center font-bold text-xs shrink-0 border border-sky-500/30"
						>
							{userInitials()}
						</div>
					{/if}
					<div class="flex flex-col overflow-hidden text-left">
						<span class="text-xs font-semibold text-slate-100 truncate">
							{$authState.user?.name ?? 'User'}
						</span>
						<span class="text-[10px] text-slate-400 truncate capitalize">
							{($authState.user?.userType || '').replace(/_/g, ' ')}
						</span>
					</div>
				</a>
				<Button
					onclick={handleLogout}
					variant="ghost"
					size="icon"
					class="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer shrink-0"
					title="Sign out"
				>
					<LogOut class="h-4 w-4" />
				</Button>
			</div>
		{/if}
	</div>
</aside>

