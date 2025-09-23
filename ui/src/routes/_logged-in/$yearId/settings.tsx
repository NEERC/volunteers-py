import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
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
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { createFileRoute, redirect } from "@tanstack/react-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import type { HallOut, PositionOut } from "@/client/types.gen";
import {
  useAddHall,
  useAddPosition,
  useEditHall,
  useEditPosition,
  useEditYear,
  useYearHalls,
  useYearPositions,
  useYears,
} from "@/data";

export const Route = createFileRoute("/_logged-in/$yearId/settings")({
  component: RouteComponent,
  beforeLoad: async ({ context }) => {
    const user = context.user;
    if (user.is_admin !== true) {
      throw redirect({ to: "/forbidden" });
    }
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
  const [editPositionName, setEditPositionName] = useState("");
  const [newPositionCanDesire, setNewPositionCanDesire] = useState(false);
  const [editPositionCanDesire, setEditPositionCanDesire] = useState(false);
  const [newPositionHasHalls, setNewPositionHasHalls] = useState(false);
  const [editPositionHasHalls, setEditPositionHasHalls] = useState(false);

  // Hall management state
  const [isAddHallDialogOpen, setIsAddHallDialogOpen] = useState(false);
  const [isEditHallDialogOpen, setIsEditHallDialogOpen] = useState(false);
  const [editingHall, setEditingHall] = useState<HallOut | null>(null);
  const [newHallName, setNewHallName] = useState("");
  const [editHallName, setEditHallName] = useState("");
  const [newHallDescription, setNewHallDescription] = useState("");
  const [editHallDescription, setEditHallDescription] = useState("");

  // Year settings state
  const [yearName, setYearName] = useState("");
  const [openForRegistration, setOpenForRegistration] = useState(false);
  const [isYearSettingsEditing, setIsYearSettingsEditing] = useState(false);

  // Fetch all positions for admin (including non-desirable ones)
  const { data: positions, isLoading } = useYearPositions(yearId);

  // Fetch all halls for admin
  const { data: halls } = useYearHalls(yearId);

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
    if (newPositionName.trim()) {
      addPositionMutation.mutate(
        {
          year_id: Number(yearId),
          name: newPositionName.trim(),
          can_desire: newPositionCanDesire,
          has_halls: newPositionHasHalls,
        },
        {
          onSuccess: () => {
            setIsAddDialogOpen(false);
            setNewPositionName("");
            setNewPositionCanDesire(false);
            setNewPositionHasHalls(false);
          },
        },
      );
    }
  };

  const handleEditPosition = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPosition && editPositionName.trim()) {
      editPositionMutation.mutate(
        {
          positionId: editingPosition.position_id,
          data: {
            name: editPositionName.trim(),
            can_desire: editPositionCanDesire,
            has_halls: editPositionHasHalls,
          },
        },
        {
          onSuccess: () => {
            setIsEditDialogOpen(false);
            setEditingPosition(null);
            setEditPositionName("");
            setEditPositionCanDesire(false);
            setEditPositionHasHalls(false);
          },
        },
      );
    }
  };

  const openEditDialog = (position: PositionOut) => {
    setEditingPosition(position);
    setEditPositionName(position.name);
    setEditPositionCanDesire(position.can_desire);
    setEditPositionHasHalls(position.has_halls);
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
            setIsAddHallDialogOpen(false);
            setNewHallName("");
            setNewHallDescription("");
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
            setIsEditHallDialogOpen(false);
            setEditingHall(null);
            setEditHallName("");
            setEditHallDescription("");
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

  const closeAddDialog = () => {
    setIsAddDialogOpen(false);
    setNewPositionName("");
    setNewPositionCanDesire(false);
  };

  const closeEditDialog = () => {
    setIsEditDialogOpen(false);
    setEditingPosition(null);
    setEditPositionName("");
    setEditPositionCanDesire(false);
  };

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
      <Typography variant="h4" component="h1" gutterBottom>
        {t("Year Settings")}
      </Typography>

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
              error={editYearMutation.isError}
              helperText={editYearMutation.error?.message}
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
                sx={{
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 1,
                  mb: 1,
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
                    </Box>
                  }
                />
                <IconButton
                  onClick={() => openEditDialog(position)}
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
            {halls.map((hall) => (
              <ListItem
                key={hall.hall_id}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  mb: 1,
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
                  onClick={() => openEditHallDialog(hall)}
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

      {/* Add Position Dialog */}
      <Dialog
        open={isAddDialogOpen}
        onClose={closeAddDialog}
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
              error={addPositionMutation.isError}
              helperText={addPositionMutation.error?.message}
              disabled={addPositionMutation.isPending}
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
          </DialogContent>
          <DialogActions>
            <Button
              onClick={closeAddDialog}
              disabled={addPositionMutation.isPending}
            >
              {t("Cancel")}
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                !newPositionName.trim() || addPositionMutation.isPending
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
        onClose={closeEditDialog}
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
              error={editPositionMutation.isError}
              helperText={editPositionMutation.error?.message}
              disabled={editPositionMutation.isPending}
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
          </DialogContent>
          <DialogActions>
            <Button
              onClick={closeEditDialog}
              disabled={editPositionMutation.isPending}
            >
              {t("Cancel")}
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                !editPositionName.trim() || editPositionMutation.isPending
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
        onClose={() => setIsAddHallDialogOpen(false)}
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
              error={addHallMutation.isError}
              helperText={addHallMutation.error?.message}
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
              multiline
              rows={3}
              disabled={addHallMutation.isPending}
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setIsAddHallDialogOpen(false)}
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
        onClose={() => setIsEditHallDialogOpen(false)}
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
              error={editHallMutation.isError}
              helperText={editHallMutation.error?.message}
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
              multiline
              rows={3}
              disabled={editHallMutation.isPending}
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setIsEditHallDialogOpen(false)}
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
    </Box>
  );
}
