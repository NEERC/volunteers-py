import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import {
  Box,
  FormControl,
  MenuItem,
  Select,
  ToggleButton,
  ToggleButtonGroup,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import type { Attendance } from "@/client/types.gen";

interface AttendanceSelectorProps {
  value: Attendance;
  onChange: (value: Attendance) => void;
}

export function getAttendanceIcon(attendance: Attendance) {
  switch (attendance) {
    case "yes":
      return <CheckCircleIcon color="success" fontSize="small" />;
    case "no":
      return <CancelIcon color="error" fontSize="small" />;
    case "late":
      return <AccessTimeIcon color="warning" fontSize="small" />;
    case "sick":
      return <LocalHospitalIcon color="info" fontSize="small" />;
    default:
      return <HelpOutlineIcon color="disabled" fontSize="small" />;
  }
}

export function getAttendanceLabel(
  attendance: Attendance,
  t: (key: string) => string,
): string {
  switch (attendance) {
    case "yes":
      return t("Yes");
    case "no":
      return t("No");
    case "late":
      return t("Late");
    case "sick":
      return t("Sick");
    default:
      return t("Unknown");
  }
}

export function AttendanceSelector({
  value,
  onChange,
}: AttendanceSelectorProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  if (isMobile) {
    return (
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <Select
          value={value}
          onChange={(e) => onChange(e.target.value as Attendance)}
          renderValue={(selectedValue) => (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              {getAttendanceIcon(selectedValue as Attendance)}
              {getAttendanceLabel(selectedValue as Attendance, t)}
            </Box>
          )}
        >
          <MenuItem value="yes">
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              {getAttendanceIcon("yes")}
              {t("Yes")}
            </Box>
          </MenuItem>
          <MenuItem value="no">
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              {getAttendanceIcon("no")}
              {t("No")}
            </Box>
          </MenuItem>
          <MenuItem value="late">
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              {getAttendanceIcon("late")}
              {t("Late")}
            </Box>
          </MenuItem>
          <MenuItem value="sick">
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              {getAttendanceIcon("sick")}
              {t("Sick")}
            </Box>
          </MenuItem>
          <MenuItem value="unknown">
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              {getAttendanceIcon("unknown")}
              {t("Unknown")}
            </Box>
          </MenuItem>
        </Select>
      </FormControl>
    );
  }

  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      onChange={(_, newValue) => {
        if (newValue !== null) {
          onChange(newValue);
        }
      }}
      size="small"
    >
      <ToggleButton value="yes">
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          {getAttendanceIcon("yes")}
          {t("Yes")}
        </Box>
      </ToggleButton>
      <ToggleButton value="no">
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          {getAttendanceIcon("no")}
          {t("No")}
        </Box>
      </ToggleButton>
      <ToggleButton value="late">
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          {getAttendanceIcon("late")}
          {t("Late")}
        </Box>
      </ToggleButton>
      <ToggleButton value="sick">
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          {getAttendanceIcon("sick")}
          {t("Sick")}
        </Box>
      </ToggleButton>
      <ToggleButton value="unknown">
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          {getAttendanceIcon("unknown")}
          {t("Unknown")}
        </Box>
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
