import {
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
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Paper,
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

// Extended types for drag and drop functionality

// Common user type that works for both registration forms and assignments
type User = {
  form_id: number;
  user_id: number;
  first_name_ru: string;
  last_name_ru: string;
  patronymic_ru: string | null;
  full_name_en: string;
  isu_id: number | null;
  phone: string | null;
  email: string | null;
  telegram_username: string | null;
  itmo_group: string | null;
  comments: string;
  desired_positions: PositionOut[];
  created_at: string;
  updated_at: string;
};

type PositionWithHalls = PositionOut & {
  assigned_users: User[];
  halls?: HallWithUsers[];
};

type HallWithUsers = HallOut & {
  assigned_users: User[];
};

export const Route = createFileRoute("/_logged-in/$yearId/days/$dayId/edit")({
  component: RouteComponent,
});

function UserCard({ user }: { user: User }) {
  const fullName = user.patronymic_ru
    ? `${user.last_name_ru} ${user.first_name_ru} ${user.patronymic_ru}`
    : `${user.last_name_ru} ${user.first_name_ru}`;

  return (
    <CardContent sx={{ p: 1, "&:last-child": { pb: 1 } }}>
      <Typography variant="body2" gutterBottom sx={{ fontWeight: 600 }}>
        {fullName}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block">
        {user.full_name_en}
      </Typography>
      {user.itmo_group && (
        <Typography variant="caption" color="text.secondary" display="block">
          Group: {user.itmo_group}
        </Typography>
      )}
      {user.isu_id && (
        <Typography variant="caption" color="text.secondary" display="block">
          ISU: {user.isu_id}
        </Typography>
      )}
      {user.phone && (
        <Typography variant="caption" color="text.secondary" display="block">
          📞 {user.phone}
        </Typography>
      )}
      {user.email && (
        <Typography variant="caption" color="text.secondary" display="block">
          ✉️ {user.email}
        </Typography>
      )}
      {user.telegram_username && (
        <Typography variant="caption" color="text.secondary" display="block">
          📱 @{user.telegram_username}
        </Typography>
      )}
      {user.desired_positions.length > 0 && (
        <Box sx={{ mt: 0.5 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            sx={{ mb: 0.25 }}
          >
            Desired:
          </Typography>
          {user.desired_positions.map((position) => (
            <Chip
              key={position.position_id}
              label={position.name}
              size="small"
              color="primary"
              variant="outlined"
              sx={{
                mr: 0.25,
                mb: 0.25,
                fontSize: "0.6rem",
                height: "18px",
              }}
            />
          ))}
        </Box>
      )}
      {user.comments && (
        <Box sx={{ mt: 0.5 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontStyle: "italic", fontSize: "0.6rem" }}
          >
            "{user.comments}"
          </Typography>
        </Box>
      )}
    </CardContent>
  );
}

function DraggableRegistrationForm({
  registrationForm,
  isAssigned = false,
}: {
  registrationForm: RegistrationFormItem;
  isAssigned?: boolean;
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

  // Convert RegistrationFormItem to User type for UserCard
  const user: User = {
    form_id: registrationForm.form_id,
    user_id: registrationForm.user_id,
    first_name_ru: registrationForm.first_name_ru,
    last_name_ru: registrationForm.last_name_ru,
    patronymic_ru: registrationForm.patronymic_ru,
    full_name_en: registrationForm.full_name_en,
    isu_id: registrationForm.isu_id,
    phone: registrationForm.phone,
    email: registrationForm.email,
    telegram_username: registrationForm.telegram_username,
    itmo_group: registrationForm.itmo_group,
    comments: registrationForm.comments,
    desired_positions: registrationForm.desired_positions,
    created_at: registrationForm.created_at,
    updated_at: registrationForm.updated_at,
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
      }}
    >
      <UserCard user={user} />
    </Card>
  );
}

function PositionColumn({ position }: { position: PositionWithHalls }) {
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

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mb: 1, display: "block" }}
      >
        {totalAssigned} assigned
      </Typography>
      <Divider sx={{ mb: 1 }} />

      {/* Direct position assignments (always available) */}
      <Box sx={{ mb: position.halls?.length ? 2 : 0 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mb: 0.5, display: "block" }}
        >
          General ({position.assigned_users.length})
        </Typography>
        <SortableContext
          items={position.assigned_users.map((user) => `user-${user.user_id}`)}
          strategy={verticalListSortingStrategy}
        >
          {position.assigned_users.map((user) => (
            <DraggableRegistrationForm
              key={user.user_id}
              registrationForm={user}
              isAssigned={true}
            />
          ))}
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
}: {
  hall: HallWithUsers;
  positionId: number;
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
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mb: 1, display: "block" }}
      >
        {hall.assigned_users.length} assigned
      </Typography>
      <Divider sx={{ mb: 1 }} />
      <SortableContext
        items={hall.assigned_users.map((user) => `user-${user.user_id}`)}
        strategy={verticalListSortingStrategy}
      >
        {hall.assigned_users.map((user) => (
          <DraggableRegistrationForm
            key={user.user_id}
            registrationForm={user}
            isAssigned={true}
          />
        ))}
      </SortableContext>
    </Paper>
  );
}

