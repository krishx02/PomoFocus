type ApiError = {
  readonly status: number;
  readonly message: string;
};

type ErrorResponse = {
  readonly status: number;
  readonly statusText: string;
};

type ErrorResponseInput = {
  readonly error: unknown;
  readonly response: ErrorResponse;
};

function isApiError(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return (
    'status' in value &&
    typeof value.status === 'number' &&
    'message' in value &&
    typeof value.message === 'string'
  );
}

function handleApiError(input: ErrorResponseInput): ApiError {
  const { error, response } = input;
  const message = extractMessage(error) ?? extractStatusText(response);

  return {
    status: response.status,
    message,
  };
}

function extractMessage(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  if (!('error' in error)) {
    return undefined;
  }

  const errorField: unknown = error.error;

  if (typeof errorField === 'string' && errorField.length > 0) {
    return errorField;
  }

  return undefined;
}

function extractStatusText(response: ErrorResponse): string {
  if (response.statusText.length > 0) {
    return response.statusText;
  }

  return 'Request failed';
}

export { isApiError, handleApiError };
export type { ApiError, ErrorResponse, ErrorResponseInput };
