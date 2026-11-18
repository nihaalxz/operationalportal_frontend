import { apiFetch } from '$lib/api/api-client';
import type {
	OperationalAssignmentResponse,
	VisaApplicationSummaryResponse,
	VfsAppointmentSummaryResponse,
	HolidayPackageSummaryResponse,
	PagedResponse
} from '$lib/types/api';
import type { PendingQueueItem, ServiceType } from '../types/assignment-types';

export async function claimOperation(
	entityType: ServiceType,
	entityId: number,
	entityDocumentNumber?: string | null
): Promise<OperationalAssignmentResponse> {
	return apiFetch<OperationalAssignmentResponse>('/api/assignments/claim', {
		method: 'POST',
		body: JSON.stringify({
			entityType,
			entityId: Number(entityId),
			entityDocumentNumber: entityDocumentNumber || null
		})
	});
}

export interface OperatorWorkloadSummary {
	visaActiveCount: number;
	visaMaxLimit: number;
	vfsActiveCount: number;
	vfsMaxLimit: number;
	holidayActiveCount: number;
	holidayMaxLimit: number;
}

export async function fetchWorkloadSummary(): Promise<OperatorWorkloadSummary> {
	try {
		return await apiFetch<OperatorWorkloadSummary>('/api/assignments/workload-summary');
	} catch {
		return {
			visaActiveCount: 0,
			visaMaxLimit: 3,
			vfsActiveCount: 0,
			vfsMaxLimit: 3,
			holidayActiveCount: 0,
			holidayMaxLimit: 3
		};
	}
}

export async function getActiveAssignments(): Promise<OperationalAssignmentResponse[]> {
	try {
		return await apiFetch<OperationalAssignmentResponse[]>('/api/assignments');
	} catch {
		return [];
	}
}

export interface MyAssignmentsSummary {
	totalActiveCount: number;
	assignments: OperationalAssignmentResponse[];
}

export async function fetchMyActiveAssignments(): Promise<MyAssignmentsSummary> {
	try {
		return await apiFetch<MyAssignmentsSummary>('/api/assignments/my');
	} catch {
		return { totalActiveCount: 0, assignments: [] };
	}
}

function calculateWaitingMinutes(createdAt: string | null): number {
	if (!createdAt) return 0;
	const created = new Date(createdAt).getTime();
	if (isNaN(created)) return 0;
	const diffMs = Date.now() - created;
	return Math.max(0, Math.floor(diffMs / (1000 * 60)));
}

function determinePriority(payableAmount: number, waitingMinutes: number): 'Urgent' | 'High' | 'Normal' {
	if (waitingMinutes > 1440 || payableAmount > 5000) return 'Urgent';
	if (waitingMinutes > 360 || payableAmount > 2000) return 'High';
	return 'Normal';
}

/**
 * Automatically fetches all pages for an endpoint if totalPages > 1,
 * ensuring zero entries are missed regardless of dataset volume.
 */
export async function fetchAllPages<T>(
	endpoint: string,
	params: Record<string, string | number | boolean | null | undefined> = {}
): Promise<T[]> {
	const firstPage = await apiFetch<PagedResponse<T>>(endpoint, {
		params: { ...params, page: 1, pageSize: 100 }
	}).catch(() => null);

	if (!firstPage?.items || firstPage.items.length === 0) {
		return [];
	}

	const allItems = [...firstPage.items];
	const totalPages = firstPage.totalPages || 1;

	if (totalPages > 1) {
		const remainingPromises: Promise<PagedResponse<T> | null>[] = [];
		for (let p = 2; p <= totalPages; p++) {
			remainingPromises.push(
				apiFetch<PagedResponse<T>>(endpoint, {
					params: { ...params, page: p, pageSize: 100 }
				}).catch(() => null)
			);
		}
		const remainingResults = await Promise.all(remainingPromises);
		for (const pageRes of remainingResults) {
			if (pageRes?.items) {
				allItems.push(...pageRes.items);
			}
		}
	}

	return allItems;
}