function UnassignedArea({ unassignedUsers }: { unassignedUsers: User[] }) {
  const { isOver, setNodeRef } = useDroppable({
    id: "unassigned-area",
  });

  return (
    <Paper
      ref={setNodeRef}
      sx={{
        p: 1.5,
        minHeight: 300,
        border: isOver ? "2px dashed" : "2px dashed transparent",
        borderColor: isOver ? "primary.main" : "transparent",
        backgroundColor: isOver ? "action.hover" : "background.paper",
        "&:hover": {
          borderColor: "primary.main",
          backgroundColor: "action.hover",
        },
      }}
    >
      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
        Unassigned Volunteers
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mb: 1, display: "block" }}
      >
        {unassignedUsers.length} available
      </Typography>
      <Divider sx={{ mb: 1 }} />
      <SortableContext
        items={unassignedUsers.map((user) => `user-${user.user_id}`)}
        strategy={verticalListSortingStrategy}
      >
        {unassignedUsers.map((user) => (
          <DraggableRegistrationForm
            key={user.user_id}
            registrationForm={user}
          />
        ))}
      </SortableContext>
    </Paper>
  );
}

function RouteComponent() {
  const { t } = useTranslation();
  const { yearId, dayId } = Route.useParams();
  const [activeId, setActiveId] = useState<string | null>(null);

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
      // Check if assignment already exists
      const existingAssignment = assignmentsData?.assignments.find(
        (assignment) =>
          assignment.user_id === userId && assignment.day_id === Number(dayId),
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
        // Find the application_form_id for this user
        const user = unassignedUsers.find((u) => u.user_id === userId);
        if (!user) {
          console.error("User not found for assignment");
          return;
        }

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

  // Transform data for drag and drop
  const [positions, setPositions] = useState<PositionWithHalls[]>([]);

  // Helper function to convert assignment to user
  const assignmentToUser = React.useCallback(
    (assignment: {
      application_form_id: number;
      user_id: number;
      first_name_ru: string;
      last_name_ru: string;
      patronymic_ru: string | null;
      full_name_en: string;
      isu_id: number | null;
      phone: string | null;
      email: string | null;
      telegram_username: string | null;
      itmo_group: string | null;
      comments: string;
      created_at: string;
      updated_at: string;
    }): User => ({
      form_id: assignment.application_form_id,
      user_id: assignment.user_id,
      first_name_ru: assignment.first_name_ru,
      last_name_ru: assignment.last_name_ru,
      patronymic_ru: assignment.patronymic_ru,
      full_name_en: assignment.full_name_en,
      isu_id: assignment.isu_id,
      phone: assignment.phone,
      email: assignment.email,
      telegram_username: assignment.telegram_username,
      itmo_group: assignment.itmo_group,
      comments: assignment.comments,
      desired_positions: [], // Not available in assignments
      created_at: assignment.created_at,
      updated_at: assignment.updated_at,
    }),
    [],
  );

  // Initialize positions when data loads
  React.useEffect(() => {
    if (positionsData && registrationFormsData && halls) {
      const initialPositions: PositionWithHalls[] = positionsData.map(
        (position) => {
          // Find all assignments for this position and day
          const positionAssignments =
            assignmentsData?.assignments.filter(
              (assignment) =>
                assignment.position?.position_id === position.position_id &&
                assignment.day_id === Number(dayId),
            ) || [];

          // Separate direct position assignments (no hall) from hall assignments
          const directAssignments = positionAssignments.filter(
            (assignment) => !assignment.hall_id,
          );
          const hallAssignments = positionAssignments.filter(
            (assignment) => assignment.hall_id,
          );

          // Create hall structure if position has halls
          const positionHalls: HallWithUsers[] = position.has_halls
            ? halls.map((hall) => ({
                ...hall,
                assigned_users: hallAssignments
                  .filter((assignment) => assignment.hall_id === hall.hall_id)
                  .map(assignmentToUser),
              }))
            : [];

          return {
            ...position,
            assigned_users: directAssignments.map(assignmentToUser),
            halls: positionHalls.length > 0 ? positionHalls : undefined,
          };
        },
      );
      setPositions(initialPositions);
    }
  }, [
    positionsData,
    registrationFormsData,
    assignmentsData,
    halls,
    dayId,
    assignmentToUser,
  ]);

  // Get unassigned users (all users who haven't been manually assigned to any position yet)
  const unassignedUsers: User[] =
    registrationFormsData?.forms
      .map((form) => ({
        form_id: form.form_id,
        user_id: form.user_id,
        first_name_ru: form.first_name_ru,
        last_name_ru: form.last_name_ru,
        patronymic_ru: form.patronymic_ru,
        full_name_en: form.full_name_en,
        isu_id: form.isu_id,
        phone: form.phone,
        email: form.email,
        telegram_username: form.telegram_username,
        itmo_group: form.itmo_group,
        comments: form.comments,
        desired_positions: form.desired_positions,
        created_at: form.created_at,
        updated_at: form.updated_at,
      }))
      .filter((user) => {
        // Check if user is assigned to any position for this day
        const isAssigned =
          assignmentsData?.assignments.some(
            (assignment) => assignment.user_id === user.user_id,
          ) || false;
        return !isAssigned;
      }) || [];

  // Helper function to remove user from all positions and halls
  const removeUserFromAll = (
    positions: PositionWithHalls[],
    userId: number,
  ): PositionWithHalls[] => {
    return positions.map((pos) => ({
      ...pos,
      assigned_users: pos.assigned_users.filter((u) => u.user_id !== userId),
      halls: pos.halls?.map((hall) => ({
        ...hall,
        assigned_users: hall.assigned_users.filter((u) => u.user_id !== userId),
      })),
    }));
  };

  // Helper function to add user to position
  const addUserToPosition = (
    positions: PositionWithHalls[],
    positionId: number,
    user: User,
  ): PositionWithHalls[] => {
    return positions.map((pos) => {
      if (pos.position_id === positionId) {
        return {
          ...pos,
          assigned_users: [...pos.assigned_users, user],
        };
      }
      return pos;
    });
  };

  // Helper function to add user to hall
  const addUserToHall = (
    positions: PositionWithHalls[],
    positionId: number,
    hallId: number,
    user: User,
  ): PositionWithHalls[] => {
    return positions.map((pos) => {
      if (pos.position_id === positionId && pos.halls) {
        return {
          ...pos,
          halls: pos.halls.map((hall) => {
            if (hall.hall_id === hallId) {
              return {
                ...hall,
                assigned_users: [...hall.assigned_users, user],
              };
            }
            return hall;
          }),
        };
      }
      return pos;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (_event: DragOverEvent) => {
    // Handle drag over logic if needed
  };

  // Helper function to find user by ID from all sources
  const findUserById = (userId: number): User | null => {
    // First check unassigned users
    const unassignedUser = unassignedUsers.find((u) => u.user_id === userId);
    if (unassignedUser) return unassignedUser;

    // Then check all assigned users in positions and halls
    for (const position of positions) {
      // Check direct position assignments
      const directUser = position.assigned_users.find(
        (u) => u.user_id === userId,
      );
      if (directUser) return directUser;

      // Check hall assignments
      if (position.halls) {
        for (const hall of position.halls) {
          const hallUser = hall.assigned_users.find(
            (u) => u.user_id === userId,
          );
          if (hallUser) return hallUser;
        }
      }
    }

    return null;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // If dragging a user
    if (activeId.startsWith("user-")) {
      const userId = Number.parseInt(activeId.replace("user-", ""));
      const user = findUserById(userId);

      if (!user) return;

      // If dropping on a position (general assignment)
      if (overId.startsWith("position-")) {
        const positionId = Number.parseInt(overId.replace("position-", ""));

        setPositions((prevPositions) => {
          const withoutUser = removeUserFromAll(prevPositions, userId);
          return addUserToPosition(withoutUser, positionId, user);
        });

        // Save assignment to backend
        saveAssignment(userId, positionId);
      }

      // If dropping on a hall (hall-specific assignment)
      if (overId.startsWith("hall-")) {
        const [positionId, hallId] = overId
          .replace("hall-", "")
          .split("-")
          .map(Number);

        setPositions((prevPositions) => {
          const withoutUser = removeUserFromAll(prevPositions, userId);
          return addUserToHall(withoutUser, positionId, hallId, user);
        });

        // Save assignment to backend
        saveAssignment(userId, positionId, hallId);
      }

      // If dropping on unassigned area (remove assignment)
      if (overId === "unassigned-area") {
        setPositions((prevPositions) => {
          return removeUserFromAll(prevPositions, userId);
        });

        // Remove assignment from backend
        const existingAssignment = assignmentsData?.assignments.find(
          (assignment) =>
            assignment.user_id === userId &&
            assignment.day_id === Number(dayId),
        );

        if (existingAssignment) {
          deleteUserDayMutation.mutate(existingAssignment.user_day_id);
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
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          {/* Unassigned Users Column */}
          <Box sx={{ flex: "0 0 250px", minWidth: "250px" }}>
            <UnassignedArea unassignedUsers={unassignedUsers} />
          </Box>

          {/* Positions Columns */}
          <Box sx={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 1.5 }}>
            {positions.map((position) => (
              <Box
                key={position.position_id}
                sx={{ flex: "0 0 250px", minWidth: "250px" }}
              >
                <PositionColumn position={position} />
              </Box>
            ))}
          </Box>
        </Box>

        <DragOverlay>
          {activeId ? (
            <div style={{ transform: "rotate(5deg)" }}>
              {activeId.startsWith("user-") ? (
                (() => {
                  const userId = Number.parseInt(activeId.replace("user-", ""));
                  const user = findUserById(userId);
                  return user ? (
                    <Card sx={{ maxWidth: 250, opacity: 0.9, boxShadow: 3 }}>
                      <UserCard user={user} />
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
