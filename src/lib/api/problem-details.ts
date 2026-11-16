// ---------------------------------------------------------------------------
// API Error Classes — Typed discriminated error hierarchy for the API client
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  public readonly status: number;
  public readonly title: string;
  public readonly detail: string;
  public readonly instance?: string;
  public readonly correlationId?: string;

  constructor(
    status: number,
    title: string,
    detail: string,
    instance?: string,
    correlationId?: string
  ) {
    super(`${status} ${title}: ${detail}`);
    this.name = 'ApiError';
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.instance = instance;
    this.correlationId = correlationId;
  }
}

export class ValidationError extends ApiError {
  public readonly errors: Record<string, string[]>;
  constructor(
    detail: string,
    errors: Record<string, string[]>,
    instance?: string,
    correlationId?: string
  ) {
    super(400, 'Validation Error', detail, instance, correlationId);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export class AuthenticationError extends ApiError {
  constructor(detail = 'Not authenticated. Please log in.', instance?: string, correlationId?: string) {
    super(401, 'Unauthorized', detail, instance, correlationId);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ApiError {
  constructor(detail = 'You do not have permission to access this resource.', instance?: string, correlationId?: string) {
    super(403, 'Forbidden', detail, instance, correlationId);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(detail = 'The requested resource was not found.', instance?: string, correlationId?: string) {
    super(404, 'Not Found', detail, instance, correlationId);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends ApiError {
  constructor(detail = 'Too many requests. Please wait a moment before trying again.', instance?: string, correlationId?: string) {
    super(429, 'Too Many Requests', detail, instance, correlationId);
    this.name = 'RateLimitError';
  }
}

export class DownstreamUnavailableError extends ApiError {
  constructor(detail = 'The booking service is currently unavailable. Please retry in a moment.', instance?: string, correlationId?: string) {
    super(503, 'Service Unavailable', detail, instance, correlationId);
    this.name = 'DownstreamUnavailableError';
  }
}

export class TimeoutError extends ApiError {
  constructor(detail = 'The request timed out. Please try again.', instance?: string, correlationId?: string) {
    super(504, 'Gateway Timeout', detail, instance, correlationId);
    this.name = 'TimeoutError';
  }
}

export class NetworkError extends Error {
  constructor(message = 'Network unavailable. Please check your connection.') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class UnknownApiError extends ApiError {
  constructor(status: number, detail = 'An unexpected error occurred.', instance?: string, correlationId?: string) {
    super(status, 'Unknown Error', detail, instance, correlationId);
    this.name = 'UnknownApiError';
  }
}

// ---------------------------------------------------------------------------
// parseProblemDetails — maps RFC-7807 response body + HTTP status → typed error
// ---------------------------------------------------------------------------
export function parseProblemDetails(status: number, body: unknown): ApiError {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : undefined;
  let detail: string | undefined;
  let title: string | undefined;
  let instance: string | undefined;
  let correlationId: string | undefined;

  if (typeof body === 'string' && body.trim().length > 0) {
    detail = body.trim();
    title = status === 400 ? 'Validation Error' : 'Error';
  } else if (b) {
    detail = typeof b.detail === 'string' && b.detail ? b.detail :
             typeof b.message === 'string' && b.message ? b.message :
             typeof b.error === 'string' && b.error ? b.error :
             typeof b.title === 'string' && b.title ? b.title : undefined;
    title = typeof b.title === 'string' ? b.title : (status === 400 ? 'Validation Error' : 'API Error');
    instance = typeof b.instance === 'string' ? b.instance : undefined;
    correlationId = typeof b.traceId === 'string'
      ? b.traceId
      : typeof b.correlationId === 'string'
        ? b.correlationId
        : undefined;
  }

  detail = detail ?? 'An unexpected error occurred.';
  title = title ?? 'API Error';

  switch (status) {
    case 400:
    case 422: {
      const errors = b?.errors && typeof b.errors === 'object'
        ? (b.errors as Record<string, string[]>)
        : {};
      return new ValidationError(detail, errors, instance, correlationId);
    }
    case 401:
      return new AuthenticationError(detail, instance, correlationId);
    case 403:
      return new AuthorizationError(detail, instance, correlationId);
    case 404:
      return new NotFoundError(detail, instance, correlationId);
    case 429:
      return new RateLimitError(detail, instance, correlationId);
    case 502:
    case 503:
      return new DownstreamUnavailableError(detail, instance, correlationId);
    case 504:
      return new TimeoutError(detail, instance, correlationId);
    default:
      return new UnknownApiError(status, detail, instance, correlationId);
  }
}
