import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import { Alert, Box, Button, Snackbar } from "@mui/material";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

interface AttendanceExportActionsProps {
  content: string;
  filename?: string;
  disabled?: boolean;
}

export function AttendanceExportActions({
  content,
  filename,
  disabled,
}: AttendanceExportActionsProps) {
  const { t } = useTranslation();
  const id = useId();
  const [notification, setNotification] = useState<{
    message: string;
    error: boolean;
  } | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setNotification({ message: t("Data copied to clipboard"), error: false });
    } catch {
      setNotification({
        message: t("Failed to copy to clipboard. Please try again."),
        error: true,
      });
    }
  };

  const download = () => {
    if (!filename) return;
    let url: string | undefined;
    try {
      url = URL.createObjectURL(
        new Blob(["\uFEFF", content], {
          type: "text/tab-separated-values;charset=utf-8",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
    } catch {
      setNotification({ message: t("Failed to download data"), error: true });
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  };

  return (
    <Box sx={{ display: "flex", gap: 1 }}>
      <Button
        id={`${id}-copy`}
        size="small"
        variant="outlined"
        startIcon={<ContentCopyIcon />}
        onClick={copy}
        disabled={disabled}
      >
        {t("Copy")}
      </Button>
      <Button
        id={`${id}-download`}
        size="small"
        variant="outlined"
        startIcon={<DownloadIcon />}
        onClick={download}
        disabled={disabled || !filename}
      >
        {t("Download")}
      </Button>
      <Snackbar
        open={!!notification}
        autoHideDuration={3000}
        onClose={() => setNotification(null)}
      >
        <Alert
          severity={notification?.error ? "error" : "success"}
          onClose={() => setNotification(null)}
        >
          {notification?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
