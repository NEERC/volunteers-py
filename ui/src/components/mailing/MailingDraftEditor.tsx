import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import DeleteIcon from "@mui/icons-material/Delete";
import SendIcon from "@mui/icons-material/Send";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  Attendance,
  MailingButton,
  MailingDraft,
  MailingFilter,
  MailingPreviewRequest,
  MailingRecipient,
  MailingRecipientError,
  MailingRenderError,
  MailingResponse,
} from "@/client/types.gen";
import { useYearDays, useYearHalls, useYearPositions } from "@/data/use-admin";
import {
  useDeleteMailing,
  useEditMailing,
  useMailingPreview,
  useMailingRecipients,
  useStartMailing,
  useTestSendMessage,
} from "@/data/use-mailings";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { apiErrorMessage } from "@/utils/apiErrorHandling";
import { ATTENDANCE_LABELS, MailingStatusChip } from "./status";
import { TelegramMessage } from "./TelegramMessage";
import { TemplateEditor } from "./TemplateEditor";

const DEBOUNCE_MS = 700;
const NO_HALL = -1;
const ATTENDANCES = Object.keys(ATTENDANCE_LABELS) as Attendance[];

type Selection = { formId: number; userDayId: number | null };

const toDraft = (mailing: MailingResponse): MailingDraft => ({
  title: mailing.title,
  template: mailing.template,
  buttons: mailing.buttons,
  filter: mailing.filter,
  excluded_form_ids: mailing.excluded_form_ids,
  assignment_mode: mailing.assignment_mode,
});

const isFilterEmpty = (filter: MailingFilter) =>
  !filter.day_ids?.length &&
  !filter.position_ids?.length &&
  !filter.hall_ids?.length &&
  !filter.no_hall &&
  !filter.attendance?.length;

function errorText(
  t: (key: string, options?: Record<string, unknown>) => string,
  error: MailingRenderError,
) {
  const where =
    error.field === "text"
      ? t("Message")
      : t("Button {{number}}", { number: (error.button ?? 0) + 1 });
  const line = error.line
    ? `, ${t("line {{line}}", { line: error.line })}`
    : "";
  return `${where}${line}: ${error.message}`;
}

