import { ArrowDownward, ArrowUpward } from "@mui/icons-material";
import {
  Box,
  ButtonBase,
  IconButton,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
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
  confirmed: 1,
  late: 2,
  sick: 3,
  no: 4,
  unknown: 5,
};

export function getAttendanceSortRank(
  attendance: Attendance | undefined,
): number {
  return attendance === undefined ? 6 : ATTENDANCE_SORT_RANK[attendance];
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("lg"));
  const { yearId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const search = useSearch({ from: "/_logged-in/$yearId/attendance" });
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

  const selectedDayId = days.find((day) => day.day_id === search.day)?.day_id;

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

  const visibleSorting = useMemo(
    () =>
      sorting.filter(({ id }) =>
        columns.some(
          (column) =>
            id === column.id ||
            ("accessorKey" in column && id === column.accessorKey),
        ),
      ),
    [columns, sorting],
  );

  const table = useReactTable({
    data: volunteers,
    columns,
    state: { sorting: visibleSorting },
    onSortingChange: (updater) =>
      setSorting(
        typeof updater === "function" ? updater(visibleSorting) : updater,
      ),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const changeDay = (newDayId: number | "all") => {
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

  const headers = table.getFlatHeaders();
  const activeSort = visibleSorting[0];
  const sortDirectionLabel = activeSort?.desc
    ? t("Sort ascending")
    : t("Sort descending");
  const attendanceSelector = (
    <AttendanceSelector
      value={selectedAttendance}
      onChange={setSelectedAttendance}
      isMobile={isMobile}
    />
  );
  const rows = table
    .getRowModel()
    .rows.map((row) => (
      <VolunteerRow
        key={row.id}
        volunteer={row.original}
        days={displayedDays}
        isMobile={isMobile}
        canEditAttendance={canEditAttendance}
        onAttendanceChange={handleAttendanceChange}
        onAddAssessment={handleAddAssessment}
        onEditAssessment={handleEditAssessment}
        onDeleteAssessment={handleDeleteAssessment}
        selectedAttendance={selectedAttendance}
      />
    ));

  return (
    <Box
      sx={{
        width: "100%",
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          px: { xs: 1.5, lg: 2 },
          py: 1,
        }}
      >
        {isMobile ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr)",
              "@media (min-width: 420px)": {
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              },
              gap: 1,
            }}
          >
            <TextField
              select
              size="small"
              label={t("Day")}
              value={selectedDayId ?? "all"}
              onChange={({ target: { value } }) =>
                changeDay(value === "all" ? value : Number(value))
              }
              slotProps={{ select: { native: true } }}
              sx={{ "& .MuiInputBase-root": { minHeight: 44 } }}
            >
              <option value="all">{t("All Days")}</option>
              {days.map((day) => (
                <option key={day.day_id} value={day.day_id}>
                  {day.day_name}
                </option>
              ))}
            </TextField>
            {attendanceSelector}
            <Box sx={{ gridColumn: "1 / -1", display: "flex", gap: 0.5 }}>
              <TextField
                select
                fullWidth
                size="small"
                label={t("Sort by")}
                value={activeSort?.id ?? ""}
                onChange={({ target: { value } }) =>
                  setSorting(value ? [{ id: value, desc: false }] : [])
                }
                slotProps={{ select: { native: true } }}
                sx={{ minWidth: 0, "& .MuiInputBase-root": { minHeight: 44 } }}
              >
                <option value="">{t("Unsorted")}</option>
                {headers.map((header) => (
                  <option key={header.id} value={header.column.id}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </option>
                ))}
              </TextField>
              <Tooltip title={sortDirectionLabel}>
                <span>
                  <IconButton
                    aria-label={sortDirectionLabel}
                    disabled={!activeSort}
                    sx={{ width: 44, height: 44 }}
                    onClick={() => {
                      if (activeSort) {
                        setSorting([
                          { id: activeSort.id, desc: !activeSort.desc },
                        ]);
                      }
                    }}
                  >
                    {activeSort?.desc ? <ArrowDownward /> : <ArrowUpward />}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Box>
        ) : (
          <>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
              <Typography variant="body2" fontWeight="medium">
                {t("Select Attendance")}:
              </Typography>
              {attendanceSelector}
            </Box>
            <Tabs
              value={selectedDayId ?? "all"}
              onChange={(_, value) => changeDay(value as number | "all")}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab label={t("All Days")} value="all" />
              {days.map((day) => (
                <Tab key={day.day_id} label={day.day_name} value={day.day_id} />
              ))}
            </Tabs>
          </>
        )}
      </Box>

      <Box
        sx={{ flex: 1, minHeight: 0, overflow: "auto", p: { xs: 1.5, lg: 2 } }}
      >
        {isMobile ? (
          <Box
            component="ul"
            role="list"
            sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 1 }}
          >
            {rows}
          </Box>
        ) : (
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
              <TableBody>{rows}</TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Box>
  );
}

