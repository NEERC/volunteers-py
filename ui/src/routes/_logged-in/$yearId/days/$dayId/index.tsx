import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FilterListIcon from "@mui/icons-material/FilterList";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";
import type {
  ColumnFiltersState,
  GroupingState,
  SortingState,
} from "@tanstack/react-table";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DayAssignmentItem } from "@/client/types.gen";
import { LinkButton } from "@/components/LinkButton";
import { useUserDayAssignments } from "@/data";
import { useAssignmentUpdates } from "@/hooks/useAssignmentUpdates";

export const Route = createFileRoute("/_logged-in/$yearId/days/$dayId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { yearId, dayId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const {
    data: assignmentsData,
    isLoading,
    error,
  } = useUserDayAssignments(yearId, dayId);

  // Subscribe to real-time assignment updates
  useAssignmentUpdates(Number.parseInt(dayId, 10), Number.parseInt(yearId, 10));

  if (isLoading) {
    return (
      <Box p={3}>
        <Typography>{t("Loading assignments...")}</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Typography color="error">
          {t("Error loading assignments")}: {error.message}
        </Typography>
      </Box>
    );
  }

  if (!assignmentsData?.assignments) {
    return (
      <Box p={3}>
        <Typography>{t("No assignments found for this day.")}</Typography>
      </Box>
    );
  }

  return (
    <Box
      p={1}
      sx={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        flexShrink: 1,
        overflow: "hidden",
      }}
    >
      <Typography variant="h4" component="h1" gutterBottom>
        {t("Volunteer Assignments")}{" "}
        {/* TODO: show day name instead of "Assignments" */}
        {user.is_admin && (
          <LinkButton to="/$yearId/days/$dayId/edit" params={{ yearId, dayId }}>
            {t("Edit Assignments")}
          </LinkButton>
        )}
      </Typography>
      {!assignmentsData.is_published && (
        <Alert severity="warning">
          {t("Assignments are not yet published")}
          {user.is_admin &&
            t(", but you can see them because you are an admin")}
        </Alert>
      )}
      {(user.is_admin || assignmentsData.is_published) && (
        <AssignmentsTable assignments={assignmentsData.assignments} />
      )}
    </Box>
  );
}

interface AssignmentsTableProps {
  assignments: DayAssignmentItem[];
}

// Column helper for TanStack Table
const columnHelper = createColumnHelper<DayAssignmentItem>();

