<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { apiFetch } from '$lib/api/api-client';
	import { NotFoundError, NetworkError, DownstreamUnavailableError, TimeoutError } from '$lib/api/problem-details';
	import { formatDateTime, formatAmount, downloadFile } from '$lib/utils';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import LifecycleStepper, { type StepperStep } from '$lib/components/LifecycleStepper.svelte';
	import type { HolidayPackageDetailResponse } from '$lib/types/api';
	import { getFileUrl } from '$lib/utils/status';
	import { printInvoice } from '$lib/utils/print-invoice';




	let data = $state<HolidayPackageDetailResponse | null>(null);
	let isLoading = $state(true);
	let errorMessage = $state('');
	let isNotFound = $state(false);
	const holidayId = $derived($page.params.id);
	const salesReturnAmt = $derived((data as any)?.salesReturnAmount || 0);
	const netSelling = $derived(Math.max(0, (data?.payableAmount || 0) - salesReturnAmt));

	// Modals State
	let showProcessModal = $state(false);
	let showEditRefModal = $state(false);
	let showUploadDocsModal = $state(false);
	let showCompleteConfirmModal = $state(false);
	let showCancelConfirmModal = $state(false);

	// Form values
	let holidayAppId = $state('');
	let suppliers = $state<Array<{ id: number; name: string; code?: string; categories?: string[] }>>([]);
	const allSuppliers = $derived(
		[...suppliers].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
	);

	function getSupplierDisplayName(supId?: number) {
		if (!supId) return '';
		const match = suppliers.find((s) => s.id === supId);
		if (!match) return `Supplier #${supId}`;
		const catStr = match.categories && match.categories.length > 0 ? ` [${match.categories.join(', ')}]` : '';
		return `${match.name}${catStr}`;
	}

	let govtFees = $state<Array<{ supplier_id?: number; amount: number; transaction_no: string; govt_fee_description: string; payment_proof?: File; existing_payment_proof?: string }>>([
		{ supplier_id: undefined, amount: 0, transaction_no: '', govt_fee_description: '' }
	]);

	let uploadDocuments = $state<Array<{ serviceName: string; file?: File }>>([
		{ serviceName: '' }
	]);

	let isSubmitting = $state(false);
	let actionError = $state('');

	async function load() {
		isLoading = true; errorMessage = ''; isNotFound = false;
		try {
			data = await apiFetch<HolidayPackageDetailResponse>(`/api/holiday-packages/${holidayId}`);
			if (data) {
				holidayAppId = data.holidayAppId ?? '';
			}
		} catch (err) {
			if (err instanceof NotFoundError) isNotFound = true;
			else if (err instanceof DownstreamUnavailableError || err instanceof TimeoutError) errorMessage = 'The booking service is temporarily unavailable. Please retry in a moment.';
			else if (err instanceof NetworkError) errorMessage = 'Unable to load holiday details. Please check your connection.';
			else errorMessage = 'Failed to load holiday package details. Please retry.';
		} finally { isLoading = false; }
	}
	import { ACCOUNTS_PORTAL_API_URL } from '$lib/config';

	async function loadSuppliers() {
		try {
			const directRes = await apiFetch<Array<{ id: number; name: string; code?: string; categories?: string[] }>>('/api/Supplier', {
				baseUrl: ACCOUNTS_PORTAL_API_URL,
				token: ''
			});
			if (directRes && directRes.length > 0) {
				suppliers = directRes;
				return;
			}
		} catch { }

		try {
			const res = await apiFetch<Array<{ id: number; name: string; code?: string; categories?: string[] }>>('/api/suppliers');
			if (res && res.length > 0) {
				suppliers = res;
			}
		} catch (e) {
			console.error('Failed to load suppliers', e);
		}
	}

	onMount(() => {
		load();
		loadSuppliers();
	});

	function addPaymentRow() {
		govtFees = [...govtFees, { supplier_id: data?.supplierId ?? undefined, amount: 0, transaction_no: '', govt_fee_description: '' }];
	}

	function removePaymentRow(index: number) {
		govtFees = govtFees.filter((_, idx) => idx !== index);
	}

	function addDocRow() {
		uploadDocuments = [...uploadDocuments, { serviceName: '' }];
	}

	function removeDocRow(index: number) {
		if (index > 0) {
			uploadDocuments = uploadDocuments.filter((_, idx) => idx !== index);
		}
	}

	// API submissions
	async function submitProcess() {
		isSubmitting = true;
		actionError = '';
		try {
			const formData = new FormData();

			govtFees.forEach((fee, index) => {
				formData.append(`govt_fees[${index}][amount]`, fee.amount.toString());
				if (fee.supplier_id) {
					formData.append(`govt_fees[${index}][supplier_id]`, fee.supplier_id.toString());
					const found = suppliers.find((s) => s.id === fee.supplier_id);
					if (found?.name) {
						formData.append(`govt_fees[${index}][supplier_name]`, found.name);
					}
				}
				formData.append(`govt_fees[${index}][transaction_no]`, fee.transaction_no);
				formData.append(`govt_fees[${index}][govt_fee_description]`, fee.govt_fee_description);
				if (fee.payment_proof) {
					formData.append(`govt_fees[${index}][payment_proof]`, fee.payment_proof);
				}
				if (fee.existing_payment_proof) {
					formData.append(`govt_fees[${index}][existing_payment_proof]`, fee.existing_payment_proof);
				}
			});

			await apiFetch(`/api/holiday-packages/${holidayId}/process`, {
				method: 'POST',
				body: formData
			});

			showProcessModal = false;
			await load();
		} catch (err: any) {
			actionError = err.message || 'Failed to start processing.';
		} finally {
			isSubmitting = false;
		}
	}

	async function submitEditRef() {
		if (!holidayAppId) {
			actionError = 'Supplier Reference ID is required.';
			return;
		}

		isSubmitting = true;
		actionError = '';
		try {
			await apiFetch(`/api/holiday-packages/${holidayId}/update-holiday-id`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ holiday_app_id: holidayAppId })
			});

			showEditRefModal = false;
			await load();
		} catch (err: any) {
			actionError = err.message || 'Failed to update supplier reference.';
		} finally {
			isSubmitting = false;
		}
	}

	async function submitStatus(status: 'completed' | 'cancelled') {
		isSubmitting = true;
		actionError = '';
		try {
			await apiFetch(`/api/holiday-packages/${holidayId}/status`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status })
			});

			showCompleteConfirmModal = false;
			showCancelConfirmModal = false;
			await load();
		} catch (err: any) {
			actionError = err.message || `Failed to update status to ${status}.`;
		} finally {
			isSubmitting = false;
		}
	}

	async function submitDocuments() {
		const validDocs = uploadDocuments.filter(d => d.serviceName && d.file);
		if (validDocs.length === 0) {
			actionError = 'At least one document and type is required.';
			return;
		}

		isSubmitting = true;
		actionError = '';
		try {
			const formData = new FormData();
			validDocs.forEach((doc, index) => {
				formData.append(`documents[${index}][serviceName]`, doc.serviceName);
				if (doc.file) {
					formData.append(`documents[${index}][file]`, doc.file);
				}
			});

			await apiFetch(`/api/holiday-packages/${holidayId}/documents`, {
				method: 'POST',
				body: formData
			});

			showUploadDocsModal = false;
			await load();
		} catch (err: any) {
			actionError = err.message || 'Failed to upload travel documents.';
		} finally {
			isSubmitting = false;
		}
	}

	const isStep1Done = $derived(data ? ['success', 'paid', 'verified'].includes(data.paymentStatus.toLowerCase()) : false);
	const isStep2Done = $derived(data ? ['under review', 'processing', 'completed', 'cancelled'].includes(data.processingStatus.toLowerCase()) : false);
	const isStep2Active = $derived(data ? (isStep1Done && data.processingStatus.toLowerCase() === 'pending') : false);
	const isStep3Done = $derived(data ? ['completed', 'cancelled'].includes(data.processingStatus.toLowerCase()) : false);
	const isStep3Active = $derived(data ? ['under review', 'processing'].includes(data.processingStatus.toLowerCase()) : false);
	const isStep4Done = $derived(data ? ['completed', 'cancelled'].includes(data.processingStatus.toLowerCase()) : false);
	const isCancelled = $derived(data ? data.processingStatus.toLowerCase() === 'cancelled' : false);

	const holidaySteps = $derived<StepperStep[]>([
		{
			number: 1,
			label: 'Payment Proof',
			subtitle: isStep1Done ? 'Verified' : 'Pending',
			isDone: isStep1Done
		},
		{
			number: 2,
			label: 'Start Booking',
			subtitle: isStep2Done ? 'Supplier ID' : isStep2Active ? 'Awaiting Action' : 'Locked',
			isDone: isStep2Done,
			isActive: isStep2Active
		},
		{
			number: 3,
			label: 'Document Upload',
			subtitle: isStep3Done ? 'Reviewed' : isStep3Active ? 'Active' : 'Waiting',
			isDone: isStep3Done,
			isActive: isStep3Active
		},
		{
			number: 4,
			label: 'Finalized',
			subtitle: isStep4Done ? (isCancelled ? 'Cancelled' : 'Completed') : 'Awaiting Documents',
			isDone: isStep4Done,
			isRejected: isCancelled
		}
	]);
	function formatPaymentMethod(val?: string | null) {
		if (!val || val.trim() === '' || val === '—' || val === '-') return 'not filled by staff';
		return val.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
	}

	const totalGovtFeesAmount = $derived(
		data?.govtFees && data.govtFees.length > 0
			? data.govtFees.reduce((acc: number, f: any) => acc + (f.amount || 0), 0)
			: 0
	);

	async function triggerProcessModal() {
		actionError = '';
		if (data) {
			try {
				await apiFetch('/api/assignments/claim', {
					method: 'POST',
					body: JSON.stringify({
						entityType: 'Holiday',
						entityId: data.id,
						entityDocumentNumber: data.documentNumber
					})
				});
			} catch (e) {
				// Ignore if already claimed by user
			}
			if (data.govtFees && data.govtFees.length > 0) {
				govtFees = data.govtFees.map((f: any) => ({
					supplier_id: f.supplierId || f.supplier_id || undefined,
					amount: f.amount || 0,
					transaction_no: f.paymentReference || f.transaction_no || '',
					govt_fee_description: f.description || '',
					existing_payment_proof: f.paymentProof || ''
				}));
			} else {
				govtFees = [{ supplier_id: undefined, amount: 0, transaction_no: '', govt_fee_description: '' }];
			}
		}
		showProcessModal = true;
	}

	function getFeeBadgeClass(status?: string | null): string {
		const s = (status || 'recorded').toLowerCase();
		if (s === 'success' || s === 'approved' || s === 'verified' || s === 'posted') {
			return 'bg-success/15 text-success border-success/30';
		}
		if (s === 'rejected' || s === 'failed') {
			return 'bg-destructive/15 text-destructive border-destructive/30';
		}
		return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
	}

	function getFeeStatusLabel(status?: string | null): string {
		const s = (status || 'recorded').toLowerCase();
		if (s === 'success' || s === 'approved' || s === 'verified' || s === 'posted') return 'APPROVED';
		if (s === 'rejected' || s === 'failed') return 'REJECTED';
		if (s === 'recorded' || s === 'pending') return 'WAITING FOR APPROVAL';
		return s.toUpperCase();
	}