export function MailingDraftEditor({ mailing }: { mailing: MailingResponse }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const yearId = mailing.year_id;
  const [draft, setDraft] = useState<MailingDraft>(() => toDraft(mailing));
  const debouncedDraft = useDebouncedValue(draft, DEBOUNCE_MS);
  const update = (changes: Partial<MailingDraft>) =>
    setDraft((previous) => ({ ...previous, ...changes }));
  const filter = draft.filter ?? {};
  const updateFilter = (changes: Partial<MailingFilter>) =>
    update({ filter: { ...filter, ...changes } });

  // Autosave
  const editMailing = useEditMailing();
  const savedDraft = useRef(debouncedDraft);
  useEffect(() => {
    if (savedDraft.current === debouncedDraft) return;
    savedDraft.current = debouncedDraft;
    editMailing.mutate({
      mailingId: mailing.mailing_id,
      draft: debouncedDraft,
    });
  }, [debouncedDraft, mailing.mailing_id, editMailing.mutate]);
  const unsaved = draft !== debouncedDraft || editMailing.isPending;

  const { data: days } = useYearDays(yearId);
  const { data: positions } = useYearPositions(yearId);
  const { data: halls } = useYearHalls(yearId);
  const recipients = useMailingRecipients(yearId, debouncedDraft);
  const recipientList = recipients.data?.recipients ?? [];

  // Recipient of the preview: the chosen one while it's in the mailing
  const [chosen, setChosen] = useState<Selection | null>(null);
  const selection = useMemo<Selection | null>(() => {
    const fits = (s: Selection) =>
      recipientList.some(
        (r) =>
          r.form_id === s.formId &&
          r.message_user_day_ids.includes(s.userDayId),
      );
    if (chosen && fits(chosen)) return chosen;
    const first =
      recipientList.find((r) => !r.excluded && r.has_telegram) ??
      recipientList[0];
    return first
      ? { formId: first.form_id, userDayId: first.message_user_day_ids[0] }
      : null;
  }, [chosen, recipientList]);

  const previewRequest: MailingPreviewRequest | null = selection
    ? {
        draft: debouncedDraft,
        form_id: selection.formId,
        user_day_id: selection.userDayId,
      }
    : null;
  const preview = useMailingPreview(yearId, previewRequest);
  const previewErrors = preview.data?.errors ?? [];

  const testSend = useTestSendMessage();
  const startMailing = useStartMailing();
  const deleteMailing = useDeleteMailing();
  const [confirmStart, setConfirmStart] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [startErrors, setStartErrors] = useState<{
    description: string;
    errors: MailingRecipientError[];
  } | null>(null);

  const start = async () => {
    setConfirmStart(false);
    const result = await startMailing.mutateAsync({
      mailingId: mailing.mailing_id,
      draft,
    });
    if (!result.started) {
      setStartErrors({
        description: result.description ?? "",
        errors: result.errors ?? [],
      });
    }
  };

  const remove = async () => {
    await deleteMailing.mutateAsync(mailing);
    navigate({ to: "/$yearId/mailings", params: { yearId: String(yearId) } });
  };

  const excluded = new Set(draft.excluded_form_ids ?? []);
  const toggleExcluded = (recipient: MailingRecipient) => {
    const next = new Set(excluded);
    if (next.has(recipient.form_id)) next.delete(recipient.form_id);
    else next.add(recipient.form_id);
    update({ excluded_form_ids: [...next] });
  };

  const buttons = draft.buttons ?? [];
  const setButtons = (next: MailingButton[]) => update({ buttons: next });
  const moveButton = (from: number, to: number) => {
    const next = [...buttons];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setButtons(next);
  };

  const filterEmpty = isFilterEmpty(filter);
  const usesAssignment = recipients.data?.uses_assignment ?? false;
  const messages = recipients.data?.messages ?? 0;

  const messageLabel = (
    recipient: MailingRecipient,
    userDayId: number | null,
  ) => {
    const assignment = recipient.assignments.find(
      (a) => a.user_day_id === userDayId,
    );
    return assignment
      ? `${recipient.name} — ${assignment.day_name}`
      : recipient.name;
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <TextField
          label={t("Title")}
          value={draft.title ?? ""}
          onChange={(e) => update({ title: e.target.value })}
          sx={{ flexGrow: 1 }}
          slotProps={{ htmlInput: { "data-testid": "mailing-title" } }}
        />
        <MailingStatusChip status={mailing.status} />
        <Typography
          variant="body2"
          color={editMailing.isError ? "error" : "text.secondary"}
          sx={{ minWidth: 90 }}
          data-testid="mailing-save-state"
        >
          {editMailing.isError
            ? t("Not saved")
            : unsaved
              ? t("Saving…")
              : t("Saved")}
        </Typography>
        <Button
          color="error"
          startIcon={<DeleteIcon />}
          onClick={() => setConfirmDelete(true)}
        >
          {t("Delete")}
        </Button>
        <Button
          variant="contained"
          startIcon={<SendIcon />}
          disabled={messages === 0 || startMailing.isPending}
          onClick={() => setConfirmStart(true)}
        >
          {t("Start mailing")}
        </Button>
      </Box>

      {startMailing.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {apiErrorMessage(startMailing.error, t("Failed to start mailing"))}
        </Alert>
      )}

      {/* Recipients */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t("Recipients")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t(
              "All application forms of the year. With a filter, only the forms with a matching assignment: all conditions apply to the same assignment, and its day, position and hall can be used in the message.",
            )}
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" },
              gap: 2,
              mb: 2,
            }}
          >
            <Autocomplete
              multiple
              size="small"
              options={days ?? []}
              getOptionLabel={(day) => day.name}
              value={(days ?? []).filter((d) =>
                filter.day_ids?.includes(d.day_id),
              )}
              onChange={(_, value) =>
                updateFilter({ day_ids: value.map((d) => d.day_id) })
              }
              renderInput={(params) => (
                <TextField {...params} label={t("Days")} />
              )}
              data-testid="mailing-filter-days"
            />
            <Autocomplete
              multiple
              size="small"
              options={positions ?? []}
              getOptionLabel={(position) => position.name}
              value={(positions ?? []).filter((p) =>
                filter.position_ids?.includes(p.position_id),
              )}
              onChange={(_, value) =>
                updateFilter({ position_ids: value.map((p) => p.position_id) })
              }
              renderInput={(params) => (
                <TextField {...params} label={t("Positions")} />
              )}
            />
            <Autocomplete
              multiple
              size="small"
              options={[NO_HALL, ...(halls ?? []).map((h) => h.hall_id)]}
              getOptionLabel={(id) =>
                id === NO_HALL
                  ? t("Without hall")
                  : (halls?.find((h) => h.hall_id === id)?.name ?? "")
              }
              value={[
                ...(filter.no_hall ? [NO_HALL] : []),
                ...(filter.hall_ids ?? []),
              ]}
              onChange={(_, value) =>
                updateFilter({
                  no_hall: value.includes(NO_HALL),
                  hall_ids: value.filter((id) => id !== NO_HALL),
                })
              }
              renderInput={(params) => (
                <TextField {...params} label={t("Halls")} />
              )}
            />
            <Autocomplete
              multiple
              size="small"
              options={ATTENDANCES}
              getOptionLabel={(attendance) => t(ATTENDANCE_LABELS[attendance])}
              value={filter.attendance ?? []}
              onChange={(_, value) => updateFilter({ attendance: value })}
              renderInput={(params) => (
                <TextField {...params} label={t("Attendance")} />
              )}
            />
          </Box>

          {usesAssignment && !filterEmpty && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
              <Typography variant="body2">
                {t("Recipients with several matching assignments get")}
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={draft.assignment_mode ?? "first"}
                onChange={(_, value) =>
                  value && update({ assignment_mode: value })
                }
              >
                <ToggleButton value="first">
                  {t("One message, for the first day")}
                </ToggleButton>
                <ToggleButton value="all">
                  {t("A message per assignment")}
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          )}
          {usesAssignment && filterEmpty && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t(
                "The message uses the assignment, but there is no assignment filter: set a filter by day, position, hall or attendance.",
              )}
            </Alert>
          )}
          {recipients.data?.has_unpublished_days && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t(
                "Some assignments are on days whose assignments are not published yet.",
              )}
            </Alert>
          )}
          {recipients.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {apiErrorMessage(
                recipients.error,
                t("Failed to load recipients"),
              )}
            </Alert>
          )}

          <Typography
            variant="body2"
            sx={{ mb: 1 }}
            data-testid="mailing-summary"
          >
            {t(
              "Messages to send: {{messages}}, recipients without Telegram: {{skipped}}",
              {
                messages,
                skipped: recipients.data?.skipped_messages ?? 0,
              },
            )}
          </Typography>
          <TableContainer sx={{ maxHeight: 400 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">{t("Send")}</TableCell>
                  <TableCell>{t("Name")}</TableCell>
                  <TableCell>{t("Telegram")}</TableCell>
                  <TableCell>{t("Assignments")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody data-testid="mailing-recipients">
                {recipientList.map((recipient) => (
                  <TableRow
                    key={recipient.form_id}
                    hover
                    selected={selection?.formId === recipient.form_id}
                    sx={{
                      cursor: "pointer",
                      opacity:
                        recipient.excluded || !recipient.has_telegram ? 0.5 : 1,
                    }}
                    onClick={() =>
                      setChosen({
                        formId: recipient.form_id,
                        userDayId: recipient.message_user_day_ids[0],
                      })
                    }
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={!recipient.excluded}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleExcluded(recipient)}
                        slotProps={{
                          input: {
                            "aria-label": t("Send to {{name}}", {
                              name: recipient.name,
                            }),
                          },
                        }}
                      />
                    </TableCell>
                    <TableCell>{recipient.name}</TableCell>
                    <TableCell>
                      {recipient.has_telegram ? (
                        recipient.telegram_username ? (
                          `@${recipient.telegram_username}`
                        ) : (
                          "✓"
                        )
                      ) : (
                        <Chip size="small" label={t("No Telegram")} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack
                        direction="row"
                        spacing={0.5}
                        flexWrap="wrap"
                        useFlexGap
                      >
                        {recipient.assignments.map((a) => (
                          <Chip
                            key={a.user_day_id}
                            size="small"
                            variant={
                              recipient.message_user_day_ids.includes(
                                a.user_day_id,
                              )
                                ? "filled"
                                : "outlined"
                            }
                            label={[a.day_name, a.position_name, a.hall_name]
                              .filter(Boolean)
                              .join(" · ")}
                          />
                        ))}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "3fr 2fr" },
          gap: 3,
        }}
      >
        {/* Message */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t("Message")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t("Jinja2 template, variables are suggested inside")}{" "}
              <code>{"{{ … }}"}</code>, {t("e.g.")}{" "}
              <code>{"{{ user.first_name_ru }}"}</code>,{" "}
              <code>{"{% if hall %}…{% endif %}"}</code>.{" "}
              {t("Formatting is Telegram HTML:")}{" "}
              <code>
                {
                  "<b> <i> <u> <s> <a href> <code> <pre> <blockquote> <tg-spoiler>"
                }
              </code>
            </Typography>
            <TemplateEditor
              value={draft.template ?? ""}
              onChange={(template) => update({ template })}
              errors={previewErrors.filter((e) => e.field === "text")}
              testId="mailing-template"
            />

            <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>
              {t("Link buttons")}
            </Typography>
            <Stack spacing={1}>
              {buttons.map((button, i) => {
                const errors = previewErrors.filter((e) => e.button === i);
                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: buttons have no ids
                  <Box key={i}>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "1fr 2fr auto",
                        gap: 1,
                        alignItems: "center",
                      }}
                    >
                      <TemplateEditor
                        singleLine
                        value={button.text ?? ""}
                        onChange={(text) =>
                          setButtons(
                            buttons.map((b, j) =>
                              j === i ? { ...b, text } : b,
                            ),
                          )
                        }
                        errors={errors.filter((e) => e.field === "button_text")}
                        testId={`mailing-button-text-${i}`}
                      />
                      <TemplateEditor
                        singleLine
                        value={button.url ?? ""}
                        onChange={(url) =>
                          setButtons(
                            buttons.map((b, j) =>
                              j === i ? { ...b, url } : b,
                            ),
                          )
                        }
                        errors={errors.filter((e) => e.field === "button_url")}
                        testId={`mailing-button-url-${i}`}
                      />
                      <Box sx={{ display: "flex" }}>
                        <IconButton
                          size="small"
                          disabled={i === 0}
                          onClick={() => moveButton(i, i - 1)}
                          aria-label={t("Move up")}
                        >
                          <ArrowUpwardIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          disabled={i === buttons.length - 1}
                          onClick={() => moveButton(i, i + 1)}
                          aria-label={t("Move down")}
                        >
                          <ArrowDownwardIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() =>
                            setButtons(buttons.filter((_, j) => j !== i))
                          }
                          aria-label={t("Delete")}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  </Box>
                );
              })}
              <Box>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() =>
                    setButtons([...buttons, { text: "", url: "" }])
                  }
                >
                  {t("Add button")}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t("Preview")}
            </Typography>
            {selection && (
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>{t("Recipient")}</InputLabel>
                <Select
                  label={t("Recipient")}
                  value={`${selection.formId}:${selection.userDayId ?? ""}`}
                  onChange={(e) => {
                    const [formId, userDayId] = e.target.value.split(":");
                    setChosen({
                      formId: Number(formId),
                      userDayId: userDayId ? Number(userDayId) : null,
                    });
                  }}
                >
                  {recipientList.flatMap((recipient) =>
                    recipient.message_user_day_ids.map((userDayId) => (
                      <MenuItem
                        key={`${recipient.form_id}:${userDayId ?? ""}`}
                        value={`${recipient.form_id}:${userDayId ?? ""}`}
                      >
                        {messageLabel(recipient, userDayId)}
                      </MenuItem>
                    )),
                  )}
                </Select>
              </FormControl>
            )}
            {!selection && (
              <Typography color="text.secondary">
                {t("No recipients")}
              </Typography>
            )}
            {previewErrors.length > 0 && (
              <Alert
                severity="error"
                sx={{ mb: 2 }}
                data-testid="mailing-preview-errors"
              >
                {previewErrors.map((error) => (
                  <div key={errorText(t, error)}>{errorText(t, error)}</div>
                ))}
              </Alert>
            )}
            {preview.data && previewErrors.length === 0 && (
              <TelegramMessage
                text={preview.data.text}
                buttons={preview.data.buttons}
              />
            )}
            {previewRequest && (
              <Box sx={{ mt: 2 }}>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={testSend.isPending || previewErrors.length > 0}
                  onClick={() =>
                    testSend.mutate({ yearId, request: previewRequest })
                  }
                >
                  {t("Send a test message to me")}
                </Button>
                {testSend.isSuccess && (
                  <Typography
                    variant="body2"
                    color="success.main"
                    sx={{ mt: 1 }}
                  >
                    {t("Test message sent to your Telegram")}
                  </Typography>
                )}
                {testSend.error && (
                  <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                    {apiErrorMessage(
                      testSend.error,
                      t("Failed to send test message"),
                    )}
                  </Typography>
                )}
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>

      <Dialog open={confirmStart} onClose={() => setConfirmStart(false)}>
        <DialogTitle>{t("Start mailing")}</DialogTitle>
        <DialogContent>
          <Typography>
            {t(
              "Send {{messages}} messages in Telegram? A started mailing can't be edited.",
              {
                messages,
              },
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmStart(false)}>{t("Cancel")}</Button>
          <Button variant="contained" onClick={start}>
            {t("Send")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <DialogTitle>{t("Delete draft")}</DialogTitle>
        <DialogContent>
          <Typography>{t("Delete this draft mailing?")}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(false)}>{t("Cancel")}</Button>
          <Button color="error" variant="contained" onClick={remove}>
            {t("Delete")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={startErrors !== null}
        onClose={() => setStartErrors(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{t("The mailing can't be started")}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>{startErrors?.description}</Typography>
          <List dense data-testid="mailing-start-errors">
            {startErrors?.errors.slice(0, 100).map((error) => (
              <ListItem
                key={`${error.form_id}:${error.user_day_id}:${error.field}:${error.button}:${error.message}`}
              >
                <ListItemText
                  primary={error.recipient_name}
                  secondary={errorText(t, error)}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStartErrors(null)}>{t("Close")}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
