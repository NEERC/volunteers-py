import { Chip, type ChipProps } from "@mui/material";
import { useTranslation } from "react-i18next";
import type {
  Attendance,
  MailingMessageStatus,
  MailingStatus,
} from "@/client/types.gen";

// Translation keys
export const MAILING_STATUS_LABELS: Record<MailingStatus, string> = {
  draft: "Draft",
  queued: "Queued",
  sending: "Sending",
  done: "Done",
  cancelled: "Cancelled",
};

const MAILING_STATUS_COLORS: Record<MailingStatus, ChipProps["color"]> = {
  draft: "default",
  queued: "info",
  sending: "primary",
  done: "success",
  cancelled: "warning",
};

export const MESSAGE_STATUS_LABELS: Record<MailingMessageStatus, string> = {
  pending: "Pending",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  unknown: "Unknown",
  skipped: "Skipped",
  cancelled: "Cancelled",
};

export const MESSAGE_STATUS_COLORS: Record<
  MailingMessageStatus,
  ChipProps["color"]
> = {
  pending: "default",
  sending: "primary",
  sent: "success",
  failed: "error",
  unknown: "warning",
  skipped: "default",
  cancelled: "default",
};

export const MESSAGE_STATUSES = Object.keys(
  MESSAGE_STATUS_LABELS,
) as MailingMessageStatus[];

export const ATTENDANCE_LABELS: Record<Attendance, string> = {
  yes: "Yes",
  no: "No",
  late: "Late",
  sick: "Sick",
  unknown: "Unknown",
  confirmed: "Confirmed",
};

export function MailingStatusChip({ status }: { status: MailingStatus }) {
  const { t } = useTranslation();
  return (
    <Chip
      size="small"
      label={t(MAILING_STATUS_LABELS[status])}
      color={MAILING_STATUS_COLORS[status]}
      data-testid="mailing-status"
    />
  );
}

export function MessageStatusChip({
  status,
}: {
  status: MailingMessageStatus;
}) {
  const { t } = useTranslation();
  return (
    <Chip
      size="small"
      variant="outlined"
      label={t(MESSAGE_STATUS_LABELS[status])}
      color={MESSAGE_STATUS_COLORS[status]}
    />
  );
}
