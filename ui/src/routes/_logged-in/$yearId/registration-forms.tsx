import SearchIcon from "@mui/icons-material/Search";
import {
  Alert,
  Box,
  Card,
  Chip,
  CircularProgress,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { RegistrationFormItem } from "@/client/types.gen";
import { DetailedUserCard } from "@/components/DetailedUserCard";
import { useRegistrationForms } from "@/data/use-admin";
import { shouldBeAdmin } from "@/utils/should-be-logged-in";

export const Route = createFileRoute("/_logged-in/$yearId/registration-forms")({
  component: RouteComponent,
  beforeLoad: async ({ context }) => {
    shouldBeAdmin(context);
    return {
      title: "Registration Forms",
    };
  },
});

const EMPTY: RegistrationFormItem[] = [];

function RouteComponent() {
  const { t } = useTranslation();
  const { yearId } = Route.useParams();
  const { data, isLoading, error } = useRegistrationForms(yearId);

  const [nameFilter, setNameFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");

  // Get all unique positions and their counts
  const positionCounts = useMemo(() => {
    if (!data?.forms) return {};

    const counts: Record<string, number> = {};
    data.forms.forEach((form) => {
      form.desired_positions.forEach((position) => {
        counts[position.name] = (counts[position.name] || 0) + 1;
      });
    });

    return counts;
  }, [data?.forms]);

  // Get unique positions for the filter dropdown
  const uniquePositions = useMemo(() => {
    return Object.keys(positionCounts).sort();
  }, [positionCounts]);

  // Filter registration forms based on name and position search
  const filteredForms = useMemo(() => {
    if (!data?.forms) return EMPTY;

    let filtered = data.forms;

    // Filter by name
    if (nameFilter.trim()) {
      const searchTerm = nameFilter.toLowerCase();
      filtered = filtered.filter((form) => {
        const fullNameRu =
          `${form.last_name_ru} ${form.first_name_ru}${form.patronymic_ru ? ` ${form.patronymic_ru}` : ""}`.toLowerCase();
        const fullNameEn =
          `${form.first_name_en} ${form.last_name_en}`.toLowerCase();

        return (
          fullNameRu.includes(searchTerm) || fullNameEn.includes(searchTerm)
        );
      });
    }

    // Filter by position
    if (positionFilter) {
      filtered = filtered.filter((form) => {
        return form.desired_positions.some(
          (position) => position.name === positionFilter,
        );
      });
    }

    return filtered;
  }, [data?.forms, nameFilter, positionFilter]);

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
          {t("Failed to load registration forms")}: {error.message}
        </Alert>
      </Box>
    );
  }

  const forms = filteredForms;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        p: 2,
        alignItems: "flex-start",
      }}
    >
      <Typography variant="h5" gutterBottom>
        {t("Registration Forms")}
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {t("All registration forms for this year")} ({forms.length} {t("forms")}
        )
      </Typography>

      {/* Position Counts */}
      {uniquePositions.length > 0 && (
        <Box sx={{ mt: 1, mb: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t("Position counts")}:
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {uniquePositions.map((position) => (
              <Chip
                key={position}
                label={`${position} (${positionCounts[position]})`}
                size="small"
                color={positionFilter === position ? "primary" : "default"}
                variant={positionFilter === position ? "filled" : "outlined"}
                onClick={() =>
                  setPositionFilter(positionFilter === position ? "" : position)
                }
                sx={{ cursor: "pointer" }}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Filters */}
      <Box
        sx={{
          mt: 1.5,
          mb: 2,
          display: "flex",
          gap: 2,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <TextField
          placeholder={t("Search by name...")}
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
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

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>{t("Filter by position")}</InputLabel>
          <Select
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            label={t("Filter by position")}
          >
            <MenuItem value="">
              <em>{t("All positions")}</em>
            </MenuItem>
            {uniquePositions.map((position) => (
              <MenuItem key={position} value={position}>
                {position} ({positionCounts[position]})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Cards List */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          width: "100%",
          maxWidth: "800px",
        }}
      >
        {forms.map((form) => (
          <Card
            key={form.form_id}
            sx={{
              "&:hover": {
                boxShadow: 3,
              },
            }}
          >
            <DetailedUserCard
              user={form}
              expandedDefault={true}
              expandable={true}
            />
          </Card>
        ))}
      </Box>

      {forms.length === 0 && (
        <Box textAlign="center" py={4} width="100%">
          <Typography variant="body1" color="text.secondary">
            {nameFilter.trim()
              ? t("No registration forms found matching your search")
              : t("No registration forms found")}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
