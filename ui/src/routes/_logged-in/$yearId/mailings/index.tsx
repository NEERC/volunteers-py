import AddIcon from "@mui/icons-material/Add";
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { MailingResponse } from "@/client/types.gen";
import { MailingStatusChip } from "@/components/mailing/status";
import { useCreateMailing, useMailings } from "@/data/use-mailings";
import { apiErrorMessage } from "@/utils/apiErrorHandling";
import { shouldBeAdmin } from "@/utils/should-be-logged-in";

export const Route = createFileRoute("/_logged-in/$yearId/mailings/")({
  component: RouteComponent,
  beforeLoad: async ({ context }) => {
    shouldBeAdmin(context);
    return {
      title: "Mailings",
    };
  },
});

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "—";

function progress(mailing: MailingResponse) {
  const { counts } = mailing;
  const total =
    counts.pending +
    counts.sending +
    counts.sent +
    counts.failed +
    counts.unknown +
    counts.cancelled;
  return `${counts.sent} / ${total}`;
}

function RouteComponent() {
  const { t } = useTranslation();
  const { yearId } = Route.useParams();
  const navigate = useNavigate();
  const { data: mailings, isLoading, error } = useMailings(yearId);
  const createMailing = useCreateMailing();

  const open = (mailingId: number) =>
    navigate({
      to: "/$yearId/mailings/$mailingId",
      params: { yearId, mailingId: String(mailingId) },
    });

  const create = async () => {
    const mailing = await createMailing.mutateAsync({ yearId });
    open(mailing.mailing_id);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 3,
        }}
      >
        <Typography variant="h4">{t("Mailings")}</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={create}
          disabled={createMailing.isPending}
        >
          {t("New mailing")}
        </Button>
      </Box>

      {createMailing.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {apiErrorMessage(createMailing.error, t("Failed to create mailing"))}
        </Alert>
      )}
      {error && (
        <Alert severity="error">
          {apiErrorMessage(error, t("Failed to load mailings"))}
        </Alert>
      )}
      {isLoading && <CircularProgress />}

      {mailings && mailings.length === 0 && (
        <Typography color="text.secondary">
          {t(
            "No mailings yet. Create one to message the volunteers of the year in Telegram.",
          )}
        </Typography>
      )}

      {mailings && mailings.length > 0 && (
        <Card>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("Title")}</TableCell>
                <TableCell>{t("Status")}</TableCell>
                <TableCell>{t("Sent")}</TableCell>
                <TableCell>{t("Created by")}</TableCell>
                <TableCell>{t("Started")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mailings.map((mailing) => (
                <TableRow
                  key={mailing.mailing_id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => open(mailing.mailing_id)}
                >
                  <TableCell>
                    {mailing.title || (
                      <Typography component="span" color="text.secondary">
                        {t("Untitled")}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <MailingStatusChip status={mailing.status} />
                  </TableCell>
                  <TableCell>
                    {mailing.status === "draft" ? "—" : progress(mailing)}
                  </TableCell>
                  <TableCell>{mailing.created_by?.name ?? "—"}</TableCell>
                  <TableCell>{formatDate(mailing.queued_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </Box>
  );
}
