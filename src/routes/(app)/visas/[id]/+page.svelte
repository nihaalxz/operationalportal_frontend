<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { apiFetch } from '$lib/api/api-client';
	import { NotFoundError, NetworkError, DownstreamUnavailableError, TimeoutError } from '$lib/api/problem-details';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import LifecycleStepper, { type StepperStep } from '$lib/components/LifecycleStepper.svelte';
	import type { VisaApplicationDetailResponse } from '$lib/types/api';
	import { getFileUrl } from '$lib/utils/status';
	import { printInvoice } from '$lib/utils/print-invoice';
	import { formatDate, formatDateTime, formatAmount, downloadFile } from '$lib/utils';
	import { ACCOUNTS_PORTAL_API_URL, SALES_PORTAL_API_URL } from '$lib/config';

	let data = $state<VisaApplicationDetailResponse | null>(null);
	let isLoading = $state(true);
	let errorMessage = $state('');
	let isNotFound = $state(false);

	const visaId = $derived($page.params.id);
	const salesReturnAmt = $derived((data as any)?.salesReturnAmount || 0);
	const netSelling = $derived(Math.max(0, (data?.payableAmount || 0) - salesReturnAmt));

	// Modals State
	let showProcessModal = $state(false);
	let showEditRefModal = $state(false);
	let showApproveModal = $state(false);
	let showRejectModal = $state(false);
	let showRequestDocModal = $state(false);
	let showUploadDocModal = $state(false);
	let showEditPayableModal = $state(false);
	let showCloseModal = $state(false);
	let isClosing = $state(false);
	let closeError = $state('');
	let editPayableAmountVal = $state(0);
	let editPayableError = $state('');
	let docRequestNote = $state('');

	// Edit Applicant Details Modal State
	let showEditApplicantModal = $state(false);
	let editingApplicant = $state<any>(null);
	let editApplicantForm = $state({
		id: 0,
		prefix: 'Mr.',
		fName: '',
		lName: '',
		dob: '',
		nationality: '',
		passportNo: '',
		contactNo: '',
		emailId: '',
		passportCopy: ''
	});
	let editApplicantError = $state('');
	let isSavingApplicant = $state(false);

	function openEditApplicantModal(applicant: any) {
		editingApplicant = applicant;
		editApplicantForm = {
			id: applicant.id,
			prefix: applicant.prefix || 'Mr.',
			fName: applicant.fName || '',
			lName: applicant.lName || '',
			dob: applicant.dob ? applicant.dob.split('T')[0] : '',
			nationality: applicant.nationality || '',
			passportNo: applicant.passportNo || '',
			contactNo: applicant.contactNo || '',
			emailId: applicant.emailId || '',
			passportCopy: applicant.passportCopy || ''
		};
		editApplicantError = '';
		showEditApplicantModal = true;
	}

	async function submitEditApplicant(e: Event) {
		e.preventDefault();
		if (!editApplicantForm.id) return;
		isSavingApplicant = true;
		editApplicantError = '';
		try {
			await apiFetch(`/api/visas/applicants/${editApplicantForm.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					prefix: editApplicantForm.prefix || null,
					fName: editApplicantForm.fName?.trim() || null,
					lName: editApplicantForm.lName?.trim() || null,
					dob: editApplicantForm.dob ? new Date(editApplicantForm.dob).toISOString() : null,
					nationality: editApplicantForm.nationality?.trim() || null,
					passportNo: editApplicantForm.passportNo?.trim() || null,
					contactNo: editApplicantForm.contactNo?.trim() || null,
					emailId: editApplicantForm.emailId?.trim() || null
				})
			});
			showEditApplicantModal = false;
			await load();
		} catch (err: any) {
			editApplicantError = err.message || 'Failed to update applicant details.';
		} finally {
			isSavingApplicant = false;
		}
	}

	// Dedicated Add Payment Modal State
	let showAddPaymentModal = $state(false);
	let addPaySupplierId = $state<number | undefined>(undefined);
	let addPayAmount = $state(0);
	let addPayDescription = $state('');
	let addPayTxnNo = $state('');
	let addPayProofFile = $state<File | null>(null);
	let addPayError = $state('');

	// Form parameters
	let govApplicationNo = $state('');
	let suppliers = $state<Array<{ id: number; name: string; code?: string; categories?: string[] }>>([]);
	const filteredSuppliers = $derived.by(() => {
		if (suppliers.length === 0) return [];
		const matches = suppliers.filter((s) => {
			if (!s.categories || s.categories.length === 0) return true;
			return s.categories.some((c) => {
				const lower = c.toLowerCase();
				return (
					lower.includes('visa') ||
					lower.includes('vfs') ||
					lower.includes('translation') ||
					lower.includes('other') ||
					lower.includes('general') ||
					lower.includes('supplier')
				);
			});
		});
		const list = matches.length > 0 ? matches : suppliers;
		return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
	});

	let govtFees = $state<Array<{ row_key?: string; supplier_id?: number; amount: number; transaction_no: string; govt_fee_description: string; payment_proof?: File; existing_payment_proof?: string }>>([
		{ row_key: undefined, supplier_id: undefined, amount: 0, transaction_no: '', govt_fee_description: '' }
	]);
	
	$effect(() => {
		if (data?.supplierId && govtFees.length > 0 && !govtFees[0].supplier_id) {
			govtFees[0].supplier_id = data.supplierId;
		}
	});
	
	let descNote = $state('');
	let refundNote = $state('');
	let rejectionFee = $state(0);
	let visaPayableAmount = $state(0);
	
	let visaDocumentFile = $state<File | null>(null);
	let rejectionDocumentFile = $state<File | null>(null);

	let isSubmitting = $state(false);
	let actionError = $state('');

	async function handleSavePayableAmount(e: Event) {
		e.preventDefault();
		if (editPayableAmountVal < 0) {
			editPayableError = 'Payable amount cannot be negative.';
			return;
		}
		isSubmitting = true;
		editPayableError = '';
		try {
			await apiFetch(`/api/visas/${visaId}/payable-amount`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ payableAmount: editPayableAmountVal, payable_amount: editPayableAmountVal })
			});
			showEditPayableModal = false;
			await load();
		} catch (err: any) {
			editPayableError = err.message || 'Failed to update payable amount.';
		} finally {
			isSubmitting = false;
		}
	}

	async function load() {
		isLoading = true;
		errorMessage = '';
		isNotFound = false;
		try {
			data = await apiFetch<VisaApplicationDetailResponse>(`/api/visas/${visaId}`);
			if (data) {
				govApplicationNo = data.applicants[0]?.govtFeeReference ?? '';
			}
			try {
				const salesDetails = await apiFetch<any>(`/api/internal/operations/visas/${visaId}`, {
					baseUrl: SALES_PORTAL_API_URL,
					headers: { 'X-OPS-KEY': 'tx_ops_secure_888' }
				});
				if (salesDetails && data) {
					if (salesDetails.operationClosed !== undefined) data.operationClosed = salesDetails.operationClosed;
					if (salesDetails.operation_closed !== undefined) (data as any).operation_closed = salesDetails.operation_closed;
					if (salesDetails.isDealClosed !== undefined) (data as any).isDealClosed = salesDetails.isDealClosed;
				}
			} catch { }
		} catch (err) {
			if (err instanceof NotFoundError) {
				isNotFound = true;
			} else if (err instanceof DownstreamUnavailableError || err instanceof TimeoutError) {
				errorMessage = 'The booking service is temporarily unavailable. Please retry in a moment.';
			} else if (err instanceof NetworkError) {
				errorMessage = 'Unable to load visa details. Please check your connection.';
			} else {
				errorMessage = 'Failed to load visa details. Please retry.';
			}
		} finally {
			isLoading = false;
		}
	}

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

	// Dynamic Payments helpers
	function addPaymentRow() {
		govtFees = [...govtFees, { supplier_id: data?.supplierId || undefined, amount: 0, transaction_no: '', govt_fee_description: '' }];
	}

	function removePaymentRow(index: number) {
		govtFees = govtFees.filter((_, idx) => idx !== index);
	}

	// API workflow calls
	async function submitProcess() {
		const targetGovRef = govApplicationNo || data?.applicants?.[0]?.govtFeeReference || data?.documentNumber || 'N/A';

		for (let i = 0; i < govtFees.length; i++) {
			if (!govtFees[i].supplier_id) {
				actionError = `Please select a Supplier Partner for Payment Log #${i + 1}.`;
				return;
			}
		}

		isSubmitting = true;
		actionError = '';
		try {
			const formData = new FormData();
			formData.append('gov_application_no', targetGovRef);
			
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

			await apiFetch(`/api/visas/${visaId}/process`, {
				method: 'POST',
				body: formData
			});

			showProcessModal = false;
			await load();
		} catch (err: any) {
			const rawDetail = err.detail || err.message || '';
			if (rawDetail.includes('already used') || rawDetail.includes('already exists')) {
				actionError = rawDetail;
			} else if (rawDetail.includes('Failed to update visa processing state') || rawDetail.includes('Failed to update gov reference') || rawDetail.includes('unexpected error') || err.status === 500) {
				actionError = `Government Application / Ref No '${targetGovRef}' is already used by another visa application.`;
			} else {
				actionError = rawDetail || 'Failed to update processing state.';
			}
		} finally {
			isSubmitting = false;
		}
	}

	async function submitEditRef() {
		if (!govApplicationNo) {
			actionError = 'Government Reference is required.';
			return;
		}

		isSubmitting = true;
		actionError = '';
		try {
			await apiFetch(`/api/visas/${visaId}/update-gov-ref`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ gov_application_no: govApplicationNo })
			});

			showEditRefModal = false;
			await load();
		} catch (err: any) {
			const rawDetail = err.detail || err.message || '';
			if (rawDetail.includes('already used') || rawDetail.includes('already exists')) {
				actionError = rawDetail;
			} else if (rawDetail.includes('Failed to update gov reference') || rawDetail.includes('Failed to update visa processing state') || rawDetail.includes('unexpected error') || err.status === 500) {
				actionError = `Government Application / Ref No '${govApplicationNo}' is already used by another visa application.`;
			} else {
				actionError = rawDetail || 'Failed to update reference.';
			}
		} finally {
			isSubmitting = false;
		}
	}

	async function submitApprove() {
		isSubmitting = true;
		actionError = '';
		try {
			const formData = new FormData();
			if (visaDocumentFile) formData.append('visa_document', visaDocumentFile);
			if (descNote) formData.append('desc_note', descNote);

			await apiFetch(`/api/visas/${visaId}/approve`, {
				method: 'POST',
				body: formData
			});

			showApproveModal = false;
			await load();
		} catch (err: any) {
			actionError = err.message || 'Failed to approve application.';
		} finally {
			isSubmitting = false;
		}
	}

	async function submitUploadDoc() {
		if (!visaDocumentFile) {
			actionError = 'Please select a Visa Document file to upload.';
			return;
		}

		isSubmitting = true;
		actionError = '';
		try {
			const formData = new FormData();
			formData.append('visa_document', visaDocumentFile);

			await apiFetch(`/api/visas/${visaId}/approve`, {
				method: 'POST',
				body: formData
			});

			showUploadDocModal = false;
			await load();
		} catch (err: any) {
			actionError = err.message || 'Failed to upload visa document.';
		} finally {
			isSubmitting = false;
		}
	}

	async function submitReject() {
		isSubmitting = true;
		actionError = '';
		try {
			const formData = new FormData();
			if (rejectionDocumentFile) {
				formData.append('rejection_document', rejectionDocumentFile);
				formData.append('rejectionDocument', rejectionDocumentFile);
			}
			const noteText = descNote?.trim() || 'Rejected by operational staff';
			formData.append('desc_note', noteText);
			formData.append('descNote', noteText);
			const feeVal = (rejectionFee ?? 0).toString();
			formData.append('rejection_fee', feeVal);
			formData.append('rejectionFee', feeVal);
			const payVal = (visaPayableAmount ?? 0).toString();
			formData.append('payable_amount', payVal);
			formData.append('payableAmount', payVal);
			if (refundNote?.trim()) {
				formData.append('refund_note', refundNote.trim());
				formData.append('refundNote', refundNote.trim());
			}

			await apiFetch(`/api/visas/${visaId}/reject`, {
				method: 'POST',
				body: formData
			});

			showRejectModal = false;
			await load();
		} catch (err: any) {
			actionError = err.message || 'Failed to reject application.';
		} finally {
			isSubmitting = false;
		}
	}

	async function submitDocUpdateRequest() {
		if (!docRequestNote.trim()) {
			actionError = 'Please enter a note explaining what documents need to be updated.';
			return;
		}

		isSubmitting = true;
		actionError = '';
		try {
			await apiFetch(`/api/visas/${visaId}/request-document-update`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ request_note: docRequestNote })
			});

			showRequestDocModal = false;
			docRequestNote = '';
			await load();
		} catch (err: any) {
			actionError = err.message || 'Failed to send document update request.';
		} finally {
			isSubmitting = false;
		}
	}

	let forceOperationClosed = $state(false);

	async function submitCloseApplication() {
		isClosing = true;
		closeError = '';
		try {
			try {
				await apiFetch(`/api/visas/${visaId}/close`, {
					method: 'POST'
				});
			} catch {
				await apiFetch(`/api/internal/operations/bookings/visa/${visaId}/operation-closed`, {
					baseUrl: SALES_PORTAL_API_URL,
					method: 'POST',
					headers: { 'X-OPS-KEY': 'tx_ops_secure_888' },
					body: JSON.stringify({ operationClosed: true })
				});
			}

			// Set the force flag so UI stays locked even if load() returns stale data
			forceOperationClosed = true;

			showCloseModal = false;
			await load();

			// Ensure data reflects closed state after reload
			if (data) {
				data.operationClosed = true;
				(data as any).operation_closed = true;
			}
		} catch (err: any) {
			closeError = err.message || 'Failed to close application.';
		} finally {
			isClosing = false;
		}
	}

	const isClosed = $derived.by(() => {
		if (forceOperationClosed) return true;
		if (!data) return false;
		return (
			data.operationClosed === true ||
			(data as any).operationClosed === 1 ||
			(data as any).operationClosed === 'true' ||
			(data as any).operation_closed === true ||
			(data as any).operation_closed === 1 ||
			(data as any).operation_closed === 'true' ||
			(data as any).isOperationClosed === true ||
			(data as any).is_operation_closed === true
		);
	});
	const isStep1Done = $derived(data ? ['success', 'paid', 'verified'].includes(data.paymentStatus.toLowerCase()) : false);
	const isDocUpdateRequested = $derived(data ? data.processingStatus.toLowerCase() === 'document_update_requested' : false);
	const isStep2Done = $derived(data ? ['under review', 'processing', 'approved', 'rejected', 'completed', 'closed'].includes(data.processingStatus.toLowerCase()) : false);
	const isStep2Active = $derived(data ? (!isClosed && isStep1Done && (data.processingStatus.toLowerCase() === 'pending' || data.processingStatus.toLowerCase() === 'documents_resubmitted')) : false);
	const isStep3Done = $derived(data ? ['approved', 'rejected', 'completed', 'closed'].includes(data.processingStatus.toLowerCase()) : false);
	const isStep3Active = $derived(data ? (!isClosed && ['under review', 'processing'].includes(data.processingStatus.toLowerCase())) : false);
	const isStep4Done = $derived(data ? ['approved', 'rejected', 'completed', 'closed'].includes(data.processingStatus.toLowerCase()) : false);
	const isRejected = $derived(data ? data.processingStatus.toLowerCase() === 'rejected' : false);

	const actuallyPaidGovtFees = $derived.by(() => {
		if (!data?.govtFees || data.govtFees.length === 0) return 0;
		return data.govtFees
			.filter((f) => {
				const s = (f.status || '').toLowerCase();
				return s === 'verified' || s === 'paid' || !!(f as any).AccountsPaymentId || !!(f as any).accounts_payment_id;
			})
			.reduce((sum, f) => sum + (f.amount || 0), 0);
	});

	const calculatedBalanceAdjustment = $derived(
		Math.max(0, (visaPayableAmount || 0) - actuallyPaidGovtFees - (rejectionFee || 0))
	);

	const editPayableBalanceCredit = $derived.by(() => {
		const currentPayable = data?.payableAmount ?? 0;
		const newPayable = Number(editPayableAmountVal) || 0;
		if (!isStep1Done) return 0;
		return Math.max(0, currentPayable - newPayable);
	});

	const recipientDisplayName = $derived.by(() => {
		if (!data) return 'Head / Agent';
		if (data.clientType?.toLowerCase() === 'agent') {
			return data.agent || `Agent #${data.agentId ?? ''}`;
		}
		return data.headName || 'Customer Head';
	});

	const visaSteps = $derived<StepperStep[]>([
		{
			number: 1,
			label: 'Payment Proof',
			subtitle: isStep1Done ? 'Verified' : 'Pending',
			isDone: isStep1Done
		},
		{
			number: 2,
			label: 'Verify Documents',
			subtitle: isStep2Done ? 'Verified' : (isDocUpdateRequested ? 'Action Required' : isStep2Active ? 'Awaiting Review' : 'Locked'),
			isDone: isStep2Done,
			isActive: isStep2Active || isDocUpdateRequested,
			isRejected: isDocUpdateRequested
		},
		{
			number: 3,
			label: 'Log Processing',
			subtitle: isStep3Done ? 'Govt Logged' : isStep3Active ? 'Awaiting Action' : 'Locked',
			isDone: isStep3Done,
			isActive: isStep3Active
		},
		{
			number: 4,
			label: 'Visa Status',
			subtitle: isStep4Done ? (isRejected ? 'Rejected' : 'Approved') : 'Awaiting',
			isDone: isStep4Done,
			isRejected: isRejected
		}
	]);

	function formatPaymentMethod(val?: string | null) {
		if (!val || val.trim() === '' || val === '—' || val === '-') return 'not filled by staff';
		return val.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
	}

	function isDocFilePath(str?: string | null): boolean {
		if (!str) return false;
		const s = str.trim().toLowerCase();
		return s.startsWith('/uploads/') || s.startsWith('uploads/') || s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:');
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
						entityType: 'Visa',
						entityId: data.id,
						entityDocumentNumber: data.documentNumber
					})
				});
			} catch (e) {
				// Ignore if already claimed by user
			}
			govApplicationNo = data.applicants[0]?.govtFeeReference ?? '';
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
			const targetGovRef = govApplicationNo || data?.applicants?.[0]?.govtFeeReference || data?.documentNumber || 'N/A';
			const formData = new FormData();
			formData.append('is_additive', 'true');
			formData.append('gov_application_no', targetGovRef);

			// Append ONLY the 1 new payment log!
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

			await apiFetch(`/api/visas/${visaId}/process`, {
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
	<title>Visa {data?.documentNumber || visaId} — Texas Operational Portal</title>
</svelte:head>

<div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
	<!-- Breadcrumbs -->
	<nav class="flex items-center space-x-2 text-xs text-muted-foreground">
		<a href="/visas" class="hover:text-primary transition-colors flex items-center gap-1 font-medium">
			<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
			Visa Applications
		</a>
		<span class="text-muted-foreground/50">/</span>
		<span class="font-semibold text-foreground">{data?.documentNumber}</span>
	</nav>

	{#if isLoading}
		<!-- Skeleton Loader -->
		<div class="space-y-6" aria-busy="true" aria-label="Loading visa details">
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
			<h2 class="text-xl font-bold text-foreground">Visa Application Not Found</h2>
			<p class="text-sm text-muted-foreground max-w-sm">Visa application #{visaId} could not be found. It may have been removed or the ID is incorrect.</p>
			<a href="/visas" class="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-primary-foreground bg-primary rounded-lg hover:opacity-90 transition-opacity">Back to Visas List</a>
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
					<h1 class="text-2xl font-bold tracking-tight text-foreground">Visa Application</h1>
					<span class="font-mono text-base font-bold text-muted-foreground/80 bg-muted/50 px-2.5 py-0.5 rounded-md border border-border">{data.documentNumber}</span>
				</div>
				<p class="text-xs font-medium text-muted-foreground flex items-center gap-2">
					<span class="text-foreground font-semibold">{data.headName ?? 'Unknown Customer'}</span>
					<span class="text-muted-foreground/40">&middot;</span>
					<span class="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border uppercase font-bold tracking-wider">{data.clientType}</span>
				</p>
			</div>
			<div class="flex flex-wrap items-center gap-2.5">
				{#if isClosed}
					<span class="inline-flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-lg font-bold bg-slate-900 text-white dark:bg-slate-800 dark:text-white border border-slate-700 shadow-xs uppercase tracking-wide">
						<svg class="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
						<span>Closed &amp; Locked</span>
					</span>
				{:else if isStep1Done}
					<button
						type="button"
						class="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg transition-all shadow-xs cursor-pointer"
						onclick={() => { closeError = ''; showCloseModal = true; }}
						title="Close this application and lock all operational workflows"
					>
						<svg class="w-4 h-4 text-slate-700 dark:text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
						<span>Close Application</span>
					</button>
				{/if}
				<StatusBadge status={data.processingStatus} />
				{#if data.processingStatus?.toLowerCase() === 'approved' && !data.visaDocument}
					<span class="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-md font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 uppercase tracking-wider" title="Approved without visa document attached">
						<svg class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
						Document Pending
					</span>
				{/if}
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
					<h2 class="text-lg font-bold text-foreground">Application Details &amp; Actions Locked</h2>
					<p class="text-xs text-muted-foreground leading-relaxed">
						All information, documents, and operational controls for this application are locked. Details will be unlocked once the payment status is verified and updated to <span class="font-semibold text-success">Success</span> by the Accounts Department.
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
			<LifecycleStepper title="Application Lifecycle" status={data.processingStatus} steps={visaSteps} />

			<!-- WORKFLOW OPERATIONS CONTROL BANNER -->
			<div class="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-xs">
				{#if isClosed}
					<!-- Closed & Locked Banner -->
					<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-slate-500/10 border border-slate-500/25 rounded-xl">
						<div class="flex items-center gap-3.5">
							<div class="p-3 bg-slate-500/20 text-slate-700 dark:text-slate-300 rounded-xl shrink-0 border border-slate-500/30">
								<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
							</div>
							<div class="space-y-1">
								<div class="flex items-center gap-2">
									<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-600 text-white">Closed</span>
									<p class="text-sm font-bold text-foreground">Application Closed &amp; Operationally Locked</p>
								</div>
								<p class="text-xs text-muted-foreground leading-relaxed">
									This visa application has been finalized and closed. All operational workflows, fee additions, document modifications, and amount updates are locked and disabled.
								</p>
							</div>
						</div>
						<div class="shrink-0">
							<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground bg-muted border border-border">
								<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
								Read-Only Mode
							</span>
						</div>
					</div>
				{:else if ['pending', 'documents_resubmitted'].includes(data.processingStatus.toLowerCase())}
					<!-- Verify Documents Stage -->
					<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-primary/5 border border-primary/15 rounded-xl">
						<div class="space-y-1">
							<div class="flex items-center gap-2">
								<span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
								<p class="text-sm font-semibold text-primary">Stage 2: Verify Applicant Documents</p>
							</div>
							<p class="text-xs text-muted-foreground leading-relaxed">
								Payment verified. Inspect applicant documents below (Passport, Iqama/Hotel, Bank docs). If valid, click <strong>Proceed to Log Processing</strong>. If any document is missing or invalid, click <strong>Request Document Update</strong>.
							</p>
						</div>
						<div class="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto">
							<button class="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-all shadow-xs cursor-pointer" onclick={() => { actionError = ''; docRequestNote = ''; showRequestDocModal = true; }}>
								Request Document Update
							</button>
							<button class="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-primary-foreground bg-primary hover:opacity-90 rounded-lg transition-all shadow-xs cursor-pointer" onclick={triggerProcessModal}>
								Proceed to Log Processing
							</button>
						</div>
					</div>
				{:else if data.processingStatus.toLowerCase() === 'document_update_requested'}
					<!-- Document Update Requested Warning Banner -->
					<div class="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
						<div class="flex items-center gap-2">
							<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-white">Action Required</span>
							<p class="text-sm font-bold text-amber-800 dark:text-amber-300">Document Update Requested from Salesman</p>
						</div>
						<p class="text-xs text-muted-foreground">
							<strong>Request Note:</strong> {(data as any).documentRequestNote || 'No specific note provided.'}
						</p>
						<p class="text-[10px] text-muted-foreground font-medium">
							Awaiting the salesman to re-upload updated documents in the Sales Portal.
						</p>
					</div>
				{:else if ['under review', 'processing'].includes(data.processingStatus.toLowerCase())}
					<!-- Active Operations Panel -->
					<div class="space-y-4">
						<div class="flex justify-between items-center border-b border-border pb-3">
							<h3 class="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
								<span class="w-2 h-2 rounded-full bg-processing animate-pulse"></span>
								Operations Control Center
							</h3>
							<span class="text-xs font-mono bg-muted border border-border px-2.5 py-1 rounded-md font-semibold text-muted-foreground">Gov ID: {data.applicants[0]?.govtFeeReference ?? '—'}</span>
						</div>
						
						<div class="flex flex-wrap items-center gap-3">
							<button class="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-success hover:opacity-95 rounded-lg transition-all shadow-xs cursor-pointer" onclick={() => { actionError = ''; descNote = ''; visaDocumentFile = null; showApproveModal = true; }}>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
								Approve Visa
							</button>
							<button class="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-destructive hover:opacity-95 rounded-lg transition-all shadow-xs cursor-pointer" onclick={() => { actionError = ''; descNote = ''; refundNote = ''; rejectionFee = 0; visaPayableAmount = data?.payableAmount ?? 0; rejectionDocumentFile = null; showRejectModal = true; }}>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
								Reject Visa
							</button>
							<button class="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-foreground bg-secondary hover:bg-muted border border-border rounded-lg transition-all cursor-pointer" onclick={() => { actionError = ''; triggerProcessModal(); }}>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
								Manage Payments
							</button>
							<button class="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-foreground bg-secondary hover:bg-muted border border-border rounded-lg transition-all cursor-pointer" onclick={() => { actionError = ''; govApplicationNo = data?.applicants[0]?.govtFeeReference ?? ''; showEditRefModal = true; }}>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
								Edit Gov Ref
							</button>
						</div>
					</div>
				{:else if data.processingStatus.toLowerCase() === 'approved'}
					{#if !data.visaDocument}
						<!-- Approved but Document Missing Alert Banner -->
						<div class="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-4 bg-amber-500/10 border border-amber-500/25 rounded-xl">
							<div class="space-y-1">
								<div class="flex items-center gap-2">
									<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-white">Document Missing</span>
									<p class="text-sm font-bold text-amber-800 dark:text-amber-300">Visa Approved — Visa Document Pending</p>
								</div>
								<p class="text-xs text-muted-foreground leading-relaxed">
									This application has been approved, but no official visa document file was uploaded. You can upload the issued copy or pay/manage government fees now.
								</p>
							</div>
							<div class="flex flex-wrap items-center gap-2.5 shrink-0">
								<button class="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-foreground bg-background hover:bg-muted border border-border rounded-lg transition-all cursor-pointer shrink-0 shadow-2xs" onclick={triggerProcessModal}>
									<svg class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
									<span>Pay / Manage Govt Fees</span>
								</button>
								<button class="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-foreground bg-background hover:bg-muted border border-border rounded-lg transition-all cursor-pointer shrink-0 shadow-2xs" onclick={() => { editPayableError = ''; editPayableAmountVal = data?.payableAmount ?? 0; showEditPayableModal = true; }}>
									<svg class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
									<span>Edit Payable Amount</span>
								</button>
								<button class="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-primary hover:opacity-90 rounded-lg transition-all shadow-xs cursor-pointer shrink-0" onclick={() => { actionError = ''; visaDocumentFile = null; showUploadDocModal = true; }}>
									<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
									<span>Upload Visa Document</span>
								</button>
							</div>
						</div>
					{:else}
						<!-- Completed Success message -->
						<div class="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-4 bg-success/5 border border-success/15 rounded-xl">
							<div class="flex items-center gap-3 text-success">
								<svg class="w-5 h-5 text-success shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
								<span class="text-xs font-semibold">Visa application has been finalized: {data.processingStatus.toUpperCase()}</span>
							</div>
							<div class="flex flex-wrap items-center gap-2.5 shrink-0">
								<button class="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-foreground bg-background hover:bg-muted border border-border rounded-lg transition-all cursor-pointer shrink-0 shadow-2xs" onclick={triggerProcessModal}>
									<svg class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
									<span>Pay / Manage Govt Fees</span>
								</button>
								<button class="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-foreground bg-background hover:bg-muted border border-border rounded-lg transition-all cursor-pointer shrink-0 shadow-2xs" onclick={() => { editPayableError = ''; editPayableAmountVal = data?.payableAmount ?? 0; showEditPayableModal = true; }}>
									<svg class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
									<span>Edit Payable Amount</span>
								</button>
								<button class="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg transition-all cursor-pointer shrink-0" onclick={() => { actionError = ''; visaDocumentFile = null; showUploadDocModal = true; }}>
									<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
									<span>Update / Replace Document</span>
								</button>
							</div>
						</div>
					{/if}
				{:else}
					<!-- Other Finalized States (e.g. Rejected) -->
					<div class="flex items-center gap-3 p-4 bg-muted/40 border border-border rounded-xl text-foreground" role="alert">
						<span class="text-xs font-semibold">Application Status: {data.processingStatus.toUpperCase()}</span>
					</div>
				{/if}
			</div>

			<!-- THREE COLUMNS GRID -->
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<!-- Left Column: Primary Details & Notes -->
				<div class="lg:col-span-2 space-y-6">
					<!-- Section: Visa Details -->
					<div class="bg-card border border-border rounded-xl p-6 shadow-xs space-y-5">
						<h3 class="text-xs font-bold text-foreground border-b border-border pb-3 uppercase tracking-wider flex items-center gap-2">
							<svg class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
							Application &amp; Customer Details
						</h3>
						
						<dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
							<div class="space-y-1 col-span-1 sm:col-span-2">
								<dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Visa Package Name</dt>
								<dd class="text-sm font-semibold text-foreground">
									{#if data.visaPackName}
										{data.visaPackName}
									{:else}
										<span class="text-xs italic text-muted-foreground/75">Not filled by staff</span>
									{/if}
								</dd>
							</div>
							<div class="space-y-1">
								<dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Destination Country</dt>
								<dd class="text-sm font-semibold text-foreground">{data.countryName ?? `Country #${data.countryId}`}</dd>
							</div>
							<div class="space-y-1">
								<dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer Head</dt>
								<dd class="text-sm font-semibold text-foreground">
									{#if data.headName}
										{data.headName}
									{:else}
										<span class="text-xs italic text-muted-foreground/75">Not filled by staff</span>
									{/if}
								</dd>
							</div>
							<div class="space-y-1">
								<dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client Type</dt>
								<dd class="text-sm font-semibold text-foreground capitalize">
									{#if data.clientType}
										{data.clientType}
									{:else}
										<span class="text-xs italic text-muted-foreground/75">Not filled by staff</span>
									{/if}
								</dd>
							</div>
							{#if data.supplierName}
								<div class="space-y-1">
									<dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Supplier</dt>
									<dd class="text-sm font-semibold text-foreground truncate">{data.supplierName}</dd>
								</div>
							{/if}
							{#if data.applicants && data.applicants.some(a => a.govtFeeReference || (a as any).visaAppId || (a as any).govt_fee_reference)}
								<div class="space-y-1">
									<dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Govt Visa Tracking ID</dt>
									<dd class="text-sm font-bold font-mono text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-300/60 dark:border-emerald-800/60 inline-block">
										{Array.from(new Set(data.applicants.map(a => a.govtFeeReference || (a as any).visaAppId || (a as any).govt_fee_reference).filter(Boolean))).join(', ')}
									</dd>
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

					<!-- Section: Notes & Documents -->
					{#if data.visaDocument || data.rejectionDocument || data.approvalNote || data.rejectionNote || data.refundNote || data.processingStatus.toLowerCase() === 'approved'}
						<div class="bg-card border border-border rounded-xl p-6 shadow-xs space-y-5">
							<h3 class="text-xs font-bold text-foreground border-b border-border pb-3 uppercase tracking-wider flex items-center gap-2">
								<svg class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
								Decision Documents &amp; Notes
							</h3>
							
							<div class="space-y-4 text-xs">
								{#if data.approvalNote}
									<div class="space-y-1.5">
										<p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Approval Notes</p>
										<div class="p-3 bg-muted/30 border border-border rounded-xl text-xs text-foreground leading-relaxed whitespace-pre-wrap">{data.approvalNote}</div>
									</div>
								{/if}

								{#if data.rejectionNote}
									<div class="space-y-1.5">
										<p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rejection Reasons</p>
										<div class="p-3 bg-destructive/5 border border-destructive/15 rounded-xl text-xs text-destructive leading-relaxed whitespace-pre-wrap">{data.rejectionNote}</div>
									</div>
								{/if}

								{#if data.refundNote}
									<div class="space-y-1.5">
										<p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Accounts Refund Note</p>
										<div class="p-3 bg-muted/40 border border-border rounded-xl text-xs text-foreground leading-relaxed whitespace-pre-wrap">{data.refundNote}</div>
									</div>
								{/if}

								{#if data.visaDocument}
									<div class="flex items-center justify-between p-3.5 bg-muted/30 hover:bg-muted/50 rounded-xl border border-border transition-all">
										<div class="flex items-center gap-3 min-w-0">
											<div class="p-2 bg-success/10 rounded-lg text-success shrink-0">
												<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
											</div>
											<div class="min-w-0">
												<p class="text-xs font-semibold text-foreground truncate">Approved Visa Document</p>
												<p class="text-[10px] text-muted-foreground">Official Issued Copy</p>
											</div>
										</div>
										<div class="flex items-center gap-2 shrink-0">
											<a href={getFileUrl(data?.visaDocument)} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 px-3 py-1.5 rounded-lg transition-colors" title="View Visa Document">
												<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
												<span>View</span>
											</a>
											<button type="button" onclick={() => downloadFile(data?.visaDocument, 'approved_visa_document')} class="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer" title="Download Visa Document">
												<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
												<span>Download</span>
											</button>
											{#if !isClosed}
												<button type="button" onclick={() => { actionError = ''; visaDocumentFile = null; showUploadDocModal = true; }} class="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground bg-muted hover:bg-muted/80 border border-border px-3 py-1.5 rounded-lg transition-colors cursor-pointer" title="Replace Document">
													<span>Replace File</span>
												</button>
											{/if}
										</div>
									</div>
								{:else if data.processingStatus.toLowerCase() === 'approved'}
									<div class="flex items-center justify-between p-3.5 bg-amber-500/10 rounded-xl border border-amber-500/25">
										<div class="flex items-center gap-3 min-w-0">
											<div class="p-2 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-lg shrink-0">
												<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
											</div>
											<div class="min-w-0">
												<p class="text-xs font-bold text-amber-900 dark:text-amber-200">Visa Document Missing</p>
												<p class="text-[10px] text-muted-foreground">Approved without attached file copy</p>
											</div>
										</div>
										{#if !isClosed}
											<button type="button" onclick={() => { actionError = ''; visaDocumentFile = null; showUploadDocModal = true; }} class="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-primary hover:opacity-90 px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0">
												<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
												<span>Upload Document</span>
											</button>
										{/if}
									</div>
								{/if}

								{#if data.rejectionDocument}
									<div class="flex items-center justify-between p-3.5 bg-muted/30 hover:bg-muted/50 rounded-xl border border-border transition-all">
										<div class="flex items-center gap-3 min-w-0">
											<div class="p-2 bg-destructive/10 rounded-lg text-destructive shrink-0">
												<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
											</div>
											<div class="min-w-0">
												<p class="text-xs font-semibold text-foreground truncate">Government Rejection Slip</p>
												<p class="text-[10px] text-muted-foreground">Official Proof</p>
											</div>
										</div>
										<div class="flex items-center gap-2 shrink-0">
											<a href={getFileUrl(data?.rejectionDocument)} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 px-3 py-1.5 rounded-lg transition-colors" title="View Rejection Document">
												<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
												<span>View</span>
											</a>
											<button type="button" onclick={() => downloadFile(data?.rejectionDocument, 'rejection_document')} class="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer" title="Download Rejection Document">
												<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
												<span>Download</span>
											</button>
										</div>
									</div>
								{/if}
							</div>
						</div>
					{/if}

					<!-- Section: Group Applicants -->
					{#if data?.applicants && data.applicants.length > 0}
						<div class="bg-card border border-border rounded-xl p-6 shadow-xs space-y-5">
							<h3 class="text-xs font-bold text-foreground border-b border-border pb-3 uppercase tracking-wider flex items-center gap-2">
								<svg class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
								Group Applicants ({data.applicants.length})
							</h3>
							
							<div class="space-y-6">
								{#each data.applicants as applicant, i}
									<div class="space-y-4 {i > 0 ? 'pt-5 border-t border-border' : ''}">
										<div class="flex items-center justify-between flex-wrap gap-2">
											<div class="flex items-center gap-2">
												<span class="text-sm font-bold text-foreground">
													{#if applicant.fName || applicant.lName}
														{applicant.prefix || ''} {applicant.fName || ''} {applicant.lName || ''}
													{:else}
														<span class="text-amber-600 dark:text-amber-400 italic">Applicant {i + 1} (Details Pending)</span>
													{/if}
												</span>
											</div>
											<div class="flex items-center gap-2">
												{#if !isClosed}
													<button
														type="button"
														class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg transition-colors cursor-pointer"
														onclick={() => openEditApplicantModal(applicant)}
														title="Fill or edit applicant details by viewing passport"
													>
														<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
														<span>Edit Details</span>
													</button>
												{/if}
												<StatusBadge status={applicant.paymentStatus} type="payment" />
											</div>
										</div>
										
										<dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5 text-xs">
											<div class="space-y-1">
												<dt class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Passport No</dt>
												<dd class="font-semibold text-foreground font-mono text-xs">
													{#if applicant.passportNo}
														{applicant.passportNo}
													{:else}
														<span class="italic text-muted-foreground/75 font-sans">Not filled by staff</span>
													{/if}
												</dd>
											</div>
											<div class="space-y-1">
												<dt class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Nationality</dt>
												<dd class="font-semibold text-foreground truncate text-xs">
													{#if applicant.nationality}
														{applicant.nationality}
													{:else}
														<span class="italic text-muted-foreground/75">Not filled by staff</span>
													{/if}
												</dd>
											</div>
											<div class="space-y-1">
												<dt class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Date of Birth</dt>
												<dd class="font-semibold text-foreground text-xs">
													{#if applicant.dob && formatDate(applicant.dob) !== 'Not filled by staff'}
														{formatDate(applicant.dob)}
													{:else}
														<span class="italic text-muted-foreground/75">Not filled by staff</span>
													{/if}
												</dd>
											</div>
											<div class="space-y-1">
												<dt class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Contact No</dt>
												<dd class="font-semibold text-foreground text-xs">
													{#if applicant.contactNo}
														{applicant.contactNo}
													{:else}
														<span class="italic text-muted-foreground/75">Not filled by staff</span>
													{/if}
												</dd>
											</div>
											{#if applicant.iqamaHotelNo}
												<div class="space-y-1.5 col-span-1 sm:col-span-2 pt-1 border-t border-border/40">
													<dt class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Iqama / Hotel No</dt>
													<div class="flex items-center gap-2 flex-wrap">
														<span class="font-semibold text-foreground font-mono bg-muted/40 px-2.5 py-1 rounded-md border border-border/50 text-xs inline-block max-w-full truncate">{applicant.iqamaHotelNo}</span>
														{#if isDocFilePath(applicant.iqamaHotelNo)}
															<a href={getFileUrl(applicant.iqamaHotelNo)} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 px-2.5 py-1 rounded-md transition-colors" title="View Iqama / Hotel No">
																<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
																<span>View</span>
															</a>
															<button type="button" onclick={() => downloadFile(applicant.iqamaHotelNo, applicant.iqamaHotelNo ?? 'iqama_hotel_doc')} class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-2.5 py-1 rounded-md transition-colors cursor-pointer" title="Download Iqama / Hotel No">
																<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
																<span>Download</span>
															</button>
														{/if}
													</div>
												</div>
											{/if}
											{#if applicant.passportCopy || applicant.bankDoc}
												<div class="col-span-1 sm:col-span-2 space-y-2 pt-2 border-t border-border/40">
													<dt class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Applicant Attachments</dt>
													<div class="flex flex-wrap gap-2.5">
														{#if applicant.passportCopy}
															<div class="inline-flex items-center gap-2 p-1.5 px-2 bg-muted/40 border border-border/60 rounded-lg">
																<span class="text-xs font-semibold text-foreground flex items-center gap-1">
																	<svg class="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
																	Passport Copy
																</span>
																<a href={getFileUrl(applicant.passportCopy)} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 px-2 py-0.5 rounded-md transition-colors" title="View Passport Copy">
																	<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
																	<span>View</span>
																</a>
																<button type="button" onclick={() => downloadFile(applicant.passportCopy, `passport_${applicant.passportNo || 'copy'}`)} class="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-2 py-0.5 rounded-md transition-colors cursor-pointer" title="Download Passport Copy">
																	<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
																	<span>Download</span>
																</button>
															</div>
														{/if}
														{#if applicant.bankDoc}
															<div class="inline-flex items-center gap-2 p-1.5 px-2 bg-muted/40 border border-border/60 rounded-lg">
																<span class="text-xs font-semibold text-foreground flex items-center gap-1">
																	<svg class="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M7 15h1m4 0h1m4 0h1m-7 4h1m4 0h1m4 0h1M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
																	Bank Document
																</span>
																<a href={getFileUrl(applicant.bankDoc)} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 px-2 py-0.5 rounded-md transition-colors" title="View Bank Document">
																	<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
																	<span>View</span>
																</a>
																<button type="button" onclick={() => downloadFile(applicant.bankDoc, `bank_doc_${applicant.fName || 'applicant'}`)} class="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-2 py-0.5 rounded-md transition-colors cursor-pointer" title="Download Bank Document">
																	<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
																	<span>Download</span>
																</button>
															</div>
														{/if}
													</div>
												</div>
											{/if}
											<div class="col-span-1 sm:col-span-2 space-y-0.5 pt-2 border-t border-border/40">
												<dt class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Payable Amount</dt>
												<dd class="font-bold text-primary font-mono text-sm">{formatAmount(applicant.payableAmount)}</dd>
											</div>
										</dl>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>

				<!-- Right Column: Financial Summary & Metadata -->
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
								<div class="flex items-center gap-2">
									<dd class="text-base font-bold text-foreground font-mono">{formatAmount(netSelling)}</dd>
									{#if !isClosed}
										<button type="button" class="px-2 py-0.5 text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-md transition-colors cursor-pointer flex items-center gap-1" onclick={() => { editPayableError = ''; editPayableAmountVal = data?.payableAmount ?? 0; showEditPayableModal = true; }}>
											<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
											<span>Edit</span>
										</button>
									{/if}
								</div>
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
							{#if data.rejectionFee > 0}
								<div class="flex justify-between items-center border-b border-border/50 pb-2.5">
									<dt class="text-xs font-semibold text-destructive uppercase tracking-wider">Rejection Fee</dt>
									<dd class="text-sm font-bold text-destructive font-mono">{formatAmount(data.rejectionFee)}</dd>
								</div>
							{/if}
							<div class="flex justify-between items-center pt-1">
								<dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment Method</dt>
								<dd class="text-xs font-semibold text-foreground bg-muted border border-border px-2.5 py-1 rounded-md">
									{formatPaymentMethod(data.paymentMethod || data.paymentMode || data.applicants?.[0]?.paymentMethod)}
								</dd>
							</div>
						</dl>
					</div>

					<!-- Government Fees Log Card -->
					<div class="bg-card border border-border rounded-xl p-6 shadow-xs space-y-4">
						<h3 class="text-xs font-bold text-foreground border-b border-border pb-3 uppercase tracking-wider flex items-center justify-between gap-2">
							<span class="flex items-center gap-2">
								<svg class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 00-2 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
								Government Fees Log ({data.govtFees?.length || 0})
							</span>
							<div class="flex items-center gap-2">
								<span class="font-mono text-primary text-xs font-bold">{formatAmount(totalGovtFeesAmount)}</span>
								{#if !isClosed && (data.processingStatus || '').toLowerCase() !== 'pending'}
									<button type="button" class="px-2.5 py-1 text-[11px] font-bold text-white bg-primary hover:opacity-90 rounded-md transition-opacity cursor-pointer flex items-center gap-1" onclick={triggerAddPaymentModal}>
										+ Add Payment
									</button>
								{/if}
							</div>
						</h3>
						{#if data.govtFees && data.govtFees.length > 0}
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
						{:else}
							<p class="text-xs text-muted-foreground italic">No government fees recorded yet.</p>
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
				<h2 class="text-base font-bold text-foreground">Process Visa Application</h2>
				<button class="text-muted-foreground hover:text-foreground text-lg cursor-pointer" onclick={() => (showProcessModal = false)} aria-label="Close modal">&times;</button>
			</div>
			
			<div class="p-5 overflow-y-auto space-y-4">
				{#if actionError}
					<div class="p-3 text-xs rounded bg-destructive/10 text-destructive border border-destructive/20 font-medium" role="alert">{actionError}</div>
				{/if}
				
				<div class="space-y-1.5">
					<label for="gov-ref-input" class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Government Application / Ref No *</label>
					<input id="gov-ref-input" type="text" bind:value={govApplicationNo} class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Enter government tracking number" />
				</div>
				
				<div class="border-t border-border/80 pt-4 space-y-3">
					<div class="flex justify-between items-center">
						<h3 class="text-xs font-bold text-foreground uppercase tracking-wider">Government Payments Logs</h3>
						<button type="button" class="text-[10px] font-bold text-primary hover:underline" onclick={addPaymentRow}>+ Add Fee Split</button>
					</div>
					
					{#each govtFees as fee, index}
						<div class="p-4 bg-muted/30 border border-border rounded-lg space-y-3 relative">
							<div class="flex justify-between items-center">
								<span class="text-xs font-bold text-muted-foreground">Payment Log #{index + 1}</span>
								<button type="button" class="text-[10px] font-bold text-destructive hover:underline cursor-pointer" onclick={() => removePaymentRow(index)}>Remove</button>
							</div>
							
							<div class="space-y-1">
								<label for="fee-supplier-{index}" class="text-[10px] font-bold text-muted-foreground/80 uppercase">Supplier Partner *</label>
								<select id="fee-supplier-{index}" bind:value={fee.supplier_id} required class="w-full px-2.5 py-1.5 text-xs border border-border rounded-md bg-background text-foreground focus:ring-1 focus:ring-primary font-semibold">
									<option value={undefined}>-- Select Visa Supplier --</option>
									{#each filteredSuppliers as supp}
										<option value={supp.id}>{supp.name} {supp.code ? `(${supp.code})` : ''}</option>
									{/each}
								</select>
							</div>

							<div class="space-y-1">
								<label for="fee-amount-{index}" class="text-[10px] font-bold text-muted-foreground/80 uppercase">Amount (BHD) *</label>
								<input id="fee-amount-{index}" type="number" step="0.001" bind:value={fee.amount} class="w-full px-2.5 py-1.5 text-xs border border-border rounded-md bg-background text-foreground focus:ring-1 focus:ring-primary" />
							</div>
							
							<div class="space-y-1">
								<label for="fee-desc-{index}" class="text-[10px] font-bold text-muted-foreground/80 uppercase">Description</label>
								<input id="fee-desc-{index}" type="text" bind:value={fee.govt_fee_description} class="w-full px-2.5 py-1.5 text-xs border border-border rounded-md bg-background text-foreground focus:ring-1 focus:ring-primary" placeholder="SMS fee, biometrics, etc." />
							</div>

							<div class="space-y-1">
								<label for="fee-proof-{index}" class="text-[10px] font-bold text-muted-foreground/80 uppercase">Payment Proof Slip</label>
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
						Saving...
					{:else}
						Submit &amp; Mark Processing
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
				<h2 class="text-base font-bold text-foreground">Edit Government Reference ID</h2>
				<button class="text-muted-foreground hover:text-foreground text-lg cursor-pointer" onclick={() => (showEditRefModal = false)} aria-label="Close modal">&times;</button>
			</div>
			
			<div class="p-5 space-y-4">
				{#if actionError}
					<div class="p-3 text-xs rounded bg-destructive/10 text-destructive border border-destructive/20 font-medium" role="alert">{actionError}</div>
				{/if}
				
				<div class="space-y-1.5">
					<label for="edit-gov-ref-input" class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Government Application / Ref No *</label>
					<input id="edit-gov-ref-input" type="text" bind:value={govApplicationNo} class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary" />
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

<!-- 3. Approve Modal -->
{#if showApproveModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" role="dialog" aria-modal="true">
		<div class="bg-background border border-border w-full max-w-md rounded-xl shadow-lg flex flex-col">
			<div class="flex items-center justify-between px-5 py-4 border-b border-border">
				<h2 class="text-base font-bold text-foreground">Approve Visa Application</h2>
				<button class="text-muted-foreground hover:text-foreground text-lg cursor-pointer" onclick={() => (showApproveModal = false)} aria-label="Close modal">&times;</button>
			</div>
			
			<div class="p-5 space-y-4">
				{#if actionError}
					<div class="p-3 text-xs rounded bg-destructive/10 text-destructive border border-destructive/20 font-medium" role="alert">{actionError}</div>
				{/if}
				
				<div class="space-y-1.5">
					<label for="visa-doc-upload" class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Upload Visa Document (Optional)</label>
					<input id="visa-doc-upload" type="file" onchange={(e) => {
						const file = e.currentTarget.files?.[0];
						if (file) visaDocumentFile = file;
					}} class="w-full text-xs text-muted-foreground file:mr-2.5 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary file:cursor-pointer" />
				</div>
				
				<div class="space-y-1.5">
					<label for="approval-note-input" class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Approval Note (Optional)</label>
					<textarea id="approval-note-input" bind:value={descNote} class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary" rows="3" placeholder="Enter message to the salesman"></textarea>
				</div>
			</div>
			
			<div class="flex justify-end gap-2 px-5 py-3 border-t border-border bg-muted/15 rounded-b-xl">
				<button class="px-4 py-2 text-xs font-semibold border border-border bg-background hover:bg-muted text-foreground rounded-lg transition-colors" onclick={() => (showApproveModal = false)} disabled={isSubmitting}>Cancel</button>
				<button class="px-4 py-2 text-xs font-bold text-white bg-success hover:opacity-95 rounded-lg transition-opacity flex items-center gap-1.5" onclick={submitApprove} disabled={isSubmitting}>
					{#if isSubmitting}
						<svg class="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
						Approving...
					{:else}
						Confirm Approval
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 4. Reject Modal -->
{#if showRejectModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" role="dialog" aria-modal="true">
		<div class="bg-background border border-border w-full max-w-md rounded-xl shadow-lg flex flex-col max-h-[90vh]">
			<div class="flex items-center justify-between px-5 py-4 border-b border-border">
				<h2 class="text-base font-bold text-foreground">Reject Visa Application</h2>
				<button class="text-muted-foreground hover:text-foreground text-lg cursor-pointer" onclick={() => (showRejectModal = false)} aria-label="Close modal">&times;</button>
			</div>
			
			<div class="p-5 overflow-y-auto space-y-4">
				{#if actionError}
					<div class="p-3 text-xs rounded bg-destructive/10 text-destructive border border-destructive/20 font-medium" role="alert">{actionError}</div>
				{/if}
				
				<div class="space-y-1.5">
					<label for="rejection-doc-upload" class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Upload Rejection Letter (PDF/Image)</label>
					<input id="rejection-doc-upload" type="file" onchange={(e) => {
						const file = e.currentTarget.files?.[0];
						if (file) rejectionDocumentFile = file;
					}} class="w-full text-xs text-muted-foreground file:mr-2.5 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary file:cursor-pointer" />
				</div>

				<div class="space-y-1.5">
					<label for="rejection-fee-input" class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Rejection Fee (BHD)</label>
					<input id="rejection-fee-input" type="number" step="0.001" bind:value={rejectionFee} class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="0" />
				</div>

				<div class="space-y-1.5">
					<label for="visa-payable-amount-input" class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Visa Payable Amount (BHD)</label>
					<input id="visa-payable-amount-input" type="number" step="0.001" bind:value={visaPayableAmount} class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Enter visa payable amount" />
				</div>
				
				<div class="space-y-1.5">
					<label for="rejection-reason-input" class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Rejection Reason</label>
					<textarea id="rejection-reason-input" bind:value={descNote} class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary" rows="3" placeholder="State official rejection reason"></textarea>
				</div>

				<div class="space-y-1.5">
					<label for="refund-note-input" class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Refund Note for Accounts</label>
					<textarea id="refund-note-input" bind:value={refundNote} class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary" rows="2" placeholder="Refund instructions..."></textarea>
				</div>

				<!-- Financial Rejection Preview Card -->
				<div class="p-3.5 bg-card border border-border rounded-xl space-y-2 text-xs">
					<div class="flex items-center justify-between border-b border-border/60 pb-1.5">
						<span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Financial Rejection Preview</span>
						<span class="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-primary/10 text-primary">Head Balance Credit</span>
					</div>
					<div class="space-y-1 text-muted-foreground font-medium">
						<div class="flex justify-between">
							<span>Visa Payable Amount:</span>
							<span class="font-bold text-foreground font-mono">{formatAmount(visaPayableAmount)}</span>
						</div>
						<div class="flex justify-between">
							<span>Government/Supplier Fees Paid:</span>
							<span class="font-bold text-foreground font-mono">{formatAmount(actuallyPaidGovtFees)}</span>
						</div>
						<div class="flex justify-between">
							<span>Rejection Fee (Agency Retained):</span>
							<span class="font-bold text-foreground font-mono">{formatAmount(rejectionFee)}</span>
						</div>
						<div class="border-t border-border/80 pt-1.5 flex justify-between font-bold text-sm text-emerald-600 dark:text-emerald-400">
							<span>Balance Adjustment to Head:</span>
							<span class="font-mono">+{formatAmount(calculatedBalanceAdjustment)}</span>
						</div>
					</div>
				</div>
			</div>
			
			<div class="flex justify-end gap-2 px-5 py-3 border-t border-border bg-muted/15 rounded-b-xl">
				<button class="px-4 py-2 text-xs font-semibold border border-border bg-background hover:bg-muted text-foreground rounded-lg transition-colors" onclick={() => (showRejectModal = false)} disabled={isSubmitting}>Cancel</button>
				<button class="px-4 py-2 text-xs font-bold text-white bg-destructive hover:opacity-95 rounded-lg transition-opacity flex items-center gap-1.5" onclick={submitReject} disabled={isSubmitting}>
					{#if isSubmitting}
						<svg class="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
						Rejecting...
					{:else}
						Confirm Rejection
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 5. Request Document Update Modal -->
{#if showRequestDocModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" role="dialog" aria-modal="true">
		<div class="bg-background border border-border w-full max-w-md rounded-xl shadow-lg flex flex-col">
			<div class="flex items-center justify-between px-5 py-4 border-b border-border">
				<h2 class="text-base font-bold text-foreground">Request Document Update</h2>
				<button class="text-muted-foreground hover:text-foreground text-lg cursor-pointer" onclick={() => (showRequestDocModal = false)} aria-label="Close modal">&times;</button>
			</div>
			
			<div class="p-5 space-y-4">
				{#if actionError}
					<div class="p-3 text-xs rounded bg-destructive/10 text-destructive border border-destructive/20 font-medium" role="alert">{actionError}</div>
				{/if}
				
				<p class="text-xs text-muted-foreground leading-relaxed">
					Specify what documents are unclear, missing, or need correction. This note will be sent to the salesman via email and in-app notification.
				</p>

				<div class="space-y-1.5">
					<label for="doc-request-note-input" class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Request Note / Instructions *</label>
					<textarea id="doc-request-note-input" rows="4" bind:value={docRequestNote} class="w-full px-3 py-2 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500" placeholder="e.g. Passport copy is blurry, please re-upload a clear scan of page 2..."></textarea>
				</div>
			</div>
			
			<div class="flex justify-end gap-2 px-5 py-3 border-t border-border bg-muted/15 rounded-b-xl">
				<button class="px-4 py-2 text-xs font-semibold border border-border bg-background hover:bg-muted text-foreground rounded-lg transition-colors" onclick={() => (showRequestDocModal = false)} disabled={isSubmitting}>Cancel</button>
				<button class="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-opacity flex items-center gap-1.5" onclick={submitDocUpdateRequest} disabled={isSubmitting}>
					{#if isSubmitting}
						<svg class="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
						Sending...
					{:else}
						Send Update Request
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 6. Upload / Replace Visa Document Modal -->
{#if showUploadDocModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" role="dialog" aria-modal="true">
		<div class="bg-background border border-border w-full max-w-md rounded-xl shadow-lg flex flex-col">
			<div class="flex items-center justify-between px-5 py-4 border-b border-border">
				<h2 class="text-base font-bold text-foreground">Upload Visa Document</h2>
				<button class="text-muted-foreground hover:text-foreground text-lg cursor-pointer" onclick={() => (showUploadDocModal = false)} aria-label="Close modal">&times;</button>
			</div>
			
			<div class="p-5 space-y-4">
				{#if actionError}
					<div class="p-3 text-xs rounded bg-destructive/10 text-destructive border border-destructive/20 font-medium" role="alert">{actionError}</div>
				{/if}
				
				<p class="text-xs text-muted-foreground leading-relaxed">
					Attach the official issued visa copy (PDF or Image) for application <strong class="text-foreground">{data?.documentNumber}</strong>.
				</p>

				<div class="space-y-1.5">
					<label for="upload-doc-input" class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Select Visa Document * (PDF/Image)</label>
					<input id="upload-doc-input" type="file" onchange={(e) => {
						const file = e.currentTarget.files?.[0];
						if (file) visaDocumentFile = file;
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

<!-- 7. Edit Payable Amount Modal -->
{#if showEditPayableModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" role="dialog" aria-modal="true">
		<div class="bg-background border border-border w-full max-w-md rounded-xl shadow-lg flex flex-col">
			<div class="flex items-center justify-between px-5 py-4 border-b border-border">
				<h2 class="text-base font-bold text-foreground flex items-center gap-2">
					<svg class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
					<span>Edit Payable Amount</span>
				</h2>
				<button class="text-muted-foreground hover:text-foreground text-lg cursor-pointer" onclick={() => (showEditPayableModal = false)} aria-label="Close modal">&times;</button>
			</div>
			
			<form onsubmit={handleSavePayableAmount} class="p-5 space-y-4">
				{#if editPayableError}
					<div class="p-3 text-xs rounded bg-destructive/10 text-destructive border border-destructive/20 font-medium" role="alert">{editPayableError}</div>
				{/if}
				
				<div class="space-y-1.5">
					<label for="edit-payable-amount-input" class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">New Payable Amount (BHD) *</label>
					<input
						id="edit-payable-amount-input"
						type="number"
						step="0.001"
						min="0"
						bind:value={editPayableAmountVal}
						required
						class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono font-bold"
					/>
				</div>

				<!-- Financial Adjustment Preview Card -->
				<div class="p-3.5 bg-card border border-border rounded-xl space-y-2 text-xs">
					<div class="flex items-center justify-between border-b border-border/60 pb-1.5">
						<span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Financial Adjustment Preview</span>
						<span class="text-[10px] px-2 py-0.5 rounded font-mono font-bold {editPayableBalanceCredit > 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-primary/10 text-primary'}">
							{data?.clientType?.toLowerCase() === 'agent' ? 'Agent Wallet Credit' : 'Head Balance Credit'}
						</span>
					</div>
					<div class="space-y-1.5 text-muted-foreground font-medium">
						<div class="flex justify-between">
							<span>Recipient Account:</span>
							<span class="font-bold text-foreground">{recipientDisplayName} ({data?.clientType?.toUpperCase() ?? 'CUSTOMER'})</span>
						</div>
						<div class="flex justify-between">
							<span>Current Payable Amount:</span>
							<span class="font-bold text-foreground font-mono">{formatAmount(data?.payableAmount ?? 0)}</span>
						</div>
						<div class="flex justify-between">
							<span>New Payable Amount:</span>
							<span class="font-bold text-foreground font-mono">{formatAmount(editPayableAmountVal)}</span>
						</div>
						{#if isStep1Done && editPayableBalanceCredit > 0}
							<div class="border-t border-border/80 pt-1.5 flex justify-between font-bold text-sm text-emerald-600 dark:text-emerald-400">
								<span>Balance Credit to {data?.clientType?.toLowerCase() === 'agent' ? 'Agent' : 'Head'}:</span>
								<span class="font-mono">+{formatAmount(editPayableBalanceCredit)}</span>
							</div>
							<p class="text-[10px] text-muted-foreground mt-1 leading-relaxed">
								Payment is already verified. Reducing the payable amount will automatically credit <strong class="text-emerald-600 dark:text-emerald-400 font-mono">+{formatAmount(editPayableBalanceCredit)}</strong> back to {recipientDisplayName}'s balance.
							</p>
						{:else if !isStep1Done}
							<div class="border-t border-border/80 pt-1.5 flex justify-between font-medium text-xs text-muted-foreground">
								<span>Payment Status:</span>
								<span class="font-bold uppercase text-amber-600 dark:text-amber-400">{data?.paymentStatus ?? 'Pending'}</span>
							</div>
							<p class="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
								Payment is not yet verified. Updating payable amount adjusts invoice total without immediate wallet credit.
							</p>
						{:else}
							<div class="border-t border-border/80 pt-1.5 flex justify-between font-bold text-xs text-muted-foreground">
								<span>Balance Adjustment:</span>
								<span class="font-mono">{formatAmount(0)} BHD</span>
							</div>
						{/if}
					</div>
				</div>

				<div class="flex justify-end gap-2 pt-3 border-t border-border">
					<button type="button" class="px-4 py-2 text-xs font-semibold border border-border bg-background hover:bg-muted text-foreground rounded-lg transition-colors cursor-pointer" onclick={() => (showEditPayableModal = false)} disabled={isSubmitting}>Cancel</button>
					<button type="submit" class="px-4 py-2 text-xs font-bold text-white bg-primary hover:opacity-90 rounded-lg transition-opacity flex items-center gap-1.5 cursor-pointer" disabled={isSubmitting}>
						{#if isSubmitting}
							<svg class="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
							Saving...
						{:else}
							Save Payable Amount
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- 8. Dedicated Add Supplier Payment Modal -->
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
					<label for="addPaySupplier" class="block font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
						Supplier Partner <span class="text-destructive">*</span>
					</label>
					<select
						id="addPaySupplier"
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
					<label for="addPayAmount" class="block font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
						Amount (BHD) <span class="text-destructive">*</span>
					</label>
					<input
						type="number"
						id="addPayAmount"
						step="0.001"
						min="0.001"
						bind:value={addPayAmount}
						placeholder="0.000"
						class="w-full h-9 bg-background border border-border rounded-lg px-3 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
						required
					/>
				</div>

				<div class="space-y-1.5">
					<label for="addPayDesc" class="block font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
						Description / Note
					</label>
					<input
						type="text"
						id="addPayDesc"
						bind:value={addPayDescription}
						placeholder="e.g. SECOND PAYMENT, Final Fee..."
						class="w-full h-9 bg-background border border-border rounded-lg px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
					/>
				</div>

				<div class="space-y-1.5">
					<label for="addPayTxn" class="block font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
						Transaction / Reference No
					</label>
					<input
						type="text"
						id="addPayTxn"
						bind:value={addPayTxnNo}
						placeholder="Payment reference (optional)"
						class="w-full h-9 bg-background border border-border rounded-lg px-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
					/>
				</div>

				<div class="space-y-1.5">
					<label for="addPayProof" class="block font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
						Payment Proof Slip
					</label>
					<input
						type="file"
						id="addPayProof"
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

<!-- 5. Close Application Confirmation Modal -->
{#if showCloseModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" role="dialog" aria-modal="true">
		<div class="bg-background border border-border w-full max-w-md rounded-xl shadow-lg flex flex-col">
			<div class="flex items-center justify-between px-5 py-4 border-b border-border">
				<div class="flex items-center gap-2 text-foreground font-bold">
					<svg class="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
					<h2 class="text-base">Close Visa Application</h2>
				</div>
				<button class="text-muted-foreground hover:text-foreground text-lg cursor-pointer" onclick={() => (showCloseModal = false)} aria-label="Close modal">&times;</button>
			</div>
			
			<div class="p-5 space-y-4">
				{#if closeError}
					<div class="p-3 text-xs rounded bg-destructive/10 text-destructive border border-destructive/20 font-medium" role="alert">{closeError}</div>
				{/if}
				
				<div class="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-lg space-y-1.5 text-xs">
					<p class="font-bold text-amber-800 dark:text-amber-300">Are you sure you want to close this application?</p>
					<p class="text-muted-foreground leading-relaxed">
						Closing this application will mark the operational processing as completed. The entire user interface will be locked and all further edits, fee logs, and document changes will be disabled.
					</p>
				</div>

				<div class="space-y-2 text-xs">
					<div class="flex justify-between py-1 border-b border-border/50">
						<span class="text-muted-foreground">Document Number:</span>
						<span class="font-mono font-bold text-foreground">{data?.documentNumber}</span>
					</div>
					<div class="flex justify-between py-1 border-b border-border/50">
						<span class="text-muted-foreground">Customer:</span>
						<span class="font-semibold text-foreground">{data?.headName || 'N/A'}</span>
					</div>
					<div class="flex justify-between py-1">
						<span class="text-muted-foreground">Current Status:</span>
						<StatusBadge status={data?.processingStatus || 'pending'} />
					</div>
				</div>
			</div>
			
			<div class="flex justify-end gap-2 px-5 py-3 border-t border-border bg-muted/15 rounded-b-xl">
				<button class="px-4 py-2 text-xs font-semibold border border-border bg-background hover:bg-muted text-foreground rounded-lg transition-colors cursor-pointer" onclick={() => (showCloseModal = false)} disabled={isClosing}>Cancel</button>
				<button class="px-4 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-all flex items-center gap-1.5 shadow-xs cursor-pointer" onclick={submitCloseApplication} disabled={isClosing}>
					{#if isClosing}
						<svg class="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
						Closing...
					{:else}
						<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
						Confirm Close Application
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 9. Edit Applicant Details Modal -->
{#if showEditApplicantModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" role="dialog" aria-modal="true">
		<div class="bg-background border border-border w-full max-w-lg rounded-xl shadow-lg flex flex-col overflow-hidden max-h-[90vh]">
			<div class="flex items-center justify-between px-5 py-4 border-b border-border">
				<div class="flex items-center gap-2">
					<svg class="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
					<h2 class="text-base font-bold text-foreground">Edit Applicant Details</h2>
				</div>
				<button class="text-muted-foreground hover:text-foreground text-lg cursor-pointer" onclick={() => (showEditApplicantModal = false)} aria-label="Close modal">&times;</button>
			</div>

			<form onsubmit={submitEditApplicant} class="p-5 space-y-4 text-xs overflow-y-auto">
				{#if editApplicantError}
					<div class="p-3 rounded-lg bg-destructive/10 text-destructive text-xs font-medium border border-destructive/20">
						{editApplicantError}
					</div>
				{/if}

				{#if editApplicantForm.passportCopy}
					<div class="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
						<div class="flex items-center gap-2 text-foreground font-semibold text-xs">
							<svg class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
							<span>Uploaded Passport Document</span>
						</div>
						<div class="flex items-center gap-2">
							<a
								href={getFileUrl(editApplicantForm.passportCopy)}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 px-2.5 py-1 rounded-md transition-colors"
							>
								<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
								<span>View Passport</span>
							</a>
							<button
								type="button"
								onclick={() => downloadFile(editApplicantForm.passportCopy, `passport_${editApplicantForm.passportNo || 'copy'}`)}
								class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
							>
								<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
								<span>Download</span>
							</button>
						</div>
					</div>
				{/if}

				<div class="grid grid-cols-12 gap-3">
					<div class="col-span-4 sm:col-span-3 space-y-1.5">
						<label for="modalApplicantPrefix" class="block font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Prefix</label>
						<select
							id="modalApplicantPrefix"
							bind:value={editApplicantForm.prefix}
							class="w-full h-9 bg-background border border-border rounded-lg px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
						>
							<option value="Mr.">Mr.</option>
							<option value="Mrs.">Mrs.</option>
							<option value="Ms.">Ms.</option>
							<option value="Dr.">Dr.</option>
							<option value="Prof.">Prof.</option>
						</select>
					</div>

					<div class="col-span-8 sm:col-span-9 space-y-1.5">
						<label for="modalApplicantFName" class="block font-bold text-muted-foreground uppercase tracking-wider text-[10px]">First Name (Given Name)</label>
						<input
							type="text"
							id="modalApplicantFName"
							bind:value={editApplicantForm.fName}
							placeholder="Enter given name"
							class="w-full h-9 bg-background border border-border rounded-lg px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
						/>
					</div>

					<div class="col-span-12 space-y-1.5">
						<label for="modalApplicantLName" class="block font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Last Name (Surname)</label>
						<input
							type="text"
							id="modalApplicantLName"
							bind:value={editApplicantForm.lName}
							placeholder="Enter surname"
							class="w-full h-9 bg-background border border-border rounded-lg px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
						/>
					</div>

					<div class="col-span-12 sm:col-span-6 space-y-1.5">
						<label for="modalApplicantPassport" class="block font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Passport No</label>
						<input
							type="text"
							id="modalApplicantPassport"
							bind:value={editApplicantForm.passportNo}
							placeholder="Passport number"
							class="w-full h-9 bg-background border border-border rounded-lg px-3 text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
						/>
					</div>

					<div class="col-span-12 sm:col-span-6 space-y-1.5">
						<label for="modalApplicantNationality" class="block font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Nationality</label>
						<input
							type="text"
							id="modalApplicantNationality"
							bind:value={editApplicantForm.nationality}
							placeholder="e.g. Bahraini, Indian, etc."
							class="w-full h-9 bg-background border border-border rounded-lg px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
						/>
					</div>

					<div class="col-span-12 sm:col-span-6 space-y-1.5">
						<label for="modalApplicantDob" class="block font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Date of Birth</label>
						<input
							type="date"
							id="modalApplicantDob"
							bind:value={editApplicantForm.dob}
							class="w-full h-9 bg-background border border-border rounded-lg px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
						/>
					</div>

					<div class="col-span-12 sm:col-span-6 space-y-1.5">
						<label for="modalApplicantContact" class="block font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Contact Number</label>
						<input
							type="text"
							id="modalApplicantContact"
							bind:value={editApplicantForm.contactNo}
							placeholder="e.g. 97333333"
							class="w-full h-9 bg-background border border-border rounded-lg px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
						/>
					</div>


				</div>

				<div class="flex items-center justify-end gap-3 pt-3 border-t border-border">
					<button
						type="button"
						class="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors cursor-pointer"
						onclick={() => (showEditApplicantModal = false)}
						disabled={isSavingApplicant}
					>
						Cancel
					</button>
					<button
						type="submit"
						class="px-5 py-2 text-xs font-bold text-white bg-primary hover:opacity-90 rounded-lg transition-opacity cursor-pointer flex items-center gap-1.5 shadow-xs"
						disabled={isSavingApplicant}
					>
						{#if isSavingApplicant}
							<svg class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25"/><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" class="opacity-75"/></svg>
							Saving...
						{:else}
							Save Applicant Details
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
