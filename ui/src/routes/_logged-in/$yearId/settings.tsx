import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
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
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import type { PositionOut } from "@/client/types.gen";
import { useAddPosition, useEditPosition, useYearPositions } from "@/data";

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

  // Fetch all positions for admin (including non-desirable ones)
  const { data: positions, isLoading } = useYearPositions(yearId);

  // Add position mutation
  const addPositionMutation = useAddPosition();

  // Edit position mutation
  const editPositionMutation = useEditPosition(yearId);

  const handleAddPosition = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPositionName.trim()) {
      addPositionMutation.mutate(
        {
          year_id: Number(yearId),
          name: newPositionName.trim(),
          can_desire: newPositionCanDesire,
        },
        {
          onSuccess: () => {
            setIsAddDialogOpen(false);
            setNewPositionName("");
            setNewPositionCanDesire(false);
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
          },
        },
        {
          onSuccess: () => {
            setIsEditDialogOpen(false);
            setEditingPosition(null);
            setEditPositionName("");
            setEditPositionCanDesire(false);
          },
        },
      );
    }
  };

  const openEditDialog = (position: PositionOut) => {
    setEditingPosition(position);
    setEditPositionName(position.name);
    setEditPositionCanDesire(position.can_desire);
    setIsEditDialogOpen(true);
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
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Year Settings
      </Typography>

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
            Positions
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsAddDialogOpen(true)}
          >
            Add Position
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
                        <Tooltip title="Available for registration">
                          <VisibilityIcon color="success" fontSize="small" />
                        </Tooltip>
                      ) : (
                        <Tooltip title="Hidden from registration">
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
            No positions found. Add your first position to get started.
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
          <DialogTitle>Add New Position</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Position Name"
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
              label="Available for registration"
              sx={{ mt: 1 }}
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={closeAddDialog}
              disabled={addPositionMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                !newPositionName.trim() || addPositionMutation.isPending
              }
            >
              {addPositionMutation.isPending ? "Adding..." : "Add Position"}
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
          <DialogTitle>Edit Position</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Position Name"
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
              label="Available for registration"
              sx={{ mt: 1 }}
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={closeEditDialog}
              disabled={editPositionMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                !editPositionName.trim() || editPositionMutation.isPending
              }
            >
              {editPositionMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
