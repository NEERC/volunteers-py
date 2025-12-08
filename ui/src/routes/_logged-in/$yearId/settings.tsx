import AddIcon from "@mui/icons-material/Add";
import BadgeIcon from "@mui/icons-material/Badge";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import HomeIcon from "@mui/icons-material/Home";
import SaveIcon from "@mui/icons-material/Save";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Snackbar,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DayOutAdmin, HallOut, PositionOut } from "@/client/types.gen";
import {
  useAddDay,
  useAddHall,
  useAddPosition,
  useEditDay,
  useEditHall,
  useEditPosition,
  useEditYear,
  useYearDays,
  useYearHalls,
  useYearPositions,
  useYears,
} from "@/data";
import { downloadFile } from "@/utils/download";
import { submitOnCtrlEnter } from "@/utils/formShortcuts";
import { shouldBeAdmin } from "@/utils/should-be-logged-in";

export const Route = createFileRoute("/_logged-in/$yearId/settings")({
  component: RouteComponent,
  beforeLoad: async ({ context }) => {
    shouldBeAdmin(context);
    return {
      title: "Year Settings",
    };
  },
});

function RouteComponent() {
  const { t } = useTranslation();
  const { yearId } = Route.useParams();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<PositionOut | null>(
    null,
  );
  const [newPositionName, setNewPositionName] = useState("");
  const [newPositionTouched, setNewPositionTouched] = useState(false);
  const [editPositionName, setEditPositionName] = useState("");
  const [editPositionTouched, setEditPositionTouched] = useState(false);
  const [newPositionCanDesire, setNewPositionCanDesire] = useState(false);
  const [editPositionCanDesire, setEditPositionCanDesire] = useState(false);
  const [newPositionHasHalls, setNewPositionHasHalls] = useState(false);
  const [editPositionHasHalls, setEditPositionHasHalls] = useState(false);
  const [newPositionIsManager, setNewPositionIsManager] = useState(false);
  const [editPositionIsManager, setEditPositionIsManager] = useState(false);
  const [newPositionSaveForNextYear, setNewPositionSaveForNextYear] =
    useState(false);
  const [editPositionSaveForNextYear, setEditPositionSaveForNextYear] =
    useState(false);
  const [newPositionScore, setNewPositionScore] = useState("1.0");
  const [newPositionScoreTouched, setNewPositionScoreTouched] = useState(false);
  const [editPositionScore, setEditPositionScore] = useState("1.0");
  const [editPositionScoreTouched, setEditPositionScoreTouched] =
    useState(false);
  const [newPositionDescription, setNewPositionDescription] = useState("");
  const [editPositionDescription, setEditPositionDescription] = useState("");
  const [newPositionScoreError, setNewPositionScoreError] = useState("");
  const [editPositionScoreError, setEditPositionScoreError] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);

  // Position error state
  const [addPositionError, setAddPositionError] = useState<string | null>(null);
  const [editPositionError, setEditPositionError] = useState<string | null>(
    null,
  );

  // Hall management state
  const [isAddHallDialogOpen, setIsAddHallDialogOpen] = useState(false);
  const [isEditHallDialogOpen, setIsEditHallDialogOpen] = useState(false);
  const [editingHall, setEditingHall] = useState<HallOut | null>(null);
  const [newHallName, setNewHallName] = useState("");
  const [newHallTouched, setNewHallTouched] = useState(false);
  const [editHallName, setEditHallName] = useState("");
  const [editHallTouched, setEditHallTouched] = useState(false);
  const [newHallDescription, setNewHallDescription] = useState("");
  const [editHallDescription, setEditHallDescription] = useState("");

  // Day management state
  const [isAddDayDialogOpen, setIsAddDayDialogOpen] = useState(false);
  const [isEditDayDialogOpen, setIsEditDayDialogOpen] = useState(false);
  const [editingDay, setEditingDay] = useState<DayOutAdmin | null>(null);
  const [newDayName, setNewDayName] = useState("");
  const [newDayTouched, setNewDayTouched] = useState(false);
  const [editDayName, setEditDayName] = useState("");
  const [editDayTouched, setEditDayTouched] = useState(false);
  const [newDayInformation, setNewDayInformation] = useState("");
  const [editDayInformation, setEditDayInformation] = useState("");
  const [newDayScore, setNewDayScore] = useState("0");
  const [newDayScoreTouched, setNewDayScoreTouched] = useState(false);
  const [editDayScore, setEditDayScore] = useState("0");
  const [editDayScoreTouched, setEditDayScoreTouched] = useState(false);
  const [newDayMandatory, setNewDayMandatory] = useState(false);
  const [editDayMandatory, setEditDayMandatory] = useState(false);
  const [newDayAssignmentPublished, setNewDayAssignmentPublished] =
    useState(false);
  const [editDayAssignmentPublished, setEditDayAssignmentPublished] =
    useState(false);

  // Year settings state
  const [yearName, setYearName] = useState("");
  const [yearNameTouched, setYearNameTouched] = useState(false);
  const [openForRegistration, setOpenForRegistration] = useState(false);
  const [isYearSettingsEditing, setIsYearSettingsEditing] = useState(false);

  // Fetch all positions for admin (including non-desirable ones)
  const { data: positions, isLoading } = useYearPositions(yearId);

  // Fetch all halls for admin
  const { data: halls } = useYearHalls(yearId);

  // Fetch all days for admin
  const { data: days } = useYearDays(yearId);

  // Fetch years data to get current year info
  const { data: yearsData } = useYears();
  const currentYear = yearsData?.years?.find(
    (y) => y.year_id === Number(yearId),
  );

  // Add position mutation
  const addPositionMutation = useAddPosition();

  // Edit position mutation
  const editPositionMutation = useEditPosition(yearId);

  // Add hall mutation
  const addHallMutation = useAddHall();

  // Edit hall mutation
  const editHallMutation = useEditHall();

  // Add day mutation
  const addDayMutation = useAddDay();

  // Edit day mutation
  const editDayMutation = useEditDay();

  // Edit year mutation
  const editYearMutation = useEditYear();

  // Initialize year settings when current year data is available
  React.useEffect(() => {
    if (currentYear) {
      setYearName(currentYear.year_name);
      setOpenForRegistration(currentYear.open_for_registration);
    }
  }, [currentYear]);

  const handleYearSettingsSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (yearName.trim()) {
      editYearMutation.mutate(
        {
          yearId: Number(yearId),
          data: {
            year_name: yearName.trim(),
            open_for_registration: openForRegistration,
          },
        },
        {
          onSuccess: () => {
            setIsYearSettingsEditing(false);
          },
        },
      );
    }
  };

  const handleYearSettingsCancel = () => {
    if (currentYear) {
      setYearName(currentYear.year_name);
      setOpenForRegistration(currentYear.open_for_registration);
    }
    setIsYearSettingsEditing(false);
  };

  const handleAddPosition = (e: React.FormEvent) => {
    e.preventDefault();
    setNewPositionScoreError("");
    setAddPositionError(null);

    const trimmedName = newPositionName.trim();
    if (!trimmedName) {
      setAddPositionError(t("Position name is required"));
      return;
    }

    // Проверка на дубликат имени (регистронезависимо)
    const nameExists = positions?.some(
      (pos) => pos.name.toLowerCase() === trimmedName.toLowerCase(),
    );

    if (nameExists) {
      setAddPositionError(
        t("Position with this name already exists for the year"),
      );
      return;
    }

    if (!newPositionScore.trim()) {
      setNewPositionScoreError(t("Score is required"));
      return;
    }

    const scoreValue = Number(newPositionScore);
    if (Number.isNaN(scoreValue)) {
      setNewPositionScoreError(t("Score must be a valid number"));
      return;
    }

    // Теперь отправляем — гарантированно без дубликата
    addPositionMutation.mutate(
      {
        year_id: Number(yearId),
        name: trimmedName,
        can_desire: newPositionCanDesire,
        has_halls: newPositionHasHalls,
        is_manager: newPositionIsManager,
        save_for_next_year: newPositionSaveForNextYear,
        score: scoreValue,
        description: newPositionDescription.trim() || null,
      },
      {
        onSuccess: () => {
          closeAddDialogAndReset();
        },
      },
    );
  };

  const handleEditPosition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPosition) return;
    setEditPositionScoreError("");
    setEditPositionError(null);

    const trimmedName = editPositionName.trim();
    if (!trimmedName) {
      setEditPositionError(t("Position name is required"));
      return;
    }

    // Проверяем дубликат, исключая текущую позицию
    const nameExists = positions?.some(
      (pos) =>
        pos.position_id !== editingPosition?.position_id &&
        pos.name.toLowerCase() === trimmedName.toLowerCase(),
    );

    if (nameExists) {
      setEditPositionError(
        t("Position with this name already exists for the year"),
      );
      return;
    }

    if (!editPositionScore.trim()) {
      setEditPositionScoreError(t("Score is required"));
      return;
    }

    const scoreValue = Number(editPositionScore);
    if (Number.isNaN(scoreValue)) {
      setEditPositionScoreError(t("Score must be a valid number"));
      return;
    }

    editPositionMutation.mutate(
      {
        positionId: editingPosition.position_id,
        data: {
          name: trimmedName,
          can_desire: editPositionCanDesire,
          has_halls: editPositionHasHalls,
          is_manager: editPositionIsManager,
          save_for_next_year: editPositionSaveForNextYear,
          score: scoreValue,
          description: editPositionDescription.trim() || null,
        },
      },
      {
        onSuccess: () => {
          closeEditDialogAndReset();
        },
      },
    );
  };

  const openEditDialog = (position: PositionOut) => {
    setEditingPosition(position);
    setEditPositionName(position.name);
    setEditPositionCanDesire(position.can_desire);
    setEditPositionHasHalls(position.has_halls);
    setEditPositionIsManager(position.is_manager);
    setEditPositionSaveForNextYear(!!position.save_for_next_year);
    setEditPositionScore(String(position.score ?? "1.0"));
    setEditPositionDescription(position.description || "");
    setIsEditDialogOpen(true);
  };

  // Hall management functions
  const handleAddHall = (e: React.FormEvent) => {
    e.preventDefault();
    if (newHallName.trim()) {
      addHallMutation.mutate(
        {
          year_id: Number(yearId),
          name: newHallName.trim(),
          description: newHallDescription.trim() || null,
        },
        {
          onSuccess: () => {
            closeAddHallDialogAndReset();
          },
        },
      );
    }
  };

  const handleEditHall = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingHall && editHallName.trim()) {
      editHallMutation.mutate(
        {
          hallId: editingHall.hall_id,
          data: {
            name: editHallName.trim(),
            description: editHallDescription.trim() || null,
          },
        },
        {
          onSuccess: () => {
            closeEditHallDialogAndReset();
          },
        },
      );
    }
  };

  const openEditHallDialog = (hall: HallOut) => {
    setEditingHall(hall);
    setEditHallName(hall.name);
    setEditHallDescription(hall.description || "");
    setIsEditHallDialogOpen(true);
  };

  // Day management functions
  const handleAddDay = (e: React.FormEvent) => {
    e.preventDefault();
    if (newDayName.trim() && newDayScore.trim()) {
      addDayMutation.mutate(
        {
          year_id: Number(yearId),
          name: newDayName.trim(),
          information: newDayInformation.trim(),
          score: Number(newDayScore),
          mandatory: newDayMandatory,
          assignment_published: newDayAssignmentPublished,
        },
        {
          onSuccess: () => {
            closeAddDayDialogAndReset();
          },
        },
      );
    }
  };

  const handleEditDay = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingDay && editDayName.trim() && editDayScore.trim()) {
      editDayMutation.mutate(
        {
          dayId: editingDay.day_id,
          yearId: yearId,
          data: {
            name: editDayName.trim(),
            information: editDayInformation.trim(),
            score: Number(editDayScore),
            mandatory: editDayMandatory,
            assignment_published: editDayAssignmentPublished,
          },
        },
        {
          onSuccess: () => {
            closeEditDayDialogAndReset();
          },
        },
      );
    }
  };

  const openEditDayDialog = (day: DayOutAdmin) => {
    setEditingDay(day);
    setEditDayName(day.name);
    setEditDayInformation(day.information);
    setEditDayScore(String(day.score ?? "0"));
    setEditDayMandatory(day.mandatory);
    setEditDayAssignmentPublished(day.assignment_published);
    setIsEditDayDialogOpen(true);
  };

  // === Close/Reset helpers ===
  const closeAddDialogAndReset = () => {
    setIsAddDialogOpen(false);
    setNewPositionName("");
    setNewPositionTouched(false);
    setNewPositionCanDesire(false);
    setNewPositionHasHalls(false);
    setNewPositionIsManager(false);
    setNewPositionSaveForNextYear(false);
    setNewPositionScore("1.0");
    setNewPositionScoreTouched(false);
    setNewPositionDescription("");
    setAddPositionError(null);
  };

  const closeEditDialogAndReset = () => {
    setIsEditDialogOpen(false);
    setEditingPosition(null);
    setEditPositionName("");
    setEditPositionTouched(false);
    setEditPositionCanDesire(false);
    setEditPositionHasHalls(false);
    setEditPositionIsManager(false);
    setEditPositionSaveForNextYear(false);
    setEditPositionScore("1.0");
    setEditPositionScoreTouched(false);
    setEditPositionDescription("");
    setEditPositionError(null);
  };

  const closeAddHallDialogAndReset = () => {
    setIsAddHallDialogOpen(false);
    setNewHallName("");
    setNewHallTouched(false);
    setNewHallDescription("");
  };
  const closeEditHallDialogAndReset = () => {
    setIsEditHallDialogOpen(false);
    setEditingHall(null);
    setEditHallName("");
    setEditHallTouched(false);
    setEditHallDescription("");
  };

  const closeAddDayDialogAndReset = () => {
    setIsAddDayDialogOpen(false);
    setNewDayName("");
    setNewDayInformation("");
    setNewDayScore("0");
    setNewDayTouched(false);
    setNewDayScoreTouched(false);
    setNewDayMandatory(false);
    setNewDayAssignmentPublished(false);
  };
  const closeEditDayDialogAndReset = () => {
    setIsEditDayDialogOpen(false);
    setEditingDay(null);
    setEditDayName("");
    setEditDayInformation("");
    setEditDayScore("0");
    setEditDayTouched(false);
    setEditDayScoreTouched(false);
    setEditDayMandatory(false);
    setEditDayAssignmentPublished(false);
  };

  const closeAddDialogSimple = () => setIsAddDialogOpen(false);
  const closeEditDialogSimple = () => setIsEditDialogOpen(false);
  const closeAddHallDialogSimple = () => setIsAddHallDialogOpen(false);
  const closeEditHallDialogSimple = () => setIsEditHallDialogOpen(false);
  const closeAddDayDialogSimple = () => setIsAddDayDialogOpen(false);
  const closeEditDayDialogSimple = () => setIsEditDayDialogOpen(false);

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="50vh"
      >
        <Typography>{t("Loading...")}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography variant="h4" component="h1">
          {t("Year Settings")}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={async () => {
            try {
              await downloadFile(`/api/v1/admin/year/${yearId}/export-csv`);
            } catch (error) {
              setExportError(
                error instanceof Error ? error.message : "Export failed",
              );
            }
          }}
        >
          {t("Export to ZIP")}
        </Button>
      </Box>

      {/* Year Settings Form */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
          }}
        >
          <Typography variant="h6" component="h2">
            {t("Year Information")}
          </Typography>
          {!isYearSettingsEditing && (
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => setIsYearSettingsEditing(true)}
            >
              {t("Edit")}
            </Button>
          )}
        </Box>

        {isYearSettingsEditing ? (
          <form onSubmit={handleYearSettingsSave}>
            <TextField
              fullWidth
              label={t("Year Name")}
              value={yearName}
              onChange={(e) => setYearName(e.target.value)}
              onBlur={() => setYearNameTouched(true)}
              error={yearNameTouched && !yearName.trim()}
              helperText={
                yearNameTouched && !yearName.trim()
                  ? t("Year name is required")
                  : editYearMutation.error?.message
              }
              disabled={editYearMutation.isPending}
              sx={{ mb: 2 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={openForRegistration}
                  onChange={(e) => setOpenForRegistration(e.target.checked)}
                  disabled={editYearMutation.isPending}
                />
              }
              label={t("Open for Registration")}
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={!yearName.trim() || editYearMutation.isPending}
              >
                {editYearMutation.isPending
                  ? t("Saving...")
                  : t("Save Changes")}
              </Button>
              <Button
                variant="outlined"
                onClick={handleYearSettingsCancel}
                disabled={editYearMutation.isPending}
              >
                {t("Cancel")}
              </Button>
            </Box>
          </form>
        ) : (
          <Box>
            <Typography variant="body1" sx={{ mb: 1 }}>
              <strong>{t("Year Name")}:</strong>{" "}
              {currentYear?.year_name || t("Loading...")}
            </Typography>
            <Typography
              variant="body1"
              sx={{ display: "flex", alignItems: "center", gap: 1 }}
            >
              <strong>{t("Registration Status:")}</strong>
              {currentYear?.open_for_registration ? (
                <>
                  <VisibilityIcon color="success" fontSize="small" />
                  {t("Open")}
                </>
              ) : (
                <>
                  <VisibilityOffIcon color="disabled" fontSize="small" />
                  {t("Closed")}
                </>
              )}
            </Typography>
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
          }}
        >
          <Typography variant="h6" component="h2">
            {t("Positions")}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsAddDialogOpen(true)}
          >
            {t("Add Position")}
          </Button>
        </Box>

        {positions && positions.length > 0 ? (
          <List>
            {positions.map((position) => (
              <ListItem
                key={position.position_id}
                onClick={() => openEditDialog(position)}
                sx={{
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 1,
                  mb: 1,
                  cursor: "pointer",
                  "&:hover": {
                    backgroundColor: "action.hover",
                  },
                }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {position.name}
                      {position.can_desire ? (
                        <Tooltip title={t("Available for registration")}>
                          <VisibilityIcon color="success" fontSize="small" />
                        </Tooltip>
                      ) : (
                        <Tooltip title={t("Hidden from registration")}>
                          <VisibilityOffIcon
                            color="disabled"
                            fontSize="small"
                          />
                        </Tooltip>
                      )}
                      {position.has_halls && (
                        <Tooltip title={t("Has halls")}>
                          <HomeIcon color="primary" fontSize="small" />
                        </Tooltip>
                      )}
                      {position.is_manager && (
                        <Tooltip title={t("Is manager")}>
                          <BadgeIcon color="secondary" fontSize="small" />
                        </Tooltip>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {t("Score")}: {position.score}
                      </Typography>
                    </Box>
                  }
                  secondary={position.description || undefined}
                />
                <IconButton
                  onClick={(event) => {
                    event.stopPropagation();
                    openEditDialog(position);
                  }}
                  color="primary"
                  size="small"
                >
                  <EditIcon />
                </IconButton>
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography color="text.secondary" sx={{ fontStyle: "italic" }}>
            {t("No positions found. Add your first position to get started.")}
          </Typography>
        )}
      </Paper>

      {/* Halls Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
          }}
        >
          <Typography variant="h6" component="h2">
            {t("Halls")}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsAddHallDialogOpen(true)}
          >
            {t("Add Hall")}
          </Button>
        </Box>

        {halls && halls.length > 0 ? (
          <List>
            {halls.map((hall: HallOut) => (
              <ListItem
                key={hall.hall_id}
                onClick={() => openEditHallDialog(hall)}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  mb: 1,
                  cursor: "pointer",
                  "&:hover": {
                    backgroundColor: "action.hover",
                  },
                }}
              >
                <ListItemText
                  primary={hall.name}
                  secondary={hall.description || t("No description")}
                />
                <IconButton
                  onClick={(event) => {
                    event.stopPropagation();
                    openEditHallDialog(hall);
                  }}
                  color="primary"
                  size="small"
                >
                  <EditIcon />
                </IconButton>
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography color="text.secondary" sx={{ fontStyle: "italic" }}>
            {t("No halls found. Add your first hall to get started.")}
          </Typography>
        )}
      </Paper>

      {/* Days Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
          }}
        >
          <Typography variant="h6" component="h2">
            {t("Days")}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsAddDayDialogOpen(true)}
          >
            {t("Add Day")}
          </Button>
        </Box>

        {days && days.length > 0 ? (
          <List>
            {days.map((day) => (
              <ListItem
                key={day.day_id}
                onClick={() => openEditDayDialog(day)}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  mb: 1,
                  cursor: "pointer",
                  "&:hover": {
                    backgroundColor: "action.hover",
                  },
                }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {day.name}
                      {day.mandatory && (
                        <Tooltip title={t("Mandatory day")}>
                          <VisibilityIcon color="warning" fontSize="small" />
                        </Tooltip>
                      )}
                      {day.assignment_published ? (
                        <Tooltip title={t("Assignments published")}>
                          <VisibilityIcon color="success" fontSize="small" />
                        </Tooltip>
                      ) : (
                        <Tooltip title={t("Assignments not published")}>
                          <VisibilityOffIcon
                            color="disabled"
                            fontSize="small"
                          />
                        </Tooltip>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {t("Score")}: {day.score}
                      </Typography>
                    </Box>
                  }
                  secondary={day.information}
                />
                <IconButton
                  onClick={(event) => {
                    event.stopPropagation();
                    openEditDayDialog(day);
                  }}
                  color="primary"
                  size="small"
                >
                  <EditIcon />
                </IconButton>
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography color="text.secondary" sx={{ fontStyle: "italic" }}>
            {t("No days found. Add your first day to get started.")}
          </Typography>
        )}
      </Paper>

      {/* Add Position Dialog */}
      <Dialog
        open={isAddDialogOpen}
        onClose={(...args: unknown[]) => {
          const reason = args[1] as string | undefined;
          if (reason === "escapeKeyDown") {
            closeAddDialogSimple();
          } else {
            closeAddDialogAndReset();
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <form onSubmit={handleAddPosition}>
          <DialogTitle>{t("Add New Position")}</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label={t("Position Name")}
              fullWidth
              variant="outlined"
              value={newPositionName}
              onChange={(e) => setNewPositionName(e.target.value)}
              onBlur={() => setNewPositionTouched(true)}
              error={
                (newPositionTouched && !newPositionName.trim()) ||
                !!addPositionError
              }
              helperText={
                (newPositionTouched && !newPositionName.trim()
                  ? t("Position name is required")
                  : addPositionError) || ""
              }
              disabled={addPositionMutation.isPending}
            />
            <TextField
              margin="dense"
              label={t("Description")}
              fullWidth
              variant="outlined"
              value={newPositionDescription}
              onChange={(e) => setNewPositionDescription(e.target.value)}
              onKeyDown={(event) =>
                submitOnCtrlEnter(event, {
                  canSubmit:
                    !!newPositionName.trim() && !addPositionMutation.isPending,
                })
              }
              multiline
              rows={3}
              disabled={addPositionMutation.isPending}
            />
            <TextField
              margin="dense"
              label={`${t("Score")} *`}
              fullWidth
              variant="outlined"
              type="number"
              value={newPositionScore}
              onChange={(e) => setNewPositionScore(e.target.value)}
              onBlur={() => setNewPositionScoreTouched(true)}
              error={
                newPositionScoreTouched &&
                (!newPositionScore.trim() || !!newPositionScoreError)
              }
              helperText={
                newPositionScoreTouched && !newPositionScore.trim()
                  ? t("Score is required")
                  : newPositionScoreError
              }
              disabled={addPositionMutation.isPending}
              inputProps={{ step: "0.1" }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={newPositionCanDesire}
                  onChange={(e) => setNewPositionCanDesire(e.target.checked)}
                  disabled={addPositionMutation.isPending}
                />
              }
              label={t("Available for registration")}
              sx={{ mt: 1 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={newPositionHasHalls}
                  onChange={(e) => setNewPositionHasHalls(e.target.checked)}
                  disabled={addPositionMutation.isPending}
                />
              }
              label={t("Has halls")}
              sx={{ mt: 1 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={newPositionIsManager}
                  onChange={(e) => setNewPositionIsManager(e.target.checked)}
                  disabled={addPositionMutation.isPending}
                />
              }
              label={t("Is manager")}
              sx={{ mt: 1 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={newPositionSaveForNextYear}
                  onChange={(e) => {
                    setNewPositionSaveForNextYear(e.target.checked);
                  }}
                  disabled={addPositionMutation.isPending}
                />
              }
              label={t("Save for next year")}
              sx={{ mt: 1 }}
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={closeAddDialogAndReset}
              disabled={addPositionMutation.isPending}
            >
              {t("Cancel")}
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                !newPositionName.trim() ||
                !newPositionScore.trim() ||
                addPositionMutation.isPending
              }
            >
              {addPositionMutation.isPending
                ? t("Adding...")
                : t("Add Position")}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit Position Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onClose={(...args: unknown[]) => {
          const reason = args[1] as string | undefined;
          if (reason === "escapeKeyDown") {
            closeEditDialogSimple();
          } else {
            closeEditDialogAndReset();
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <form onSubmit={handleEditPosition}>
          <DialogTitle>{t("Edit Position")}</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label={t("Position Name")}
              fullWidth
              variant="outlined"
              value={editPositionName}
              onChange={(e) => setEditPositionName(e.target.value)}
              onBlur={() => setEditPositionTouched(true)}
              error={
                (editPositionTouched && !editPositionName.trim()) ||
                !!editPositionError
              }
              helperText={
                (editPositionTouched && !editPositionName.trim()
                  ? t("Position name is required")
                  : editPositionError) || ""
              }
              disabled={editPositionMutation.isPending}
            />
            <TextField
              margin="dense"
              label={t("Description")}
              fullWidth
              variant="outlined"
              value={editPositionDescription}
              onChange={(e) => setEditPositionDescription(e.target.value)}
              onKeyDown={(event) =>
                submitOnCtrlEnter(event, {
                  canSubmit:
                    !!editPositionName.trim() &&
                    !editPositionMutation.isPending,
                })
              }
              multiline
              rows={3}
              disabled={editPositionMutation.isPending}
            />
            <TextField
              margin="dense"
              label={`${t("Score")} *`}
              fullWidth
              variant="outlined"
              type="number"
              value={editPositionScore}
              onChange={(e) => setEditPositionScore(e.target.value)}
              onBlur={() => setEditPositionScoreTouched(true)}
              error={
                editPositionScoreTouched &&
                (!editPositionScore.trim() || !!editPositionScoreError)
              }
              helperText={
                editPositionScoreTouched && !editPositionScore.trim()
                  ? t("Score is required")
                  : editPositionScoreError
              }
              disabled={editPositionMutation.isPending}
              inputProps={{ step: "0.1" }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={editPositionCanDesire}
                  onChange={(e) => setEditPositionCanDesire(e.target.checked)}
                  disabled={editPositionMutation.isPending}
                />
              }
              label={t("Available for registration")}
              sx={{ mt: 1 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={editPositionHasHalls}
                  onChange={(e) => setEditPositionHasHalls(e.target.checked)}
                  disabled={editPositionMutation.isPending}
                />
              }
              label={t("Has halls")}
              sx={{ mt: 1 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={editPositionIsManager}
                  onChange={(e) => setEditPositionIsManager(e.target.checked)}
                  disabled={editPositionMutation.isPending}
                />
              }
              label={t("Is manager")}
              sx={{ mt: 1 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={editPositionSaveForNextYear}
                  onChange={(e) => {
                    setEditPositionSaveForNextYear(e.target.checked);
                  }}
                  disabled={editPositionMutation.isPending}
                />
              }
              label={t("Save for next year")}
              sx={{ mt: 1 }}
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={closeEditDialogAndReset}
              disabled={editPositionMutation.isPending}
            >
              {t("Cancel")}
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                !editPositionName.trim() ||
                !editPositionScore.trim() ||
                editPositionMutation.isPending
              }
            >
              {editPositionMutation.isPending
                ? t("Saving...")
                : t("Save Changes")}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Add Hall Dialog */}
      <Dialog
        open={isAddHallDialogOpen}
        onClose={(...args: unknown[]) => {
          const reason = args[1] as string | undefined;
          if (reason === "escapeKeyDown") {
            closeAddHallDialogSimple();
          } else {
            closeAddHallDialogAndReset();
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <form onSubmit={handleAddHall}>
          <DialogTitle>{t("Add New Hall")}</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label={t("Hall Name")}
              fullWidth
              variant="outlined"
              value={newHallName}
              onChange={(e) => setNewHallName(e.target.value)}
              onBlur={() => setNewHallTouched(true)}
              error={newHallTouched && !newHallName.trim()}
              helperText={
                newHallTouched && !newHallName.trim()
                  ? t("Hall name is required")
                  : addHallMutation.error?.message
              }
              disabled={addHallMutation.isPending}
              required
            />
            <TextField
              margin="dense"
              label={t("Description")}
              fullWidth
              variant="outlined"
              value={newHallDescription}
              onChange={(e) => setNewHallDescription(e.target.value)}
              onKeyDown={(event) =>
                submitOnCtrlEnter(event, {
                  canSubmit: !!newHallName.trim() && !addHallMutation.isPending,
                })
              }
              multiline
              rows={3}
              disabled={addHallMutation.isPending}
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={closeAddHallDialogAndReset}
              disabled={addHallMutation.isPending}
            >
              {t("Cancel")}
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!newHallName.trim() || addHallMutation.isPending}
            >
              {addHallMutation.isPending ? t("Adding...") : t("Add Hall")}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit Hall Dialog */}
      <Dialog
        open={isEditHallDialogOpen}
        onClose={(...args: unknown[]) => {
          const reason = args[1] as string | undefined;
          if (reason === "escapeKeyDown") {
            closeEditHallDialogSimple();
          } else {
            closeEditHallDialogAndReset();
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <form onSubmit={handleEditHall}>
          <DialogTitle>{t("Edit Hall")}</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label={t("Hall Name")}
              fullWidth
              variant="outlined"
              value={editHallName}
              onChange={(e) => setEditHallName(e.target.value)}
              onBlur={() => setEditHallTouched(true)}
              error={editHallTouched && !editHallName.trim()}
              helperText={
                editHallTouched && !editHallName.trim()
                  ? t("Hall name is required")
                  : editHallMutation.error?.message
              }
              disabled={editHallMutation.isPending}
              required
            />
            <TextField
              margin="dense"
              label={t("Description")}
              fullWidth
              variant="outlined"
              value={editHallDescription}
              onChange={(e) => setEditHallDescription(e.target.value)}
              onKeyDown={(event) =>
                submitOnCtrlEnter(event, {
                  canSubmit:
                    !!editHallName.trim() && !editHallMutation.isPending,
                })
              }
              multiline
              rows={3}
              disabled={editHallMutation.isPending}
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={closeEditHallDialogAndReset}
              disabled={editHallMutation.isPending}
            >
              {t("Cancel")}
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!editHallName.trim() || editHallMutation.isPending}
            >
              {editHallMutation.isPending ? t("Saving...") : t("Save Changes")}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Add Day Dialog */}
      <Dialog
        open={isAddDayDialogOpen}
        onClose={(...args: unknown[]) => {
          const reason = args[1] as string | undefined;
          if (reason === "escapeKeyDown") {
            closeAddDayDialogSimple();
          } else {
            closeAddDayDialogAndReset();
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <form onSubmit={handleAddDay}>
          <DialogTitle>{t("Add New Day")}</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label={t("Day Name")}
              fullWidth
              variant="outlined"
              value={newDayName}
              onChange={(e) => setNewDayName(e.target.value)}
              onBlur={() => setNewDayTouched(true)}
              error={newDayTouched && !newDayName.trim()}
              helperText={
                newDayTouched && !newDayName.trim()
                  ? t("Day name is required")
                  : addDayMutation.error?.message
              }
              disabled={addDayMutation.isPending}
              required
            />
            <TextField
              margin="dense"
              label={t("Information")}
              fullWidth
              variant="outlined"
              value={newDayInformation}
              onChange={(e) => setNewDayInformation(e.target.value)}
              onKeyDown={(event) =>
                submitOnCtrlEnter(event, {
                  canSubmit: !!newDayName.trim() && !addDayMutation.isPending,
                })
              }
              multiline
              rows={3}
              disabled={addDayMutation.isPending}
            />
            <TextField
              margin="dense"
              label={`${t("Score")} *`}
              fullWidth
              variant="outlined"
              type="number"
              value={newDayScore}
              onChange={(e) => setNewDayScore(e.target.value)}
              onBlur={() => setNewDayScoreTouched(true)}
              error={newDayScoreTouched && !newDayScore.trim()}
              helperText={
                newDayScoreTouched && !newDayScore.trim()
                  ? t("Score is required")
                  : ""
              }
              disabled={addDayMutation.isPending}
              inputProps={{ step: "0.1" }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={newDayMandatory}
                  onChange={(e) => setNewDayMandatory(e.target.checked)}
                  disabled={addDayMutation.isPending}
                />
              }
              label={t("Mandatory day")}
              sx={{ mt: 1 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={newDayAssignmentPublished}
                  onChange={(e) =>
                    setNewDayAssignmentPublished(e.target.checked)
                  }
                  disabled={addDayMutation.isPending}
                />
              }
              label={t("Publish assignments")}
              sx={{ mt: 1 }}
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={closeAddDayDialogAndReset}
              disabled={addDayMutation.isPending}
            >
              {t("Cancel")}
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                !newDayName.trim() ||
                !newDayScore.trim() ||
                addDayMutation.isPending
              }
            >
              {addDayMutation.isPending ? t("Adding...") : t("Add Day")}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit Day Dialog */}
      <Dialog
        open={isEditDayDialogOpen}
        onClose={(...args: unknown[]) => {
          const reason = args[1] as string | undefined;
          if (reason === "escapeKeyDown") {
            closeEditDayDialogSimple();
          } else {
            closeEditDayDialogAndReset();
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <form onSubmit={handleEditDay}>
          <DialogTitle>{t("Edit Day")}</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label={t("Day Name")}
              fullWidth
              variant="outlined"
              value={editDayName}
              onChange={(e) => setEditDayName(e.target.value)}
              onBlur={() => setEditDayTouched(true)}
              error={editDayTouched && !editDayName.trim()}
              helperText={
                editDayTouched && !editDayName.trim()
                  ? t("Day name is required")
                  : editDayMutation.error?.message
              }
              disabled={editDayMutation.isPending}
              required
            />
            <TextField
              margin="dense"
              label={t("Information")}
              fullWidth
              variant="outlined"
              value={editDayInformation}
              onChange={(e) => setEditDayInformation(e.target.value)}
              onKeyDown={(event) =>
                submitOnCtrlEnter(event, {
                  canSubmit: !!editDayName.trim() && !editDayMutation.isPending,
                })
              }
              multiline
              rows={3}
              disabled={editDayMutation.isPending}
            />
            <TextField
              margin="dense"
              label={`${t("Score")} *`}
              fullWidth
              variant="outlined"
              type="number"
              value={editDayScore}
              onChange={(e) => setEditDayScore(e.target.value)}
              onBlur={() => setEditDayScoreTouched(true)}
              error={editDayScoreTouched && !editDayScore.trim()}
              helperText={
                editDayScoreTouched && !editDayScore.trim()
                  ? t("Score is required")
                  : ""
              }
              disabled={editDayMutation.isPending}
              inputProps={{ step: "0.1" }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={editDayMandatory}
                  onChange={(e) => setEditDayMandatory(e.target.checked)}
                  disabled={editDayMutation.isPending}
                />
              }
              label={t("Mandatory day")}
              sx={{ mt: 1 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={editDayAssignmentPublished}
                  onChange={(e) =>
                    setEditDayAssignmentPublished(e.target.checked)
                  }
                  disabled={editDayMutation.isPending}
                />
              }
              label={t("Publish assignments")}
              sx={{ mt: 1 }}
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={closeEditDayDialogAndReset}
              disabled={editDayMutation.isPending}
            >
              {t("Cancel")}
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                !editDayName.trim() ||
                !editDayScore.trim() ||
                editDayMutation.isPending
              }
            >
              {editDayMutation.isPending ? t("Saving...") : t("Save Changes")}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

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
