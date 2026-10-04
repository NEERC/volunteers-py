import { AxiosError } from "axios";

export type ResponseWithDescriptionOrDetail = {
  description?: string;
  detail?: string;
};

export function handleApiError(
  error: AxiosError<ResponseWithDescriptionOrDetail> | Error,
) {
  if (error instanceof AxiosError) {
    // Add server-provided error details to the message
    const maybeDescription = error.response?.data?.description;
    if (maybeDescription) {
      error.message += `: ${maybeDescription}`;
    }

    const maybeDetail = error.response?.data?.detail;
    if (maybeDetail) {
      error.message += `: ${maybeDetail}`;
    }
  }

  return error;
}

export function logApiError(operation: string, error: Error): void {
  const apiError = handleApiError(error);
  console.error(`${operation} failed:`, apiError);
}

export function createErrorHandler(operation: string) {
  return (error: Error) => {
    logApiError(operation, error);
  };
}

/** Server-provided error detail, or the error message as a fallback. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as
      | ResponseWithDescriptionOrDetail
      | undefined;
    if (typeof data?.detail === "string") {
      return data.detail;
    }
    if (data?.description) {
      return data.description;
    }
  }
  return error instanceof Error ? error.message : fallback;
}
