import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogTitle,
  FormControlLabel,
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
import {
  deletePrintTemplateApiV1AdminPrintTemplateYearYearIdTemplateIdDelete as deletePrintTemplate,
  editPrintTemplateApiV1AdminPrintTemplateYearYearIdTemplateIdPatch as editPrintTemplate,
  generatePrintTemplateApiV1AdminPrintTemplateYearYearIdTemplateIdGeneratePost as generatePrintTemplate,
  listPrintRecipientsApiV1AdminPrintTemplateYearYearIdTemplateIdRecipientsPost as listPrintRecipients,
  previewPrintTemplateApiV1AdminPrintTemplateYearYearIdTemplateIdPreviewPost as previewPrintTemplate,
} from "@/client";
import type {
  AssignmentMode,
  PrintAsset,
  PrintContext,
  PrintRecipient,
  PrintTemplateDetail,
} from "@/client/types.gen";
import { ExpressionEditor } from "@/components/mailing/ExpressionEditor";
import { printPdfResponse, printTemplateKeys } from "@/data/print-templates";
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

type Props = { template: PrintTemplateDetail; yearId: string };
export function PrintTemplateEditor({ template, yearId }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const path = { year_id: Number(yearId), template_id: template.template_id };
  const queryKey = printTemplateKeys.detail(
    yearId,
    String(template.template_id),
  );
  const navigate = useNavigate();
  const [title, setTitle] = useState(template.title);
  const [source, setSource] = useState(template.source);
  const [day, setDay] = useState("");
  const [expression, setExpression] = useState("");
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("first");
  const [excluded, setExcluded] = useState<number[]>([]);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [lastPdf, setLastPdf] = useState<Blob | null>(null);
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
      excluded_form_ids: excluded,
    }),
    [candidateContext, excluded],
  );
  const debouncedCandidates = useDebouncedValue(candidateContext, 400);
  const recipients = useQuery({
    queryKey: [...queryKey, "recipients", debouncedCandidates],
    queryFn: ({ signal }) =>
      listPrintRecipients({
        path,
        body: debouncedCandidates,
        signal,
        throwOnError: true,
      }).then(({ data }) => data),
    enabled: Boolean(day) && debouncedCandidates === candidateContext,
    retry: false,
  });
  const candidates = recipients.data?.recipients ?? [];
  const excludedIds = useMemo(() => new Set(excluded), [excluded]);
  const included = candidates.filter(
    (recipient) => !excludedIds.has(recipient.form_id),
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
    queryKey: [...queryKey, "preview", assetsVersion, debouncedPreview],
    queryFn: async ({ signal }) => {
      const response = await printPdfResponse(
        previewPrintTemplate({
          path,
          body: debouncedPreview,
          signal,
          throwOnError: true,
        }),
      );
      return response.data instanceof Blob ? response.data : null;
    },
    enabled:
      Boolean(day) &&
      debouncedPreview === previewRequest &&
      !recipients.isError,
    retry: false,
  });
  useEffect(() => {
    if (preview.data !== undefined) setLastPdf(preview.data);
  }, [preview.data]);

  const save = useMutation({
    mutationFn: () =>
      editPrintTemplate({
        path,
        body: { title: title.trim(), source },
        throwOnError: true,
      }).then(({ data }) => data),
    onSuccess: (saved) => {
      queryClient.setQueryData<PrintTemplateDetail>(queryKey, (current) => ({
        ...saved,
        assets: current?.assets ?? saved.assets,
      }));
      void queryClient.invalidateQueries({
        queryKey: printTemplateKeys.year(yearId),
        exact: true,
      });
    },
  });
  const remove = useMutation({
    mutationFn: () => deletePrintTemplate({ path, throwOnError: true }),
    onSuccess: async () => {
      void queryClient.invalidateQueries({
        queryKey: printTemplateKeys.year(yearId),
        exact: true,
      });
      await navigate({ to: "/$yearId/templates", params: { yearId } });
    },
  });
  const generate = useMutation({
    mutationFn: async () => {
      const response = await printPdfResponse(
        generatePrintTemplate({
          path,
          body: { ...context, source },
          throwOnError: true,
        }),
      );
      if (response.status === 204 || !response.data) return false;
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      const disposition = response.headers["content-disposition"];
      link.download =
        typeof disposition === "string"
          ? (disposition.match(/filename="([^"]+)"/i)?.[1] ??
            `badges-${day}.pdf`)
          : `badges-${day}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    },
  });

  const updateAssets = (assets: PrintAsset[]) => {
    queryClient.setQueryData<PrintTemplateDetail>(queryKey, (current) => ({
      ...(current ?? template),
      assets,
    }));
    setAssetsVersion((current) => current + 1);
  };
  const error = save.error || generate.error || daysError;
  const noRecipients = t("No recipients match the filters.");
  const requestFailed = t("Template request failed");
  const shownRecipients = Array.from(
    new Map(
      candidates.map((recipient) => [recipient.form_id, recipient]),
    ).values(),
  ).filter(({ name }) =>
    name
      .toLocaleLowerCase()
      .includes(recipientSearch.trim().toLocaleLowerCase()),
  );
  const shownIncluded = shownRecipients.filter(
    ({ form_id }) => !excludedIds.has(form_id),
  ).length;
  const allShownIncluded = shownIncluded === shownRecipients.length;
  const setRecipientsIncluded = (formIds: number[], included: boolean) => {
    setExcluded((current) => {
      const next = new Set(current);
      for (const id of formIds) {
        if (included) next.delete(id);
        else next.add(id);
      }
      return [...next];
    });
  };
  const pdf = preview.data === undefined ? lastPdf : preview.data;

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
                setLastPdf(null);
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
            <Box>
              <Typography gutterBottom>{t("Excluded applications")}</Typography>
              <TextField
                size="small"
                type="search"
                label={t("Search by name")}
                value={recipientSearch}
                onChange={(event) => setRecipientSearch(event.target.value)}
              />
              <Stack sx={{ maxHeight: 240, overflowY: "auto" }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={shownRecipients.length > 0 && allShownIncluded}
                      indeterminate={shownIncluded > 0 && !allShownIncluded}
                      disabled={shownRecipients.length === 0}
                      onChange={() =>
                        setRecipientsIncluded(
                          shownRecipients.map(({ form_id }) => form_id),
                          !allShownIncluded,
                        )
                      }
                    />
                  }
                  label={t("Include all shown")}
                />
                {recipientSearch.trim() && shownRecipients.length === 0 && (
                  <Typography color="text.secondary">
                    {t("Nobody found")}
                  </Typography>
                )}
                {shownRecipients.map(({ form_id, name }) => (
                  <FormControlLabel
                    key={form_id}
                    control={
                      <Checkbox
                        checked={!excludedIds.has(form_id)}
                        onChange={(event) =>
                          setRecipientsIncluded([form_id], event.target.checked)
                        }
                      />
                    }
                    label={name}
                  />
                ))}
              </Stack>
            </Box>
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
                  {[
                    recipient.name,
                    recipient.position_name,
                    recipient.hall_name,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
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
        <Paper variant="outlined" sx={{ minHeight: 560, position: "relative" }}>
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
            <Alert
              severity="error"
              variant="filled"
              sx={{
                whiteSpace: "pre-wrap",
                ...(pdf && {
                  position: "absolute",
                  top: 8,
                  left: 8,
                  right: 8,
                  zIndex: 1,
                }),
              }}
            >
              {apiErrorMessage(preview.error, requestFailed)}
            </Alert>
          )}
          {day && preview.data === null && (
            <Alert severity="info">{noRecipients}</Alert>
          )}
          {day && pdf && <PdfFrame pdf={pdf} />}
        </Paper>
      </Box>
    </Stack>
  );
}
