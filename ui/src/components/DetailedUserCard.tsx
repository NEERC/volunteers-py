import { ExpandMore as ExpandMoreIcon } from "@mui/icons-material";
import {
  Box,
  CardContent,
  Chip,
  Collapse,
  Divider,
  IconButton,
  Link,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { RegistrationFormItem } from "@/client";

export function DetailedUserCard({
  user,
  expandedDefault,
  expandable = true,
}: {
  user: RegistrationFormItem;
  expandedDefault: boolean;
  expandable?: boolean;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(expandedDefault);
  const fullName = user.patronymic_ru
    ? `${user.last_name_ru} ${user.first_name_ru} ${user.patronymic_ru}`
    : `${user.last_name_ru} ${user.first_name_ru}`;

  const hasExtraInfo =
    user.itmo_group ||
    user.telegram_username ||
    user.desired_positions.length > 0 ||
    user.comments ||
    user.gender ||
    user.needs_invitation ||
    (user.experience && user.experience.length > 0);

  return (
    <CardContent sx={{ p: 1, "&:last-child": { pb: 1 } }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
        // onClick={(e) => {
        //   e.stopPropagation();
        //   expandable && setExpanded(!expanded);
        // }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {fullName}
          </Typography>
        </Box>
        {hasExtraInfo && expandable && (
          <IconButton
            size="large"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            sx={{
              p: 0.25,
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease-in-out",
            }}
          >
            <ExpandMoreIcon />
          </IconButton>
        )}
      </Box>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontSize: "0.75rem" }}
        >
          {user.first_name_en} {user.last_name_en}
        </Typography>
        <Divider sx={{ my: 0.5 }} />

        {user.itmo_group && (
          <Typography variant="body2" sx={{ mb: 0.25, fontSize: "0.75rem" }}>
            <strong>{t("Group")}:</strong> {user.itmo_group}
          </Typography>
        )}
        {user.telegram_username && (
          <Typography variant="body2" sx={{ mb: 0.25, fontSize: "0.75rem" }}>
            <strong>{t("Telegram")}:</strong> 📱{" "}
            <Link
              href={`https://t.me/${user.telegram_username}`}
              target="_blank"
            >
              @{user.telegram_username}
            </Link>
          </Typography>
        )}
        {user.gender && (
          <Typography variant="body2" sx={{ mb: 0.25, fontSize: "0.75rem" }}>
            <strong>{t("Gender")}:</strong>{" "}
            {user.gender === "male" ? t("Male") : t("Female")}
          </Typography>
        )}

        {user.desired_positions.length > 0 && (
          <Box sx={{ mt: 0.5 }}>
            <Typography
              variant="body2"
              sx={{ mb: 0.25, fontWeight: 600, fontSize: "0.75rem" }}
            >
              {t("Desired Positions")}:
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.25 }}>
              {user.desired_positions.map((position) => (
                <Chip
                  key={position.position_id}
                  label={position.name}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ fontSize: "0.65rem", height: "20px" }}
                />
              ))}
            </Box>
          </Box>
        )}

        {user.comments && (
          <Box sx={{ mt: 0.5 }}>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, mb: 0.25, fontSize: "0.75rem" }}
            >
              {t("Comments")}:
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                fontStyle: "italic",
                backgroundColor: "grey.50",
                p: 0.5,
                borderRadius: 0.5,
                fontSize: "0.7rem",
              }}
            >
              "{user.comments}"
            </Typography>
          </Box>
        )}

        {user.needs_invitation && (
          <Box sx={{ mt: 0.5 }}>
            <Typography variant="body2" sx={{ mb: 0.25, fontSize: "0.75rem" }}>
              <strong>{t("I need an invitation for work/study")}</strong> ✓
            </Typography>
          </Box>
        )}

        {user.experience && user.experience.length > 0 && (
          <Box sx={{ mt: 0.5, overflowX: "auto" }}>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, mb: 0.25, fontSize: "0.75rem" }}
            >
              {t("Experience")}:
            </Typography>
            <Table size="small" sx={{ fontSize: "0.7rem" }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontSize: "0.65rem", py: 0.25, px: 0.5 }}>
                    {t("Year")}
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.65rem", py: 0.25, px: 0.5 }}>
                    {t("Positions")}
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.65rem", py: 0.25, px: 0.5 }}>
                    {t("Attendance")}:
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.65rem", py: 0.25, px: 0.5 }}>
                    {t("Assessments")}:
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {user.experience.map((exp, index) => (
                  <TableRow key={`${exp.year_name}-${index}`}>
                    <TableCell sx={{ fontSize: "0.65rem", py: 0.25, px: 0.5 }}>
                      {exp.year_name}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.65rem", py: 0.25, px: 0.5 }}>
                      {exp.positions.length > 0 ? (
                        <Box
                          sx={{ display: "flex", flexWrap: "wrap", gap: 0.25 }}
                        >
                          {exp.positions.map((position, posIndex) => (
                            <Chip
                              key={`${exp.year_name}-pos-${posIndex}`}
                              label={position}
                              size="small"
                              color="secondary"
                              variant="outlined"
                              sx={{ fontSize: "0.6rem", height: "16px" }}
                            />
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          {t("None")}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.65rem", py: 0.25, px: 0.5 }}>
                      {Object.entries(exp.attendance_stats).map(
                        ([status, count]) => (
                          <Box
                            key={`${exp.year_name}-attendance-${status}`}
                            sx={{ display: "inline-block", mr: 0.5 }}
                          >
                            <Typography
                              variant="caption"
                              sx={{ fontSize: "0.6rem" }}
                            >
                              {status}: {count}
                            </Typography>
                          </Box>
                        ),
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.65rem", py: 0.25, px: 0.5 }}>
                      {exp.assessments.length > 0 ? (
                        <Box
                          sx={{ display: "flex", flexWrap: "wrap", gap: 0.25 }}
                        >
                          {exp.assessments.map((assessment, assIndex) => (
                            <Chip
                              key={`${exp.year_name}-ass-${assIndex}`}
                              label={assessment}
                              size="small"
                              color="success"
                              variant="outlined"
                              sx={{
                                fontSize: "0.6rem",
                                height: "auto",
                                "& .MuiChip-label": {
                                  display: "block",
                                  whiteSpace: "normal",
                                },
                              }}
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
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Collapse>
    </CardContent>
  );
}
