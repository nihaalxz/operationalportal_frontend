<script lang="ts">
	import { page } from '$app/stores';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb';

	const segmentLabels: Record<string, string> = {
		dashboard: 'Dashboard',
		'pending-applications': 'Pending Applications',
		'active-applications': 'Active Applications',
		'completed-applications': 'Completed Applications',
		visas: 'Visas',
		vfs: 'VFS Appointments',
		holidays: 'Holiday Packages',
		profile: 'Profile Settings'
	};

	const breadcrumbs = $derived(() => {
		const paths = $page.url.pathname.split('/').filter(Boolean);
		let accum = '';

		return paths.map((segment, idx) => {
			accum += `/${segment}`;
			// If it's a numeric ID or hash, show as #ID or reference
			const isId = /^\d+$/.test(segment);
			const label = isId ? `#${segment}` : segmentLabels[segment] || segment.replace(/-/g, ' ');
			return {
				label,
				route: accum,
				isLast: idx === paths.length - 1
			};
		});
	});

	const activeBreadcrumbs = $derived(breadcrumbs());
</script>

{#if activeBreadcrumbs.length > 0}
	<Breadcrumb.Root class="select-none">
		<Breadcrumb.List>
			<Breadcrumb.Item>
				<Breadcrumb.Link href="/dashboard">Home</Breadcrumb.Link>
			</Breadcrumb.Item>
			{#each activeBreadcrumbs as bc (bc.route)}
				<Breadcrumb.Separator />
				<Breadcrumb.Item>
					{#if bc.isLast}
						<Breadcrumb.Page class="capitalize font-semibold text-foreground">{bc.label}</Breadcrumb.Page>
					{:else}
						<Breadcrumb.Link href={bc.route} class="capitalize">{bc.label}</Breadcrumb.Link>
					{/if}
				</Breadcrumb.Item>
			{/each}
		</Breadcrumb.List>
	</Breadcrumb.Root>
{/if}

