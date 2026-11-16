<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { apiFetch } from '$lib/api/api-client';
	import { NotFoundError, NetworkError, DownstreamUnavailableError, TimeoutError } from '$lib/api/problem-details';
	import { formatDate, formatDateTime, formatAmount, downloadFile } from '$lib/utils';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import LifecycleStepper, { type StepperStep } from '$lib/components/LifecycleStepper.svelte';
	import type { VfsAppointmentDetailResponse } from '$lib/types/api';
	import { getFileUrl } from '$lib/utils/status';
	import { printInvoice } from '$lib/utils/print-invoice';


	let data = $state<VfsAppointmentDetailResponse | null>(null);
	let isLoading = $state(true);
	let errorMessage = $state('');
	let isNotFound = $state(false);
	const vfsId = $derived($page.params.id);
	const salesReturnAmt = $derived((data as any)?.salesReturnAmount || 0);
	const netSelling = $derived(Math.max(0, (data?.payableAmount || 0) - salesReturnAmt));

	// Modals State
	let showProcessModal = $state(false);
	let showEditRefModal = $state(false);
	let showScheduleModal = $state(false);
	let showCompleteModal = $state(false);
	let showCancelModal = $state(false);
	let showUploadDocModal = $state(false);

	// Dedicated Add Payment Modal State
	let showAddPaymentModal = $state(false);
	let addPaySupplierId = $state<number | undefined>(undefined);
	let addPayAmount = $state(0);
	let addPayDescription = $state('');
	let addPayTxnNo = $state('');
	let addPayProofFile = $state<File | null>(null);
	let addPayError = $state('');

	// Form values
	let vfsAppId = $state('');
	let appointmentDate = $state('');
	let appointmentTime = $state('');
	let scheduleDescription = $state('');

	let suppliers = $state<Array<{ id: number; name: string; code?: string; categories?: string[] }>>([]);
	const filteredSuppliers = $derived.by(() => {
		if (suppliers.length === 0) return [];
		const matches = suppliers.filter((s) => {
			if (!s.categories || s.categories.length === 0) return true;
			return s.categories.some((c) => {
				const lower = c.toLowerCase();
				return lower.includes('vfs') || lower.includes('visa') || lower.includes('general') || lower.includes('supplier');
			});
		});
		return matches.length > 0 ? matches : suppliers;
	});

	let govtFees = $state<Array<{ row_key?: string; supplier_id?: number; amount: number; transaction_no: string; govt_fee_description: string; payment_proof?: File; existing_payment_proof?: string }>>([
		{ row_key: undefined, supplier_id: undefined, amount: 0, transaction_no: '', govt_fee_description: '' }
	]);

	$effect(() => {
		if (data?.supplierId && govtFees.length > 0 && !govtFees[0].supplier_id) {
			govtFees[0].supplier_id = data.supplierId;
		}
	});

	function addPaymentRow() {
		govtFees = [...govtFees, { supplier_id: data?.supplierId || undefined, amount: 0, transaction_no: '', govt_fee_description: '' }];
	}

	function removePaymentRow(index: number) {
		govtFees = govtFees.filter((_, idx) => idx !== index);
	}

	let vfsDocFile = $state<File | null>(null);
	let verifiedReceiptFile = $state<File | null>(null);
	let rejectedReceiptFile = $state<File | null>(null);

	let isSubmitting = $state(false);
	let actionError = $state('');

	async function load() {
		isLoading = true; errorMessage = ''; isNotFound = false;
		try {
			data = await apiFetch<VfsAppointmentDetailResponse>(`/api/vfs-appointments/${vfsId}`);
			if (data) {
				vfsAppId = data.vfsAppId ?? '';
				appointmentDate = data.appointmentDate ? data.appointmentDate.split('T')[0] : '';
				appointmentTime = data.appointmentTime ? data.appointmentTime.substring(0, 5) : '';
				scheduleDescription = data.vfsReceipt ?? ''; // VfsReceipt matches schedule notes in DB config
			}
		} catch (err) {
			if (err instanceof NotFoundError) isNotFound = true;
			else if (err instanceof DownstreamUnavailableError || err instanceof TimeoutError) errorMessage = 'The booking service is temporarily unavailable. Please retry in a moment.';
			else if (err instanceof NetworkError) errorMessage = 'Unable to load VFS details. Please check your connection.';
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

	function formatTime(value: string | null | undefined): string {
		if (!value) return '';
		return value.substring(0, 5);
	}



	// API workflow calls
	async function submitProcess() {
		isSubmitting = true;
		actionError = '';
		try {
			const formData = new FormData();

			govtFees.forEach((fee, index) => {
				if (fee.row_key) {
					formData.append(`govt_fees[${index}][row_key]`, fee.row_key);
				}
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

			await apiFetch(`/api/vfs-appointments/${vfsId}/process`, {
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

	async function submitSchedule() {
		if (!appointmentDate || !appointmentTime) {
			actionError = 'Appointment Date and Time are required.';
			return;
		}

		isSubmitting = true;
		actionError = '';
		try {
			await apiFetch(`/api/vfs-appointments/${vfsId}/update`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					appointment_date: appointmentDate,
					appointment_time: appointmentTime,
					description: scheduleDescription
				})
			});

			showScheduleModal = false;
			await load();
		} catch (err: any) {
			actionError = err.message || 'Failed to update schedule details.';
		} finally {
			isSubmitting = false;
		}
	}

	async function submitVfsRef() {
		if (!vfsAppId) {
			actionError = 'VFS Reference ID is required.';
			return;
		}

		isSubmitting = true;
		actionError = '';
		try {
			await apiFetch(`/api/vfs-appointments/${vfsId}/update-vfs-ref`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ vfs_app_id: vfsAppId })
			});

			showEditRefModal = false;
			await load();
		} catch (err: any) {
			actionError = err.message || 'Failed to update VFS reference.';
		} finally {
			isSubmitting = false;
		}
	}

	async function submitStatus(status: 'completed' | 'cancelled') {
		if (status === 'completed' && (!vfsDocFile || !verifiedReceiptFile)) {
			actionError = 'Final VFS Document and Verified Receipt files are required.';
			return;
		}

		isSubmitting = true;
		actionError = '';
		try {
			const formData = new FormData();
			formData.append('status', status);
			if (vfsDocFile) formData.append('vfsDoc', vfsDocFile);
			if (verifiedReceiptFile) formData.append('verifiedReceipt', verifiedReceiptFile);
			if (rejectedReceiptFile) formData.append('rejectedReceipt', rejectedReceiptFile);

			await apiFetch(`/api/vfs-appointments/${vfsId}/status`, {
				method: 'POST',
				body: formData
			});

			showCompleteModal = false;
			showCancelModal = false;
			await load();
		} catch (err: any) {
			actionError = err.message || `Failed to update status to ${status}.`;
		} finally {
			isSubmitting = false;
		}
	}

	async function submitUploadDoc() {
		if (!vfsDocFile && !verifiedReceiptFile) {
			actionError = 'Please select a VFS document or payment receipt file to upload.';
			return;
		}

		isSubmitting = true;
		actionError = '';
		try {
			const formData = new FormData();
			formData.append('status', data?.processingStatus || 'completed');
			if (vfsDocFile) formData.append('vfsDoc', vfsDocFile);
			if (verifiedReceiptFile) formData.append('verifiedReceipt', verifiedReceiptFile);

			await apiFetch(`/api/vfs-appointments/${vfsId}/status`, {
				method: 'POST',
				body: formData
			});

			showUploadDocModal = false;
			await load();
		} catch (err: any) {
			actionError = err?.message || 'Failed to upload VFS document.';
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

	const vfsSteps = $derived<StepperStep[]>([
		{
			number: 1,
			label: 'Payment Proof',
			subtitle: isStep1Done ? 'Verified' : 'Pending',
			isDone: isStep1Done
		},
		{
			number: 2,
			label: 'Start Processing',
			subtitle: isStep2Done ? 'VFS Logged' : isStep2Active ? 'Awaiting Action' : 'Locked',
			isDone: isStep2Done,
			isActive: isStep2Active
		},
		{
			number: 3,
			label: 'Review',
			subtitle: isStep3Done ? 'Reviewed' : isStep3Active ? 'Active' : 'Waiting',
			isDone: isStep3Done,
			isActive: isStep3Active
		},
		{
			number: 4,
			label: 'Finalized',
			subtitle: isStep4Done ? (isCancelled ? 'Cancelled' : 'Completed') : 'Awaiting',
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
						entityType: 'VFS',
						entityId: data.id,
						entityDocumentNumber: data.documentNumber
					})
				});
			} catch (e) {
				// Ignore if already claimed by user
			}
			vfsAppId = data.vfsAppId ?? '';
			govtFees = [{
				row_key: undefined,
				supplier_id: data?.supplierId || undefined,
				amount: 0,
				transaction_no: '',
				govt_fee_description: 'INITIAL PAYMENT'
			}];
		}
		showProcessModal = true;
	}

	function triggerAddPaymentModal() {
		actionError = '';
		addPayError = '';
		addPaySupplierId = data?.supplierId || (suppliers[0]?.id ? suppliers[0].id : undefined);
		addPayAmount = 0;
		addPayDescription = (data?.govtFees && data.govtFees.length > 0) ? 'SECOND PAYMENT' : 'INITIAL PAYMENT';
		addPayTxnNo = '';
		addPayProofFile = null;
		showAddPaymentModal = true;
	}

	async function submitAddPayment(e: Event) {
		e.preventDefault();
		if (addPayAmount <= 0) {
			addPayError = 'Payment amount must be greater than 0 BHD.';
			return;
		}
		if (!addPaySupplierId) {
			addPayError = 'Please select a supplier partner.';
			return;
		}

		isSubmitting = true;
		addPayError = '';
		try {
			const targetVfsAppId = vfsAppId || data?.vfsAppId || data?.documentNumber || 'N/A';
			const formData = new FormData();
			formData.append('is_additive', 'true');
			formData.append('vfs_app_id', targetVfsAppId);

			const freshRowKey = 'fee_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
			formData.append('govt_fees[0][row_key]', freshRowKey);
			formData.append('govt_fees[0][amount]', addPayAmount.toString());
			formData.append('govt_fees[0][supplier_id]', addPaySupplierId.toString());
			
			const found = suppliers.find((s) => s.id === addPaySupplierId);
			if (found?.name) {
				formData.append('govt_fees[0][supplier_name]', found.name);
			}
			formData.append('govt_fees[0][transaction_no]', addPayTxnNo || '');
			formData.append('govt_fees[0][govt_fee_description]', addPayDescription || 'Supplier Payment');
			if (addPayProofFile) {
				formData.append('govt_fees[0][payment_proof]', addPayProofFile);
			}

			await apiFetch(`/api/vfs-appointments/${vfsId}/process`, {
				method: 'POST',
				body: formData
			});

			showAddPaymentModal = false;
			await load();
		} catch (err: any) {
			addPayError = err.message || 'Failed to submit supplier payment.';
		} finally {
			isSubmitting = false;
		}
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
	<title>VFS {data?.documentNumber || vfsId} — Texas Operational Portal</title>
</svelte:head>

<div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
	<!-- Breadcrumbs -->
	<nav class="flex items-center space-x-2 text-xs text-muted-foreground">
		<a href="/vfs" class="hover:text-primary transition-colors flex items-center gap-1 font-medium">
			<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
			VFS Appointments
		</a>
		<span class="text-muted-foreground/50">/</span>
		<span class="font-semibold text-foreground">{data?.documentNumber || `TXSVFS${String(vfsId).padStart(6, '0')}`}</span>
	</nav>

	{#if isLoading}
		<!-- Skeleton Loader -->
		<div class="space-y-6" aria-busy="true" aria-label="Loading VFS details">
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
			<h2 class="text-xl font-bold text-foreground">VFS Appointment Not Found</h2>
			<p class="text-sm text-muted-foreground max-w-sm">VFS appointment #{vfsId} could not be found. It may have been removed or the ID is incorrect.</p>
			<a href="/vfs" class="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-primary-foreground bg-primary rounded-lg hover:opacity-90 transition-opacity">Back to VFS List</a>
		</div>
	{:else if errorMessage}
		<div class="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
			<div class="inline-flex p-2.5 rounded-full bg-destructive/10 text-destructive">
				<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10"></circle>
					<line x1="12" y1="8" x2="12" y2="12"></line>
					<line x1="12" y1="16" x2="12.01" y2="16"></line>
				</svg>
			</div>
			<p class="text-sm text-muted-foreground max-w-md">{errorMessage}</p>
			<button class="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-primary-foreground bg-primary rounded-lg hover:opacity-90 transition-opacity" onclick={load}>Retry Loading</button>
		</div>
	{:else if data}
		<!-- Detail Header -->
		<div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-5 border-b border-border">
			<div class="space-y-1.5">
				<div class="flex items-center gap-3">
					<h1 class="text-2xl font-bold tracking-tight text-foreground">VFS Appointment</h1>
					<span class="font-mono text-base font-bold text-muted-foreground/80 bg-muted/50 px-2.5 py-0.5 rounded-md border border-border">{data.documentNumber}</span>
				</div>
				<p class="text-xs font-medium text-muted-foreground flex items-center gap-2">
					<span class="text-foreground font-semibold">{data.name}</span>
					<span class="text-muted-foreground/40">&middot;</span>
					<span class="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border uppercase font-bold tracking-wider">{data.country}</span>
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
					<h2 class="text-lg font-bold text-foreground">Appointment Details &amp; Actions Locked</h2>
					<p class="text-xs text-muted-foreground leading-relaxed">
						All information, documents, and operational controls for this VFS appointment are locked. Details will be unlocked once the payment status is verified and updated to <span class="font-semibold text-success">Success</span> by the Accounts Department.
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
			<LifecycleStepper title="VFS Application Progress" status={data.processingStatus} steps={vfsSteps} />

			<!-- WORKFLOW OPERATIONS CONTROL BANNER -->
			<div class="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-xs">
				{#if data.processingStatus.toLowerCase() === 'pending'}
					<!-- Start Processing banner -->
					<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-primary/5 border border-primary/15 rounded-xl">
						<div class="space-y-1">
							<p class="text-sm font-semibold text-primary">Payment Cleared &amp; Verified</p>
							<p class="text-xs text-muted-foreground leading-relaxed">Ready for booking. Click to assign the VFS Reference ID and start processing the application.</p>
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
							<button class="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-success hover:opacity-95 rounded-lg transition-all shadow-xs cursor-pointer" onclick={() => { actionError = ''; vfsDocFile = null; verifiedReceiptFile = null; showCompleteModal = true; }}>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
								Complete Appointment
							</button>
							<button class="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-destructive hover:opacity-95 rounded-lg transition-all shadow-xs cursor-pointer" onclick={() => { actionError = ''; rejectedReceiptFile = null; showCancelModal = true; }}>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
								Cancel Appointment
							</button>
							<button class="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-foreground bg-secondary hover:bg-muted border border-border rounded-lg transition-all cursor-pointer" onclick={() => { actionError = ''; triggerProcessModal(); }}>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
								Manage Payments
							</button>
							<button class="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-foreground bg-secondary hover:bg-muted border border-border rounded-lg transition-all cursor-pointer" onclick={() => { actionError = ''; appointmentDate = data?.appointmentDate ? data.appointmentDate.split('T')[0] : ''; appointmentTime = data?.appointmentTime ? data.appointmentTime.substring(0, 5) : ''; scheduleDescription = data?.vfsReceipt ?? ''; showScheduleModal = true; }}>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
								Reschedule
							</button>
							<button class="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-foreground bg-secondary hover:bg-muted border border-border rounded-lg transition-all cursor-pointer" onclick={() => { actionError = ''; vfsDocFile = null; verifiedReceiptFile = null; showUploadDocModal = true; }}>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
								Upload VFS Document
							</button>
						</div>
					</div>
				{:else if data.processingStatus.toLowerCase() === 'completed'}
					{#if !data.passportCopy && !data.vfsReceipt}
						<!-- Completed but Document Missing Alert Banner -->
						<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-amber-500/10 border border-amber-500/25 rounded-xl">
							<div class="space-y-1">
								<div class="flex items-center gap-2">
									<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-white">Document Missing</span>
									<p class="text-sm font-bold text-amber-800 dark:text-amber-300">VFS Appointment Completed — VFS Document Pending</p>
								</div>
								<p class="text-xs text-muted-foreground leading-relaxed">
									This application has been completed, but no official VFS appointment document or receipt file was uploaded. You can upload the issued copy now.
								</p>
							</div>
							<button class="shrink-0 px-4 py-2.5 text-xs font-bold text-white bg-primary hover:opacity-90 rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer" onclick={() => { actionError = ''; vfsDocFile = null; verifiedReceiptFile = null; showUploadDocModal = true; }}>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
								Upload VFS Document
							</button>
						</div>
					{:else}
						<!-- Completed Success message -->
						<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-success/5 border border-success/15 rounded-xl">
							<div class="flex items-center gap-3 text-success">
								<svg class="w-5 h-5 text-success shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
								<span class="text-xs font-semibold">VFS Appointment has been finalized: {data.processingStatus.toUpperCase()}</span>
							</div>
							<button class="shrink-0 px-3 py-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5" onclick={() => { actionError = ''; vfsDocFile = null; verifiedReceiptFile = null; showUploadDocModal = true; }}>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
								Update / Replace VFS Document
							</button>
						</div>
					{/if}
				{:else}
					<!-- Other Finalized States (e.g. Cancelled) -->
					<div class="flex items-center gap-3 p-4 bg-muted/40 border border-border rounded-xl text-foreground" role="alert">
						<span class="text-xs font-semibold">VFS Appointment Status: {data.processingStatus.toUpperCase()}</span>
					</div>
				{/if}
			</div>

			<!-- THREE COLUMNS GRID -->
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<!-- Left Column: Appointment & Customer Info -->
				<div class="lg:col-span-2 space-y-6">
					<!-- Section: VFS Appointment details -->
					<div class="bg-card border border-border rounded-xl p-6 shadow-xs space-y-5">
						<h3 class="text-xs font-bold text-foreground border-b border-border pb-3 uppercase tracking-wider flex items-center gap-2">
							<svg class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
							Appointment &amp; Customer Details
						</h3>
						
						<dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
							<div class="space-y-1">
								<dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Applicant Name</dt>
								<dd class="text-sm font-semibold text-foreground">{data.prefix} {data.name}</dd>
							</div>
							<div class="space-y-1">
								<dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer Head</dt>
								<dd class="text-sm font-semibold text-foreground">{data.headName ?? '—'}</dd>
							</div>
							<div class="space-y-1">
								<dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Visa Type</dt>
								<dd class="text-sm font-semibold text-foreground">{data.visaType}</dd>
							</div>
							<div class="space-y-1">
								<dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client Type</dt>
								<dd class="text-sm font-semibold text-foreground capitalize">{data.clientType ?? '—'}</dd>
							</div>
							<div class="space-y-1">
								<dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Scheduled Date</dt>
								<dd class="text-sm font-semibold text-foreground">{formatDate(data.appointmentDate)}</dd>
							</div>
							<div class="space-y-1">
								<dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Scheduled Time</dt>
								<dd class="text-sm font-semibold text-foreground">{formatTime(data.appointmentTime)}</dd>
							</div>
							{#if data.supplierName}
								<div class="space-y-1 col-span-1 sm:col-span-2">
									<dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Supplier</dt>
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

					<!-- Section: Documents & Schedule Notes -->
					{#if data.vfsReceipt || data.passportCopy}
						<div class="bg-card border border-border rounded-xl p-6 shadow-xs space-y-5">
							<h3 class="text-xs font-bold text-foreground border-b border-border pb-3 uppercase tracking-wider flex items-center gap-2">
								<svg class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
								Documents &amp; Receipts
							</h3>
							
							<div class="space-y-4 text-xs">
								{#if data.passportCopy}
									<div class="flex items-center justify-between p-3.5 bg-muted/30 hover:bg-muted/50 rounded-xl border border-border transition-all">
										<div class="flex items-center gap-3 min-w-0">
											<div class="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
												<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
											</div>
											<div class="min-w-0">
												<p class="text-xs font-semibold text-foreground truncate">Confirmation Letter</p>
												<p class="text-[10px] text-muted-foreground">PDF Document</p>
											</div>
										</div>
										<div class="flex items-center gap-2 shrink-0">
											<a href={getFileUrl(data.passportCopy)} target="_blank" rel="noopener noreferrer" class="text-xs font-semibold text-primary bg-background px-3 py-1.5 rounded-lg border border-border shadow-2xs hover:bg-muted transition-colors">
												View
											</a>
											<button onclick={() => downloadFile(data?.passportCopy, 'vfs_confirmation_letter.pdf')} class="text-xs font-semibold text-primary bg-background px-3 py-1.5 rounded-lg border border-border shadow-2xs hover:bg-muted transition-colors cursor-pointer">
												Download
											</button>
										</div>
									</div>
								{/if}

								{#if data.vfsReceipt}
									<div class="space-y-1.5">
										<dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Receipt Slip / Instruction Note</dt>
										{#if data.vfsReceipt.startsWith('/')}
											<div class="flex items-center justify-between p-3.5 bg-muted/30 hover:bg-muted/50 rounded-xl border border-border transition-all">
												<div class="flex items-center gap-3 min-w-0">
													<div class="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
														<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
													</div>
													<div class="min-w-0">
														<p class="text-xs font-semibold text-foreground truncate">VFS Payment Receipt</p>
														<p class="text-[10px] text-muted-foreground">Booking Slip</p>
													</div>
												</div>
												<div class="flex items-center gap-2 shrink-0">
													<a href={getFileUrl(data.vfsReceipt)} target="_blank" rel="noopener noreferrer" class="text-xs font-semibold text-primary bg-background px-3 py-1.5 rounded-lg border border-border shadow-2xs hover:bg-muted transition-colors">
														View
													</a>
													<button onclick={() => downloadFile(data?.vfsReceipt, 'vfs_payment_receipt.pdf')} class="text-xs font-semibold text-primary bg-background px-3 py-1.5 rounded-lg border border-border shadow-2xs hover:bg-muted transition-colors cursor-pointer">
														Download
													</button>
												</div>
											</div>
										{:else}
											<div class="p-3.5 bg-muted/20 border border-border rounded-xl text-xs text-foreground leading-relaxed whitespace-pre-wrap">
												{data.vfsReceipt}
											</div>
										{/if}
									</div>
								{/if}
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
									<dt class="text-xs font-semibold text-primary uppercase tracking-wider">Government Fees Total</dt>
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

					<!-- Government Fees Log Card -->
					{#if data.govtFees && data.govtFees.length > 0}
						<div class="bg-card border border-border rounded-xl p-6 shadow-xs space-y-4">
							<h3 class="text-xs font-bold text-foreground border-b border-border pb-3 uppercase tracking-wider flex items-center justify-between">
								<span class="flex items-center gap-2">
									<svg class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
									Government Fees Log ({data.govtFees.length})
								</span>
								<span class="font-mono text-primary text-xs font-bold">{formatAmount(totalGovtFeesAmount)}</span>
							</h3>
							<div class="space-y-3 divide-y divide-border/40">
								{#each data.govtFees as fee}
									<div class="pt-3 first:pt-0 space-y-2 text-xs">
										<div class="flex items-center justify-between">
											<span class="font-bold text-foreground font-mono">{formatAmount(fee.amount)}</span>
											<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border {getFeeBadgeClass(fee.status)}">
												{getFeeStatusLabel(fee.status)}
											</span>
										</div>
										{#if fee.description}
											<p class="text-muted-foreground text-[11px]">{fee.description}</p>
										{/if}
										{#if fee.paymentReference || (fee as any).transaction_no}
											<p class="text-[11px] font-mono text-muted-foreground"><span class="font-semibold text-foreground">Txn / Ref:</span> {fee.paymentReference || (fee as any).transaction_no}</p>
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
						</div>
					{/if}

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
				<h2 class="text-base font-bold text-foreground">Process VFS Appointment</h2>
				<button class="text-muted-foreground hover:text-foreground text-lg cursor-pointer" onclick={() => (showProcessModal = false)}>&times;</button>
			</div>
			
			<div class="p-5 overflow-y-auto space-y-4">
				{#if actionError}
					<div class="p-3 text-xs rounded bg-destructive/10 text-destructive border border-destructive/20 font-medium" role="alert">{actionError}</div>
				{/if}
				

				<div class="border-t border-border/80 pt-4 space-y-3">
					<div class="flex justify-between items-center">
						<h3 class="text-xs font-bold text-foreground uppercase tracking-wider">Govt Fees &amp; Payments</h3>
						<button type="button" class="text-[10px] font-bold text-primary hover:underline" onclick={addPaymentRow}>+ Add Fee Split</button>
					</div>
					
					{#each govtFees as fee, index}
						<div class="p-4 bg-muted/30 border border-border rounded-lg space-y-3 relative">
							<div class="flex justify-between items-center">
								<span class="text-xs font-bold text-muted-foreground">Payment Log #{index + 1}</span>
								<button type="button" class="text-[10px] font-bold text-destructive hover:underline cursor-pointer" onclick={() => removePaymentRow(index)}>Remove</button>
							</div>
							
							<div class="space-y-1">
								<label for="vfs-fee-supplier-{index}" class="text-[10px] font-bold text-muted-foreground/80 uppercase">Supplier Partner *</label>
								<select id="vfs-fee-supplier-{index}" bind:value={fee.supplier_id} class="w-full px-2.5 py-1.5 text-xs border border-border rounded-md bg-background text-foreground focus:ring-1 focus:ring-primary font-semibold">
									<option value={undefined}>-- Select VFS Supplier --</option>
									{#each filteredSuppliers as supp}
										<option value={supp.id}>{supp.name} {supp.code ? `(${supp.code})` : ''}</option>
									{/each}
								</select>
							</div>

							<div class="space-y-1">
								<label for="vfs-fee-amount-{index}" class="text-[10px] font-bold text-muted-foreground/80 uppercase">Amount (BHD) *</label>
								<input id="vfs-fee-amount-{index}" type="number" step="0.001" bind:value={fee.amount} class="w-full px-2.5 py-1.5 text-xs border border-border rounded-md bg-background text-foreground focus:ring-1 focus:ring-primary" />
							</div>
							
							<div class="space-y-1">
								<label class="text-[10px] font-bold text-muted-foreground/80 uppercase">Description</label>
								<input type="text" bind:value={fee.govt_fee_description} class="w-full px-2.5 py-1.5 text-xs border border-border rounded-md bg-background text-foreground focus:ring-1 focus:ring-primary" placeholder="SMS alerts, courier, etc." />
							</div>

							<div class="space-y-1">
								<label class="text-[10px] font-bold text-muted-foreground/80 uppercase">Payment Slip Proof</label>
								<input type="file" onchange={(e) => {
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
						Submit &amp; Mark Under Review
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 2. Edit VFS Ref Modal -->
{#if showEditRefModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" role="dialog" aria-modal="true">
		<div class="bg-background border border-border w-full max-w-md rounded-xl shadow-lg flex flex-col">
			<div class="flex items-center justify-between px-5 py-4 border-b border-border">
				<h2 class="text-base font-bold text-foreground">Edit VFS Reference ID</h2>
				<button class="text-muted-foreground hover:text-foreground text-lg cursor-pointer" onclick={() => (showEditRefModal = false)}>&times;</button>
			</div>
			
			<div class="p-5 space-y-4">
				{#if actionError}
					<div class="p-3 text-xs rounded bg-destructive/10 text-destructive border border-destructive/20 font-medium" role="alert">{actionError}</div>
				{/if}
				
				<div class="space-y-1.5">
					<label for="edit-vfs-ref-input" class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">VFS Reference ID *</label>
					<input id="edit-vfs-ref-input" type="text" bind:value={vfsAppId} class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary" />
				</div>
			</div>
			
			<div class="flex justify-end gap-2 px-5 py-3 border-t border-border bg-muted/15 rounded-b-xl">
				<button class="px-4 py-2 text-xs font-semibold border border-border bg-background hover:bg-muted text-foreground rounded-lg transition-colors" onclick={() => (showEditRefModal = false)} disabled={isSubmitting}>Cancel</button>
				<button class="px-4 py-2 text-xs font-bold text-primary-foreground bg-primary hover:opacity-90 rounded-lg transition-opacity flex items-center gap-1.5" onclick={submitVfsRef} disabled={isSubmitting}>
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

<!-- 3. Reschedule Schedule Modal -->
{#if showScheduleModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" role="dialog" aria-modal="true">
		<div class="bg-background border border-border w-full max-w-md rounded-xl shadow-lg flex flex-col">
			<div class="flex items-center justify-between px-5 py-4 border-b border-border">
				<h2 class="text-base font-bold text-foreground">Update VFS Schedule Details</h2>
				<button class="text-muted-foreground hover:text-foreground text-lg cursor-pointer" onclick={() => (showScheduleModal = false)}>&times;</button>
			</div>
			
			<div class="p-5 space-y-4">
				{#if actionError}
					<div class="p-3 text-xs rounded bg-destructive/10 text-destructive border border-destructive/20 font-medium" role="alert">{actionError}</div>
				{/if}
				
				<div class="space-y-1.5">
					<label for="appt-date-input" class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Appointment Date *</label>
					<input id="appt-date-input" type="date" bind:value={appointmentDate} class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-hidden focus:ring-2" />
				</div>

				<div class="space-y-1.5">
					<label for="appt-time-input" class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Appointment Time *</label>
					<input id="appt-time-input" type="time" bind:value={appointmentTime} class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-hidden focus:ring-2" />
				</div>
				
				<div class="space-y-1.5">
					<label for="schedule-notes-input" class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Instructions &amp; Schedule Notes</label>
					<textarea id="schedule-notes-input" bind:value={scheduleDescription} class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-hidden focus:ring-2" rows="3" placeholder="Add directives for the candidate..."></textarea>
				</div>
			</div>
			
			<div class="flex justify-end gap-2 px-5 py-3 border-t border-border bg-muted/15 rounded-b-xl">
				<button class="px-4 py-2 text-xs font-semibold border border-border bg-background hover:bg-muted text-foreground rounded-lg transition-colors" onclick={() => (showScheduleModal = false)} disabled={isSubmitting}>Cancel</button>
				<button class="px-4 py-2 text-xs font-bold text-primary-foreground bg-primary hover:opacity-90 rounded-lg transition-opacity flex items-center gap-1.5" onclick={submitSchedule} disabled={isSubmitting}>
					{#if isSubmitting}
						<svg class="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
						Saving...
					{:else}
						Update Schedule
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 4. Complete Modal -->
{#if showCompleteModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" role="dialog" aria-modal="true">
		<div class="bg-background border border-border w-full max-w-md rounded-xl shadow-lg flex flex-col">
			<div class="flex items-center justify-between px-5 py-4 border-b border-border">
				<h2 class="text-base font-bold text-foreground">Complete VFS Appointment</h2>
				<button class="text-muted-foreground hover:text-foreground text-lg cursor-pointer" onclick={() => (showCompleteModal = false)}>&times;</button>
			</div>
			
			<div class="p-5 space-y-4">
				{#if actionError}
					<div class="p-3 text-xs rounded bg-destructive/10 text-destructive border border-destructive/20 font-medium" role="alert">{actionError}</div>
				{/if}
				
				<div class="space-y-1.5">
					<label for="vfs-letter-upload" class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Upload Final VFS Appointment Letter *</label>
					<input id="vfs-letter-upload" type="file" onchange={(e) => {
						const file = e.currentTarget.files?.[0];
						if (file) vfsDocFile = file;
					}} class="w-full text-xs text-muted-foreground file:mr-2.5 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary file:cursor-pointer" />
				</div>

				<div class="space-y-1.5">
					<label for="vfs-receipt-upload" class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Upload Verified VFS Payment Receipt *</label>
					<input id="vfs-receipt-upload" type="file" onchange={(e) => {
						const file = e.currentTarget.files?.[0];
						if (file) verifiedReceiptFile = file;
					}} class="w-full text-xs text-muted-foreground file:mr-2.5 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary file:cursor-pointer" />
				</div>
			</div>
			
			<div class="flex justify-end gap-2 px-5 py-3 border-t border-border bg-muted/15 rounded-b-xl">
				<button class="px-4 py-2 text-xs font-semibold border border-border bg-background hover:bg-muted text-foreground rounded-lg transition-colors" onclick={() => (showCompleteModal = false)} disabled={isSubmitting}>Cancel</button>
				<button class="px-4 py-2 text-xs font-bold text-white bg-success hover:opacity-95 rounded-lg transition-opacity flex items-center gap-1.5" onclick={() => submitStatus('completed')} disabled={isSubmitting}>
					{#if isSubmitting}
						<svg class="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
						Completing...
					{:else}
						Mark Completed
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 5. Cancel Modal -->
{#if showCancelModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" role="dialog" aria-modal="true">
		<div class="bg-background border border-border w-full max-w-md rounded-xl shadow-lg flex flex-col">
			<div class="flex items-center justify-between px-5 py-4 border-b border-border">
				<h2 class="text-base font-bold text-foreground">Cancel VFS Appointment</h2>
				<button class="text-muted-foreground hover:text-foreground text-lg cursor-pointer" onclick={() => (showCancelModal = false)}>&times;</button>
			</div>
			
			<div class="p-5 space-y-4">
				{#if actionError}
					<div class="p-3 text-xs rounded bg-destructive/10 text-destructive border border-destructive/20 font-medium" role="alert">{actionError}</div>
				{/if}
				
				<p class="text-xs text-muted-foreground leading-relaxed">Are you sure you want to mark this VFS appointment application as cancelled? Please upload the cancellation slip below to confirm.</p>
				
				<div class="space-y-1.5">
					<label for="rejection-slip-upload" class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Cancellation Slip / Rejection Proof (Optional)</label>
					<input id="rejection-slip-upload" type="file" onchange={(e) => {
						const file = e.currentTarget.files?.[0];
						if (file) rejectedReceiptFile = file;
					}} class="w-full text-xs text-muted-foreground file:mr-2.5 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary file:cursor-pointer" />
				</div>
			</div>
			
			<div class="flex justify-end gap-2 px-5 py-3 border-t border-border bg-muted/15 rounded-b-xl">
				<button class="px-4 py-2 text-xs font-semibold border border-border bg-background hover:bg-muted text-foreground rounded-lg transition-colors" onclick={() => (showCancelModal = false)} disabled={isSubmitting}>Cancel</button>
				<button class="px-4 py-2 text-xs font-bold text-white bg-destructive hover:opacity-95 rounded-lg transition-opacity flex items-center gap-1.5" onclick={() => submitStatus('cancelled')} disabled={isSubmitting}>
					{#if isSubmitting}
						<svg class="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
						Cancelling...
					{:else}
						Confirm Cancellation
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 6. Upload / Replace VFS Document Modal -->
{#if showUploadDocModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" role="dialog" aria-modal="true">
		<div class="bg-background border border-border w-full max-w-md rounded-xl shadow-lg flex flex-col">
			<div class="flex items-center justify-between px-5 py-4 border-b border-border">
				<h2 class="text-base font-bold text-foreground">Upload VFS Document</h2>
				<button class="text-muted-foreground hover:text-foreground text-lg cursor-pointer" onclick={() => (showUploadDocModal = false)} aria-label="Close modal">&times;</button>
			</div>
			
			<div class="p-5 space-y-4">
				{#if actionError}
					<div class="p-3 text-xs rounded bg-destructive/10 text-destructive border border-destructive/20 font-medium" role="alert">{actionError}</div>
				{/if}
				
				<p class="text-xs text-muted-foreground leading-relaxed">
					Attach the official VFS appointment document letter or payment receipt slip for candidate <strong class="text-foreground">{data?.prefix} {data?.name}</strong>.
				</p>

				<div class="space-y-1.5">
					<label for="upload-vfs-doc-input" class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">VFS Appointment Letter (PDF/Image)</label>
					<input id="upload-vfs-doc-input" type="file" onchange={(e) => {
						const file = e.currentTarget.files?.[0];
						if (file) vfsDocFile = file;
					}} class="w-full text-xs text-muted-foreground file:mr-2.5 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary file:cursor-pointer" />
				</div>

				<div class="space-y-1.5">
					<label for="upload-vfs-receipt-input" class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">VFS Payment Receipt (PDF/Image)</label>
					<input id="upload-vfs-receipt-input" type="file" onchange={(e) => {
						const file = e.currentTarget.files?.[0];
						if (file) verifiedReceiptFile = file;
					}} class="w-full text-xs text-muted-foreground file:mr-2.5 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary file:cursor-pointer" />
				</div>
			</div>
			
			<div class="flex justify-end gap-2 px-5 py-3 border-t border-border bg-muted/15 rounded-b-xl">
				<button class="px-4 py-2 text-xs font-semibold border border-border bg-background hover:bg-muted text-foreground rounded-lg transition-colors" onclick={() => (showUploadDocModal = false)} disabled={isSubmitting}>Cancel</button>
				<button class="px-4 py-2 text-xs font-bold text-white bg-primary hover:opacity-90 rounded-lg transition-opacity flex items-center gap-1.5" onclick={submitUploadDoc} disabled={isSubmitting}>
					{#if isSubmitting}
						<svg class="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
						Uploading...
					{:else}
						Save Document
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Dedicated Add Supplier Payment Modal for VFS -->
{#if showAddPaymentModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" role="dialog" aria-modal="true">
		<div class="bg-background border border-border w-full max-w-md rounded-xl shadow-lg flex flex-col overflow-hidden">
			<div class="flex items-center justify-between px-5 py-4 border-b border-border">
				<h2 class="text-base font-bold text-foreground">Add Supplier Payment</h2>
				<button class="text-muted-foreground hover:text-foreground text-lg cursor-pointer" onclick={() => (showAddPaymentModal = false)} aria-label="Close modal">&times;</button>
			</div>

			<form onsubmit={submitAddPayment} class="p-5 space-y-4 text-xs">
				{#if addPayError}
					<div class="p-3 rounded-lg bg-destructive/10 text-destructive text-xs font-medium border border-destructive/20">
						{addPayError}
					</div>
				{/if}

				<div class="space-y-1.5">
					<label for="addPaySupplierVfs" class="block font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
						Supplier Partner <span class="text-destructive">*</span>
					</label>
					<select
						id="addPaySupplierVfs"
						bind:value={addPaySupplierId}
						class="w-full h-9 bg-background border border-border rounded-lg px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground font-semibold"
						required
					>
						{#each filteredSuppliers as sup}
							<option value={sup.id}>{sup.name} {sup.code ? `(${sup.code})` : ''}</option>
						{/each}
					</select>
				</div>

				<div class="space-y-1.5">
					<label for="addPayAmountVfs" class="block font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
						Amount (BHD) <span class="text-destructive">*</span>
					</label>
					<input
						type="number"
						id="addPayAmountVfs"
						step="0.001"
						min="0.001"
						bind:value={addPayAmount}
						placeholder="0.000"
						class="w-full h-9 bg-background border border-border rounded-lg px-3 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
						required
					/>
				</div>

				<div class="space-y-1.5">
					<label for="addPayDescVfs" class="block font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
						Description / Note
					</label>
					<input
						type="text"
						id="addPayDescVfs"
						bind:value={addPayDescription}
						placeholder="e.g. SECOND PAYMENT, Final Fee..."
						class="w-full h-9 bg-background border border-border rounded-lg px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
					/>
				</div>

				<div class="space-y-1.5">
					<label for="addPayTxnVfs" class="block font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
						Transaction / Reference No
					</label>
					<input
						type="text"
						id="addPayTxnVfs"
						bind:value={addPayTxnNo}
						placeholder="Payment reference (optional)"
						class="w-full h-9 bg-background border border-border rounded-lg px-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
					/>
				</div>

				<div class="space-y-1.5">
					<label for="addPayProofVfs" class="block font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
						Payment Proof Slip
					</label>
					<input
						type="file"
						id="addPayProofVfs"
						accept="image/*,.pdf"
						onchange={(e) => {
							const files = (e.target as HTMLInputElement).files;
							addPayProofFile = files && files.length > 0 ? files[0] : null;
						}}
						class="w-full text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
					/>
				</div>

				<div class="flex items-center justify-end gap-3 pt-3 border-t border-border">
					<button
						type="button"
						class="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors cursor-pointer"
						onclick={() => (showAddPaymentModal = false)}
						disabled={isSubmitting}
					>
						Cancel
					</button>
					<button
						type="submit"
						class="px-5 py-2 text-xs font-bold text-white bg-primary hover:opacity-90 rounded-lg transition-opacity cursor-pointer flex items-center gap-1.5"
						disabled={isSubmitting}
					>
						{#if isSubmitting}
							<svg class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25"/><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" class="opacity-75"/></svg>
						{/if}
						Submit Payment Request
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

