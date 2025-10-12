import {
  type CollisionDetection,
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  HallOut,
  PositionOut,
  RegistrationFormItem,
} from "@/client/types.gen";
import {
  useAddUserDay,
  useDayAssignments,
  useDeleteUserDay,
  useEditUserDay,
  useRegistrationForms,
  useYearHalls,
  useYearPositions,
} from "@/data/use-admin";

// Custom collision detection that prioritizes the drawer
const customCollisionDetection: CollisionDetection = (args) => {
  const { active, droppableContainers, pointerCoordinates } = args;

  // If dragging a user card
  if (active.id.toString().startsWith("user-")) {
    // Check if we're over the drawer area
    const drawerContainer = droppableContainers.find(
      (container) => container.id === "hover-drawer-area",
    );

    if (drawerContainer?.rect.current && pointerCoordinates) {
      // Get the drawer's bounding rectangle
      const drawerRect = drawerContainer.rect.current;

      // Check if the pointer is over the drawer
      const isOverDrawer =
        pointerCoordinates.x >= drawerRect.left &&
        pointerCoordinates.x <= drawerRect.right &&
        pointerCoordinates.y >= drawerRect.top &&
        pointerCoordinates.y <= drawerRect.bottom;

      if (isOverDrawer) {
        return [
          {
            id: "hover-drawer-area",
            data: {
              droppableContainer: drawerContainer,
            },
          },
        ];
      }
    }
  }

  // Fall back to closest center for other cases
  return closestCenter(args);
};

// Extended types for drag and drop functionality

type PositionWithHalls = PositionOut & {
  assigned_users: RegistrationFormItem[];
  halls?: HallWithUsers[];
};

type HallWithUsers = HallOut & {
  assigned_users: RegistrationFormItem[];
};

export const Route = createFileRoute("/_logged-in/$yearId/days/$dayId/edit")({
  component: RouteComponent,
});

