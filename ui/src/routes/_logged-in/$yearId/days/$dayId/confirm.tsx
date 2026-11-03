import { Alert, Box, Button, Paper, Typography } from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { getAttendanceLabel } from "@/components/AttendanceSelector";
import { ConfirmedMark } from "@/components/ConfirmedMark";
import { useAssignmentConfirmation, useConfirmAssignment } from "@/data";
import { apiErrorMessage } from "@/utils/apiErrorHandling";

// Linked from mailings only, not shown in the menu
export const Route = createFileRoute("/_logged-in/$yearId/days/$dayId/confirm")(
  {
    component: RouteComponent,
    beforeLoad: () => ({ title: "Confirm attendance" }),
  },
);

function RouteComponent() {
  const { t } = useTranslation();
  const { yearId, dayId } = Route.useParams();
  const { data, isLoading, error } = useAssignmentConfirmation(yearId, dayId);
  const confirm = useConfirmAssignment(yearId, dayId);

  if (isLoading) {
    return (
      <Box p={3}>
        <Typography>{t("Loading...")}</Typography>
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box p={3}>
        <Alert severity="error">
          {apiErrorMessage(error, t("Failed to load data"))}
        </Alert>
      </Box>
    );
  }

  return (
    <Box p={3} sx={{ maxWidth: 640 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          {data.day_name}
        </Typography>
        {data.state === "not_published" && (
          <Alert severity="info">
            {t("Assignments are not published yet")}
          </Alert>
        )}
        {data.state === "not_assigned" && (
          <Alert severity="info">{t("You are not assigned to this day")}</Alert>
        )}
        {data.state === "assigned" && data.attendance && (
          <>
            <Typography variant="body1" sx={{ mb: 2 }} data-testid="assignment">
              {data.hall
                ? t("On {{day}} you are {{position}} in hall {{hall}}.", {
                    day: data.day_name,
                    position: data.position,
                    hall: data.hall,
                  })
                : t("On {{day}} you are {{position}}.", {
                    day: data.day_name,
                    position: data.position,
                  })}
            </Typography>
            {data.day_information && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 2, whiteSpace: "pre-wrap" }}
              >
                {data.day_information}
              </Typography>
            )}
            {data.attendance === "unknown" ? (
              <>
                <Typography variant="h6" component="p" sx={{ mb: 2 }}>
                  {t("Do you remember and will you come?")}
                </Typography>
                {confirm.isError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {apiErrorMessage(confirm.error, t("Failed to confirm"))}
                  </Alert>
                )}
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => confirm.mutate()}
                  loading={confirm.isPending}
                >
                  {t("Yes, I'll come")}
                </Button>
              </>
            ) : data.attendance === "confirmed" ? (
              <Alert severity="success" icon={<ConfirmedMark />}>
                {confirm.isSuccess
                  ? t("Thank you! We are waiting for you.")
                  : t("You have already confirmed that you will come.")}
              </Alert>
            ) : (
              <Alert severity="info">
                {t("Your attendance is already marked: {{attendance}}", {
                  attendance: getAttendanceLabel(data.attendance, t),
                })}
              </Alert>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {t("If your plans have changed, write to the volunteer manager.")}
            </Typography>
          </>
        )}
      </Paper>
    </Box>
  );
}
