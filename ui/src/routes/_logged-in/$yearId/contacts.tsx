import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Link,
  Paper,
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
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { UserListItem } from "@/client/types.gen";
import { DetailedUserCard } from "@/components/DetailedUserCard";
import { useRegistrationForms, useUsersList } from "@/data/use-admin";
import { shouldBeLoggedIn } from "@/utils/should-be-logged-in";

export const Route = createFileRoute("/_logged-in/$yearId/contacts")({
  component: RouteComponent,
  beforeLoad: async ({ context }) => {
    shouldBeLoggedIn(context);
    return {
      title: "Contacts",
    };
  },
});

const EMPTY: UserListItem[] = [];

function RouteComponent() {
  // console.log("render");
  const { t } = useTranslation();
  const { yearId } = Route.useParams();
  const { data, isLoading, error } = useUsersList(yearId);
  const { data: registrationForms } = useRegistrationForms(yearId);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Handle status column click
  const handleStatusClick = useCallback((userId: number) => {
    setSelectedUserId(userId);
    setIsModalOpen(true);
  }, []);

  // Get selected user's registration form data
  const selectedUserForm = registrationForms?.forms.find(
    (form) => form.user_id === selectedUserId,
  );

  // Define columns with appropriate sizing
  const columns: ColumnDef<UserListItem>[] = useMemo(
    () => [
      {
        id: "name_ru",
        header: t("Name (Russian)"),
        accessorFn: (row) =>
          `${row.last_name_ru} ${row.first_name_ru}${row.patronymic_ru ? ` ${row.patronymic_ru}` : ""}`,
        size: 200, // Russian names can be long
        cell: (info) => (
          <Typography variant="body2" fontWeight="medium" fontSize="0.875rem">
            {info.getValue() as string}
          </Typography>
        ),
      },
      {
        id: "name_en",
        header: t("Name (English)"),
        accessorFn: (row) => `${row.first_name_en} ${row.last_name_en}`,
        size: 150, // English names are usually shorter
        cell: (info) => (
          <Typography variant="body2" fontSize="0.875rem">
            {info.getValue() as string}
          </Typography>
        ),
      },
      {
        id: "group",
        header: t("Group"),
        accessorKey: "itmo_group",
        size: 100, // Group codes are short
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
        header: t("Email"),
        accessorKey: "email",
        size: 200, // Email addresses need adequate space
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
        header: t("Phone"),
        accessorKey: "phone",
        size: 200, // Phone numbers are relatively short
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
        header: t("Telegram"),
        accessorKey: "telegram_username",
        size: 200, // Telegram usernames are short
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
        header: t("Status"),
        accessorKey: "is_registered",
        size: 170, // Status chips are compact
        cell: (info) => {
          const isRegistered = info.getValue() as boolean;
          const userId = info.row.original.id;
          return (
            <Chip
              label={isRegistered ? t("Registered") : t("Not Registered")}
              size="small"
              color={isRegistered ? "success" : "default"}
              variant={isRegistered ? "filled" : "outlined"}
              sx={{
                height: 20,
                fontSize: "0.75rem",
                cursor: "pointer",
                "&:hover": {
                  opacity: 0.8,
                },
              }}
              onClick={() => handleStatusClick(userId)}
            />
          );
        },
      },
    ],
    [t, handleStatusClick],
  );

  // Create table instance
  const table = useReactTable({
    data: data?.users || EMPTY,
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
    estimateSize: () => 40, // Fixed row height
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
        <Alert severity="error">
          {t("Failed to load contacts")}: {error.message}
        </Alert>
      </Box>
    );
  }

  const users = data?.users || EMPTY;

  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        p: 2,
        flexShrink: 1,
        alignItems: "flex-start",
        overflow: "hidden",
      }}
    >
      <Typography variant="h5" gutterBottom>
        {t("Contacts")}
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {t("List of all users and their registration status for this year")}
      </Typography>

      {/* Search and filters */}
      <Box sx={{ mt: 1.5, mb: 1.5 }}>
        <TextField
          placeholder={t("Search users...")}
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

      <Paper
        sx={{
          flex: 1,
          overflow: "auto",
          maxWidth: "100%",
        }}
      >
        <Box
          ref={tableContainerRef}
          sx={{
            height: "100%",
            overflow: "auto",
          }}
        >
          {/* Header */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: table
                .getAllColumns()
                .map((col) => `${col.getSize()}px`)
                .join(" "),
              borderBottom: "2px solid",
              borderColor: "divider",
              position: "sticky",
              top: 0,
              backgroundColor: "background.paper",
              zIndex: 1,
              minWidth: "max-content",
            }}
          >
            {table.getHeaderGroups().map((headerGroup) =>
              headerGroup.headers.map((header) => (
                <Box
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  sx={{
                    cursor: header.column.getCanSort() ? "pointer" : "default",
                    userSelect: "none",
                    py: 1,
                    px: 1.5,
                    borderRight: "1px solid",
                    borderColor: "divider",
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    "&:last-child": {
                      borderRight: "none",
                    },
                    "&:hover": header.column.getCanSort()
                      ? { backgroundColor: "action.hover" }
                      : {},
                  }}
                >
                  <Typography variant="subtitle2" fontWeight="medium">
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </Typography>
                  {header.column.getIsSorted() === "asc" && "↑"}
                  {header.column.getIsSorted() === "desc" && "↓"}
                </Box>
              )),
            )}
          </Box>

          {/* Virtualized Body */}
          <Box
            sx={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              minWidth: "max-content",
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
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    display: "grid",
                    gridTemplateColumns: table
                      .getAllColumns()
                      .map((col) => `${col.getSize()}px`)
                      .join(" "),
                    minWidth: "max-content",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    "&:hover": {
                      backgroundColor: "action.hover",
                    },
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <Box
                      key={cell.id}
                      sx={{
                        py: 0.5,
                        px: 1.5,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        borderRight: "1px solid",
                        borderColor: "divider",
                        display: "flex",
                        alignItems: "center",
                        "&:last-child": {
                          borderRight: "none",
                        },
                      }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </Box>
                  ))}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Paper>

      {users.length === 0 && (
        <Box textAlign="center" py={4}>
          <Typography variant="body1" color="text.secondary">
            {t("No users found")}
          </Typography>
        </Box>
      )}

      {/* User Details Modal */}
      <Dialog
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="h6">{t("User Registration Details")}</Typography>
          <IconButton onClick={() => setIsModalOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {selectedUserForm ? (
            <DetailedUserCard
              user={selectedUserForm}
              expandedDefault={true}
              expandable={false}
            />
          ) : (
            <Box p={3} textAlign="center">
              <Typography variant="body1" color="text.secondary">
                {t("User registration form not found")}
              </Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
