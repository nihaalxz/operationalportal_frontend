import { describe, it, expect } from 'vitest';
import {
  parseProblemDetails,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  DownstreamUnavailableError,
  TimeoutError,
  ValidationError,
  NetworkError
} from '$lib/api/problem-details';

describe('parseProblemDetails', () => {
  it('maps 401 to AuthenticationError', () => {
    const err = parseProblemDetails(401, { title: 'Unauthorized', detail: 'Not authenticated.' });
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.status).toBe(401);
    expect(err.detail).toBe('Not authenticated.');
  });

  it('maps 403 to AuthorizationError', () => {
    const err = parseProblemDetails(403, { title: 'Forbidden', detail: 'No access.' });
    expect(err).toBeInstanceOf(AuthorizationError);
    expect(err.status).toBe(403);
  });

  it('maps 404 to NotFoundError', () => {
    const err = parseProblemDetails(404, { title: 'Not Found', detail: 'Resource missing.' });
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err.status).toBe(404);
  });

  it('maps 429 to RateLimitError', () => {
    const err = parseProblemDetails(429, { title: 'Too Many Requests', detail: 'Slow down.' });
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.status).toBe(429);
  });

  it('maps 502 to DownstreamUnavailableError', () => {
    const err = parseProblemDetails(502, { title: 'Bad Gateway', detail: 'Downstream failed.' });
    expect(err).toBeInstanceOf(DownstreamUnavailableError);
    expect(err.status).toBe(503); // DownstreamUnavailableError hardcodes 503
  });

  it('maps 503 to DownstreamUnavailableError', () => {
    const err = parseProblemDetails(503, { title: 'Service Unavailable', detail: 'Offline.' });
    expect(err).toBeInstanceOf(DownstreamUnavailableError);
    expect(err.status).toBe(503);
  });

  it('maps 504 to TimeoutError', () => {
    const err = parseProblemDetails(504, { title: 'Timeout', detail: 'Timed out.' });
    expect(err).toBeInstanceOf(TimeoutError);
    expect(err.status).toBe(504);
  });

  it('maps 400 with errors object to ValidationError', () => {
    const err = parseProblemDetails(400, {
      title: 'Validation Error',
      detail: 'Fields invalid.',
      errors: { email: ['Invalid email'] }
    });
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).errors).toEqual({ email: ['Invalid email'] });
  });

  it('maps 400 without errors object to ValidationError with empty errors', () => {
    const err = parseProblemDetails(400, { title: 'Bad Request', detail: 'Missing fields.' });
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).errors).toEqual({});
  });

  it('handles null/empty body gracefully', () => {
    const err = parseProblemDetails(500, null);
    expect(err.status).toBe(500);
    expect(err.detail).toBe('An unexpected error occurred.');
    expect(err.title).toBe('Unknown Error');
  });

  it('extracts traceId as correlationId', () => {
    const err = parseProblemDetails(400, { title: 'Bad', detail: 'Bad.', traceId: 'abc-123' });
    expect(err.correlationId).toBe('abc-123');
  });
});

describe('NetworkError', () => {
  it('has correct name and default message', () => {
    const err = new NetworkError();
    expect(err.name).toBe('NetworkError');
    expect(err.message).toContain('Network unavailable');
  });
});
