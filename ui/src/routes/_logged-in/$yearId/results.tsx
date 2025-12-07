import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Link,
  Popover,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useYearResults } from "@/data/use-admin";
import { openAuthenticatedPage } from "@/utils/download";
import { shouldBeAdmin } from "@/utils/should-be-logged-in";

export const Route = createFileRoute("/_logged-in/$yearId/results")({
  component: RouteComponent,
  beforeLoad: async ({ context }) => {
    shouldBeAdmin(context);
    return {
      title: "Results",
    };
  },
});

type PopoverType = "experience" | "assessments";

function RouteComponent() {
  const { t } = useTranslation();
  const { yearId } = Route.useParams();
  const { data, isLoading, error } = useYearResults(yearId);
  const [popoverAnchor, setPopoverAnchor] = useState<{
    element: HTMLElement;
    userId: number;
    type: PopoverType;
    data:
      | Array<[string, Array<string>]>
      | Array<{ assessment_id: number; comment: string; value: number }>;
  } | null>(null);

  const handleOpenExperiencePopover = (
    event: React.MouseEvent<HTMLElement>,
    userId: number,
    explanations: Array<[string, Array<string>]>,
  ) => {
    setPopoverAnchor({
      element: event.currentTarget,
      userId,
      type: "experience",
      data: explanations,
    });
  };

  const handleOpenAssessmentsPopover = (
    event: React.MouseEvent<HTMLElement>,
    userId: number,
    assessments: Array<{
      assessment_id: number;
      comment: string;
      value: number;
    }>,
  ) => {
    setPopoverAnchor({
      element: event.currentTarget,
      userId,
      type: "assessments",
      data: assessments,
    });
  };

  const handleClosePopover = () => {
    setPopoverAnchor(null);
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={4}>
        <Alert severity="error">
          {t("Failed to load results")}: {error.message}
        </Alert>
      </Box>
    );
  }

  const results = data?.results || [];

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        p: 2,
        alignItems: "flex-start",
      }}
    >
      <Typography variant="h5" gutterBottom>
        {t("Results")}
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {t("All registered volunteers for this year")} ({results.length}{" "}
        {t("results")})
      </Typography>

      <Box sx={{ mt: 2, mb: 2 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={async () => {
            try {
              await openAuthenticatedPage(
                `/api/v1/admin/year/${yearId}/certificates`,
              );
            } catch (error) {
              console.error("Failed to open certificates:", error);
              alert("Failed to open certificates. Please try again.");
            }
          }}
        >
          {t("Generate Certificates")}
        </Button>
      </Box>

      {results.length === 0 ? (
        <Box sx={{ mt: 2 }}>
          <Alert severity="info">{t("No volunteers found")}</Alert>
        </Box>
      ) : (
        <TableContainer sx={{ width: "100%", mt: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  <strong>{t("Volunteer")}</strong>
                </TableCell>
                <TableCell>
                  <strong>{t("Experience")}</strong>
                </TableCell>
                <TableCell>
                  <strong>{t("Rank")}</strong>
                </TableCell>
                <TableCell>
                  <strong>{t("Assessment")}</strong>
                </TableCell>
                <TableCell>
                  <strong>{t("Positions")}</strong>
                </TableCell>
                <TableCell>
                  <strong>{t("Assessments")}</strong>
                </TableCell>
                <TableCell>
                  <strong>{t("Attendance")}</strong>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((result) => {
                const fullNameRu = result.patronymic_ru
                  ? `${result.last_name_ru || ""} ${result.first_name_ru || ""} ${result.patronymic_ru || ""}`
                  : `${result.last_name_ru || ""} ${result.first_name_ru || ""}`;
                const fullNameEn = `${result.first_name_en || ""} ${result.last_name_en || ""}`;

                // Ensure arrays are actually arrays
                const assessments = Array.isArray(result.assessments)
                  ? result.assessments
                  : [];
                const positions = Array.isArray(result.positions)
                  ? result.positions
                  : [];
                const attendance = Array.isArray(result.attendance)
                  ? result.attendance
                  : [];
                const experienceExplanation = Array.isArray(
                  result.experience_explanation,
                )
                  ? result.experience_explanation
                  : [];

                const totalAssessments = assessments.reduce(
                  (sum, a) => sum + (a?.value || 0),
                  0,
                );
                const attendanceValues = attendance
                  .filter(
                    (a) =>
                      a?.attendance !== null && a?.attendance !== undefined,
                  )
                  .map((a) => a.attendance);
                const experience = result.experience ?? 0;
                const experienceThisYear = result.experience_this_year ?? 0;

                return (
                  <TableRow key={result.user_id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {fullNameRu}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontSize: "0.75rem" }}
                      >
                        {fullNameEn}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {experienceExplanation.length > 0 ? (
                        <Link
                          component="button"
                          variant="body2"
                          onClick={(e) =>
                            handleOpenExperiencePopover(
                              e,
                              result.user_id,
                              experienceExplanation,
                            )
                          }
                          sx={{
                            cursor: "pointer",
                            textDecoration: "underline",
                            fontWeight: 600,
                            "&:hover": {
                              textDecoration: "underline",
                            },
                          }}
                        >
                          {experience.toFixed(2)}
                        </Link>
                      ) : (
                        <Typography variant="body2">
                          {experience.toFixed(2)}
                        </Typography>
                      )}
                      {experienceThisYear > 0 && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontSize: "0.7rem", display: "block" }}
                        >
                          {t("This year")}: {experienceThisYear.toFixed(2)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {t(result.rank || "unknown")}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {result.total_assessment.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {positions.length > 0 ? (
                        <Box
                          sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}
                        >
                          {positions.map((position) => (
                            <Chip
                              key={position.position_id}
                              label={position.name}
                              size="small"
                              color="primary"
                              variant="outlined"
                              sx={{ fontSize: "0.7rem", height: "20px" }}
                            />
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          {t("None")}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {assessments.length > 0 ? (
                        <Box>
                          <Link
                            component="button"
                            variant="body2"
                            onClick={(e) =>
                              handleOpenAssessmentsPopover(
                                e,
                                result.user_id,
                                assessments,
                              )
                            }
                            sx={{
                              cursor: "pointer",
                              textDecoration: "underline",
                              fontWeight: 600,
                              "&:hover": {
                                textDecoration: "underline",
                              },
                            }}
                          >
                            {totalAssessments.toFixed(2)}
                          </Link>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontSize: "0.7rem", display: "block" }}
                          >
                            ({assessments.length} {t("assessments")})
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          {t("None")}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {attendanceValues.length > 0 ? (
                        <Box
                          sx={{ display: "flex", flexWrap: "wrap", gap: 0.25 }}
                        >
                          {attendanceValues.map((attendance, idx) => (
                            <Chip
                              key={`day-${idx}-${attendance}`}
                              label={t(attendance || "unknown")}
                              size="small"
                              color={
                                attendance === "yes"
                                  ? "success"
                                  : attendance === "late"
                                    ? "warning"
                                    : attendance === "sick"
                                      ? "info"
                                      : "default"
                              }
                              variant="outlined"
                              sx={{ fontSize: "0.65rem", height: "18px" }}
                            />
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          {t("None")}
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Experience Explanation Popover */}
      <Popover
        open={popoverAnchor !== null && popoverAnchor.type === "experience"}
        anchorEl={popoverAnchor?.element}
        onClose={handleClosePopover}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
      >
        <Box
          sx={{
            p: 2,
            maxWidth: 500,
            maxHeight: 400,
            overflow: "auto",
          }}
        >
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            {t("Experience Breakdown")}
          </Typography>
          {(() => {
            const data = popoverAnchor?.data;
            if (!data || !Array.isArray(data)) {
              return null;
            }
            return (data as Array<[string, Array<string>]>).map((item, idx) => {
              if (!Array.isArray(item) || item.length < 2) {
                return null;
              }
              const [year, explanations] = item;
              return (
                <Box key={`year-${idx}-${year}`} sx={{ mb: 2 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 600, mb: 1, fontSize: "0.875rem" }}
                  >
                    {year || "Unknown"}:
                  </Typography>
                  <Box component="ul" sx={{ pl: 2, mb: 0, mt: 0.5 }}>
                    {(Array.isArray(explanations) ? explanations : []).map(
                      (explanation, expIdx) => (
                        <Typography
                          key={`explanation-${expIdx}-${explanation}`}
                          component="li"
                          variant="body2"
                          color="text.secondary"
                          sx={{ fontSize: "0.75rem", mb: 0.5 }}
                        >
                          {explanation || ""}
                        </Typography>
                      ),
                    )}
                  </Box>
                </Box>
              );
            });
          })()}
        </Box>
      </Popover>

      {/* Assessments Popover */}
      <Popover
        open={popoverAnchor !== null && popoverAnchor.type === "assessments"}
        anchorEl={popoverAnchor?.element}
        onClose={handleClosePopover}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
      >
        <Box
          sx={{
            p: 2,
            maxWidth: 500,
            maxHeight: 400,
            overflow: "auto",
          }}
        >
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            {t("Assessments")}
          </Typography>
          {(() => {
            const data = popoverAnchor?.data;
            if (!data || !Array.isArray(data)) {
              return null;
            }
            return (
              data as Array<{
                assessment_id: number;
                comment: string;
                value: number;
              }>
            ).map((assessment, idx, arr) => (
              <Box
                key={assessment?.assessment_id ?? idx}
                sx={{
                  mb: 2,
                  pb: 2,
                  borderBottom: idx < arr.length - 1 ? "1px solid" : "none",
                  borderColor: "divider",
                }}
              >
                <Box
                  sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
                >
                  <Chip
                    label={(assessment?.value ?? 0).toFixed(2)}
                    size="small"
                    color="success"
                    variant="outlined"
                    sx={{ fontWeight: 600 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    ID: {assessment?.assessment_id ?? "N/A"}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {assessment?.comment || ""}
                </Typography>
              </Box>
            ));
          })()}
        </Box>
      </Popover>
    </Box>
  );
}
