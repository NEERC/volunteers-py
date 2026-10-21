import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ReplayIcon from "@mui/icons-material/Replay";
import StopIcon from "@mui/icons-material/Stop";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  MailingMessageResponse,
  MailingMessageStatus,
  MailingResponse,
} from "@/client/types.gen";
import {
  useCancelMailing,
  useCreateMailing,
  useMailingEvents,
  useResendMessages,
} from "@/data/use-mailings";
import { apiErrorMessage } from "@/utils/apiErrorHandling";
import {
  MailingStatusChip,
  MESSAGE_STATUS_COLORS,
  MESSAGE_STATUS_LABELS,
  MESSAGE_STATUSES,
  MessageStatusChip,
} from "./status";
import { TelegramMessage } from "./TelegramMessage";

const RESENDABLE: MailingMessageStatus[] = ["failed", "unknown"];

const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString() : "—";

export function MailingProgress({ mailing }: { mailing: MailingResponse }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { messages, loaded, restart } = useMailingEvents(
    mailing.mailing_id,
    true,
  );
  const cancelMailing = useCancelMailing();
  const resendMessages = useResendMessages();
  const createMailing = useCreateMailing();

  const [statusFilter, setStatusFilter] = useState<MailingMessageStatus | "">(
    "",
  );
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [opened, setOpened] = useState<MailingMessageResponse | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmResend, setConfirmResend] = useState(false);

  const list = useMemo(
    () =>
      [...messages.values()]
        .filter((m) => !statusFilter || m.status === statusFilter)
        .sort((a, b) => a.message_id - b.message_id),
    [messages, statusFilter],
  );

  const { counts } = mailing;
  const toSend =
    counts.pending +
    counts.sending +
    counts.sent +
    counts.failed +
    counts.unknown;
  const processed = counts.sent + counts.failed + counts.unknown;
  const active = mailing.status === "queued" || mailing.status === "sending";
  const canResend = mailing.status === "sending" || mailing.status === "done";

  const selectedMessages = [...selected]
    .map((id) => messages.get(id))
    .filter(
      (m): m is MailingMessageResponse =>
        m !== undefined && RESENDABLE.includes(m.status),
    );
  const resendingUnknown = selectedMessages.some((m) => m.status === "unknown");

  const toggle = (id: number) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const resend = async () => {
    setConfirmResend(false);
    await resendMessages.mutateAsync({
      mailingId: mailing.mailing_id,
      messageIds: selectedMessages.map((m) => m.message_id),
    });
    setSelected(new Set());
    restart();
  };

  const clone = async () => {
    const copy = await createMailing.mutateAsync({
      yearId: mailing.year_id,
      sourceMailingId: mailing.mailing_id,
    });
    navigate({
      to: "/$yearId/mailings/$mailingId",
      params: {
        yearId: String(mailing.year_id),
        mailingId: String(copy.mailing_id),
      },
    });
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          {mailing.title || t("Untitled")}
        </Typography>
        <MailingStatusChip status={mailing.status} />
        <Button startIcon={<ContentCopyIcon />} onClick={clone}>
          {t("Copy to a new mailing")}
        </Button>
        {active && (
          <Button
            color="error"
            variant="outlined"
            startIcon={<StopIcon />}
            onClick={() => setConfirmCancel(true)}
          >
            {t("Cancel mailing")}
          </Button>
        )}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t("Started by {{name}} at {{date}}", {
          name: mailing.started_by?.name ?? "—",
          date: formatDate(mailing.queued_at),
        })}
        {mailing.finished_at &&
          `, ${t("finished at {{date}}", { date: formatDate(mailing.finished_at) })}`}
      </Typography>

      {(cancelMailing.error || resendMessages.error) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {apiErrorMessage(
            cancelMailing.error ?? resendMessages.error,
            t("Something went wrong"),
          )}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <LinearProgress
            variant="determinate"
            value={toSend ? (processed / toSend) * 100 : 100}
            sx={{ height: 8, borderRadius: 4, mb: 2 }}
          />
          <Stack
            direction="row"
            spacing={1}
            flexWrap="wrap"
            useFlexGap
            data-testid="mailing-counts"
          >
            {MESSAGE_STATUSES.filter((status) => counts[status] > 0).map(
              (status) => (
                <Chip
                  key={status}
                  size="small"
                  color={MESSAGE_STATUS_COLORS[status]}
                  variant={statusFilter === status ? "filled" : "outlined"}
                  label={`${t(MESSAGE_STATUS_LABELS[status])}: ${counts[status]}`}
                  onClick={() =>
                    setStatusFilter(statusFilter === status ? "" : status)
                  }
                />
              ),
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              {t("Messages")}
            </Typography>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel shrink>{t("Status")}</InputLabel>
              <Select
                label={t("Status")}
                notched
                displayEmpty
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as MailingMessageStatus | "")
                }
              >
                <MenuItem value="">{t("All")}</MenuItem>
                {MESSAGE_STATUSES.map((status) => (
                  <MenuItem key={status} value={status}>
                    {t(MESSAGE_STATUS_LABELS[status])}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {canResend && (
              <Button
                variant="outlined"
                startIcon={<ReplayIcon />}
                disabled={
                  selectedMessages.length === 0 || resendMessages.isPending
                }
                onClick={() => setConfirmResend(true)}
              >
                {t("Resend selected ({{count}})", {
                  count: selectedMessages.length,
                })}
              </Button>
            )}
          </Box>

          {!loaded && <CircularProgress size={24} />}
          {loaded && (
            <TableContainer sx={{ maxHeight: 600 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>{t("Name")}</TableCell>
                    <TableCell>{t("Telegram")}</TableCell>
                    <TableCell>{t("Assignment")}</TableCell>
                    <TableCell>{t("Status")}</TableCell>
                    <TableCell>{t("Error")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody data-testid="mailing-messages">
                  {list.map((message) => (
                    <TableRow
                      key={message.message_id}
                      hover
                      sx={{ cursor: "pointer" }}
                      onClick={() => setOpened(message)}
                    >
                      <TableCell padding="checkbox">
                        {canResend && RESENDABLE.includes(message.status) && (
                          <Checkbox
                            checked={selected.has(message.message_id)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggle(message.message_id)}
                          />
                        )}
                      </TableCell>
                      <TableCell>{message.recipient_name}</TableCell>
                      <TableCell>
                        {message.telegram_username
                          ? `@${message.telegram_username}`
                          : "—"}
                      </TableCell>
                      <TableCell>{message.assignment_label ?? "—"}</TableCell>
                      <TableCell>
                        <MessageStatusChip status={message.status} />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 300 }}>
                        <Typography variant="body2" color="error" noWrap>
                          {message.error}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={opened !== null}
        onClose={() => setOpened(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{opened?.recipient_name}</DialogTitle>
        <DialogContent>
          {opened && (
            <Stack spacing={2}>
              <Box>
                <MessageStatusChip status={opened.status} />
                {opened.sent_at && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    component="span"
                    sx={{ ml: 1 }}
                  >
                    {formatDate(opened.sent_at)}
                  </Typography>
                )}
              </Box>
              {opened.error && <Alert severity="error">{opened.error}</Alert>}
              <TelegramMessage text={opened.text} buttons={opened.buttons} />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpened(null)}>{t("Close")}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmCancel} onClose={() => setConfirmCancel(false)}>
        <DialogTitle>{t("Cancel mailing")}</DialogTitle>
        <DialogContent>
          <Typography>
            {t(
              "Messages not sent yet won't be sent. The mailing can't be resumed.",
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmCancel(false)}>{t("Back")}</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              setConfirmCancel(false);
              cancelMailing.mutate(mailing.mailing_id);
            }}
          >
            {t("Cancel mailing")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmResend} onClose={() => setConfirmResend(false)}>
        <DialogTitle>{t("Resend messages")}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: resendingUnknown ? 2 : 0 }}>
            {t("Send {{count}} messages again?", {
              count: selectedMessages.length,
            })}
          </Typography>
          {resendingUnknown && (
            <Alert severity="warning">
              {t(
                "Some of them may have been delivered: their delivery is unknown. These recipients may get the message twice.",
              )}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmResend(false)}>{t("Back")}</Button>
          <Button variant="contained" onClick={resend}>
            {t("Resend")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
