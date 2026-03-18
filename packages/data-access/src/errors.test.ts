import { describe, it, expect } from 'vitest';
import { isApiError, handleApiError } from './errors';
import type { ApiError, ErrorResponseInput } from './errors';

describe('isApiError', () => {
  it('returns true for a valid ApiError object', () => {
    const error: ApiError = { status: 400, message: 'Bad Request' };
    expect(isApiError(error)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isApiError(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isApiError(undefined)).toBe(false);
  });

  it('returns false for a string', () => {
    expect(isApiError('not an error')).toBe(false);
  });

  it('returns false for a number', () => {
    expect(isApiError(404)).toBe(false);
  });

  it('returns false for an object missing status', () => {
    expect(isApiError({ message: 'no status' })).toBe(false);
  });

  it('returns false for an object missing message', () => {
    expect(isApiError({ status: 500 })).toBe(false);
  });

  it('returns false for an object with wrong status type', () => {
    expect(isApiError({ status: '400', message: 'Bad Request' })).toBe(false);
  });

  it('returns false for an object with wrong message type', () => {
    expect(isApiError({ status: 400, message: 123 })).toBe(false);
  });

  it('returns true for an ApiError with extra properties', () => {
    expect(isApiError({ status: 400, message: 'Bad Request', extra: true })).toBe(true);
  });
});

describe('handleApiError', () => {
  it('transforms a 400 error response', () => {
    const input: ErrorResponseInput = {
      error: { error: 'Validation failed' },
      response: { status: 400, statusText: 'Bad Request' },
    };

    const result = handleApiError(input);
    expect(result).toEqual({ status: 400, message: 'Validation failed' });
  });

  it('transforms a 401 error response', () => {
    const input: ErrorResponseInput = {
      error: { error: 'Unauthorized' },
      response: { status: 401, statusText: 'Unauthorized' },
    };

    const result = handleApiError(input);
    expect(result).toEqual({ status: 401, message: 'Unauthorized' });
  });

  it('transforms a 404 error response', () => {
    const input: ErrorResponseInput = {
      error: { error: 'Not found' },
      response: { status: 404, statusText: 'Not Found' },
    };

    const result = handleApiError(input);
    expect(result).toEqual({ status: 404, message: 'Not found' });
  });

  it('transforms a 500 error response', () => {
    const input: ErrorResponseInput = {
      error: { error: 'Internal server error' },
      response: { status: 500, statusText: 'Internal Server Error' },
    };

    const result = handleApiError(input);
    expect(result).toEqual({ status: 500, message: 'Internal server error' });
  });

  it('transforms a 422 error response with details', () => {
    const input: ErrorResponseInput = {
      error: { error: 'Validation failed', details: { field: 'name' } },
      response: { status: 422, statusText: 'Unprocessable Entity' },
    };

    const result = handleApiError(input);
    expect(result).toEqual({ status: 422, message: 'Validation failed' });
  });

  it('uses status text when error body has no error field', () => {
    const input: ErrorResponseInput = {
      error: {},
      response: { status: 503, statusText: 'Service Unavailable' },
    };

    const result = handleApiError(input);
    expect(result).toEqual({ status: 503, message: 'Service Unavailable' });
  });

  it('uses generic message when error body is empty and no status text', () => {
    const input: ErrorResponseInput = {
      error: {},
      response: { status: 500, statusText: '' },
    };

    const result = handleApiError(input);
    expect(result).toEqual({ status: 500, message: 'Request failed' });
  });

  it('handles missing error body (undefined)', () => {
    const input: ErrorResponseInput = {
      error: undefined,
      response: { status: 502, statusText: 'Bad Gateway' },
    };

    const result = handleApiError(input);
    expect(result).toEqual({ status: 502, message: 'Bad Gateway' });
  });

  it('handles error body that is a string instead of object', () => {
    const input: ErrorResponseInput = {
      error: 'Something went wrong',
      response: { status: 500, statusText: 'Internal Server Error' },
    };

    const result = handleApiError(input);
    expect(result).toEqual({ status: 500, message: 'Internal Server Error' });
  });

  it('handles error body with non-string error field', () => {
    const input: ErrorResponseInput = {
      error: { error: 42 },
      response: { status: 400, statusText: 'Bad Request' },
    };

    const result = handleApiError(input);
    expect(result).toEqual({ status: 400, message: 'Bad Request' });
  });
});
