import { Alert, Box, CircularProgress } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { getPrintTemplateApiV1AdminPrintTemplateYearYearIdTemplateIdGet as getPrintTemplate } from "@/client";
import { PrintTemplateEditor } from "@/components/print-template/PrintTemplateEditor";
import { printTemplateKeys } from "@/data/print-templates";
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
  const queryKey = printTemplateKeys.detail(yearId, templateId);
  const template = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      getPrintTemplate({
        path: { year_id: Number(yearId), template_id: Number(templateId) },
        signal,
        throwOnError: true,
      }).then(({ data }) => data),
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
          key={queryKey.join(":")}
          template={template.data}
          yearId={yearId}
        />
      )}
    </Box>
  );
}