export async function fetchPendingQueueItems(): Promise<{
	items: PendingQueueItem[];
	assignmentsMap: Record<string, OperationalAssignmentResponse>;
}> {
	const [visaItems, vfsItems, holidayItems, assignments] = await Promise.all([
		fetchAllPages<VisaApplicationSummaryResponse>('/api/visas', { status: 'pending' }),
		fetchAllPages<VfsAppointmentSummaryResponse>('/api/vfs-appointments', { status: 'pending' }),
		fetchAllPages<HolidayPackageSummaryResponse>('/api/holiday-packages', { status: 'pending' }),
		getActiveAssignments()
	]);

	const assignmentsMap: Record<string, OperationalAssignmentResponse> = {};
	for (const a of assignments) {
		const key = `${a.entityType.toUpperCase()}_${a.entityId}`;
		assignmentsMap[key] = a;
	}

	const pendingItems: PendingQueueItem[] = [];

	// Visas
	for (const item of visaItems) {
		const visaEntityId = item.id !== undefined && item.id !== null ? Number(item.id) : 0;
		const key = `VISA_${visaEntityId}`;
		const isAssigned = !!assignmentsMap[key];
		const isPending = (item.processingStatus || '').toLowerCase() === 'pending';

		if (!isAssigned && isPending) {
			const waitingMinutes = calculateWaitingMinutes(item.createdAt);
			const country = item.countryName || item.country || item.visaPackName || '—';
			const passportNo = item.passportNumber || item.passportNo || '—';
			const salesmanName = item.salesmanName || '';
			const applicantFirstName = item.applicantFirstName || item.applicantFirstNames || (item.applicantNames ? item.applicantNames.split(' ')[0] : '') || '';
			const visaPackDetails = `${item.visaPackName || 'Visa Package'} (${item.applicantCount || 1} applicant${(item.applicantCount || 1) !== 1 ? 's' : ''})`;
			const govtId = item.govtTrackingId || item.govtId || '—';
			pendingItems.push({
				id: visaEntityId,
				entityType: 'VISA',
				entityId: visaEntityId,
				refNo: item.documentNumber || `#VISA-${visaEntityId}`,
				customer: item.headName || 'Not filled by staff',
				salesmanName,
				applicantFirstName,
				passenger: applicantFirstName || item.headName || 'Applicant',
				visaPackDetails,
				details: visaPackDetails,
				destination: country,
				country,
				passportNo,
				govtId,
				processingStatus: item.processingStatus || 'Pending',
				paymentStatus: item.paymentStatus || 'Unpaid',
				payableAmount: item.payableAmount || 0,
				createdAt: item.createdAt,
				priority: determinePriority(item.payableAmount || 0, waitingMinutes),
				waitingMinutes,
				detailUrl: `/visas/${visaEntityId}`
			});
		}
	}

	// VFS
	for (const item of vfsItems) {
		const vfsEntityId = item.id !== undefined && item.id !== null ? Number(item.id) : 0;
		const key = `VFS_${vfsEntityId}`;
		const isAssigned = !!assignmentsMap[key];
		const isPending = (item.processingStatus || '').toLowerCase() === 'pending';

		if (!isAssigned && isPending) {
			const waitingMinutes = calculateWaitingMinutes(item.createdAt);
			const country = item.country || '—';
			const applicantFirstName = item.name ? item.name.trim().split(' ')[0] : 'Applicant';
			const visaPackDetails = `${item.visaType || 'VFS'} Appointment`;
			pendingItems.push({
				id: vfsEntityId,
				entityType: 'VFS',
				entityId: vfsEntityId,
				refNo: item.documentNumber || `#VFS-${vfsEntityId}`,
				customer: item.headName || 'Not filled by staff',
				salesmanName: '',
				applicantFirstName,
				passenger: item.name || 'Applicant',
				visaPackDetails,
				details: `${item.name || 'Applicant'} · ${item.visaType || 'VFS'} (${country})`,
				destination: country,
				country,
				passportNo: '—',
				govtId: '—',
				processingStatus: item.processingStatus || 'Pending',
				paymentStatus: item.paymentStatus || 'Unpaid',
				payableAmount: item.payableAmount || 0,
				createdAt: item.createdAt,
				priority: determinePriority(item.payableAmount || 0, waitingMinutes),
				waitingMinutes,
				detailUrl: `/vfs/${vfsEntityId}`
			});
		}
	}

	// Holidays
	for (const item of holidayItems) {
		const holidayEntityId = item.id !== undefined && item.id !== null ? Number(item.id) : 0;
		const key = `HOLIDAY_${holidayEntityId}`;
		const isAssigned = !!assignmentsMap[key];
		const isPending = (item.processingStatus || '').toLowerCase() === 'pending';

		if (!isAssigned && isPending) {
			const waitingMinutes = calculateWaitingMinutes(item.createdAt);
			const country = item.country || '—';
			const applicantFirstName = item.passengerName ? item.passengerName.trim().split(' ')[0] : 'Passenger';
			const visaPackDetails = `${item.days || 0} Days Holiday Package`;
			pendingItems.push({
				id: holidayEntityId,
				entityType: 'HOLIDAY',
				entityId: holidayEntityId,
				refNo: item.documentNumber || `#HOLIDAY-${holidayEntityId}`,
				customer: item.headName || 'Not filled by staff',
				salesmanName: '',
				applicantFirstName,
				passenger: item.passengerName || 'Passenger',
				visaPackDetails,
				details: `${item.passengerName || 'Passenger'} · ${country} (${item.days || 0} Days)`,
				destination: country,
				country,
				passportNo: '—',
				govtId: '—',
				processingStatus: item.processingStatus || 'Pending',
				paymentStatus: item.paymentStatus || 'Unpaid',
				payableAmount: item.payableAmount || 0,
				createdAt: item.createdAt,
				priority: determinePriority(item.payableAmount || 0, waitingMinutes),
				waitingMinutes,
				detailUrl: `/holidays/${holidayEntityId}`
			});
		}
	}

	return { items: pendingItems, assignmentsMap };
}

