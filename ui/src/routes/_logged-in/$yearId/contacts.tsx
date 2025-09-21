import SearchIcon from "@mui/icons-material/Search";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  InputAdornment,
  Link,
  Paper,
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
import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useState } from "react";
import type { UserListItem } from "@/client/types.gen";
import { useUsersList } from "@/data/use-admin";

export const Route = createFileRoute("/_logged-in/$yearId/contacts")({
  component: RouteComponent,
});

function RouteComponent() {
  const { yearId } = Route.useParams();
  const { data, isLoading, error } = useUsersList(yearId);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  // Define columns
  const columns: ColumnDef<UserListItem>[] = [
    {
      id: "name_ru",
      header: "Name (Russian)",
      accessorFn: (row) =>
        `${row.last_name_ru} ${row.first_name_ru}${row.patronymic_ru ? ` ${row.patronymic_ru}` : ""}`,
      cell: (info) => (
        <Typography variant="body2" fontWeight="medium" fontSize="0.875rem">
          {info.getValue() as string}
        </Typography>
      ),
    },
    {
      id: "name_en",
      header: "Name (English)",
      accessorKey: "full_name_en",
      cell: (info) => (
        <Typography variant="body2" fontSize="0.875rem">
          {info.getValue() as string}
        </Typography>
      ),
    },
    {
      id: "group",
      header: "Group",
      accessorKey: "itmo_group",
      cell: (info) => {
        const group = info.getValue() as string | null;
        return group ? (
          <Chip
            label={group}
            size="small"
            color="primary"
            sx={{ height: 20, fontSize: "0.75rem" }}
          />
        ) : (
          <Typography
            variant="body2"
            color="text.secondary"
            fontSize="0.875rem"
          >
            -
          </Typography>
        );
      },
    },
    {
      id: "email",
      header: "Email",
      accessorKey: "email",
      cell: (info) => {
        const email = info.getValue() as string | null;
        return email ? (
          <Link
            href={`mailto:${email}`}
            sx={{
              textDecoration: "none",
              color: "primary.main",
              "&:hover": {
                textDecoration: "underline",
              },
            }}
          >
            <Typography variant="body2" fontSize="0.875rem">
              {email}
            </Typography>
          </Link>
        ) : (
          <Typography
            variant="body2"
            color="text.secondary"
            fontSize="0.875rem"
          >
            -
          </Typography>
        );
      },
    },
    {
      id: "phone",
      header: "Phone",
      accessorKey: "phone",
      cell: (info) => {
        const phone = info.getValue() as string | null;
        return phone ? (
          <Link
            href={`tel:${phone}`}
            sx={{
              textDecoration: "none",
              color: "primary.main",
              "&:hover": {
                textDecoration: "underline",
              },
            }}
          >
            <Typography variant="body2" fontSize="0.875rem">
              {phone}
            </Typography>
          </Link>
        ) : (
          <Typography
            variant="body2"
            color="text.secondary"
            fontSize="0.875rem"
          >
            -
          </Typography>
        );
      },
    },
    {
      id: "telegram",
      header: "Telegram",
      accessorKey: "telegram_username",
      cell: (info) => {
        const username = info.getValue() as string | null;
        return username ? (
          <Link
            href={`tg://resolve?domain=${username}`}
            sx={{
              textDecoration: "none",
              color: "primary.main",
              "&:hover": {
                textDecoration: "underline",
              },
            }}
          >
            <Typography variant="body2" fontSize="0.875rem">
              @{username}
            </Typography>
          </Link>
        ) : (
          <Typography
            variant="body2"
            color="text.secondary"
            fontSize="0.875rem"
          >
            -
          </Typography>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "is_registered",
      cell: (info) => {
        const isRegistered = info.getValue() as boolean;
        return (
          <Chip
            label={isRegistered ? "Registered" : "Not Registered"}
            size="small"
            color={isRegistered ? "success" : "default"}
            variant={isRegistered ? "filled" : "outlined"}
            sx={{ height: 20, fontSize: "0.75rem" }}
          />
        );
      },
    },
  ];

  // Create table instance
  const table = useReactTable({
    data: data?.users || [],
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Virtual scrolling setup
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 40, // Estimated row height
    overscan: 10, // Number of items to render outside of the visible area
  });

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
        <Alert severity="error">Failed to load contacts: {error.message}</Alert>
      </Box>
    );
  }

  const users = data?.users || [];

  return (
    <Box p={2}>
      <Typography variant="h5" gutterBottom>
        Contacts
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        List of all users and their registration status for this year
      </Typography>

      {/* Search and filters */}
      <Box sx={{ mt: 1.5, mb: 1.5 }}>
        <TextField
          placeholder="Search users..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 300 }}
          size="small"
        />
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
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
                      py: 1,
                      px: 1.5,
                      "&:hover": header.column.getCanSort()
                        ? { backgroundColor: "action.hover" }
                        : {},
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="subtitle2" fontWeight="medium">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                      </Typography>
                      {header.column.getIsSorted() === "asc" && "↑"}
                      {header.column.getIsSorted() === "desc" && "↓"}
                    </Box>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableHead>
        </Table>

        {/* Virtual scrolling container */}
        <Box
          ref={tableContainerRef}
          sx={{
            height: "400px",
            overflow: "auto",
          }}
        >
          <Box
            sx={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <Box
                  key={row.id}
                  sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} sx={{ py: 0.5, px: 1.5 }}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                </Box>
              );
            })}
          </Box>
        </Box>
      </TableContainer>

      {users.length === 0 && (
        <Box textAlign="center" py={4}>
          <Typography variant="body1" color="text.secondary">
            No users found
          </Typography>
        </Box>
      )}
    </Box>
  );
}