interface VolunteerRowProps {
  volunteer: VolunteerAttendance;
  days: Array<{ day_id: number; day_name: string }>;
  isMobile: boolean;
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
  isMobile,
  canEditAttendance,
  onAttendanceChange,
  onAddAssessment,
  onEditAssessment,
  onDeleteAssessment,
  selectedAttendance,
}: VolunteerRowProps) {
  const { t } = useTranslation();

  const dayCells = days.map((day) => {
    const item = volunteer.attendanceByDay.get(day.day_id);
    const content = item ? (
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "row", lg: "column" },
          alignItems: "center",
          gap: 0.5,
          minWidth: 0,
        }}
      >
        <ButtonBase
          component={canEditAttendance ? "button" : "span"}
          disabled={!canEditAttendance}
          sx={{
            gap: 0.5,
            px: 0.5,
            borderRadius: 1,
            minHeight: { xs: 44, lg: 0 },
            textAlign: "start",
            "&:hover, &.Mui-focusVisible": { backgroundColor: "action.hover" },
          }}
          onClick={() =>
            onAttendanceChange(item.user_day_id, selectedAttendance)
          }
        >
          {getAttendanceIcon(item.attendance)}
          <Typography component="span" variant="body2">
            {getAttendanceLabel(item.attendance, t)}
          </Typography>
        </ButtonBase>
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
    );

    if (isMobile) {
      return (
        <Box
          key={day.day_id}
          sx={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "space-between",
            columnGap: 1,
            minHeight: 44,
            px: 1.5,
            borderTop: 1,
            borderColor: "divider",
          }}
        >
          {days.length > 1 && (
            <Typography
              variant="body2"
              fontWeight="medium"
              sx={{ minWidth: 0 }}
            >
              {day.day_name}
            </Typography>
          )}
          {content}
        </Box>
      );
    }

    return (
      <TableCell key={day.day_id} align="center" sx={{ py: 0.5 }}>
        {content}
      </TableCell>
    );
  });

  const telegram = volunteer.user_telegram && (
    <Typography variant="caption" color="text.secondary">
      @{volunteer.user_telegram}
    </Typography>
  );

  if (isMobile) {
    return (
      <Paper
        component="li"
        variant="outlined"
        sx={{ minWidth: 0, overflowWrap: "anywhere" }}
      >
        <Box sx={{ px: 1.5, py: 1 }}>
          <Typography variant="subtitle2" component="h2">
            {volunteer.user_name}
          </Typography>
          {telegram}
          <Typography variant="body2" color="text.secondary">
            {volunteer.position_name}
            {volunteer.hall_name && <> · {volunteer.hall_name}</>}
          </Typography>
        </Box>
        {dayCells}
      </Paper>
    );
  }

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
        <Typography variant="body2">{volunteer.user_name}</Typography>
        {telegram}
      </TableCell>
      {dayCells}
    </TableRow>
  );
}
