import { Alert, Box, CircularProgress } from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { MailingDraftEditor } from "@/components/mailing/MailingDraftEditor";
import { MailingProgress } from "@/components/mailing/MailingProgress";
import { useMailing } from "@/data/use-mailings";
import { apiErrorMessage } from "@/utils/apiErrorHandling";
import { shouldBeAdmin } from "@/utils/should-be-logged-in";

export const Route = createFileRoute("/_logged-in/$yearId/mailings/$mailingId")(
  {
    component: RouteComponent,
    beforeLoad: async ({ context }) => {
      shouldBeAdmin(context);
      return {
        title: "Mailing",
      };
    },
  },
);

function RouteComponent() {
  const { t } = useTranslation();
  const { mailingId } = Route.useParams();
  const { data: mailing, isLoading, error } = useMailing(mailingId);

  let content: React.ReactNode;
  if (isLoading) {
    content = <CircularProgress />;
  } else if (error || !mailing) {
    content = (
      <Alert severity="error">
        {apiErrorMessage(error, t("Failed to load mailing"))}
      </Alert>
    );
  } else {
    // A new key once started: the progress replaces the editor
    content =
      mailing.status === "draft" ? (
        <MailingDraftEditor key="draft" mailing={mailing} />
      ) : (
        <MailingProgress key="progress" mailing={mailing} />
      );
  }
  return <Box sx={{ p: 3 }}>{content}</Box>;
}
