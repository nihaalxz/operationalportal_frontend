<script lang="ts">
	import { onMount } from 'svelte';
	import { apiFetch } from '$lib/api/api-client';
	import { NetworkError, DownstreamUnavailableError, TimeoutError } from '$lib/api/problem-details';
	import type { DashboardSummaryResponse } from '$lib/types/api';
	import { hasPermission } from '$lib/stores/auth';
	import { refreshPendingCount, getPendingCounts } from '$lib/features/assignments/stores/assignment-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';

	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Inbox from '@lucide/svelte/icons/inbox';
	import Clock from '@lucide/svelte/icons/clock';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import FileText from '@lucide/svelte/icons/file-text';
	import Calendar from '@lucide/svelte/icons/calendar';
	import Map from '@lucide/svelte/icons/map';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';

	let data = $state<DashboardSummaryResponse | null>(null);
	let isLoading = $state(true);
	let isRefreshing = $state(false);
	let errorMessage = $state('');
	let lastUpdated = $state<string | null>(null);

	async function loadDashboard(showRefreshing = false) {
		if (showRefreshing) {
			isRefreshing = true;
		} else {
			isLoading = true;
		}
		errorMessage = '';
		try {
			const [dashboardData] = await Promise.all([
				apiFetch<DashboardSummaryResponse>('/api/dashboard/summary'),
				refreshPendingCount().catch(() => null)
			]);
			data = dashboardData;
			lastUpdated =
				new Intl.DateTimeFormat('en-US', {
					hour: '2-digit',
					minute: '2-digit',
					second: '2-digit',
					hour12: true,
					timeZone: 'Asia/Bahrain'
				}).format(new Date()) + ' AST';
		} catch (err) {
			if (err instanceof DownstreamUnavailableError || err instanceof TimeoutError) {
				errorMessage = 'The data service is temporarily unavailable. Operational figures may be incomplete.';
			} else if (err instanceof NetworkError) {
				errorMessage = 'Unable to connect. Please check your network connection.';
			} else {
				errorMessage = 'Failed to load dashboard data. Please retry.';
			}
		} finally {
			isLoading = false;
			isRefreshing = false;
		}
	}

	onMount(() => {
		loadDashboard();
		const interval = setInterval(() => {
			if (!isLoading && !isRefreshing) {
				loadDashboard(true);
			}
		}, 30000);
		return () => clearInterval(interval);
	});

	const pendingBreakdown = $derived(getPendingCounts());

	const unassignedVisasCount = $derived(
		pendingBreakdown.hasLoaded
			? pendingBreakdown.visas
			: Math.max(0, (data?.pendingVisasCount ?? 0) - (data?.underReviewVisasCount ?? 0))
	);

	const unassignedVfsCount = $derived(
		pendingBreakdown.hasLoaded
			? pendingBreakdown.vfs
			: Math.max(0, (data?.pendingVfsCount ?? 0) - (data?.processingVfsCount ?? 0))
	);

	const unassignedHolidaysCount = $derived(
		pendingBreakdown.hasLoaded
			? pendingBreakdown.holidays
			: Math.max(0, (data?.pendingHolidaysCount ?? 0) - (data?.processingHolidaysCount ?? 0))
	);

	const totalUnderReview = $derived(
		(data?.underReviewVisasCount ?? 0) +
		(data?.processingVfsCount ?? 0) +
		(data?.processingHolidaysCount ?? 0)
	);

	const heroPendingCount = $derived(
		pendingBreakdown.hasLoaded
			? pendingBreakdown.total
			: (data?.pendingUnassignedCount ?? (unassignedVisasCount + unassignedVfsCount + unassignedHolidaysCount))
	);

	const heroActiveWorkload = $derived(
		data?.myOperationsCount !== undefined && data?.myOperationsCount !== null
			? data.myOperationsCount
			: totalUnderReview
	);

	const completedToday = $derived(data?.completedTodayCount ?? 0);
</script>

<svelte:head>
	<title>Dashboard — Texas Operational Portal</title>
</svelte:head>