</script>

<svelte:head>
	<title>Holiday {data?.documentNumber || holidayId} — Texas Operational Portal</title>
</svelte:head>
<div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
	<!-- Breadcrumbs -->
	<nav class="flex items-center space-x-2 text-xs text-muted-foreground">
		<a href="/holidays" class="hover:text-primary transition-colors flex items-center gap-1 font-medium">
			<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
			Holiday Packages
		</a>
		<span class="text-muted-foreground/50">/</span>
		<span class="font-semibold text-foreground">{data?.documentNumber || `TXSHOL${String(holidayId).padStart(6, '0')}`}</span>
	</nav>

	{#if isLoading}
		<!-- Skeleton Loader -->
		<div class="space-y-6" aria-busy="true" aria-label="Loading holiday details">
			<div class="flex justify-between items-start">
				<div class="space-y-2 w-1/3">
					<div class="h-8 bg-muted rounded animate-pulse w-full"></div>
					<div class="h-4 bg-muted rounded animate-pulse w-2/3"></div>
				</div>
				<div class="h-6 bg-muted rounded-full animate-pulse w-24"></div>
			</div>
			<div class="h-28 bg-muted rounded-xl animate-pulse"></div>
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<div class="h-64 bg-muted rounded-xl animate-pulse lg:col-span-2"></div>
				<div class="h-64 bg-muted rounded-xl animate-pulse"></div>
			</div>
		</div>
	{:else if isNotFound}
		<!-- Not Found Card -->
		<div class="flex flex-col items-center justify-center text-center p-12 bg-card border border-border rounded-xl shadow-xs space-y-4" role="alert">
			<div class="p-3 bg-destructive/10 rounded-full text-destructive">
				<svg class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
			</div>
			<h2 class="text-xl font-bold text-foreground">Holiday Package Not Found</h2>
			<p class="text-sm text-muted-foreground max-w-sm">Holiday package #{holidayId} could not be found. It may have been removed or the ID is incorrect.</p>
			<a href="/holidays" class="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-primary-foreground bg-primary rounded-lg hover:opacity-90 transition-opacity">Back to Holidays List</a>
		</div>
	{:else if errorMessage}
		<!-- Error Alert -->
		<div class="flex flex-col items-center justify-center text-center p-12 bg-card border border-border rounded-xl shadow-xs space-y-4" role="alert">
			<div class="p-3 bg-destructive/10 rounded-full text-destructive">
				<svg class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
			</div>
			<p class="text-sm text-muted-foreground max-w-md">{errorMessage}</p>
			<button class="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-primary-foreground bg-primary rounded-lg hover:opacity-90 transition-opacity" onclick={load}>Retry Loading</button>
		</div>
	{:else if data}
		<!-- Detail Header -->
		<div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-5 border-b border-border">
			<div class="space-y-1.5">
				<div class="flex items-center gap-3">
					<h1 class="text-2xl font-bold tracking-tight text-foreground">Holiday Package</h1>
					<span class="font-mono text-base font-bold text-muted-foreground/80 bg-muted/50 px-2.5 py-0.5 rounded-md border border-border">{data.documentNumber}</span>
				</div>
				<p class="text-xs font-medium text-muted-foreground flex items-center gap-2">
					<span class="text-foreground font-semibold">{data.passengerName}</span>
					<span class="text-muted-foreground/40">&middot;</span>
					<span class="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border uppercase font-bold tracking-wider">{data.country} &middot; {data.days} Days</span>
				</p>
			</div>
			<div class="flex flex-wrap items-center gap-2.5">
				<StatusBadge status={data.processingStatus} />
				<StatusBadge status={data.paymentStatus} type="payment" />
			</div>
		</div>

		{#if !isStep1Done}
			<!-- Payment Pending Locked State Banner -->
			<div class="flex flex-col items-center justify-center text-center p-12 bg-card border border-border rounded-xl shadow-xs space-y-4 my-6" role="alert">
				<div class="p-4 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full border border-amber-500/20">
					<svg class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
						<path d="M7 11V7a5 5 0 0 1 10 0v4"/>
					</svg>
				</div>
				<div class="space-y-2 max-w-md">
					<h2 class="text-lg font-bold text-foreground">Package Details &amp; Actions Locked</h2>
					<p class="text-xs text-muted-foreground leading-relaxed">
						All information, vouchers, and operational controls for this holiday package are locked. Details will be unlocked once the payment status is verified and updated to <span class="font-semibold text-success">Success</span> by the Accounts Department.
					</p>
				</div>
				<div class="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs">
					<div class="px-3 py-1.5 bg-muted/60 border border-border rounded-lg flex items-center gap-2">
						<span class="text-muted-foreground font-medium">Payment Status:</span>
						<StatusBadge status={data.paymentStatus} type="payment" />
					</div>
					<div class="px-3 py-1.5 bg-muted/60 border border-border rounded-lg flex items-center gap-2 font-mono">
						<span class="text-muted-foreground font-medium font-sans">Payable:</span>
						<span class="font-bold text-foreground">{formatAmount(data.payableAmount)}</span>
					</div>
				</div>
			</div>
		{:else}
			<!-- STATE-BASED PROCESS STEPPER -->
			<LifecycleStepper title="Holiday Booking Progress" status={data.processingStatus} steps={holidaySteps} />

			<!-- WORKFLOW OPERATIONS CONTROL BANNER -->
			<div class="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-xs">
				{#if data.processingStatus.toLowerCase() === 'pending'}
					<!-- Start Processing banner -->
					<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-primary/5 border border-primary/15 rounded-xl">
						<div class="space-y-1">
							<p class="text-sm font-semibold text-primary">Payment Cleared &amp; Verified</p>
							<p class="text-xs text-muted-foreground leading-relaxed">Ready for booking. Click to assign the Supplier reference ID and begin travel package booking.</p>
						</div>
						<button class="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-primary-foreground bg-primary hover:opacity-90 rounded-lg transition-all shadow-xs shrink-0 cursor-pointer" onclick={triggerProcessModal}>
							Start Processing
						</button>
					</div>
				{:else if ['under review', 'processing'].includes(data.processingStatus.toLowerCase())}
					<!-- Active Operations Panel -->
					<div class="space-y-4">
						<div class="flex justify-between items-center border-b border-border pb-3">
							<h3 class="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
								<span class="w-2 h-2 rounded-full bg-processing animate-pulse"></span>
								Operations Control Center
							</h3>
						</div>
						
						<div class="flex flex-wrap items-center gap-3">
							<button class="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-success hover:opacity-95 rounded-lg transition-all shadow-xs cursor-pointer" onclick={() => { actionError = ''; showCompleteConfirmModal = true; }}>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
								Mark Completed
							</button>
							<button class="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-destructive hover:opacity-95 rounded-lg transition-all shadow-xs cursor-pointer" onclick={() => { actionError = ''; showCancelConfirmModal = true; }}>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
								Cancel Package
							</button>
							<button class="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-foreground bg-secondary hover:bg-muted border border-border rounded-lg transition-all cursor-pointer" onclick={() => { actionError = ''; uploadDocuments = [{ serviceName: '' }]; showUploadDocsModal = true; }}>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
								Upload Documents
							</button>
							<button class="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-foreground bg-secondary hover:bg-muted border border-border rounded-lg transition-all cursor-pointer" onclick={() => { actionError = ''; triggerProcessModal(); }}>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
								Manage Payments
							</button>
						</div>
					</div>
				{:else}
					<!-- Completed Success message -->
					<div class="flex items-center gap-3 p-4 bg-success/5 border border-success/15 rounded-xl text-success" role="alert">
						<svg class="w-5 h-5 text-success shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
						<span class="text-xs font-semibold">Holiday package has been finalized: {data.processingStatus.toUpperCase()}</span>
					</div>
				{/if}
			</div>

			<!-- THREE COLUMNS GRID -->
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<!-- Left Column: Primary Details & Documents -->
				<div class="lg:col-span-2 space-y-6">
					<!-- Section: Package Details -->
					<div class="bg-card border border-border rounded-xl p-6 shadow-xs space-y-5">
						<h3 class="text-xs font-bold text-foreground border-b border-border pb-3 uppercase tracking-wider flex items-center gap-2">
							<svg class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
							Package Booking &amp; Customer Details
						</h3>
						
						<dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
							<div class="space-y-1">
								<dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Passenger Name</dt>
								<dd class="text-sm font-semibold text-foreground">{data.prefix} {data.passengerName}</dd>
							</div>
							<div class="space-y-1">
								<dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Destination</dt>
								<dd class="text-sm font-semibold text-foreground">{data.country}</dd>
							</div>
							<div class="space-y-1">
								<dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Duration</dt>
								<dd class="text-sm font-semibold text-foreground">{data.days} Days</dd>
							</div>
							<div class="space-y-1">
								<dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client Type</dt>
								<dd class="text-sm font-semibold text-foreground capitalize">{data.clientType ?? '—'}</dd>
							</div>
							<div class="space-y-1">
								<dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer Head</dt>
								<dd class="text-sm font-semibold text-foreground">{data.headName ?? '—'}</dd>
							</div>
							{#if data.supplierName && data.supplierName.toLowerCase() !== 'walk-in / direct' && data.supplier?.toLowerCase() !== 'walk-in / direct'}
								<div class="space-y-1 col-span-1 sm:col-span-2">
									<dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Primary Package Supplier</dt>
									<dd class="text-sm font-semibold text-foreground">{data.supplierName} {data.supplier ? `(${data.supplier})` : ''}</dd>
								</div>
							{/if}
							{#if data.agent}
								<div class="space-y-1 col-span-1 sm:col-span-2 pt-2 border-t border-border/40">
									<dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assigned Agent</dt>
									<dd class="text-sm font-semibold text-foreground">{data.agent}</dd>
								</div>
							{/if}
						</dl>
					</div>

					<!-- Section: Documents & Travel Vouchers -->
					{#if data.documents && data.documents.length > 0}
						<div class="bg-card border border-border rounded-xl p-6 shadow-xs space-y-5">
							<h3 class="text-xs font-bold text-foreground border-b border-border pb-3 uppercase tracking-wider flex items-center gap-2">
								<svg class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
								Documents
							</h3>
							
							<div class="space-y-3.5 text-xs">
								{#each data.documents as doc}
									<div class="flex items-center justify-between p-3.5 bg-muted/30 hover:bg-muted/50 rounded-xl border border-border transition-all">
										<div class="flex items-center gap-3 min-w-0">
											<div class="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
												<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 01-2-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
											</div>
											<div class="min-w-0">
												<p class="text-xs font-semibold text-foreground truncate">{doc.documentType}</p>
												<p class="text-[10px] text-muted-foreground">Uploaded {formatDateTime(doc.createdAt)}</p>
											</div>
										</div>
										<div class="flex items-center gap-2 shrink-0">
											<a href={getFileUrl(doc.documentPath)} target="_blank" rel="noopener noreferrer" class="text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1">
												<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
												View
											</a>
											<button type="button" onclick={() => downloadFile(getFileUrl(doc.documentPath), doc.documentType || undefined)} class="text-xs font-semibold text-foreground bg-background hover:bg-muted border border-border px-3 py-1.5 rounded-lg shadow-2xs transition-colors inline-flex items-center gap-1">
												<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
												Download
											</button>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>

				<!-- Right Column: Financials & Metadata -->
				<div class="lg:col-span-1 space-y-6">
					<!-- Financial Card -->
					<div class="bg-card border border-border rounded-xl p-6 shadow-xs space-y-5">
						<h3 class="text-xs font-bold text-foreground border-b border-border pb-3 uppercase tracking-wider flex items-center gap-2">
							<svg class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
							Financial Summary &amp; Logs
						</h3>
						
						<dl class="space-y-4 text-xs">
							{#if salesReturnAmt > 0}
								<div class="flex justify-between items-center border-b border-border/50 pb-2.5 text-xs text-muted-foreground">
									<dt class="font-semibold uppercase tracking-wider">Original Payable</dt>
									<dd class="font-mono line-through">{formatAmount(data.payableAmount)}</dd>
								</div>
								<div class="flex justify-between items-center border-b border-border/50 pb-2.5 text-xs text-rose-600 dark:text-rose-400">
									<dt class="font-semibold uppercase tracking-wider">Sales Return</dt>
									<dd class="font-mono font-bold">-{formatAmount(salesReturnAmt)}</dd>
								</div>
							{/if}
							<div class="flex justify-between items-center border-b border-border/50 pb-2.5">
								<dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payable Amount</dt>
								<dd class="text-base font-bold text-foreground font-mono">{formatAmount(netSelling)}</dd>
							</div>
							<div class="flex justify-between items-center border-b border-border/50 pb-2.5">
								<dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expected Cost</dt>
								<dd class="text-sm font-semibold text-muted-foreground font-mono">{formatAmount(data.expectedSupplierCost)}</dd>
							</div>
							{#if totalGovtFeesAmount > 0}
								<div class="flex justify-between items-center border-b border-border/50 pb-2.5">
									<dt class="text-xs font-semibold text-primary uppercase tracking-wider">Supplier Payments Total</dt>
									<dd class="text-sm font-bold text-primary font-mono">{formatAmount(totalGovtFeesAmount)}</dd>
								</div>
							{/if}
							<div class="flex justify-between items-center pt-1">
								<dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment Mode</dt>
								<dd class="text-xs font-semibold text-foreground bg-muted border border-border px-2.5 py-1 rounded-md">
									{formatPaymentMethod(data.paymentMode || data.paymentMethod)}
								</dd>
							</div>
						</dl>
					</div>

					<!-- Supplier Payments Log Card -->
					<div class="bg-card border border-border rounded-xl p-6 shadow-xs space-y-4">
						<h3 class="text-xs font-bold text-foreground border-b border-border pb-3 uppercase tracking-wider flex items-center justify-between flex-wrap gap-2">
							<span class="flex items-center gap-2">
								<svg class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
								Supplier Payments Log ({data.govtFees?.length || 0})
							</span>
						</h3>
						{#if data.govtFees && data.govtFees.length > 0}
							<div class="space-y-3 divide-y divide-border/40">
								{#each data.govtFees as fee}
									<div class="pt-3 first:pt-0 space-y-1.5 text-xs">
										<div class="flex items-center justify-between">
											<span class="font-bold text-foreground font-mono">{formatAmount(fee.amount)}</span>
											<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border {getFeeBadgeClass(fee.status)}">
												{getFeeStatusLabel(fee.status)}
											</span>
										</div>
										{#if fee.supplierId || fee.supplier_id || fee.supplierName}
											<p class="text-[11px] font-bold text-primary flex items-center gap-1">
												<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
												{fee.supplierName || getSupplierDisplayName(fee.supplierId ?? fee.supplier_id ?? undefined)}
											</p>
										{/if}
										{#if fee.description || fee.govt_fee_description}
											<p class="text-muted-foreground text-[11px]">{fee.description || fee.govt_fee_description}</p>
										{/if}
										{#if fee.paymentReference || fee.transaction_no}
											<p class="text-[11px] font-mono text-muted-foreground"><span class="font-semibold text-foreground">Txn / Ref:</span> {fee.paymentReference || fee.transaction_no}</p>
										{/if}
										{#if fee.paymentProof}
											<div class="pt-1">
												<a href={getFileUrl(fee.paymentProof)} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:underline">
													<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
													View Payment Proof
												</a>
											</div>
										{/if}
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-xs text-muted-foreground italic py-1">No supplier payments recorded yet.</p>
						{/if}
					</div>

					<!-- Meta Card -->
					<div class="bg-card border border-border rounded-xl p-6 shadow-xs text-xs text-muted-foreground space-y-3">
						<h3 class="text-xs font-bold text-foreground border-b border-border pb-3 uppercase tracking-wider flex items-center gap-2">
							<svg class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
							Metadata Info
						</h3>
						<div class="flex justify-between items-center py-1">
							<span class="font-semibold uppercase tracking-wider text-[11px]">CREATED</span>
							<span class="font-semibold text-foreground">{formatDateTime(data.createdAt)}</span>
						</div>
						<div class="flex justify-between items-center py-1 border-t border-border/40">
							<span class="font-semibold uppercase tracking-wider text-[11px]">LAST UPDATED</span>
							<span class="font-semibold text-foreground">{formatDateTime(data.updatedAt)}</span>
						</div>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- ===================== MODALS OVERLAYS ===================== -->

<!-- 1. Process Modal -->
{#if showProcessModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" role="dialog" aria-modal="true">
		<div class="bg-background border border-border w-full max-w-lg rounded-xl shadow-lg flex flex-col max-h-[90vh]">
			<div class="flex items-center justify-between px-5 py-4 border-b border-border">
				<h2 class="text-base font-bold text-foreground">Process Holiday Package</h2>
				<button class="text-muted-foreground hover:text-foreground text-lg cursor-pointer" onclick={() => (showProcessModal = false)}>&times;</button>
			</div>
			
			<div class="p-5 overflow-y-auto space-y-4">
				{#if actionError}
					<div class="p-3 text-xs rounded bg-destructive/10 text-destructive border border-destructive/20 font-medium" role="alert">{actionError}</div>
				{/if}
				<div class="space-y-3">
					<div class="flex justify-between items-center">
						<h3 class="text-xs font-bold text-foreground uppercase tracking-wider">Supplier Payments / Deposits</h3>
						<button type="button" class="text-[10px] font-bold text-primary hover:underline" onclick={addPaymentRow}>+ Add Payment Row</button>
					</div>
					
					{#if govtFees.length === 0}
						<div class="p-4 bg-muted/20 border border-border rounded-lg text-center text-xs text-muted-foreground italic">
							No supplier payments added. Click "+ Add Payment Row" above to add a payment.
						</div>
					{/if}

					{#each govtFees as fee, index}
						<div class="p-4 bg-muted/30 border border-border rounded-lg space-y-3 relative">
							<div class="flex justify-between items-center">
								<span class="text-xs font-bold text-muted-foreground">Payment Log #{index + 1}</span>
								<button type="button" class="text-[10px] font-bold text-destructive hover:underline cursor-pointer" onclick={() => removePaymentRow(index)}>Remove</button>
							</div>
							
							<div class="space-y-1">
								<label for="fee-supplier-{index}" class="text-[10px] font-bold text-muted-foreground/80 uppercase">Supplier Partner *</label>
								<select id="fee-supplier-{index}" bind:value={fee.supplier_id} class="w-full px-2.5 py-1.5 text-xs border border-border rounded-md bg-background text-foreground focus:ring-1 focus:ring-primary font-semibold">
									<option value={undefined}>-- Select Supplier (Visa, Flight, Hotel, Transport, Holiday) --</option>
									{#each allSuppliers as supp}
										<option value={supp.id}>
											{supp.name} {supp.code ? `(${supp.code})` : ''} {supp.categories && supp.categories.length > 0 ? `[${supp.categories.join(', ')}]` : ''}
										</option>
									{/each}
								</select>
							</div>

							<div class="space-y-1">
								<label for="fee-amount-{index}" class="text-[10px] font-bold text-muted-foreground/80 uppercase">Amount (BHD) *</label>
								<input id="fee-amount-{index}" type="number" step="0.001" bind:value={fee.amount} class="w-full px-2.5 py-1.5 text-xs border border-border rounded-md bg-background text-foreground focus:ring-1 focus:ring-primary" />
							</div>
							
							<div class="space-y-1">
								<label for="fee-desc-{index}" class="text-[10px] font-bold text-muted-foreground/80 uppercase">Description</label>
								<input id="fee-desc-{index}" type="text" bind:value={fee.govt_fee_description} class="w-full px-2.5 py-1.5 text-xs border border-border rounded-md bg-background text-foreground focus:ring-1 focus:ring-primary" placeholder="Deposit, local tour booking fee..." />
							</div>

							<div class="space-y-1">
								<label for="fee-proof-{index}" class="text-[10px] font-bold text-muted-foreground/80 uppercase">Payment Proof Document</label>
								<input id="fee-proof-{index}" type="file" onchange={(e) => {
									const file = e.currentTarget.files?.[0];
									if (file) govtFees[index].payment_proof = file;
								}} class="w-full text-xs text-muted-foreground file:mr-2.5 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary file:cursor-pointer" />
							</div>
						</div>
					{/each}
				</div>
			</div>
			
			<div class="flex justify-end gap-2 px-5 py-3 border-t border-border bg-muted/15 rounded-b-xl">
				<button class="px-4 py-2 text-xs font-semibold border border-border bg-background hover:bg-muted text-foreground rounded-lg transition-colors" onclick={() => (showProcessModal = false)} disabled={isSubmitting}>Cancel</button>
				<button class="px-4 py-2 text-xs font-bold text-primary-foreground bg-primary hover:opacity-90 rounded-lg transition-opacity flex items-center gap-1.5" onclick={submitProcess} disabled={isSubmitting}>
					{#if isSubmitting}
						<svg class="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
						Processing...
					{:else}
						Submit &amp; Start Booking
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 2. Edit Reference ID Modal -->
{#if showEditRefModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" role="dialog" aria-modal="true">
		<div class="bg-background border border-border w-full max-w-md rounded-xl shadow-lg flex flex-col">
			<div class="flex items-center justify-between px-5 py-4 border-b border-border">
				<h2 class="text-base font-bold text-foreground">Edit Supplier Reference ID</h2>
				<button class="text-muted-foreground hover:text-foreground text-lg cursor-pointer" onclick={() => (showEditRefModal = false)}>&times;</button>
			</div>
			
			<div class="p-5 space-y-4">
				{#if actionError}
					<div class="p-3 text-xs rounded bg-destructive/10 text-destructive border border-destructive/20 font-medium" role="alert">{actionError}</div>
				{/if}
				
				<div class="space-y-1.5">
					<label for="edit-supplier-ref-input" class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Supplier Booking Reference ID *</label>
					<input id="edit-supplier-ref-input" type="text" bind:value={holidayAppId} class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary" />
				</div>
			</div>
			
			<div class="flex justify-end gap-2 px-5 py-3 border-t border-border bg-muted/15 rounded-b-xl">
				<button class="px-4 py-2 text-xs font-semibold border border-border bg-background hover:bg-muted text-foreground rounded-lg transition-colors" onclick={() => (showEditRefModal = false)} disabled={isSubmitting}>Cancel</button>
				<button class="px-4 py-2 text-xs font-bold text-primary-foreground bg-primary hover:opacity-90 rounded-lg transition-opacity flex items-center gap-1.5" onclick={submitEditRef} disabled={isSubmitting}>
					{#if isSubmitting}
						<svg class="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
						Updating...
					{:else}
						Update Reference
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 3. Upload Docs Modal -->
{#if showUploadDocsModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" role="dialog" aria-modal="true">
		<div class="bg-background border border-border w-full max-w-md rounded-xl shadow-lg flex flex-col max-h-[90vh]">
			<div class="flex items-center justify-between px-5 py-4 border-b border-border">
				<h2 class="text-base font-bold text-foreground">Upload Documents</h2>
				<button class="text-muted-foreground hover:text-foreground text-lg cursor-pointer" onclick={() => (showUploadDocsModal = false)}>&times;</button>
			</div>
			
			<div class="p-5 overflow-y-auto space-y-4">
				{#if actionError}
					<div class="p-3 text-xs rounded bg-destructive/10 text-destructive border border-destructive/20 font-medium" role="alert">{actionError}</div>
				{/if}
				
				<div class="flex justify-between items-center border-b border-border/60 pb-2">
					<h3 class="text-xs font-bold text-muted-foreground uppercase">Travel Documents</h3>
					<button type="button" class="text-[10px] font-bold text-primary hover:underline" onclick={addDocRow}>+ Add Document</button>
				</div>
				
				{#each uploadDocuments as doc, index}
					<div class="p-4 bg-muted/30 border border-border rounded-lg space-y-3 relative">
						<div class="flex justify-between items-center">
							<span class="text-xs font-bold text-muted-foreground">Document #{index + 1}</span>
							{#if index > 0}
								<button type="button" class="text-[10px] font-bold text-destructive hover:underline" onclick={() => removeDocRow(index)}>Remove</button>
							{/if}
						</div>
						
						<div class="space-y-1">
							<label for="doc-name-{index}" class="text-[10px] font-bold text-muted-foreground/80 uppercase">Service / Document Name *</label>
							<input id="doc-name-{index}" type="text" bind:value={doc.serviceName} class="w-full px-2.5 py-1.5 text-xs border border-border rounded-md bg-background text-foreground focus:ring-1 focus:ring-primary" placeholder="Flight ticket, Hotel voucher..." />
						</div>

						<div class="space-y-1">
							<label for="doc-file-{index}" class="text-[10px] font-bold text-muted-foreground/80 uppercase">Document File *</label>
							<input id="doc-file-{index}" type="file" onchange={(e) => {
								const file = e.currentTarget.files?.[0];
								if (file) uploadDocuments[index].file = file;
							}} class="w-full text-xs text-muted-foreground file:mr-2.5 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary file:cursor-pointer" />
						</div>
					</div>
				{/each}
			</div>
			
			<div class="flex justify-end gap-2 px-5 py-3 border-t border-border bg-muted/15 rounded-b-xl">
				<button class="px-4 py-2 text-xs font-semibold border border-border bg-background hover:bg-muted text-foreground rounded-lg transition-colors" onclick={() => (showUploadDocsModal = false)} disabled={isSubmitting}>Cancel</button>
				<button class="px-4 py-2 text-xs font-bold text-primary-foreground bg-primary hover:opacity-90 rounded-lg transition-opacity flex items-center gap-1.5" onclick={submitDocuments} disabled={isSubmitting}>
					{#if isSubmitting}
						<svg class="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
						Uploading...
					{:else}
						Upload All Documents
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 4. Complete Confirm Modal -->
{#if showCompleteConfirmModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" role="dialog" aria-modal="true">
		<div class="bg-background border border-border w-full max-w-md rounded-xl shadow-lg flex flex-col">
			<div class="flex items-center justify-between px-5 py-4 border-b border-border">
				<h2 class="text-base font-bold text-foreground">Complete Holiday Package</h2>
				<button class="text-muted-foreground hover:text-foreground text-lg cursor-pointer" onclick={() => (showCompleteConfirmModal = false)}>&times;</button>
			</div>
			
			<div class="p-5 space-y-3">
				<p class="text-sm text-foreground">Are you sure you want to mark this holiday package application as <strong class="text-success font-semibold">Completed</strong>?</p>
				<p class="text-xs text-muted-foreground leading-relaxed">This will notify the booking salesman and release final travel vouchers to their portal.</p>
				{#if actionError}
					<div class="p-3 text-xs rounded bg-destructive/10 text-destructive border border-destructive/20 font-medium" role="alert">{actionError}</div>
				{/if}
			</div>
			
			<div class="flex justify-end gap-2 px-5 py-3 border-t border-border bg-muted/15 rounded-b-xl">
				<button class="px-4 py-2 text-xs font-semibold border border-border bg-background hover:bg-muted text-foreground rounded-lg transition-colors" onclick={() => (showCompleteConfirmModal = false)} disabled={isSubmitting}>Cancel</button>
				<button class="px-4 py-2 text-xs font-bold text-white bg-success hover:opacity-95 rounded-lg transition-opacity flex items-center gap-1.5" onclick={() => submitStatus('completed')} disabled={isSubmitting}>
					{#if isSubmitting}
						<svg class="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
						Confirming...
					{:else}
						Yes, Mark Completed
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 5. Cancel Confirm Modal -->
{#if showCancelConfirmModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" role="dialog" aria-modal="true">
		<div class="bg-background border border-border w-full max-w-md rounded-xl shadow-lg flex flex-col">
			<div class="flex items-center justify-between px-5 py-4 border-b border-border">
				<h2 class="text-base font-bold text-foreground">Cancel Holiday Package</h2>
				<button class="text-muted-foreground hover:text-foreground text-lg cursor-pointer" onclick={() => (showCancelConfirmModal = false)}>&times;</button>
			</div>
			
			<div class="p-5 space-y-3">
				<p class="text-sm text-foreground">Are you sure you want to mark this holiday package application as <strong class="text-destructive font-semibold">Cancelled</strong>?</p>
				<p class="text-xs text-muted-foreground leading-relaxed">This will revert the booking status and notify the booking agent.</p>
				{#if actionError}
					<div class="p-3 text-xs rounded bg-destructive/10 text-destructive border border-destructive/20 font-medium" role="alert">{actionError}</div>
				{/if}
			</div>
			
			<div class="flex justify-end gap-2 px-5 py-3 border-t border-border bg-muted/15 rounded-b-xl">
				<button class="px-4 py-2 text-xs font-semibold border border-border bg-background hover:bg-muted text-foreground rounded-lg transition-colors" onclick={() => (showCancelConfirmModal = false)} disabled={isSubmitting}>Cancel</button>
				<button class="px-4 py-2 text-xs font-bold text-white bg-destructive hover:opacity-95 rounded-lg transition-opacity flex items-center gap-1.5" onclick={() => submitStatus('cancelled')} disabled={isSubmitting}>
					{#if isSubmitting}
						<svg class="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
						Confirming...
					{:else}
						Yes, Cancel Package
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	@import '../../../../lib/theme/detail-styles.css';

	.workflow-card {
		background: hsl(var(--card));
		border: 1px solid hsl(var(--border));
		border-radius: 0.75rem;
		padding: 1.25rem 1.5rem;
		margin-bottom: 1rem;
	}
	.status-alert {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.9rem;
		font-weight: 500;
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
	}
	.status-alert--locked {
		background: hsl(var(--muted) / 0.5);
		color: hsl(var(--muted-foreground));
		border: 1px solid hsl(var(--border));
	}
	.status-alert--success {
		background: hsl(142.1 76.2% 36.3% / 0.1);
		color: hsl(142.1 76.2% 36.3%);
		border: 1px solid hsl(142.1 76.2% 36.3% / 0.2);
	}
	.action-banner {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
	}
	.action-banner__text {
		font-size: 0.9rem;
		color: hsl(var(--muted-foreground));
		max-width: 500px;
	}
	.action-panel h3 {
		font-size: 0.95rem;
		font-weight: 600;
		margin: 0;
	}
	.action-panel__header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}
	.ref-badge {
		font-size: 0.75rem;
		font-family: monospace;
		padding: 0.2rem 0.5rem;
		border-radius: 0.25rem;
		background: hsl(var(--muted));
		color: hsl(var(--muted-foreground));
	}
	.action-buttons-group {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.action-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 600;
		border-radius: 0.375rem;
		border: 1px solid transparent;
		cursor: pointer;
		font-family: inherit;
		transition: all 0.15s;
	}
	.action-btn--primary {
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
	}
	.action-btn--primary:hover { opacity: 0.9; }
	.action-btn--secondary {
		background: hsl(var(--secondary));
		color: hsl(var(--secondary-foreground));
		border-color: hsl(var(--border));
	}
	.action-btn--secondary:hover { background: hsl(var(--muted)); }
	.action-btn--success {
		background: hsl(142.1 76.2% 36.3%);
		color: white;
	}
	.action-btn--success:hover { opacity: 0.9; }
	.action-btn--danger {
		background: hsl(var(--destructive));
		color: hsl(var(--destructive-foreground));
	}
	.action-btn--danger:hover { opacity: 0.9; }
	.action-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.doc-link {
		color: hsl(var(--primary));
		text-decoration: underline;
		font-weight: 500;
	}

	.timestamp-sub {
		display: block;
		font-size: 0.725rem;
		color: hsl(var(--muted-foreground));
		margin-top: 0.2rem;
	}

	.text-warning {
		color: hsl(38 92% 50%);
	}

	/* Modal styling */
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: 1rem;
	}
	.modal-content {
		background: hsl(var(--background));
		border: 1px solid hsl(var(--border));
		border-radius: 0.75rem;
		width: 100%;
		max-width: 550px;
		display: flex;
		flex-direction: column;
		max-height: 90vh;
		box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
	}
	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid hsl(var(--border));
	}
	.modal-header h2 {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 0;
	}
	.close-x {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: hsl(var(--muted-foreground));
	}
	.modal-body {
		padding: 1.25rem;
		overflow-y: auto;
	}
	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 0.875rem 1.25rem;
		border-top: 1px solid hsl(var(--border));
		background: hsl(var(--muted) / 0.2);
		border-bottom-left-radius: 0.75rem;
		border-bottom-right-radius: 0.75rem;
	}
	.form-group {
		margin-bottom: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}
	.form-group label {
		font-size: 0.75rem;
		font-weight: 600;
		color: hsl(var(--muted-foreground));
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
	.form-control {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border-radius: 0.375rem;
		border: 1px solid hsl(var(--border));
		background: hsl(var(--background));
		color: hsl(var(--foreground));
		font-family: inherit;
		font-size: 0.875rem;
	}
	.form-control:focus {
		outline: 2px solid hsl(var(--ring));
	}
	.modal-error {
		background: hsl(var(--destructive) / 0.1);
		color: hsl(var(--destructive));
		border: 1px solid hsl(var(--destructive) / 0.2);
		padding: 0.625rem 0.875rem;
		border-radius: 0.375rem;
		font-size: 0.8125rem;
		margin-bottom: 1rem;
	}

	.govt-fees-section {
		margin-top: 1.5rem;
		border-top: 1px dashed hsl(var(--border));
		padding-top: 1rem;
	}
	.govt-fees-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}
	.govt-fees-header h3 {
		font-size: 0.875rem;
		font-weight: 600;
		margin: 0;
	}
	.btn-small {
		background: none;
		border: none;
		color: hsl(var(--primary));
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
	}
	.fee-row-card {
		background: hsl(var(--muted) / 0.25);
		border: 1px solid hsl(var(--border));
		border-radius: 0.5rem;
		padding: 0.875rem;
		margin-bottom: 0.75rem;
	}
	.fee-row-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
		border-bottom: 1px solid hsl(var(--border) / 0.5);
		padding-bottom: 0.25rem;
	}
	.fee-row-header h4 {
		font-size: 0.8rem;
		font-weight: 600;
		margin: 0;
		color: hsl(var(--muted-foreground));
	}
	.btn-remove {
		background: none;
		border: none;
		color: hsl(var(--destructive));
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
	}
	.fee-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}
</style>
