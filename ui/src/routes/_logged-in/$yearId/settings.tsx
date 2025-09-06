import type { PositionOut } from "@/client/types.gen";
import { useAddPosition, useEditPosition, useYearForm } from "@/data";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

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

  // Fetch year data to get positions
  const { data: yearData, isLoading } = useYearForm(yearId);

  // Add position mutation
  const addPositionMutation = useAddPosition();

  // Edit position mutation
  const editPositionMutation = useEditPosition();

  const handleAddPosition = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPositionName.trim()) {
      addPositionMutation.mutate(
        {
          year_id: Number(yearId),
          name: newPositionName.trim(),
        },
        {
          onSuccess: () => {
            setIsAddDialogOpen(false);
            setNewPositionName("");
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
          data: { name: editPositionName.trim() },
        },
        {
          onSuccess: () => {
            setIsEditDialogOpen(false);
            setEditingPosition(null);
            setEditPositionName("");
          },
        },
      );
    }
  };

  const openEditDialog = (position: PositionOut) => {
    setEditingPosition(position);
    setEditPositionName(position.name);
    setIsEditDialogOpen(true);
  };

  const closeAddDialog = () => {
    setIsAddDialogOpen(false);
    setNewPositionName("");
  };

  const closeEditDialog = () => {
    setIsEditDialogOpen(false);
    setEditingPosition(null);
    setEditPositionName("");
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

        {yearData?.positions && yearData.positions.length > 0 ? (
          <List>
            {yearData.positions.map((position) => (
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
                <ListItemText primary={position.name} />
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
