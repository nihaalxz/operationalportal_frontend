// Dashboard
export interface DashboardSummaryResponse {
  pendingVisasCount: number;
  underReviewVisasCount: number;
  pendingVfsCount: number;
  processingVfsCount: number;
  pendingHolidaysCount: number;
  processingHolidaysCount: number;
  pendingUnassignedCount?: number;
  myOperationsCount?: number;
  completedTodayCount?: number;
}

// Operational Work Assignments
export interface OperationalAssignmentResponse {
  id: number;
  entityType: string;
  entityId: number;
  entityDocumentNumber?: string | null;
  assignedToUserId: number;
  assignedToUserName: string;
  assignedAt: string;
  completedByUserId?: number | null;
  completedByUserName?: string | null;
  completedAt?: string | null;
  status: string;
  lastModifiedByUserId: number;
  lastModifiedByUserName: string;
  lastModifiedAt: string;
  remarks?: string | null;
}

export interface OperationalAssignmentHistoryResponse {
  id: number;
  assignmentId: number;
  action: string;
  performedByUserId: number;
  performedByUserName: string;
  performedAt: string;
  oldAssignedUserId?: number | null;
  oldAssignedUserName?: string | null;
  newAssignedUserId?: number | null;
  newAssignedUserName?: string | null;
  reason?: string | null;
}

export interface MyAssignmentsSummaryResponse {
  totalActiveCount: number;
  assignments: OperationalAssignmentResponse[];
}

export interface ClaimAssignmentRequest {
  entityType: string;
  entityId: number;
  entityDocumentNumber?: string | null;
  remarks?: string | null;
}

// Generic pagination envelope
export interface PagedResponse<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

// Visa Applications
export interface VisaApplicationSummaryResponse {
  id: number;
  documentNumber?: string | null;
  headName: string | null;
  salesmanName?: string | null;
  visaPackName: string | null;
  countryName?: string | null;
  country?: string | null;
  passportNumber?: string | null;
  passportNo?: string | null;
  govtId?: string | null;
  govtTrackingId?: string | null;
  applicantFirstName?: string | null;
  applicantFirstNames?: string | null;
  applicantNames?: string | null;
  clientType: string;
  processingStatus: string;
  paymentStatus: string;
  payableAmount: number;
  profit: number;
  applicantCount: number;
  createdAt: string | null;
  updatedAt?: string | null;
  visaDocument?: string | null;
}

export interface VisaApplicantResponse {
  id: number;
  prefix: string;
  fName: string;
  lName: string;
  dob: string;
  nationality: string;
  careOf: string;
  contactNo: string;
  emailId: string;
  passportNo: string;
  iqamaHotelNo?: string | null;
  payableAmount: number;
  expectedSupplierCost: number;
  profit: number;
  isInhouse: boolean;
  paymentMethod: string;
  paymentStatus: string;
  paymentProof: string | null;
  paymentReference: string | null;
  bankId: number | null;
  bankName: string | null;
  passportCopy?: string | null;
  bankDoc?: string | null;
  govtFeeReference?: string | null;
}

export interface GovtFeeDetailResponse {
  id: number;
  amount: number;
  description?: string | null;
  paymentReference?: string | null;
  transaction_no?: string | null;
  status?: string | null;
  paymentProof?: string | null;
  supplierId?: number | null;
  supplier_id?: number | null;
  supplierName?: string | null;
  govt_fee_description?: string | null;
  createdAt?: string | null;
}

export interface VisaApplicationDetailResponse {
  id: number;
  documentNumber?: string | null;
  userId: number;
  countryId: number;
  countryName?: string | null;
  visaPackId: number;
  visaPackName: string | null;
  clientType: string;
  agent: string | null;
  agentId: number | null;
  headId: number | null;
  headName: string | null;
  processingStatus: string;
  paymentStatus: string;
  visaDocument: string | null;
  approvalNote: string | null;
  rejectionDocument: string | null;
  rejectionNote: string | null;
  refundNote: string | null;
  payableAmount: number;
  expectedSupplierCost: number;
  profit: number;
  supplierId: number | null;
  supplierName: string | null;
  rejectionFee: number;
  createdAt: string | null;
  updatedAt: string | null;
  isDealClosed?: boolean;
  operationClosed?: boolean;
  operation_closed?: boolean;
  documentRequestNote?: string | null;
  paymentMethod?: string | null;
  paymentMode?: string | null;
  govtFees?: GovtFeeDetailResponse[];
  applicants: VisaApplicantResponse[];
}

// VFS Appointments
export interface VfsAppointmentSummaryResponse {
  id: number;
  documentNumber?: string | null;
  headName: string | null;
  name: string;
  country: string;
  visaType: string;
  paymentStatus: string;
  processingStatus: string;
  payableAmount: number;
  profit: number;
  appointmentDate: string | null;
  createdAt: string | null;
  updatedAt?: string | null;
}

export interface VfsAppointmentDetailResponse {
  id: number;
  documentNumber?: string | null;
  createdBy: number;
  headId: number | null;
  headName: string | null;
  clientType: string | null;
  agent: string | null;
  agentId: number | null;
  prefix: string;
  name: string;
  supplier: string;
  supplierId: number | null;
  country: string;
  visaType: string;
  payableAmount: number;
  expectedSupplierCost: number;
  profit: number;
  paymentMode: string;
  paymentMethod?: string | null;
  paymentStatus: string;
  processingStatus: string;
  appointmentDate: string | null;
  appointmentTime: string | null;
  vfsReceipt: string | null;
  passportCopy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  vfsAppId?: string | null;
  supplierName?: string | null;
  salesReturnAmount?: number | null;
  govtFees?: GovtFeeDetailResponse[];
}

// Holiday Packages
export interface HolidayPackageSummaryResponse {
  id: number;
  documentNumber?: string | null;
  headName: string | null;
  passengerName: string;
  country: string;
  days: number;
  paymentStatus: string;
  processingStatus: string;
  payableAmount: number;
  profit: number;
  createdAt: string | null;
  updatedAt?: string | null;
}

export interface HolidayPackageDetailResponse {
  id: number;
  documentNumber?: string | null;
  createdBy: number;
  headId: number | null;
  headName: string | null;
  clientType: string | null;
  agent: string | null;
  agentId: number | null;
  prefix: string;
  passengerName: string;
  supplier: string;
  supplierId: number | null;
  supplierName?: string | null;
  holidayAppId?: string | null;
  country: string;
  days: number;
  payableAmount: number;
  expectedSupplierCost: number;
  profit: number;
  paymentMode: string;
  paymentMethod?: string | null;
  paymentStatus: string;
  processingStatus: string;
  createdAt: string | null;
  updatedAt: string | null;
  govtFees?: GovtFeeDetailResponse[];
  documents: HolidayPackageDocumentResponse[];
}

export interface HolidayPackageDocumentResponse {
  id: number;
  documentPath: string;
  documentType: string;
  createdAt: string | null;
}
