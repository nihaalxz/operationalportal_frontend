// Status mapping for all three booking types.
// Maps backend-defined status strings to human-readable labels and semantic variants.

export type StatusVariant = 'default' | 'success' | 'warning' | 'destructive' | 'processing' | 'outline';

export interface StatusConfig {
  label: string;
  variant: StatusVariant;
  ariaLabel: string;
}

// ---------------------------------------------------------------------------
// Processing Status — shared across Visas, VFS, and Holidays
// ---------------------------------------------------------------------------
const PROCESSING_STATUS_MAP: Record<string, StatusConfig> = {
  pending: { label: 'Pending', variant: 'warning', ariaLabel: 'Status: Pending review' },
  under_review: { label: 'Under Review', variant: 'processing', ariaLabel: 'Status: Under review' },
  processing: { label: 'Processing', variant: 'processing', ariaLabel: 'Status: Processing in progress' },
  document_update_requested: { label: 'Document Update Requested', variant: 'warning', ariaLabel: 'Status: Document Update Requested' },
  documents_resubmitted: { label: 'Documents Resubmitted', variant: 'warning', ariaLabel: 'Status: Documents Resubmitted' },
  approved: { label: 'Approved', variant: 'success', ariaLabel: 'Status: Approved' },
  rejected: { label: 'Rejected', variant: 'destructive', ariaLabel: 'Status: Rejected' },
  completed: { label: 'Completed', variant: 'success', ariaLabel: 'Status: Completed' },
  cancelled: { label: 'Cancelled', variant: 'outline', ariaLabel: 'Status: Cancelled' },
  refunded: { label: 'Refunded', variant: 'outline', ariaLabel: 'Status: Refunded' }
};

// ---------------------------------------------------------------------------
// Payment Status — shared across all booking types
// ---------------------------------------------------------------------------
const PAYMENT_STATUS_MAP: Record<string, StatusConfig> = {
  unpaid: { label: 'Unpaid', variant: 'destructive', ariaLabel: 'Payment Status: Unpaid' },
  partial: { label: 'Partial', variant: 'warning', ariaLabel: 'Payment Status: Partially paid' },
  paid: { label: 'Paid', variant: 'success', ariaLabel: 'Payment Status: Fully paid' },
  refunded: { label: 'Refunded', variant: 'outline', ariaLabel: 'Payment Status: Refunded' }
};

/** Resolve a processing status string to its display config */
export function getProcessingStatus(status: string | null | undefined): StatusConfig {
  if (!status) return { label: '—', variant: 'outline', ariaLabel: 'Status: Unknown' };
  const key = status.toLowerCase().replace(/\s+/g, '_');
  return (
    PROCESSING_STATUS_MAP[key] ?? {
      label: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      variant: 'outline',
      ariaLabel: `Status: ${status}`
    }
  );
}

/** Resolve a payment status string to its display config */
export function getPaymentStatus(status: string | null | undefined): StatusConfig {
  if (!status) return { label: '—', variant: 'outline', ariaLabel: 'Payment: Unknown' };
  const key = status.toLowerCase().replace(/\s+/g, '_');
  return (
    PAYMENT_STATUS_MAP[key] ?? {
      label: status,
      variant: 'outline',
      ariaLabel: `Payment Status: ${status}`
    }
  );
}

export { getFileUrl } from '$lib/config';

