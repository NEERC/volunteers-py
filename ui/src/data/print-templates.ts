import { AxiosError } from "axios";

export const printTemplateKeys = {
  year: (yearId: string) => ["print-templates", yearId] as const,
  detail: (yearId: string, templateId: string) =>
    ["print-templates", yearId, templateId] as const,
};

export async function printPdfResponse<T>(response: Promise<T>): Promise<T> {
  try {
    return await response;
  } catch (error) {
    if (error instanceof AxiosError && error.response?.data instanceof Blob) {
      const body = await new Response(error.response.data)
        .json()
        .catch(() => null);
      if (typeof body?.detail === "string") throw new Error(body.detail);
      if (typeof body?.description === "string")
        throw new Error(body.description);
    }
    throw error;
  }
}
