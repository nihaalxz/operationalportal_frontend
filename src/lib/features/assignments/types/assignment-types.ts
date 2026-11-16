import type {
	OperationalAssignmentResponse,
	VisaApplicationSummaryResponse,
	VfsAppointmentSummaryResponse,
	HolidayPackageSummaryResponse
} from '$lib/types/api';

export type ServiceType = 'VISA' | 'VFS' | 'HOLIDAY';

export interface PendingQueueItem {
	id: number;
	entityType: ServiceType;
	entityId: number;
	refNo: string;
	customer: string;
	salesmanName?: string;
	passenger: string;
	details: string;
	destination: string;
	country?: string;
	passportNo?: string;
	govtId?: string;
	applicantFirstName?: string;
	visaPackDetails?: string;
	processingStatus: string;
	paymentStatus: string;
	payableAmount: number;
	createdAt: string | null;
	priority: 'High' | 'Normal' | 'Urgent';
	waitingMinutes: number;
	detailUrl: string;
}

export type ModuleTab = 'my' | 'team' | 'all';
export type ServiceFilterTab = 'all' | 'visa' | 'vfs' | 'holiday';

export type QueueSortOption = 'newest' | 'oldest' | 'priority';

export interface QueueParams {
	page: number;
	pageSize: number;
	search: string;
	status: string;
	tab: ModuleTab;
	service: ServiceFilterTab;
	sort: QueueSortOption;
}
