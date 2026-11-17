import { Alert, Box, CircularProgress } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PrintTemplateEditor } from "@/components/print-template/PrintTemplateEditor";
import {
  type PrintTemplate,
  printJson,
  templatesPath,
} from "@/data/print-templates";
import { apiErrorMessage } from "@/utils/apiErrorHandling";
import { shouldBeAdmin } from "@/utils/should-be-logged-in";

export const Route = createFileRoute(
  "/_logged-in/$yearId/templates/$templateId",
)({
  beforeLoad: ({ context }) => {
    shouldBeAdmin(context);
    return { title: "Templates" };
  },
  component: TemplatePage,
});

function TemplatePage() {
  const { t } = useTranslation();
  const { yearId, templateId } = Route.useParams();
  const path = `${templatesPath(yearId)}/${templateId}`;
  const template = useQuery({
    queryKey: [path],
    queryFn: ({ signal }) => printJson<PrintTemplate>(path, { signal }),
  });

  return (
    <Box sx={{ p: 3 }}>
      {template.isPending && <CircularProgress />}
      {template.error && (
        <Alert severity="error">
          {apiErrorMessage(template.error, t("Template request failed"))}
        </Alert>
      )}
      {template.data && (
        <PrintTemplateEditor
          key={path}
          template={template.data}
          yearId={yearId}
          path={path}
        />
      )}
    </Box>
  );
}
