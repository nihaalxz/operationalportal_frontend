import { apiFetchBlob } from '$lib/api/api-client';

export async function printInvoice(entityType: string, id: number | string) {
  try {
    const blob = await apiFetchBlob(`/api/sales/invoices/${entityType}/${id}`);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (err: any) {
    console.error('Failed to generate invoice PDF:', err);
    alert('Failed to generate invoice PDF. Please try again.');
  }
}
