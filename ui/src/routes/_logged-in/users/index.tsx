import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  InputAdornment,
  Link,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { createFileRoute, Link as RouterLink } from "@tanstack/react-router";
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
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAllUsers } from "@/data/use-admin";
import { downloadFile } from "@/utils/download";
import { getGenderLabel } from "@/utils/gender";
import { shouldBeAdmin } from "@/utils/should-be-logged-in";

export const Route = createFileRoute("/_logged-in/users/")({
  component: RouteComponent,
  beforeLoad: async ({ context }) => {
    shouldBeAdmin(context);
    return {
      title: "Users",
    };
  },
});

function RouteComponent() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useAllUsers();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);

  const columns: ColumnDef<NonNullable<typeof data>["users"][number]>[] =
    useMemo(
      () => [
        {
          id: "user_id",
          header: t("ID"),
          accessorKey: "user_id",
          size: 80,
          cell: (info) => (
            <Typography variant="body2" fontSize="0.875rem">
              {info.getValue() as number}
            </Typography>
          ),
        },
        {
          id: "name_ru",
          header: t("Name (Russian)"),
          accessorFn: (row) =>
            `${row.last_name_ru} ${row.first_name_ru}${row.patronymic_ru ? ` ${row.patronymic_ru}` : ""}`,
          size: 200,
          cell: (info) => {
            const user = info.row.original;
            return (
              <RouterLink
                to="/users/$userId"
                params={{ userId: String(user.user_id) }}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <Typography
                  variant="body2"
                  fontWeight="medium"
                  fontSize="0.875rem"
                  sx={{
                    "&:hover": {
                      textDecoration: "underline",
                      color: "primary.main",
                    },
                  }}
                >
                  {info.getValue() as string}
                </Typography>
              </RouterLink>
            );
          },
        },
        {
          id: "name_en",
          header: t("Name (English)"),
          accessorFn: (row) => `${row.first_name_en} ${row.last_name_en}`,
          size: 150,
          cell: (info) => (
            <Typography variant="body2" fontSize="0.875rem">
              {info.getValue() as string}
            </Typography>
          ),
        },
        {
          id: "email",
          header: t("Email"),
          accessorKey: "email",
          size: 180,
          cell: (info) => {
            const email = info.getValue() as string | null;
            return email ? (
              <Link href={`mailto:${email}`} target="_blank" rel="noopener">
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
          size: 140,
          cell: (info) => {
            const phone = info.getValue() as string | null;
            return phone ? (
              <Link href={`tel:${phone}`}>
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
          size: 140,
          cell: (info) => {
            const username = info.getValue() as string | null;
            return username ? (
              <Link
                href={`https://t.me/${username}`}
                target="_blank"
                rel="noopener"
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
          id: "gender",
          header: t("Gender"),
          accessorKey: "gender",
          size: 100,
          cell: (info) => {
            const gender = info.getValue() as string | null;
            return (
              <Typography variant="body2" fontSize="0.875rem">
                {getGenderLabel(gender, t)}
              </Typography>
            );
          },
        },
        {
          id: "is_admin",
          header: t("Admin"),
          accessorKey: "is_admin",
          size: 100,
          cell: (info) => {
            const isAdmin = info.getValue() as boolean;
            return isAdmin ? (
              <Chip label={t("Admin")} color="primary" size="small" />
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
      ],
      [t],
    );

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
          {t("Failed to load users")}: {error.message}
        </Alert>
      </Box>
    );
  }

  const users = data?.users || [];

  return (
    <Box p={3}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="h4" component="h1">
            {t("Users")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t("List of all users")}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={async () => {
            try {
              await downloadFile("/api/v1/admin/user/export-csv");
            } catch (error) {
              setExportError(
                error instanceof Error ? error.message : "Export failed",
              );
            }
          }}
        >
          {t("Export to CSV")}
        </Button>
      </Box>

      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          placeholder={t("Search users...")}
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {users.length === 0 ? (
        <Alert severity="info">{t("No users found")}</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small" stickyHeader>
            <TableHead>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableCell
                      key={header.id}
                      sx={{
                        fontWeight: 600,
                        backgroundColor: "background.paper",
                        minWidth: header.getSize(),
                        width: header.getSize(),
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
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
                    <TableCell
                      key={cell.id}
                      sx={{
                        minWidth: cell.column.getSize(),
                        width: cell.column.getSize(),
                      }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Export error notification */}
      <Snackbar
        open={!!exportError}
        autoHideDuration={6000}
        onClose={() => setExportError(null)}
        message={exportError}
      />
    </Box>
  );
}