<div class="space-y-8 max-w-7xl mx-auto pb-12">
	<!-- Page Header matching Accounts Portal -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/60">
		<div class="space-y-1.5">
			<div class="flex items-center gap-2.5 flex-wrap">
				<h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Operations Command Center</h1>
				<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
					<span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
					Live Operations
				</span>
			</div>
			<p class="text-xs sm:text-sm text-muted-foreground">
				Real-time monitoring of application queues, operator claims, and fulfillment throughput.
			</p>
		</div>

		<div class="flex items-center gap-3 self-start sm:self-auto">
			{#if lastUpdated}
				<span class="text-xs text-muted-foreground hidden md:inline">Updated {lastUpdated}</span>
			{/if}
			<Button
				variant="outline"
				class="h-9.5 px-4 rounded-xl cursor-pointer flex items-center gap-2 text-xs font-semibold shadow-xs"
				onclick={() => loadDashboard(true)}
				disabled={isLoading || isRefreshing}
			>
				<RefreshCw class={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
				<span>{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
			</Button>
		</div>
	</div>

	{#if errorMessage && data}
		<div class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center justify-between gap-3 text-xs sm:text-sm text-amber-700 dark:text-amber-400" role="alert">
			<div class="flex items-center gap-2">
				<CircleAlert class="h-4 w-4 shrink-0" />
				<span>{errorMessage}</span>
			</div>
			<Button variant="ghost" size="sm" class="h-7 text-xs font-semibold text-amber-700 dark:text-amber-300" onclick={() => loadDashboard(true)}>
				Retry
			</Button>
		</div>
	{/if}

	{#if isLoading}
		<!-- Loading Skeletons -->
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
			{#each Array(3) as _}
				<div class="h-48 rounded-2xl bg-card border border-border p-6 animate-pulse flex flex-col justify-between">
					<div class="h-4 w-32 bg-muted rounded"></div>
					<div class="h-10 w-24 bg-muted rounded"></div>
					<div class="h-4 w-40 bg-muted rounded"></div>
				</div>
			{/each}
		</div>
		<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
			{#each Array(3) as _}
				<div class="h-72 rounded-2xl bg-card border border-border p-6 animate-pulse space-y-4">
					<div class="h-6 w-36 bg-muted rounded"></div>
					<div class="grid grid-cols-2 gap-4 h-44">
						<div class="bg-muted/50 rounded-xl"></div>
						<div class="bg-muted/50 rounded-xl"></div>
					</div>
				</div>
			{/each}
		</div>
	{:else if errorMessage && !data}
		<div class="rounded-xl border border-destructive/30 bg-destructive/10 p-8 text-center space-y-3" role="alert">
			<CircleAlert class="h-10 w-10 text-destructive mx-auto" />
			<h3 class="text-sm font-bold text-foreground">Operational Data Unavailable</h3>
			<p class="text-xs text-muted-foreground max-w-md mx-auto">{errorMessage}</p>
			<Button variant="default" class="mt-2" onclick={() => loadDashboard()}>
				Retry Load
			</Button>
		</div>
	{:else if data}
		<!-- Top 3 KPI Metrics Grid -->
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
			<!-- Pending Inbox Queue -->
			<a
				href="/pending-applications"
				class="bg-card border border-border hover:border-amber-500/50 rounded-2xl p-6 sm:p-7 shadow-xs transition-all hover:shadow-md flex flex-col justify-between group relative overflow-hidden min-h-[210px]"
			>
				<div class="flex items-center justify-between gap-2">
					<span class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pending Inbox</span>
					<div class="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl group-hover:scale-105 transition-transform">
						<Inbox class="h-5 w-5" />
					</div>
				</div>
				<div class="my-4">
					<div class="text-4xl font-extrabold font-mono tracking-tight text-foreground">{heroPendingCount}</div>
					<p class="text-sm text-muted-foreground mt-1.5">Unassigned applications in queue</p>
				</div>
				<div class="pt-4 border-t border-border/50 flex items-center justify-between text-xs sm:text-sm font-semibold text-amber-600 dark:text-amber-400">
					<span>Claim Applications</span>
					<ArrowRight class="h-4 w-4 group-hover:translate-x-1 transition-transform" />
				</div>
			</a>

			<!-- Active Workload -->
			<a
				href="/active-applications"
				class="bg-card border border-border hover:border-sky-500/50 rounded-2xl p-6 sm:p-7 shadow-xs transition-all hover:shadow-md flex flex-col justify-between group relative overflow-hidden min-h-[210px]"
			>
				<div class="flex items-center justify-between gap-2">
					<span class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Workload</span>
					<div class="p-2.5 bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-xl group-hover:scale-105 transition-transform">
						<Clock class="h-5 w-5" />
					</div>
				</div>
				<div class="my-4">
					<div class="text-4xl font-extrabold font-mono tracking-tight text-foreground">{heroActiveWorkload}</div>
					<p class="text-sm text-muted-foreground mt-1.5">Applications under review</p>
				</div>
				<div class="pt-4 border-t border-border/50 flex items-center justify-between text-xs sm:text-sm font-semibold text-sky-600 dark:text-sky-400">
					<span>My Active Tasks</span>
					<ArrowRight class="h-4 w-4 group-hover:translate-x-1 transition-transform" />
				</div>
			</a>

			<!-- Completed Today -->
			<a
				href="/completed-applications?filter=today"
				class="bg-card border border-border hover:border-emerald-500/50 rounded-2xl p-6 sm:p-7 shadow-xs transition-all hover:shadow-md flex flex-col justify-between group relative overflow-hidden min-h-[210px]"
			>
				<div class="flex items-center justify-between gap-2">
					<span class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Completed Today</span>
					<div class="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl group-hover:scale-105 transition-transform">
						<CircleCheck class="h-5 w-5" />
					</div>
				</div>
				<div class="my-4">
					<div class="text-4xl font-extrabold font-mono tracking-tight text-foreground">{completedToday}</div>
					<p class="text-sm text-muted-foreground mt-1.5">Operations finished today</p>
				</div>
				<div class="pt-4 border-t border-border/50 flex items-center justify-between text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400">
					<span>View Today's Log</span>
					<ArrowRight class="h-4 w-4 group-hover:translate-x-1 transition-transform" />
				</div>
			</a>
		</div>

		<!-- Service Modules Section Cards -->
		<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
			<!-- Visa Applications Section -->
			{#if hasPermission('visas')}
				<div class="bg-card border border-border rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between hover:border-sky-500/40 transition-all min-h-[260px]">
					<div class="p-5 border-b border-border/50 flex items-center justify-between gap-3">
						<div class="flex items-center gap-3">
							<div class="p-2.5 bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-xl">
								<FileText class="h-5 w-5" />
							</div>
							<div>
								<h2 class="text-base font-bold text-foreground">Visa Applications</h2>
								<p class="text-xs text-muted-foreground">Entry & Express Visa Services</p>
							</div>
						</div>
						<a
							href="/visas"
							class="text-xs sm:text-sm font-semibold text-sky-600 hover:text-sky-500 transition-colors flex items-center gap-1"
							aria-label="View all visa applications"
						>
							View All
							<ArrowRight class="h-3.5 w-3.5" />
						</a>
					</div>

					<div class="p-5 grid grid-cols-2 gap-4">
						<a
							href="/pending-applications?service=visa"
							class="bg-muted/40 hover:bg-amber-500/5 hover:border-amber-500/30 border border-border/70 rounded-xl p-4 sm:p-5 flex flex-col justify-between transition-all group cursor-pointer min-h-[140px]"
						>
							<div class="flex items-center justify-between">
								<span class="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20">
									Pending
								</span>
								<span class="font-mono text-3xl font-extrabold text-foreground group-hover:text-amber-600 transition-colors">
									{unassignedVisasCount}
								</span>
							</div>
							<div class="mt-4">
								<p class="text-sm font-semibold text-foreground">Awaiting Claim</p>
								<span class="text-xs text-muted-foreground group-hover:text-amber-600 transition-colors flex items-center gap-1 mt-1 font-medium">
									Claim queue &rarr;
								</span>
							</div>
						</a>

						<a
							href="/visas"
							class="bg-muted/40 hover:bg-sky-500/5 hover:border-sky-500/30 border border-border/70 rounded-xl p-4 sm:p-5 flex flex-col justify-between transition-all group cursor-pointer min-h-[140px]"
						>
							<div class="flex items-center justify-between">
								<span class="px-2.5 py-1 rounded-md text-xs font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/20">
									Workload
								</span>
								<span class="font-mono text-3xl font-extrabold text-foreground group-hover:text-sky-600 transition-colors">
									{data.underReviewVisasCount}
								</span>
							</div>
							<div class="mt-4">
								<p class="text-sm font-semibold text-foreground">My Active Tasks</p>
								<span class="text-xs text-muted-foreground group-hover:text-sky-600 transition-colors flex items-center gap-1 mt-1 font-medium">
									Manage tasks &rarr;
								</span>
							</div>
						</a>
					</div>
				</div>
			{/if}

			<!-- VFS Appointments Section -->
			{#if hasPermission('vfs')}
				<div class="bg-card border border-border rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between hover:border-amber-500/40 transition-all min-h-[260px]">
					<div class="p-5 border-b border-border/50 flex items-center justify-between gap-3">
						<div class="flex items-center gap-3">
							<div class="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
								<Calendar class="h-5 w-5" />
							</div>
							<div>
								<h2 class="text-base font-bold text-foreground">VFS Appointments</h2>
								<p class="text-xs text-muted-foreground">Biometrics & Slot Booking</p>
							</div>
						</div>
						<a
							href="/vfs"
							class="text-xs sm:text-sm font-semibold text-amber-600 hover:text-amber-500 transition-colors flex items-center gap-1"
							aria-label="View all VFS appointments"
						>
							View All
							<ArrowRight class="h-3.5 w-3.5" />
						</a>
					</div>

					<div class="p-5 grid grid-cols-2 gap-4">
						<a
							href="/pending-applications?service=vfs"
							class="bg-muted/40 hover:bg-amber-500/5 hover:border-amber-500/30 border border-border/70 rounded-xl p-4 sm:p-5 flex flex-col justify-between transition-all group cursor-pointer min-h-[140px]"
						>
							<div class="flex items-center justify-between">
								<span class="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20">
									Pending
								</span>
								<span class="font-mono text-3xl font-extrabold text-foreground group-hover:text-amber-600 transition-colors">
									{unassignedVfsCount}
								</span>
							</div>
							<div class="mt-4">
								<p class="text-sm font-semibold text-foreground">Awaiting Claim</p>
								<span class="text-xs text-muted-foreground group-hover:text-amber-600 transition-colors flex items-center gap-1 mt-1 font-medium">
									Claim queue &rarr;
								</span>
							</div>
						</a>

						<a
							href="/vfs"
							class="bg-muted/40 hover:bg-amber-500/5 hover:border-amber-500/30 border border-border/70 rounded-xl p-4 sm:p-5 flex flex-col justify-between transition-all group cursor-pointer min-h-[140px]"
						>
							<div class="flex items-center justify-between">
								<span class="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20">
									Workload
								</span>
								<span class="font-mono text-3xl font-extrabold text-foreground group-hover:text-amber-600 transition-colors">
									{data.processingVfsCount}
								</span>
							</div>
							<div class="mt-4">
								<p class="text-sm font-semibold text-foreground">My Active Tasks</p>
								<span class="text-xs text-muted-foreground group-hover:text-amber-600 transition-colors flex items-center gap-1 mt-1 font-medium">
									Manage tasks &rarr;
								</span>
							</div>
						</a>
					</div>
				</div>
			{/if}

			<!-- Holiday Packages Section -->
			{#if hasPermission('holidays')}
				<div class="bg-card border border-border rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between hover:border-emerald-500/40 transition-all min-h-[260px]">
					<div class="p-5 border-b border-border/50 flex items-center justify-between gap-3">
						<div class="flex items-center gap-3">
							<div class="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
								<Map class="h-5 w-5" />
							</div>
							<div>
								<h2 class="text-base font-bold text-foreground">Holiday Packages</h2>
								<p class="text-xs text-muted-foreground">Custom Tours & Itineraries</p>
							</div>
						</div>
						<a
							href="/holidays"
							class="text-xs sm:text-sm font-semibold text-emerald-600 hover:text-emerald-500 transition-colors flex items-center gap-1"
							aria-label="View all holiday packages"
						>
							View All
							<ArrowRight class="h-3.5 w-3.5" />
						</a>
					</div>

					<div class="p-5 grid grid-cols-2 gap-4">
						<a
							href="/pending-applications?service=holiday"
							class="bg-muted/40 hover:bg-emerald-500/5 hover:border-emerald-500/30 border border-border/70 rounded-xl p-4 sm:p-5 flex flex-col justify-between transition-all group cursor-pointer min-h-[140px]"
						>
							<div class="flex items-center justify-between">
								<span class="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
									Pending
								</span>
								<span class="font-mono text-3xl font-extrabold text-foreground group-hover:text-emerald-600 transition-colors">
									{unassignedHolidaysCount}
								</span>
							</div>
							<div class="mt-4">
								<p class="text-sm font-semibold text-foreground">Awaiting Claim</p>
								<span class="text-xs text-muted-foreground group-hover:text-emerald-600 transition-colors flex items-center gap-1 mt-1 font-medium">
									Claim queue &rarr;
								</span>
							</div>
						</a>

						<a
							href="/holidays"
							class="bg-muted/40 hover:bg-emerald-500/5 hover:border-emerald-500/30 border border-border/70 rounded-xl p-4 sm:p-5 flex flex-col justify-between transition-all group cursor-pointer min-h-[140px]"
						>
							<div class="flex items-center justify-between">
								<span class="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
									Workload
								</span>
								<span class="font-mono text-3xl font-extrabold text-foreground group-hover:text-emerald-600 transition-colors">
									{data.processingHolidaysCount}
								</span>
							</div>
							<div class="mt-4">
								<p class="text-sm font-semibold text-foreground">My Active Tasks</p>
								<span class="text-xs text-muted-foreground group-hover:text-emerald-600 transition-colors flex items-center gap-1 mt-1 font-medium">
									Manage tasks &rarr;
								</span>
							</div>
						</a>
					</div>
				</div>
			{/if}
		</div>

		{#if !hasPermission('visas') && !hasPermission('vfs') && !hasPermission('holidays')}
			<div class="rounded-xl border border-border bg-card p-10 text-center space-y-2">
				<ShieldCheck class="h-10 w-10 text-muted-foreground mx-auto" />
				<h3 class="text-sm font-bold text-foreground">No Accessible Modules</h3>
				<p class="text-xs text-muted-foreground">Your account does not currently have permissions assigned for any operational modules.</p>
			</div>
		{/if}
	{/if}
</div>