function DetailedUserCard({
  user,
  expandedDefault,
}: {
  user: RegistrationFormItem;
  expandedDefault: boolean;
}) {
  const [expanded, setExpanded] = useState(expandedDefault);
  const fullName = user.patronymic_ru
    ? `${user.last_name_ru} ${user.first_name_ru} ${user.patronymic_ru}`
    : `${user.last_name_ru} ${user.first_name_ru}`;

  const hasExtraInfo =
    user.itmo_group ||
    user.telegram_username ||
    user.desired_positions.length > 0 ||
    user.comments ||
    (user.experience && user.experience.length > 0);

  return (
    <CardContent sx={{ p: 1, "&:last-child": { pb: 1 } }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {fullName}
          </Typography>
        </Box>
        {hasExtraInfo && (
          <IconButton
            size="small"
            onClick={() => setExpanded(!expanded)}
            sx={{
              p: 0.25,
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease-in-out",
            }}
          >
            <ExpandMoreIcon sx={{ fontSize: "1rem" }} />
          </IconButton>
        )}
      </Box>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontSize: "0.75rem" }}
        >
          {user.full_name_en}
        </Typography>
        <Divider sx={{ my: 0.5 }} />

        {user.itmo_group && (
          <Typography variant="body2" sx={{ mb: 0.25, fontSize: "0.75rem" }}>
            <strong>Group:</strong> {user.itmo_group}
          </Typography>
        )}
        {user.telegram_username && (
          <Typography variant="body2" sx={{ mb: 0.25, fontSize: "0.75rem" }}>
            <strong>Telegram:</strong> 📱{" "}
            <Link
              href={`https://t.me/${user.telegram_username}`}
              target="_blank"
            >
              @{user.telegram_username}
            </Link>
          </Typography>
        )}

        {user.desired_positions.length > 0 && (
          <Box sx={{ mt: 0.5 }}>
            <Typography
              variant="body2"
              sx={{ mb: 0.25, fontWeight: 600, fontSize: "0.75rem" }}
            >
              Desired Positions:
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.25 }}>
              {user.desired_positions.map((position) => (
                <Chip
                  key={position.position_id}
                  label={position.name}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ fontSize: "0.65rem", height: "20px" }}
                />
              ))}
            </Box>
          </Box>
        )}

        {user.comments && (
          <Box sx={{ mt: 0.5 }}>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, mb: 0.25, fontSize: "0.75rem" }}
            >
              Comments:
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                fontStyle: "italic",
                backgroundColor: "grey.50",
                p: 0.5,
                borderRadius: 0.5,
                fontSize: "0.7rem",
              }}
            >
              "{user.comments}"
            </Typography>
          </Box>
        )}

        {user.experience && user.experience.length > 0 && (
          <Box sx={{ mt: 0.5, overflowX: "auto" }}>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, mb: 0.25, fontSize: "0.75rem" }}
            >
              Experience:
            </Typography>
            <Table size="small" sx={{ fontSize: "0.7rem" }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontSize: "0.65rem", py: 0.25, px: 0.5 }}>
                    Year
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.65rem", py: 0.25, px: 0.5 }}>
                    Positions
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.65rem", py: 0.25, px: 0.5 }}>
                    Attendance
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.65rem", py: 0.25, px: 0.5 }}>
                    Assessments
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {user.experience.map((exp, index) => (
                  <TableRow key={`${exp.year_name}-${index}`}>
                    <TableCell sx={{ fontSize: "0.65rem", py: 0.25, px: 0.5 }}>
                      {exp.year_name}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.65rem", py: 0.25, px: 0.5 }}>
                      {exp.positions.length > 0 ? (
                        <Box
                          sx={{ display: "flex", flexWrap: "wrap", gap: 0.25 }}
                        >
                          {exp.positions.map((position, posIndex) => (
                            <Chip
                              key={`${exp.year_name}-pos-${posIndex}`}
                              label={position}
                              size="small"
                              color="secondary"
                              variant="outlined"
                              sx={{ fontSize: "0.6rem", height: "16px" }}
                            />
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          None
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.65rem", py: 0.25, px: 0.5 }}>
                      {Object.entries(exp.attendance_stats).map(
                        ([status, count]) => (
                          <Box
                            key={`${exp.year_name}-attendance-${status}`}
                            sx={{ display: "inline-block", mr: 0.5 }}
                          >
                            <Typography
                              variant="caption"
                              sx={{ fontSize: "0.6rem" }}
                            >
                              {status}: {count}
                            </Typography>
                          </Box>
                        ),
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.65rem", py: 0.25, px: 0.5 }}>
                      {exp.assessments.length > 0 ? (
                        <Box
                          sx={{ display: "flex", flexWrap: "wrap", gap: 0.25 }}
                        >
                          {exp.assessments.map((assessment, assIndex) => (
                            <Chip
                              key={`${exp.year_name}-ass-${assIndex}`}
                              label={assessment}
                              size="small"
                              color="success"
                              variant="outlined"
                              sx={{
                                fontSize: "0.6rem",
                                height: "auto",
                                "& .MuiChip-label": {
                                  display: "block",
                                  whiteSpace: "normal",
                                },
                              }}
                            />
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          None
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Collapse>
    </CardContent>
  );
}

function DraggableDetailedUserCard({ user }: { user: RegistrationFormItem }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `user-${user.user_id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      sx={{
        mb: 2,
        cursor: "grab",
        "&:active": { cursor: "grabbing" },
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <DetailedUserCard user={user} expandedDefault={true} />
    </Card>
  );
}

function HoverDrawer({
  unassignedUsers,
  activeId,
}: {
  unassignedUsers: RegistrationFormItem[];
  activeId: string | null;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const { isOver, setNodeRef } = useDroppable({
    id: "hover-drawer-area",
  });

  // Don't open drawer when dragging
  const shouldShowDrawer = isHovered && !activeId;

  return (
    <Box
      ref={setNodeRef}
      sx={{
        position: "fixed",
        right: 0,
        top: 0,
        height: "100vh",
        width: shouldShowDrawer ? "500px" : "50px",
        backgroundColor: isOver ? "action.hover" : "background.paper",
        border: isOver ? "2px dashed" : "1px solid",
        boxSizing: "border-box",
        borderColor: isOver ? "primary.main" : "divider",
        transition: "width 0.3s ease-in-out",
        zIndex: 3000,
        overflow: "hidden",
        "&:hover": {
          width: shouldShowDrawer ? "500px" : "50px",
        },
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Hover trigger area */}
      <Box
        sx={{
          position: "absolute",
          right: 0,
          top: 0,
          width: "50px",
          height: "100%",
          backgroundColor: "primary.main",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 3001,
          pointerEvents: "none",
        }}
      >
        <PersonIcon sx={{ color: "white", transform: "rotate(90deg)" }} />
      </Box>

      {/* Drawer content */}
      <Box
        sx={{
          width: "calc(500px - 50px - 2px)",
          boxSizing: "border-box",
          height: "100%",
          p: 2,
          pt: 8,
          overflowY: "auto",
          overflowX: "hidden",
          opacity: shouldShowDrawer ? 1 : 0,
          transition: "opacity 0.2s ease-in-out",
          pointerEvents: "auto",
        }}
      >
        <Typography
          variant="h6"
          sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}
        >
          <PersonIcon />
          Available Volunteers
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {unassignedUsers.length} volunteers available
        </Typography>

        <Divider sx={{ mb: 2 }} />

        {unassignedUsers.length === 0 ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ textAlign: "center", py: 4 }}
          >
            All volunteers have been assigned to positions
          </Typography>
        ) : (
          unassignedUsers.map((user) => (
            <DraggableDetailedUserCard key={user.user_id} user={user} />
          ))
        )}
      </Box>
    </Box>
  );
}

function DraggableRegistrationForm({
  registrationForm,
  isAssigned = false,
  isOptimistic = false,
}: {
  registrationForm: RegistrationFormItem;
  isAssigned?: boolean;
  isOptimistic?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `user-${registrationForm.user_id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      sx={{
        mb: 0.5,
        cursor: "grab",
        "&:active": {
          cursor: "grabbing",
        },
        opacity: isDragging ? 0.5 : 1,
        backgroundColor: isAssigned ? "action.selected" : "background.paper",
        border: isAssigned ? "1px solid" : "1px solid transparent",
        borderColor: isAssigned ? "primary.main" : "transparent",
        // Add subtle loading animation for optimistic updates
        ...(isOptimistic && {
          position: "relative",
          "&::after": {
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "linear-gradient(90deg, transparent, rgba(25, 118, 210, 0.1), transparent)",
            animation: "shimmer 1.5s infinite",
            pointerEvents: "none",
          },
        }),
      }}
    >
      <DetailedUserCard user={registrationForm} expandedDefault={false} />
    </Card>
  );
}

function PositionColumn({
  position,
  optimisticUpdates,
}: {
  position: PositionWithHalls;
  optimisticUpdates: {
    [key: string]: {
      userId: number;
      positionId: number;
      hallId?: number;
      type: "add" | "remove";
    };
  };
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `position-${position.position_id}`,
  });

  const totalAssigned =
    position.assigned_users.length +
    (position.halls?.reduce(
      (sum, hall) => sum + hall.assigned_users.length,
      0,
    ) || 0);

  return (
    <Paper
      ref={setNodeRef}
      sx={{
        p: 1.5,
        minHeight: 300,
        border: isOver ? "2px dashed" : "1px solid",
        borderColor: isOver ? "primary.main" : "divider",
        backgroundColor: isOver ? "action.hover" : "background.paper",
      }}
    >
      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
        {position.name}
      </Typography>
      <Divider sx={{ mb: 1 }} />

      {/* Direct position assignments (always available) */}
      <Box sx={{ mb: position.halls?.length ? 2 : 0 }}>
        <SortableContext
          items={position.assigned_users.map((user) => `user-${user.user_id}`)}
          strategy={verticalListSortingStrategy}
        >
          {position.assigned_users.map((user) => {
            // Check if this user has an optimistic update
            const hasOptimisticUpdate = Object.values(optimisticUpdates).some(
              (update) =>
                update.userId === user.user_id &&
                update.positionId === position.position_id &&
                !update.hallId,
            );

            return (
              <DraggableRegistrationForm
                key={user.user_id}
                registrationForm={user}
                isAssigned={true}
                isOptimistic={hasOptimisticUpdate}
              />
            );
          })}
        </SortableContext>
      </Box>

      {/* Hall-specific assignments (if position has halls) */}
      {position.halls && position.halls.length > 0 && (
        <Box sx={{ display: "flex", gap: 1, flexDirection: "column" }}>
          {position.halls.map((hall) => (
            <HallColumn
              key={hall.hall_id}
              hall={hall}
              positionId={position.position_id}
              optimisticUpdates={optimisticUpdates}
            />
          ))}
        </Box>
      )}
    </Paper>
  );
}

function HallColumn({
  hall,
  positionId,
  optimisticUpdates,
}: {
  hall: HallWithUsers;
  positionId: number;
  optimisticUpdates: {
    [key: string]: {
      userId: number;
      positionId: number;
      hallId?: number;
      type: "add" | "remove";
    };
  };
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `hall-${positionId}-${hall.hall_id}`,
  });

  return (
    <Paper
      ref={setNodeRef}
      sx={{
        p: 1,
        minHeight: 200,
        border: isOver ? "2px dashed" : "1px solid",
        borderColor: isOver ? "secondary.main" : "divider",
        backgroundColor: isOver ? "action.hover" : "background.paper",
      }}
    >
      <Typography variant="body2" gutterBottom sx={{ fontWeight: 600 }}>
        {hall.name}
      </Typography>
      <Divider sx={{ mb: 1 }} />
      <SortableContext
        items={hall.assigned_users.map((user) => `user-${user.user_id}`)}
        strategy={verticalListSortingStrategy}
      >
        {hall.assigned_users.map((user) => {
          // Check if this user has an optimistic update for this hall
          const hasOptimisticUpdate = Object.values(optimisticUpdates).some(
            (update) =>
              update.userId === user.user_id &&
              update.positionId === positionId &&
              update.hallId === hall.hall_id,
          );

          return (
            <DraggableRegistrationForm
              key={user.user_id}
              registrationForm={user}
              isAssigned={true}
              isOptimistic={hasOptimisticUpdate}
            />
          );
        })}
      </SortableContext>
    </Paper>
  );
}

function RouteComponent() {
  const { t } = useTranslation();
  const { yearId, dayId } = Route.useParams();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [optimisticUpdates, setOptimisticUpdates] = useState<{
    [key: string]: {
      userId: number;
      positionId: number;
      hallId?: number;
      type: "add" | "remove";
    };
  }>({});

  const {
    data: registrationFormsData,
    isLoading: formsLoading,
    error: formsError,
  } = useRegistrationForms(yearId);

  const {
    data: positionsData,
    isLoading: positionsLoading,
    error: positionsError,
  } = useYearPositions(yearId);

  const {
    data: assignmentsData,
    isLoading: assignmentsLoading,
    error: assignmentsError,
  } = useDayAssignments(dayId);

  const addUserDayMutation = useAddUserDay();
  const editUserDayMutation = useEditUserDay();
  const deleteUserDayMutation = useDeleteUserDay();

  // Function to save assignment to backend
  const saveAssignment = async (
    userId: number,
    positionId: number,
    hallId?: number,
  ) => {
    try {
      // Find the user to get their application_form_id
      const user = findUserById(userId);
      if (!user) {
        console.error("User not found for assignment");
        return;
      }

      // Check if assignment already exists by looking for the user in assignments
      const existingAssignment = assignmentsData?.assignments.find(
        (assignment) => {
          const assignmentUser = assignmentToUser(assignment);
          return assignmentUser?.user_id === userId;
        },
      );

      if (existingAssignment) {
        // Update existing assignment
        await editUserDayMutation.mutateAsync({
          userDayId: existingAssignment.user_day_id,
          data: {
            position_id: positionId,
            hall_id: hallId || null,
          },
        });
      } else {
        // Create new assignment
        await addUserDayMutation.mutateAsync({
          application_form_id: user.form_id,
          day_id: Number(dayId),
          information: "",
          attendance: "unknown",
          position_id: positionId,
          hall_id: hallId || null,
        });
      }
    } catch (error) {
      console.error("Failed to save assignment:", error);
    }
  };

  const { data: halls } = useYearHalls(yearId);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  // Helper function to convert assignment to user using application_form_id
  const assignmentToUser = React.useCallback(
    (assignment: {
      application_form_id: number;
      position_id: number;
      hall_id: number | null;
    }): RegistrationFormItem | null => {
      // Find the original registration form using application_form_id
      const originalForm = registrationFormsData?.forms.find(
        (form) => form.form_id === assignment.application_form_id,
      );

      if (!originalForm) {
        console.warn(
          `Registration form not found for application_form_id: ${assignment.application_form_id}`,
        );
        return null;
      }

      return originalForm;
    },
    [registrationFormsData],
  );

  // Helper function to find user by ID from all sources
  const findUserById = React.useCallback(
    (userId: number): RegistrationFormItem | null => {
      // First check registration forms (unassigned users)
      const formUser = registrationFormsData?.forms.find(
        (form) => form.user_id === userId,
      );
      if (formUser) {
        return formUser;
      }

      // Then check assignments - need to find by application_form_id
      const assignment = assignmentsData?.assignments.find((assignment) => {
        const user = assignmentToUser(assignment);
        return user?.user_id === userId;
      });
      if (assignment) {
        return assignmentToUser(assignment);
      }

      return null;
    },
    [registrationFormsData, assignmentsData, assignmentToUser],
  );

  // Transform data for drag and drop - computed from fetched data with optimistic updates
  const positions: PositionWithHalls[] = React.useMemo(() => {
    if (!positionsData || !registrationFormsData || !halls) {
      return [];
    }

    return positionsData.map((position) => {
      // Find all assignments for this position and day
      const positionAssignments =
        assignmentsData?.assignments.filter(
          (assignment) => assignment.position_id === position.position_id,
        ) || [];

      // Separate direct position assignments (no hall) from hall assignments
      const directAssignments = positionAssignments.filter(
        (assignment) => !assignment.hall_id,
      );
      const hallAssignments = positionAssignments.filter(
        (assignment) => assignment.hall_id,
      );

      // Apply optimistic updates for this position
      const optimisticDirectUsers: RegistrationFormItem[] = [];
      const optimisticHallUsers: { [hallId: number]: RegistrationFormItem[] } =
        {};

      Object.values(optimisticUpdates).forEach((update) => {
        if (update.positionId === position.position_id) {
          const user = findUserById(update.userId);
          if (user) {
            if (update.type === "add") {
              if (update.hallId) {
                // Add to specific hall
                if (!optimisticHallUsers[update.hallId]) {
                  optimisticHallUsers[update.hallId] = [];
                }
                optimisticHallUsers[update.hallId].push(user);
              } else {
                // Add to direct position
                optimisticDirectUsers.push(user);
              }
            }
            // For 'remove' type, we'll filter out the user below
          }
        }
      });

      // Create hall structure if position has halls
      const positionHalls: HallWithUsers[] = position.has_halls
        ? halls.map((hall) => {
            const hallAssignmentsForHall = hallAssignments
              .filter((assignment) => assignment.hall_id === hall.hall_id)
              .map(assignmentToUser)
              .filter((user): user is RegistrationFormItem => user !== null);

            // Apply optimistic updates for this hall
            const optimisticUsers = optimisticHallUsers[hall.hall_id] || [];
            const finalHallUsers = [
              ...hallAssignmentsForHall,
              ...optimisticUsers,
            ].filter((user) => {
              // Remove users that have optimistic 'remove' updates
              return !Object.values(optimisticUpdates).some(
                (update) =>
                  update.userId === user.user_id &&
                  update.type === "remove" &&
                  update.positionId === position.position_id &&
                  update.hallId === hall.hall_id,
              );
            });

            return {
              ...hall,
              assigned_users: finalHallUsers,
            };
          })
        : [];

      // Apply optimistic updates to direct assignments
      const finalDirectUsers = [
        ...directAssignments
          .map(assignmentToUser)
          .filter((user): user is RegistrationFormItem => user !== null),
        ...optimisticDirectUsers,
      ].filter((user) => {
        // Remove users that have optimistic 'remove' updates
        return !Object.values(optimisticUpdates).some(
          (update) =>
            update.userId === user.user_id &&
            update.type === "remove" &&
            update.positionId === position.position_id &&
            !update.hallId,
        );
      });

      return {
        ...position,
        assigned_users: finalDirectUsers,
        halls: positionHalls.length > 0 ? positionHalls : undefined,
      };
    });
  }, [
    positionsData,
    registrationFormsData,
    assignmentsData,
    halls,
    assignmentToUser,
    optimisticUpdates,
    findUserById,
  ]);

  // Get unassigned users (all users who haven't been manually assigned to any position yet)
  const unassignedUsers: RegistrationFormItem[] =
    registrationFormsData?.forms.filter((form) => {
      // Check if user is assigned to any position for this day (including optimistic updates)
      const isAssignedInData =
        assignmentsData?.assignments.some((assignment) => {
          const assignmentUser = assignmentToUser(assignment);
          return assignmentUser?.user_id === form.user_id;
        }) || false;

      // Check if user has optimistic 'add' updates (meaning they're being assigned)
      const hasOptimisticAdd = Object.values(optimisticUpdates).some(
        (update) => update.userId === form.user_id && update.type === "add",
      );

      // Check if user has optimistic 'remove' updates (meaning they're being unassigned)
      const hasOptimisticRemove = Object.values(optimisticUpdates).some(
        (update) => update.userId === form.user_id && update.type === "remove",
      );

      // User is unassigned if:
      // 1. Not assigned in data AND no optimistic add, OR
      // 2. Has optimistic remove (regardless of data state)
      return (!isAssignedInData && !hasOptimisticAdd) || hasOptimisticRemove;
    }) || [];

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (_event: DragOverEvent) => {
    // Handle drag over logic if needed
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // If dragging a user
    if (activeId.startsWith("user-")) {
      const userId = Number.parseInt(activeId.replace("user-", ""), 10);
      const user = findUserById(userId);

      if (!user) return;

      // Generate unique key for this operation
      const operationKey = `${userId}-${Date.now()}`;

      // If dropping on a position (general assignment)
      if (overId.startsWith("position-")) {
        const positionId = Number.parseInt(overId.replace("position-", ""), 10);

        // Add optimistic update
        setOptimisticUpdates((prev) => ({
          ...prev,
          [operationKey]: { userId, positionId, type: "add" },
        }));

        // Save assignment to backend
        saveAssignment(userId, positionId)
          .then(() => {
            // Remove optimistic update on success
            setOptimisticUpdates((prev) => {
              const { [operationKey]: _, ...rest } = prev;
              return rest;
            });
          })
          .catch((error) => {
            console.error("Failed to save assignment:", error);
            // Remove optimistic update on error
            setOptimisticUpdates((prev) => {
              const { [operationKey]: _, ...rest } = prev;
              return rest;
            });
          });
      }

      // If dropping on a hall (hall-specific assignment)
      if (overId.startsWith("hall-")) {
        const [positionId, hallId] = overId
          .replace("hall-", "")
          .split("-")
          .map(Number);

        // Add optimistic update
        setOptimisticUpdates((prev) => ({
          ...prev,
          [operationKey]: { userId, positionId, hallId, type: "add" },
        }));

        // Save assignment to backend
        saveAssignment(userId, positionId, hallId)
          .then(() => {
            // Remove optimistic update on success
            setOptimisticUpdates((prev) => {
              const { [operationKey]: _, ...rest } = prev;
              return rest;
            });
          })
          .catch((error) => {
            console.error("Failed to save assignment:", error);
            // Remove optimistic update on error
            setOptimisticUpdates((prev) => {
              const { [operationKey]: _, ...rest } = prev;
              return rest;
            });
          });
      }

      // If dropping on hover drawer area (remove assignment)
      if (overId === "hover-drawer-area") {
        const existingAssignment = assignmentsData?.assignments.find(
          (assignment) => {
            const assignmentUser = assignmentToUser(assignment);
            return assignmentUser?.user_id === userId;
          },
        );

        if (existingAssignment) {
          // Find which position/hall the user is currently assigned to
          const currentPosition = positions.find(
            (pos) =>
              pos.assigned_users.some((u) => u.user_id === userId) ||
              pos.halls?.some((hall) =>
                hall.assigned_users.some((u) => u.user_id === userId),
              ),
          );

          if (currentPosition) {
            const currentHall = currentPosition.halls?.find((hall) =>
              hall.assigned_users.some((u) => u.user_id === userId),
            );

            // Add optimistic update for removal
            setOptimisticUpdates((prev) => ({
              ...prev,
              [operationKey]: {
                userId,
                positionId: currentPosition.position_id,
                hallId: currentHall?.hall_id,
                type: "remove",
              },
            }));

            // Remove assignment from backend
            deleteUserDayMutation.mutate(existingAssignment.user_day_id, {
              onSuccess: () => {
                // Remove optimistic update on success
                setOptimisticUpdates((prev) => {
                  const { [operationKey]: _, ...rest } = prev;
                  return rest;
                });
              },
              onError: (error) => {
                console.error("Failed to delete assignment:", error);
                // Remove optimistic update on error
                setOptimisticUpdates((prev) => {
                  const { [operationKey]: _, ...rest } = prev;
                  return rest;
                });
              },
            });
          }
        }
      }
    }
  };

  if (formsLoading || positionsLoading || assignmentsLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (formsError || positionsError || assignmentsError) {
    return (
      <Alert severity="error">
        {formsError?.message ||
          positionsError?.message ||
          assignmentsError?.message ||
          "Failed to load data"}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <style>
        {`
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}
      </style>
      <Typography variant="h5" gutterBottom>
        {t("Day Assignments")} - Day {dayId}
      </Typography>

      {/* Existing Assignments Summary */}
      {assignmentsData && assignmentsData.assignments.length > 0 && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {t("Current assignments")}: {assignmentsData.assignments.length}{" "}
          volunteers assigned to positions
        </Alert>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("Drag and drop volunteers to assign them to positions for this day")}
      </Typography>

      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", pr: "60px" }}>
          {/* Positions Columns */}
          {positions.map((position) => (
            <Box
              key={position.position_id}
              sx={{ flex: "0 0 250px", minWidth: "250px" }}
            >
              <PositionColumn
                position={position}
                optimisticUpdates={optimisticUpdates}
              />
            </Box>
          ))}
        </Box>

        {/* Hover Drawer for Available Volunteers */}
        <HoverDrawer unassignedUsers={unassignedUsers} activeId={activeId} />

        <DragOverlay>
          {activeId ? (
            <div style={{ transform: "rotate(5deg)" }}>
              {activeId.startsWith("user-") ? (
                (() => {
                  const userId = Number.parseInt(
                    activeId.replace("user-", ""),
                    10,
                  );
                  const user = findUserById(userId);
                  return user ? (
                    <Card sx={{ maxWidth: 250, opacity: 0.9, boxShadow: 3 }}>
                      <DetailedUserCard user={user} expandedDefault={false} />
                    </Card>
                  ) : null;
                })()
              ) : (
                <Card sx={{ maxWidth: 250, opacity: 0.9, boxShadow: 3 }}>
                  <CardContent sx={{ p: 1 }}>
                    <Typography variant="body2">
                      Dragging position...
                    </Typography>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </Box>
  );
}
