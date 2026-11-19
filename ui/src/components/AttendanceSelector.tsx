import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { Attendance } from "@/client/types.gen";

interface AttendanceSelectorProps {
  value: Attendance;
  onChange: (value: Attendance) => void;
  isMobile: boolean;
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
    case "confirmed":
      return <DoneAllIcon color="primary" fontSize="small" />;
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
    case "confirmed":
      return t("Confirmed");
    default:
      return t("Unknown");
  }
}

// Confirmed is set by the volunteer before the day, the others by managers on the day
const ATTENDANCE_OPTIONS: Attendance[] = [
  "yes",
  "no",
  "late",
  "sick",
  "unknown",
  "confirmed",
];

export function AttendanceSelector({
  value,
  onChange,
  isMobile,
}: AttendanceSelectorProps) {
  const { t } = useTranslation();
  const labelId = useId();

  const renderOption = (attendance: Attendance) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      {getAttendanceIcon(attendance)}
      <Typography component="span" variant="inherit" noWrap>
        {getAttendanceLabel(attendance, t)}
      </Typography>
    </Box>
  );

  if (isMobile) {
    return (
      <FormControl size="small" fullWidth>
        <InputLabel id={labelId}>{t("Attendance")}</InputLabel>
        <Select
          labelId={labelId}
          autoWidth
          label={t("Attendance")}
          sx={{ minHeight: 44 }}
          value={value}
          onChange={(e) => onChange(e.target.value as Attendance)}
          renderValue={(selectedValue) =>
            renderOption(selectedValue as Attendance)
          }
        >
          {ATTENDANCE_OPTIONS.map((attendance) => (
            <MenuItem key={attendance} value={attendance}>
              {renderOption(attendance)}
            </MenuItem>
          ))}
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
      {ATTENDANCE_OPTIONS.map((attendance) => (
        <ToggleButton key={attendance} value={attendance}>
          {renderOption(attendance)}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
