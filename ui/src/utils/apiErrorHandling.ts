export interface ApiError {
  message: string;
  status?: number;
  details?: unknown;
}

export function handleApiError(error: unknown): ApiError {
  const apiError: ApiError = {
    message: error.message || "An unexpected error occurred",
    status: error.response?.status,
    details: error.response?.data,
  };

  // Add server-provided error details to the message
  const maybeDescription = error.response?.data?.description;
  if (maybeDescription) {
    apiError.message += `: ${maybeDescription}`;
  }

  const maybeDetail = error.response?.data?.detail;
  if (maybeDetail) {
    apiError.message += `: ${maybeDetail}`;
  }

  return apiError;
}

export function logApiError(operation: string, error: unknown): void {
  const apiError = handleApiError(error);
  console.error(`${operation} failed:`, apiError);
}

export function createErrorHandler(operation: string) {
  return (error: unknown) => {
    logApiError(operation, error);
  };
}
