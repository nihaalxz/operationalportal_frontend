import { describe, it, expect } from 'vitest';
import { getProcessingStatus, getPaymentStatus } from '$lib/utils/status';

describe('getProcessingStatus', () => {
  it('maps pending to warning variant', () => {
    const cfg = getProcessingStatus('pending');
    expect(cfg.variant).toBe('warning');
    expect(cfg.label).toBe('Pending');
  });

  it('maps Approved (any case) to success variant', () => {
    const cfg = getProcessingStatus('Approved');
    expect(cfg.variant).toBe('success');
    expect(cfg.label).toBe('Approved');
  });

  it('maps rejected to destructive variant', () => {
    const cfg = getProcessingStatus('rejected');
    expect(cfg.variant).toBe('destructive');
  });

  it('maps under_review to processing variant', () => {
    const cfg = getProcessingStatus('under_review');
    expect(cfg.variant).toBe('processing');
  });

  it('maps unknown status to outline with raw label', () => {
    const cfg = getProcessingStatus('some_future_status');
    expect(cfg.variant).toBe('outline');
    expect(cfg.label).toBe('some_future_status');
  });

  it('handles null gracefully', () => {
    const cfg = getProcessingStatus(null);
    expect(cfg.label).toBe('—');
    expect(cfg.variant).toBe('outline');
  });

  it('handles undefined gracefully', () => {
    const cfg = getProcessingStatus(undefined);
    expect(cfg.label).toBe('—');
  });
});

describe('getPaymentStatus', () => {
  it('maps paid to success', () => {
    const cfg = getPaymentStatus('paid');
    expect(cfg.variant).toBe('success');
    expect(cfg.label).toBe('Paid');
  });

  it('maps unpaid to destructive', () => {
    const cfg = getPaymentStatus('Unpaid');
    expect(cfg.variant).toBe('destructive');
  });

  it('maps partial to warning', () => {
    const cfg = getPaymentStatus('partial');
    expect(cfg.variant).toBe('warning');
  });

  it('handles unknown payment status gracefully', () => {
    const cfg = getPaymentStatus('mysterious_status');
    expect(cfg.variant).toBe('outline');
  });

  it('handles null gracefully', () => {
    const cfg = getPaymentStatus(null);
    expect(cfg.label).toBe('—');
  });
});
