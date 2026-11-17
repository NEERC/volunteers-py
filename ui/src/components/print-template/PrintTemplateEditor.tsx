import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AssignmentMode } from "@/client/types.gen";
import { ExpressionEditor } from "@/components/mailing/ExpressionEditor";
import {
  jsonBody,
  type PrintAsset,
  type PrintContext,
  type PrintRecipient,
  type PrintTemplate,
  printJson,
  printRequest,
  templatesPath,
} from "@/data/print-templates";
import { useYearDays } from "@/data/use-admin";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { apiErrorMessage } from "@/utils/apiErrorHandling";
import { TemplateAssets } from "./TemplateAssets";
import { TypstEditor } from "./TypstEditor";

const recipientKey = (recipient: PrintRecipient) =>
  `${recipient.form_id}:${recipient.user_day_id}`;

function PdfFrame({ pdf }: { pdf: Blob }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const objectUrl = URL.createObjectURL(pdf);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [pdf]);
  return (
    <Box
      component="iframe"
      title={t("PDF preview")}
      src={url}
      sx={{ border: 0, width: "100%", height: 560 }}
    />
  );
}

type Props = { template: PrintTemplate; yearId: string; path: string };
export function PrintTemplateEditor({ template, yearId, path }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [title, setTitle] = useState(template.title);
  const [source, setSource] = useState(template.source);
  const [day, setDay] = useState("");
  const [expression, setExpression] = useState("");
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("first");
  const [excluded, setExcluded] = useState<PrintRecipient[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [assetsVersion, setAssetsVersion] = useState(0);
  const { data: days, error: daysError } = useYearDays(yearId);
  const candidateContext = useMemo<PrintContext>(
    () => ({
      day_id: Number(day),
      filter: { expression: expression.trim() || null },
      assignment_mode: assignmentMode,
      excluded_form_ids: [],
    }),
    [day, expression, assignmentMode],
  );
  const context = useMemo<PrintContext>(
    () => ({
      ...candidateContext,
      excluded_form_ids: excluded.map(({ form_id }) => form_id),
    }),
    [candidateContext, excluded],
  );
  const debouncedCandidates = useDebouncedValue(candidateContext, 400);
  const recipients = useQuery({
    queryKey: [path, "recipients", debouncedCandidates],
    queryFn: ({ signal }) =>
      printJson<{ recipients: PrintRecipient[] }>(`${path}/recipients`, {
        method: "POST",
        ...jsonBody(debouncedCandidates),
        signal,
      }),
    enabled: Boolean(day) && debouncedCandidates === candidateContext,
    retry: false,
  });
  const candidates = recipients.data?.recipients ?? [];
  const included = candidates.filter(
    (recipient) => !context.excluded_form_ids.includes(recipient.form_id),
  );
  const activeRecipient = included.find(
    (recipient) => recipientKey(recipient) === selectedRecipient,
  );
  const previewRequest = useMemo(
    () => ({
      ...context,
      source,
      form_id: activeRecipient?.form_id,
      user_day_id: activeRecipient?.user_day_id,
    }),
    [context, source, activeRecipient],
  );
  const debouncedPreview = useDebouncedValue(previewRequest, 450);
  const preview = useQuery({
    queryKey: [path, "preview", assetsVersion, debouncedPreview],
    queryFn: async ({ signal }) => {
      const response = await printRequest(`${path}/preview`, {
        method: "POST",
        ...jsonBody(debouncedPreview),
        signal,
      });
      return response.status === 204 ? null : response.blob();
    },
    enabled:
      Boolean(day) &&
      debouncedPreview === previewRequest &&
      !recipients.isError,
    retry: false,
  });
  const save = useMutation({
    mutationFn: () =>
      printJson<PrintTemplate>(path, {
        method: "PATCH",
        ...jsonBody({ title: title.trim(), source }),
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData<PrintTemplate>([path], (current) => ({
        ...saved,
        assets: current?.assets ?? saved.assets,
      }));
      void queryClient.invalidateQueries({
        queryKey: [templatesPath(yearId)],
        exact: true,
      });
    },
  });
  const remove = useMutation({
    mutationFn: () => printRequest(path, { method: "DELETE" }),
    onSuccess: async () => {
      void queryClient.invalidateQueries({
        queryKey: [templatesPath(yearId)],
        exact: true,
      });
      await navigate({ to: "/$yearId/templates", params: { yearId } });
    },
  });
  const generate = useMutation({
    mutationFn: async () => {
      const response = await printRequest(`${path}/generate`, {
        method: "POST",
        ...jsonBody({ ...context, source }),
      });
      if (response.status === 204) return false;
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download =
        response.headers
          .get("Content-Disposition")
          ?.match(/filename="?([^";]+)"?/i)?.[1] ?? `badges-${day}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    },
  });

  const updateAssets = (assets: PrintAsset[]) => {
    queryClient.setQueryData<PrintTemplate>([path], (current) => ({
      ...(current ?? template),
      assets,
    }));
    setAssetsVersion((current) => current + 1);
  };
  const error = save.error || remove.error || generate.error || daysError;
  const noRecipients = t("No recipients match the filters.");
  const requestFailed = t("Template request failed");
  const excludedOptions = Array.from(
    new Map(
      [...candidates, ...excluded].map((recipient) => [
        recipient.form_id,
        recipient,
      ]),
    ).values(),
  );

  return (
    <Stack spacing={2}>
      <Link to="/$yearId/templates" params={{ yearId }}>
        {t("Templates")}
      </Link>
      <Typography variant="h4">{template.title}</Typography>
      <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1}>
        <TextField
          size="small"
          label={t("Template name")}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <Button
          variant="outlined"
          disabled={
            !title.trim() ||
            save.isPending ||
            (title === template.title && source === template.source)
          }
          onClick={() => save.mutate()}
        >
          {t("Save")}
        </Button>
        <Button color="error" onClick={() => setConfirmDelete(true)}>
          {t("Delete")}
        </Button>
        <Button
          variant="contained"
          disabled={
            !day ||
            generate.isPending ||
            debouncedCandidates !== candidateContext ||
            recipients.isPending ||
            recipients.isError ||
            included.length === 0
          }
          onClick={() => generate.mutate()}
        >
          {t("Generate")}
        </Button>
      </Stack>
      {error && (
        <Alert severity="error">{apiErrorMessage(error, requestFailed)}</Alert>
      )}
      {generate.data === false && <Alert severity="info">{noRecipients}</Alert>}
      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <DialogTitle>{t("Delete this print template?")}</DialogTitle>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(false)}>{t("Cancel")}</Button>
          <Button
            disabled={remove.isPending}
            color="error"
            onClick={() => remove.mutate()}
          >
            {t("Delete")}
          </Button>
        </DialogActions>
        {remove.error && (
          <Alert severity="error">
            {apiErrorMessage(remove.error, requestFailed)}
          </Alert>
        )}
      </Dialog>
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          {t("Context settings")}
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <TextField
              select
              label={t("Day")}
              value={day}
              onChange={(event) => {
                setDay(event.target.value);
                setSelectedRecipient("");
              }}
            >
              <MenuItem value="">{t("Select a day")}</MenuItem>
              {(days ?? []).map((entry) => (
                <MenuItem key={entry.day_id} value={String(entry.day_id)}>
                  {entry.name}
                </MenuItem>
              ))}
            </TextField>
            <Box>
              <Typography gutterBottom>{t("Expression filter")}</Typography>
              <ExpressionEditor value={expression} onChange={setExpression} />
            </Box>
            <TextField
              select
              label={t("Assignments per recipient")}
              value={assignmentMode}
              onChange={(event) =>
                setAssignmentMode(
                  event.target.value === "all" ? "all" : "first",
                )
              }
            >
              <MenuItem value="first">
                {t("First matching assignment")}
              </MenuItem>
              <MenuItem value="all">{t("All matching assignments")}</MenuItem>
            </TextField>
            <Autocomplete
              multiple
              options={excludedOptions}
              value={excluded}
              isOptionEqualToValue={(a, b) => a.form_id === b.form_id}
              getOptionLabel={(recipient) => recipient.name}
              getOptionKey={(recipient) => recipient.form_id}
              onChange={(_, value) => setExcluded(value)}
              renderInput={(params) => (
                <TextField {...params} label={t("Excluded applications")} />
              )}
            />
            <TextField
              select
              label={t("Preview recipient")}
              value={activeRecipient ? recipientKey(activeRecipient) : ""}
              onChange={(event) => setSelectedRecipient(event.target.value)}
            >
              <MenuItem value="">{t("First matching recipient")}</MenuItem>
              {included.map((recipient) => (
                <MenuItem
                  key={recipientKey(recipient)}
                  value={recipientKey(recipient)}
                >
                  {recipient.name}
                </MenuItem>
              ))}
            </TextField>
            {recipients.error && (
              <Alert severity="error">
                {apiErrorMessage(recipients.error, requestFailed)}
              </Alert>
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>
      <TemplateAssets
        path={path}
        assets={template.assets}
        onChange={updateAssets}
      />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            lg: "repeat(2, minmax(0, 1fr))",
          },
          gap: 2,
        }}
      >
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          <TypstEditor
            label={t("Typst source")}
            value={source}
            onChange={setSource}
          />
        </Paper>
        <Paper variant="outlined" sx={{ minHeight: 560 }}>
          {!day && (
            <Alert severity="info">
              {t("Select a day to preview the PDF.")}
            </Alert>
          )}
          {day &&
            (debouncedPreview !== previewRequest || preview.isFetching) && (
              <CircularProgress size={24} sx={{ m: 2 }} />
            )}
          {day && preview.error && (
            <Alert severity="error" sx={{ whiteSpace: "pre-wrap" }}>
              {apiErrorMessage(preview.error, requestFailed)}
            </Alert>
          )}
          {day && preview.data === null && (
            <Alert severity="info">{noRecipients}</Alert>
          )}
          {day && preview.data && <PdfFrame pdf={preview.data} />}
        </Paper>
      </Box>
    </Stack>
  );
}