export interface CompletedQueueItem {
	id: number;
	entityType: 'VISA' | 'VFS' | 'HOLIDAY';
	entityId: number;
	refNo: string;
	customer: string;
	salesmanName?: string;
	govtId?: string;
	applicantFirstName?: string;
	passenger: string;
	details: string;
	destination: string;
	country?: string;
	passportNo?: string;
	createdAt?: string | null;
	applicantCount?: number;
	processingStatus: string;
	paymentStatus: string;
	payableAmount: number;
	completedAt: string | null;
	detailUrl: string;
	visaDocument?: string | null;
}

export async function fetchCompletedApplications(currentUserId?: number): Promise<CompletedQueueItem[]> {
	const [assignmentsRes, visaItems, vfsItems, holidayItems] = await Promise.all([
		apiFetch<OperationalAssignmentResponse[]>('/api/assignments/completed').catch(() => null),
		fetchAllPages<VisaApplicationSummaryResponse>('/api/visas'),
		fetchAllPages<VfsAppointmentSummaryResponse>('/api/vfs-appointments'),
		fetchAllPages<HolidayPackageSummaryResponse>('/api/holiday-packages')
	]);

	const visaMap = new Map<number, VisaApplicationSummaryResponse>();
	for (const item of visaItems) visaMap.set(item.id, item);

	const vfsMap = new Map<number, VfsAppointmentSummaryResponse>();
	for (const item of vfsItems) vfsMap.set(item.id, item);

	const holidayMap = new Map<number, HolidayPackageSummaryResponse>();
	for (const item of holidayItems) holidayMap.set(item.id, item);

	const completedItems: CompletedQueueItem[] = [];
	const addedKeys = new Set<string>();

	if (assignmentsRes && Array.isArray(assignmentsRes)) {
		for (const assignment of assignmentsRes) {
			const typeUpper = (assignment.entityType || '').toUpperCase();
			const key = `${typeUpper}_${assignment.entityId}`;
			if (addedKeys.has(key)) continue;
			addedKeys.add(key);

			if (typeUpper.includes('VISA')) {
				const visa = visaMap.get(assignment.entityId);
				const country = visa?.countryName || visa?.country || visa?.visaPackName || '—';
				const passportNo = visa?.passportNumber || visa?.passportNo || '—';
				const salesmanName = visa?.salesmanName || '';
				const govtId = visa?.govtTrackingId || visa?.govtId || '—';
				const applicantFirstName = visa?.applicantFirstName || visa?.applicantFirstNames || (visa?.applicantNames ? visa.applicantNames.split(' ')[0] : '') || '';
				completedItems.push({
					id: assignment.entityId,
					entityType: 'VISA',
					entityId: assignment.entityId,
					refNo: visa?.documentNumber || assignment.entityDocumentNumber || `#VISA-${assignment.entityId}`,
					customer: visa?.headName || 'Customer Record',
					salesmanName,
					govtId,
					applicantFirstName,
					passenger: applicantFirstName || visa?.headName || 'Applicant',
					details: visa ? `${visa.visaPackName || 'Visa Package'} (${visa.applicantCount || 1} applicant${(visa.applicantCount || 1) !== 1 ? 's' : ''})` : `Completed Visa #${assignment.entityId}`,
					destination: country,
					country,
					passportNo,
					createdAt: visa?.createdAt || null,
					applicantCount: visa?.applicantCount || 1,
					processingStatus: visa?.processingStatus || assignment.status || 'Completed',
					paymentStatus: visa?.paymentStatus || 'Paid',
					payableAmount: visa?.payableAmount || 0,
					completedAt: assignment.completedAt || assignment.lastModifiedAt || new Date().toISOString(),
					detailUrl: `/visas/${assignment.entityId}`,
					visaDocument: visa?.visaDocument
				});
			} else if (typeUpper.includes('VFS')) {
				const vfs = vfsMap.get(assignment.entityId);
				const country = vfs?.country || '—';
				const applicantFirstName = vfs?.name ? vfs.name.trim().split(' ')[0] : 'Applicant';
				completedItems.push({
					id: assignment.entityId,
					entityType: 'VFS',
					entityId: assignment.entityId,
					refNo: vfs?.documentNumber || assignment.entityDocumentNumber || `#VFS-${assignment.entityId}`,
					customer: vfs?.headName || 'Customer Record',
					salesmanName: '',
					govtId: '—',
					applicantFirstName,
					passenger: vfs?.name || 'Applicant',
					details: vfs ? `${vfs.name || 'Applicant'} · ${vfs.visaType || 'VFS'} (${country})` : `Completed VFS #${assignment.entityId}`,
					destination: country,
					country,
					passportNo: '—',
					createdAt: vfs?.createdAt || null,
					applicantCount: 1,
					processingStatus: vfs?.processingStatus || assignment.status || 'Completed',
					paymentStatus: vfs?.paymentStatus || 'Paid',
					payableAmount: vfs?.payableAmount || 0,
					completedAt: assignment.completedAt || assignment.lastModifiedAt || new Date().toISOString(),
					detailUrl: `/vfs/${assignment.entityId}`
				});
			} else if (typeUpper.includes('HOLIDAY')) {
				const holiday = holidayMap.get(assignment.entityId);
				const country = holiday?.country || '—';
				const applicantFirstName = holiday?.passengerName ? holiday.passengerName.trim().split(' ')[0] : 'Passenger';
				completedItems.push({
					id: assignment.entityId,
					entityType: 'HOLIDAY',
					entityId: assignment.entityId,
					refNo: holiday?.documentNumber || assignment.entityDocumentNumber || `#HOLIDAY-${assignment.entityId}`,
					customer: holiday?.headName || 'Customer Record',
					salesmanName: '',
					govtId: '—',
					applicantFirstName,
					passenger: holiday?.passengerName || 'Passenger',
					details: holiday ? `${holiday.passengerName || 'Passenger'} · ${country} (${holiday.days || 0} Days)` : `Completed Holiday #${assignment.entityId}`,
					destination: country,
					country,
					passportNo: '—',
					createdAt: holiday?.createdAt || null,
					applicantCount: 1,
					processingStatus: holiday?.processingStatus || assignment.status || 'Completed',
					paymentStatus: holiday?.paymentStatus || 'Paid',
					payableAmount: holiday?.payableAmount || 0,
					completedAt: assignment.completedAt || assignment.lastModifiedAt || new Date().toISOString(),
					detailUrl: `/holidays/${assignment.entityId}`
				});
			}
		}
	}

	for (const v of visaItems) {
		const isCompleted = ['approved', 'completed'].includes((v.processingStatus || '').toLowerCase());
		const key = `VISA_${v.id}`;
		if (isCompleted && !addedKeys.has(key)) {
			addedKeys.add(key);
			const country = v.countryName || v.country || v.visaPackName || '—';
			const passportNo = v.passportNumber || v.passportNo || '—';
			const salesmanName = v.salesmanName || '';
			const govtId = v.govtTrackingId || v.govtId || '—';
			const applicantFirstName = v.applicantFirstName || v.applicantFirstNames || (v.applicantNames ? v.applicantNames.split(' ')[0] : '') || '';
			completedItems.push({
				id: v.id,
				entityType: 'VISA',
				entityId: v.id,
				refNo: v.documentNumber || `#VISA-${v.id}`,
				customer: v.headName || 'Customer Record',
				salesmanName,
				govtId,
				applicantFirstName,
				passenger: applicantFirstName || v.headName || 'Applicant',
				details: `${v.visaPackName || 'Visa Package'} (${v.applicantCount || 1} applicant${(v.applicantCount || 1) !== 1 ? 's' : ''})`,
				destination: country,
				country,
				passportNo,
				createdAt: v.createdAt || null,
				applicantCount: v.applicantCount || 1,
				processingStatus: v.processingStatus || 'Completed',
				paymentStatus: v.paymentStatus || 'Paid',
				payableAmount: v.payableAmount || 0,
				completedAt: v.updatedAt || v.createdAt || new Date().toISOString(),
				detailUrl: `/visas/${v.id}`,
				visaDocument: v.visaDocument
			});
		}
	}

	// Sort completed applications descending by date
	completedItems.sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());

	return completedItems;
}