function AssignmentsTable({ assignments }: AssignmentsTableProps) {
  const { t } = useTranslation();
  const [grouping, setGrouping] = useState<GroupingState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "position", desc: true },
    { id: "hall", desc: true },
    // { id: "attendance", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Get unique values for filter options
  const positionOptions = Array.from(
    new Set(assignments.map((item) => item.position || t("No Position"))),
  ).sort();
  const hallOptions = Array.from(
    new Set(assignments.map((item) => item.hall || t("No Hall"))),
  ).sort();
  // const attendanceOptions = Array.from(
  //   new Set(assignments.map((item) => item.attendance)),
  // ).sort();

  // console.log(positionOptions, hallOptions, attendanceOptions);

  const columns = [
    columnHelper.accessor("name", {
      header: t("Name"),
      enableGrouping: false,
      enableColumnFilter: false,
    }),
    columnHelper.accessor("telegram", {
      header: t("Telegram"),
      cell: (info) => {
        const username = info.getValue();
        return username ? `@${username}` : "-";
      },
      enableGrouping: false,
      enableColumnFilter: false,
    }),
    columnHelper.accessor("position", {
      header: t("Position"),
      cell: (info) => info.getValue() || t("No Position"),
      enableGrouping: true,
      enableGlobalFilter: true,
      filterFn: "equals",
    }),
    columnHelper.accessor("hall", {
      header: t("Hall"),
      cell: (info) => info.getValue() || t("No Hall"),
      enableGrouping: true,
      enableGlobalFilter: true,
      filterFn: "equals",
    }),
    // columnHelper.accessor("attendance", {
    //   header: "Attendance",
    //   cell: (info) => {
    //     const attendance = info.getValue();
    //     const color =
    //       attendance === "yes"
    //         ? "success"
    //         : attendance === "no"
    //           ? "error"
    //           : "default";
    //     return (
    //       <Chip
    //         label={attendance}
    //         color={color as "success" | "error" | "default"}
    //         size="small"
    //       />
    //     );
    //   },
    //   enableGrouping: true,
    //   enableGlobalFilter: true,
    //   filterFn: "equals",
    // }),
  ];

  const table = useReactTable({
    data: assignments,
    columns,
    state: {
      grouping,
      sorting,
      columnFilters,
      globalFilter,
    },
    onGroupingChange: setGrouping,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    enableGrouping: true,
    enableSorting: true,
    enableFilters: true,
    enableGlobalFilter: true,
    initialState: {
      expanded: true, // All groups expanded by default
    },
  });

  return (
    <>
      {/* Controls */}
      <Box sx={{ mt: 2 }}>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 2 }}>
          <TextField
            placeholder={t("Search all columns...")}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            size="small"
            sx={{ minWidth: 300 }}
          />
          <IconButton
            onClick={() => setShowFilters(!showFilters)}
            color={showFilters ? "primary" : "default"}
          >
            <FilterListIcon />
          </IconButton>
        </Box>

        <Collapse in={showFilters}>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>{t("Group By")}</InputLabel>
              <Select
                multiple
                value={grouping}
                onChange={(e) => setGrouping(e.target.value as string[])}
                label={t("Group By")}
              >
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanGroup())
                  .map((column) => (
                    <MenuItem key={column.id} value={column.id}>
                      {column.columnDef.header as string}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>

            {table
              .getAllColumns()
              .filter((column) => column.getCanFilter())
              .map((column) => {
                const getFilterOptions = () => {
                  switch (column.id) {
                    case "position":
                      return positionOptions;
                    case "hall":
                      return hallOptions;
                    // case "attendance":
                    //   return attendanceOptions;
                    default:
                      return [];
                  }
                };

                return (
                  <FormControl
                    key={column.id}
                    size="small"
                    sx={{ minWidth: 120 }}
                  >
                    <InputLabel>{column.columnDef.header as string}</InputLabel>
                    <Select
                      value={String(column.getFilterValue() ?? "")}
                      onChange={(e) =>
                        column.setFilterValue(e.target.value || undefined)
                      }
                      label={t("Filter")}
                    >
                      <MenuItem value="">{t("Any")}</MenuItem>
                      {getFilterOptions().map((option) => (
                        <MenuItem key={option} value={option}>
                          {option}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                );
              })}

            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                table.resetColumnFilters();
                setGlobalFilter("");
                setGrouping([]);
                setSorting([]);
              }}
            >
              {t("Clear All")}
            </Button>
          </Box>
        </Collapse>

        {/* Active Filters */}
        {(table.getState().columnFilters.length > 0 || grouping.length > 0) && (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
            {grouping.map((group) => (
              <Chip
                key={group}
                label={`${t("Grouped by")}: ${group}`}
                onDelete={() =>
                  setGrouping(grouping.filter((g) => g !== group))
                }
                color="primary"
                size="small"
              />
            ))}
            {table.getState().columnFilters.map((filter) => (
              <Chip
                key={filter.id}
                label={`${filter.id}: ${filter.value}`}
                onDelete={() =>
                  table.getColumn(filter.id)?.setFilterValue(undefined)
                }
                color="secondary"
                size="small"
              />
            ))}
          </Box>
        )}
      </Box>

      <TableContainer component={Paper} sx={{ maxHeight: "80vh" }}>
        <Table stickyHeader>
          <TableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableCell key={header.id}>
                    {header.isPlaceholder ? null : (
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Box
                          onClick={header.column.getToggleSortingHandler()}
                          sx={{
                            cursor: header.column.getCanSort()
                              ? "pointer"
                              : "default",
                            userSelect: "none",
                            display: "flex",
                            alignItems: "center",
                            whiteSpace: "nowrap",
                            gap: 0.5,
                          }}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {{
                            asc: " ↑",
                            desc: " ↓",
                          }[header.column.getIsSorted() as string] ?? ""}
                        </Box>
                      </Box>
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableHead>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} hover>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} sx={{ whiteSpace: "nowrap", p: 1 }}>
                    {cell.getIsGrouped() ? (
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <IconButton
                          size="small"
                          onClick={row.getToggleExpandedHandler()}
                        >
                          {row.getIsExpanded() ? (
                            <ExpandLessIcon />
                          ) : (
                            <ExpandMoreIcon />
                          )}
                        </IconButton>
                        <Chip
                          label={`${cell.getValue()} (${row.subRows.length})`}
                          color="primary"
                          size="small"
                        />
                      </Box>
                    ) : cell.getIsAggregated() ? null : cell.getIsPlaceholder() ? null : (
                      flexRender(cell.column.columnDef.cell, cell.getContext())
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}
