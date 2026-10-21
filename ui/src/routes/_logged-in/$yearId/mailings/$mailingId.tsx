import { Alert, CircularProgress } from "@mui/material";
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

  if (isLoading) return <CircularProgress />;
  if (error || !mailing) {
    return (
      <Alert severity="error">
        {apiErrorMessage(error, t("Failed to load mailing"))}
      </Alert>
    );
  }
  // A new key once started: the progress replaces the editor
  return mailing.status === "draft" ? (
    <MailingDraftEditor key="draft" mailing={mailing} />
  ) : (
    <MailingProgress key="progress" mailing={mailing} />
  );
}
