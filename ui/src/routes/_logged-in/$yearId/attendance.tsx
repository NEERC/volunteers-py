import {
  Box,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from "@mui/material";
import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Attendance, AttendanceItem } from "@/client/types.gen";
import {
  AttendanceSelector,
  getAttendanceIcon,
  getAttendanceLabel,
} from "@/components/AttendanceSelector";
import { useAttendance, useSaveAttendance } from "@/data/use-year";
import { shouldBeManager } from "@/utils/should-be-logged-in";

export const Route = createFileRoute("/_logged-in/$yearId/attendance")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): { day?: number } => {
    return {
      day: search.day ? Number(search.day) : undefined,
    };
  },
  beforeLoad: async ({ context, params }) => {
    await shouldBeManager(context, params.yearId);
    return {
      title: "Attendance",
    };
  },
});

interface VolunteerAttendance {
  user_id: number;
  user_name: string;
  user_telegram: string | null;
  position_id: number;
  position_name: string;
  hall_id: number | null;
  hall_name: string | null;
  attendanceByDay: Map<number, AttendanceItem>;
}

function RouteComponent() {
  const { t } = useTranslation();
  const { yearId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const search = useSearch({ from: "/_logged-in/$yearId/attendance" });
  const selectedDayId = search.day;
  const [selectedAttendance, setSelectedAttendance] =
    useState<Attendance>("yes");

  const { data: attendanceData, isLoading: attendanceLoading } =
    useAttendance(yearId);
  const saveAttendanceMutation = useSaveAttendance();

  const canEditAttendance = !!user;

  // Get unique days from attendance data
  const days = useMemo(() => {
    if (!attendanceData?.attendance) return [];
    const dayMap = new Map<number, { day_id: number; day_name: string }>();
    for (const item of attendanceData.attendance) {
      if (!dayMap.has(item.day_id)) {
        dayMap.set(item.day_id, {
          day_id: item.day_id,
          day_name: item.day_name,
        });
      }
    }
    return Array.from(dayMap.values()).sort((a, b) => a.day_id - b.day_id);
  }, [attendanceData]);

  // Group volunteers by position, then by volunteer
  const volunteersByPosition = useMemo(() => {
    if (!attendanceData?.attendance)
      return new Map<number, VolunteerAttendance[]>();

    const positionMap = new Map<number, Map<number, VolunteerAttendance>>();

    for (const item of attendanceData.attendance) {
      // Get or create position group
      if (!positionMap.has(item.position_id)) {
        positionMap.set(item.position_id, new Map());
      }
      const positionVolunteers = positionMap.get(item.position_id);
      if (!positionVolunteers) continue;

      // Get or create volunteer
      if (!positionVolunteers.has(item.user_id)) {
        positionVolunteers.set(item.user_id, {
          user_id: item.user_id,
          user_name: item.user_name,
          user_telegram: item.user_telegram,
          position_id: item.position_id,
          position_name: item.position_name,
          hall_id: item.hall_id,
          hall_name: item.hall_name,
          attendanceByDay: new Map(),
        });
      }

      const volunteer = positionVolunteers.get(item.user_id);
      if (!volunteer) continue;
      volunteer.attendanceByDay.set(item.day_id, item);
    }

    // Convert to array format
    const result = new Map<number, VolunteerAttendance[]>();
    for (const [positionId, volunteers] of positionMap.entries()) {
      result.set(positionId, Array.from(volunteers.values()));
    }

    return result;
  }, [attendanceData]);

  // Get position names for grouping
  const positions = useMemo(() => {
    if (!attendanceData?.attendance) return [];
    const positionMap = new Map<
      number,
      { position_id: number; position_name: string }
    >();
    for (const item of attendanceData.attendance) {
      if (!positionMap.has(item.position_id)) {
        positionMap.set(item.position_id, {
          position_id: item.position_id,
          position_name: item.position_name,
        });
      }
    }
    return Array.from(positionMap.values()).sort(
      (a, b) => a.position_id - b.position_id,
    );
  }, [attendanceData]);

  // Filter days based on selected day
  const displayedDays = useMemo(() => {
    if (selectedDayId) {
      return days.filter((d) => d.day_id === selectedDayId);
    }
    return days;
  }, [days, selectedDayId]);

  const handleDayTabChange = (
    _: React.SyntheticEvent,
    newDayId: number | "all",
  ) => {
    navigate({
      to: "/$yearId/attendance",
      params: { yearId },
      search: newDayId === "all" ? {} : { day: newDayId },
    });
  };

  const handleAttendanceChange = async (
    userDayId: number,
    attendance: Attendance,
  ) => {
    await saveAttendanceMutation.mutateAsync({
      user_day_id: userDayId,
      attendance,
    });
  };

  if (attendanceLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>{t("Loading...")}</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box sx={{ borderBottom: 1, borderColor: "divider", px: 2, py: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
          <Typography variant="body2" fontWeight="medium">
            {t("Select Attendance")}:
          </Typography>
          <AttendanceSelector
            value={selectedAttendance}
            onChange={setSelectedAttendance}
          />
        </Box>
        <Tabs
          value={selectedDayId || "all"}
          onChange={(_, value) =>
            handleDayTabChange(_, value as number | "all")
          }
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label={t("All Days")} value="all" />
          {days.map((day) => (
            <Tab key={day.day_id} label={day.day_name} value={day.day_id} />
          ))}
        </Tabs>
      </Box>

      <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
        <TableContainer component={Paper}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("Position")}</TableCell>
                <TableCell>{t("Hall")}</TableCell>
                <TableCell>{t("Name")}</TableCell>
                {displayedDays.map((day) => (
                  <TableCell key={day.day_id} align="center">
                    {day.day_name}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {positions.map((position) => {
                const volunteers =
                  volunteersByPosition.get(position.position_id) || [];
                return volunteers.map((volunteer, idx) => (
                  <VolunteerRow
                    key={`${volunteer.user_id}-${position.position_id}`}
                    volunteer={volunteer}
                    positionName={position.position_name}
                    days={displayedDays}
                    canEditAttendance={canEditAttendance}
                    onAttendanceChange={handleAttendanceChange}
                    isFirstInPosition={idx === 0}
                    selectedAttendance={selectedAttendance}
                  />
                ));
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
}

interface VolunteerRowProps {
  volunteer: VolunteerAttendance;
  positionName: string;
  days: Array<{ day_id: number; day_name: string }>;
  canEditAttendance: boolean;
  onAttendanceChange: (
    userDayId: number,
    attendance: Attendance,
  ) => Promise<void>;
  isFirstInPosition: boolean;
  selectedAttendance: Attendance;
}

function VolunteerRow({
  volunteer,
  positionName,
  days,
  canEditAttendance,
  onAttendanceChange,
  isFirstInPosition,
  selectedAttendance,
}: VolunteerRowProps) {
  const { t } = useTranslation();

  const handleAttendanceChange = async (
    dayId: number,
    attendance: Attendance,
  ) => {
    const item = volunteer.attendanceByDay.get(dayId);
    if (!item) return;

    await onAttendanceChange(item.user_day_id, attendance);
  };

  return (
    <TableRow>
      <TableCell sx={{ py: 0.5 }}>
        {isFirstInPosition && (
          <Typography variant="body2" fontWeight="medium">
            {positionName}
          </Typography>
        )}
      </TableCell>
      <TableCell sx={{ py: 0.5 }}>
        <Typography variant="body2">{volunteer.hall_name || "-"}</Typography>
      </TableCell>
      <TableCell sx={{ py: 0.5 }}>
        <Box>
          <Typography variant="body2">{volunteer.user_name}</Typography>
          {volunteer.user_telegram && (
            <Typography variant="caption" color="text.secondary">
              @{volunteer.user_telegram}
            </Typography>
          )}
        </Box>
      </TableCell>
      {days.map((day) => {
        const item = volunteer.attendanceByDay.get(day.day_id);

        return (
          <TableCell
            key={day.day_id}
            align="center"
            sx={{
              py: 0.5,
              cursor: canEditAttendance && item ? "pointer" : "default",
              "&:hover":
                canEditAttendance && item
                  ? { backgroundColor: "action.hover" }
                  : {},
            }}
            onClick={() => {
              if (canEditAttendance && item) {
                handleAttendanceChange(day.day_id, selectedAttendance);
              }
            }}
          >
            {item ? (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  justifyContent: "center",
                }}
              >
                {getAttendanceIcon(item.attendance)}
                <Typography variant="body2">
                  {getAttendanceLabel(item.attendance, t)}
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                -
              </Typography>
            )}
          </TableCell>
        );
      })}
    </TableRow>
  );
}
