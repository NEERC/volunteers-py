import {
  Alert,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  jsonBody,
  type PrintTemplate,
  type PrintTemplateSummary,
  printJson,
  templatesPath,
} from "@/data/print-templates";
import { apiErrorMessage } from "@/utils/apiErrorHandling";
import { shouldBeAdmin } from "@/utils/should-be-logged-in";

export const Route = createFileRoute("/_logged-in/$yearId/templates/")({
  beforeLoad: ({ context }) => {
    shouldBeAdmin(context);
    return { title: "Templates" };
  },
  component: TemplatesPage,
});

function TemplatesPage() {
  const { t } = useTranslation();
  const { yearId } = Route.useParams();
  const path = templatesPath(yearId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const templates = useQuery({
    queryKey: [path],
    queryFn: ({ signal }) =>
      printJson<{ templates: PrintTemplateSummary[] }>(path, { signal }),
  });
  const create = useMutation({
    mutationFn: () =>
      printJson<PrintTemplate>(path, {
        method: "POST",
        ...jsonBody({ title: title.trim() }),
      }),
    onSuccess: async (template) => {
      const templateId = String(template.template_id);
      queryClient.setQueryData([`${path}/${templateId}`], template);
      void queryClient.invalidateQueries({ queryKey: [path] });
      await navigate({
        to: "/$yearId/templates/$templateId",
        params: { yearId, templateId },
      });
    },
  });

  return (
    <Stack spacing={2} sx={{ p: 3 }}>
      <Typography variant="h4">{t("Templates")}</Typography>
      <Stack
        component="form"
        direction="row"
        spacing={2}
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim() && !create.isPending) create.mutate();
        }}
      >
        <TextField
          size="small"
          label={t("Template name")}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
        <Button
          type="submit"
          variant="contained"
          disabled={!title.trim() || create.isPending}
        >
          {t("Create template")}
        </Button>
      </Stack>
      {templates.isPending && <CircularProgress />}
      {(templates.error || create.error) && (
        <Alert severity="error">
          {apiErrorMessage(
            templates.error || create.error,
            t("Template request failed"),
          )}
        </Alert>
      )}
      {templates.data?.templates.length === 0 && (
        <Typography color="text.secondary">
          {t("No print templates yet.")}
        </Typography>
      )}
      {templates.data?.templates.map((template) => (
        <Typography key={template.template_id}>
          <Link
            to="/$yearId/templates/$templateId"
            params={{ yearId, templateId: String(template.template_id) }}
          >
            {template.title}
          </Link>
        </Typography>
      ))}
    </Stack>
  );
}
