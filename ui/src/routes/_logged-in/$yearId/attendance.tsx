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
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  Attendance,
  VolunteersApiV1AttendanceSchemasAttendanceItem as AttendanceItem,
} from "@/client/types.gen";
import { AssessmentInput } from "@/components/AssessmentInput";
import {
  AttendanceSelector,
  getAttendanceIcon,
  getAttendanceLabel,
} from "@/components/AttendanceSelector";
import {
  useAddAssessment,
  useAttendance,
  useDeleteAssessment,
  useEditAssessment,
  useSaveAttendance,
} from "@/data/use-year";
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

export interface VolunteerAttendance {
  user_id: number;
  user_name: string;
  user_telegram: string | null;
  position_id: number;
  position_name: string;
  hall_id: number | null;
  hall_name: string | null;
  attendanceByDay: Map<number, AttendanceItem>;
}

const ATTENDANCE_SORT_RANK: Record<Attendance, number> = {
  yes: 0,
  late: 1,
  sick: 2,
  no: 3,
  unknown: 4,
};

export function getAttendanceSortRank(
  attendance: Attendance | undefined,
): number {
  return attendance === undefined ? 5 : ATTENDANCE_SORT_RANK[attendance];
}

export function flattenVolunteers(
  attendance: AttendanceItem[],
): VolunteerAttendance[] {
  const volunteerMap = new Map<string, VolunteerAttendance>();

  for (const item of attendance) {
    const key = `${item.user_id}-${item.position_id}`;
    let volunteer = volunteerMap.get(key);
    if (!volunteer) {
      volunteer = {
        user_id: item.user_id,
        user_name: item.user_name,
        user_telegram: item.user_telegram,
        position_id: item.position_id,
        position_name: item.position_name,
        hall_id: item.hall_id,
        hall_name: item.hall_name,
        attendanceByDay: new Map(),
      };
      volunteerMap.set(key, volunteer);
    }
    volunteer.attendanceByDay.set(item.day_id, item);
  }

  return Array.from(volunteerMap.values());
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
  const addAssessmentMutation = useAddAssessment();
  const editAssessmentMutation = useEditAssessment();
  const deleteAssessmentMutation = useDeleteAssessment();

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

  // Flatten attendance data into one row per volunteer+position
  const volunteers = useMemo(
    () => flattenVolunteers(attendanceData?.attendance ?? []),
    [attendanceData],
  );

  // Filter days based on selected day
  const displayedDays = useMemo(() => {
    if (selectedDayId) {
      return days.filter((d) => d.day_id === selectedDayId);
    }
    return days;
  }, [days, selectedDayId]);

  const columns = useMemo<ColumnDef<VolunteerAttendance>[]>(
    () => [
      { accessorKey: "position_name", header: t("Position") },
      {
        id: "hall_name",
        accessorFn: (volunteer) => volunteer.hall_name ?? "",
        header: t("Hall"),
      },
      { accessorKey: "user_name", header: t("Name") },
      ...displayedDays.map((day) => ({
        id: `day-${day.day_id}`,
        accessorFn: (volunteer: VolunteerAttendance) =>
          getAttendanceSortRank(
            volunteer.attendanceByDay.get(day.day_id)?.attendance,
          ),
        header: day.day_name,
      })),
    ],
    [t, displayedDays],
  );

  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: volunteers,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

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

  const handleAddAssessment = async (
    userDayId: number,
    value: number,
    comment: string,
  ) => {
    await addAssessmentMutation.mutateAsync({
      user_day_id: userDayId,
      value,
      comment,
    });
  };

  const handleEditAssessment = async (
    assessmentId: number,
    value: number | null,
    comment: string | null,
  ) => {
    await editAssessmentMutation.mutateAsync({
      assessment_id: assessmentId,
      value,
      comment,
    });
  };

  const handleDeleteAssessment = async (assessmentId: number) => {
    await deleteAssessmentMutation.mutateAsync(assessmentId);
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
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableCell
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      sx={{
                        cursor: header.column.getCanSort()
                          ? "pointer"
                          : "default",
                        userSelect: "none",
                        "&:hover": header.column.getCanSort()
                          ? { backgroundColor: "action.hover" }
                          : {},
                      }}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {header.column.getIsSorted() === "asc" && " ↑"}
                      {header.column.getIsSorted() === "desc" && " ↓"}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableHead>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <VolunteerRow
                  key={row.id}
                  volunteer={row.original}
                  days={displayedDays}
                  canEditAttendance={canEditAttendance}
                  onAttendanceChange={handleAttendanceChange}
                  onAddAssessment={handleAddAssessment}
                  onEditAssessment={handleEditAssessment}
                  onDeleteAssessment={handleDeleteAssessment}
                  selectedAttendance={selectedAttendance}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
}

interface VolunteerRowProps {
  volunteer: VolunteerAttendance;
  days: Array<{ day_id: number; day_name: string }>;
  canEditAttendance: boolean;
  onAttendanceChange: (
    userDayId: number,
    attendance: Attendance,
  ) => Promise<void>;
  onAddAssessment: (
    userDayId: number,
    value: number,
    comment: string,
  ) => Promise<void>;
  onEditAssessment: (
    assessmentId: number,
    value: number | null,
    comment: string | null,
  ) => Promise<void>;
  onDeleteAssessment: (assessmentId: number) => Promise<void>;
  selectedAttendance: Attendance;
}

function VolunteerRow({
  volunteer,
  days,
  canEditAttendance,
  onAttendanceChange,
  onAddAssessment,
  onEditAssessment,
  onDeleteAssessment,
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
        <Typography variant="body2" fontWeight="medium">
          {volunteer.position_name}
        </Typography>
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
            }}
          >
            {item ? (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 0.5,
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    cursor: canEditAttendance ? "pointer" : "default",
                    "&:hover": canEditAttendance
                      ? { backgroundColor: "action.hover" }
                      : {},
                    px: 0.5,
                    borderRadius: 1,
                  }}
                  onClick={() => {
                    if (canEditAttendance) {
                      handleAttendanceChange(day.day_id, selectedAttendance);
                    }
                  }}
                >
                  {getAttendanceIcon(item.attendance)}
                  <Typography variant="body2">
                    {getAttendanceLabel(item.attendance, t)}
                  </Typography>
                </Box>
                <AssessmentInput
                  userDayId={item.user_day_id}
                  assessments={item.assessments}
                  canEdit={canEditAttendance}
                  onAdd={onAddAssessment}
                  onEdit={onEditAssessment}
                  onDelete={onDeleteAssessment}
                />
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
