import { authStore } from "@/store/auth";

/**
 * Download a file from an authenticated endpoint
 */
export async function downloadFile(
  url: string,
  filename?: string,
): Promise<void> {
  try {
    const token = authStore.getAccessToken();
    if (!token) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;

    // Use filename from Content-Disposition header if available
    let finalFilename = filename;
    const contentDisposition = response.headers.get("Content-Disposition");
    if (contentDisposition && !finalFilename) {
      const filenameMatch = contentDisposition.match(
        /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i,
      );
      if (filenameMatch?.[1]) {
        finalFilename = filenameMatch[1].replace(/['"]/g, "");
      }
    }

    link.download = finalFilename || "download";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error("Failed to download file:", error);
    throw error;
  }
}

/**
 * Open HTML page in a new window with authentication
 */
export async function openAuthenticatedPage(url: string): Promise<void> {
  try {
    const token = authStore.getAccessToken();
    if (!token) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const blob = new Blob([html], { type: "text/html" });
    const blobUrl = window.URL.createObjectURL(blob);

    // Open in new window
    const newWindow = window.open(blobUrl, "_blank");

    // Clean up the blob URL after a delay (window needs time to load)
    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
    }, 1000);

    if (!newWindow) {
      throw new Error(
        "Failed to open new window. Please check popup blocker settings.",
      );
    }
  } catch (error) {
    console.error("Failed to open authenticated page:", error);
    throw error;
  }
}
