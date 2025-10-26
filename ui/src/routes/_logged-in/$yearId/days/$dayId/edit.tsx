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
  Person as PersonIcon,
  PushPin as PinIcon,
  PushPinOutlined as PinOutlinedIcon,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  Paper,
  Switch,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  HallOut,
  PositionOut,
  RegistrationFormItem,
} from "@/client/types.gen";
import { DetailedUserCard } from "@/components/DetailedUserCard";
import {
  useDayAssignments,
  useEditDay,
  useRegistrationForms,
  useYearDays,
  useYearHalls,
  useYearPositions,
} from "@/data/use-admin";
import { useDayAssignmentManager } from "@/hooks/useDayAssignmentManager";

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

function DraggableDetailedUserCard({
  user,
  isSelected,
  onClick,
  isMobile = false,
}: {
  user: RegistrationFormItem;
  isSelected: boolean;
  onClick: () => void;
  isMobile?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `user-${user.user_id}`,
    disabled: isMobile, // Disable drag on mobile
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...(isMobile ? {} : attributes)}
      {...(isMobile ? {} : listeners)}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      sx={{
        mb: 2,
        cursor: isMobile ? "pointer" : "grab",
        "&:active": { cursor: isMobile ? "pointer" : "grabbing" },
        opacity: isDragging ? 0.5 : 1,
        border: isSelected ? "2px solid" : "1px solid",
        borderColor: isSelected ? "primary.main" : "divider",
        backgroundColor: isSelected ? "action.selected" : "background.paper",
        "&:hover": {
          backgroundColor: isSelected ? "action.selected" : "action.hover",
        },
      }}
    >
      <DetailedUserCard user={user} expandedDefault={true} />
    </Card>
  );
}

function HoverDrawer({
  unassignedUsers,
  activeId,
  isPinned,
  onPinChange,
  clickSelectedUserId,
  onUserClick,
  onRemoveAssignment,
  isMobile = false,
}: {
  unassignedUsers: RegistrationFormItem[];
  activeId: string | null;
  isPinned: boolean;
  onPinChange: (pinned: boolean) => void;
  clickSelectedUserId: number | null;
  onUserClick: (userId: number) => void;
  onRemoveAssignment: (userId: number) => void;
  isMobile?: boolean;
}) {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const { isOver, setNodeRef } = useDroppable({
    id: "hover-drawer-area",
  });

  // Don't open drawer when dragging, but show if pinned
  // On mobile, only show if pinned (no hover)
  const shouldShowDrawer = isMobile
    ? isPinned && !activeId
    : (isHovered || isPinned) && !activeId;

  return (
    <Box
      ref={setNodeRef}
      sx={{
        position: "fixed",
        // Desktop: right side drawer
        ...(isMobile
          ? {}
          : {
              right: 0,
              top: 0,
              height: "100vh",
              width: shouldShowDrawer ? "500px" : "50px",
            }),
        // Mobile: bottom drawer
        ...(isMobile
          ? {
              bottom: 0,
              left: 0,
              right: 0,
              height: shouldShowDrawer ? "60vh" : "60px",
              width: "100vw",
            }
          : {}),
        backgroundColor: isOver
          ? "action.hover"
          : clickSelectedUserId
            ? "action.selected"
            : "background.paper",
        border: isOver
          ? "2px dashed"
          : clickSelectedUserId
            ? "2px solid"
            : "1px solid",
        boxSizing: "border-box",
        borderColor: isOver
          ? "primary.main"
          : clickSelectedUserId
            ? "primary.main"
            : "divider",
        transition: isPinned
          ? "none"
          : isMobile
            ? "height 0.3s ease-in-out"
            : "width 0.3s ease-in-out",
        zIndex: 3000,
        overflow: "hidden",
        cursor: clickSelectedUserId ? "pointer" : "default",
        "&:hover": {
          // Only apply hover effects on desktop
          ...(isMobile
            ? {}
            : {
                width: isPinned ? "500px" : shouldShowDrawer ? "500px" : "50px",
              }),
        },
      }}
      onMouseEnter={() => !isMobile && !isPinned && setIsHovered(true)}
      onMouseLeave={() => !isMobile && !isPinned && setIsHovered(false)}
    >
      {/* Hover trigger area */}
      <Box
        onClick={(e) => {
          e.stopPropagation();
          // On mobile, clicking the trigger area toggles the drawer
          if (isMobile) {
            onPinChange(!isPinned);
          }
        }}
        sx={{
          position: "absolute",
          // Desktop: right side trigger
          ...(isMobile
            ? {}
            : {
                right: 0,
                top: 0,
                width: "50px",
                height: "100%",
                flexDirection: "column",
              }),
          // Mobile: bottom trigger
          ...(isMobile
            ? {
                bottom: 0,
                left: 0,
                right: 0,
                height: "60px",
                width: "100%",
                flexDirection: "row",
              }
            : {}),
          backgroundColor: "primary.main",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          cursor: "pointer",
          zIndex: 3001,
          pointerEvents: "auto",
        }}
      >
        <PersonIcon
          sx={{
            color: "white",
            transform: isMobile ? "none" : "rotate(90deg)",
          }}
        />
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onPinChange(!isPinned);
          }}
          sx={{
            color: "white",
            padding: 0.5,
            "&:hover": {
              backgroundColor: "rgba(255, 255, 255, 0.1)",
            },
          }}
        >
          {isPinned ? (
            <PinIcon sx={{ fontSize: 16 }} />
          ) : (
            <PinOutlinedIcon sx={{ fontSize: 16 }} />
          )}
        </IconButton>
      </Box>

      {/* Drawer content */}
      <Box
        onClick={(e) => {
          e.stopPropagation();
          // Handle clicks on empty areas of the drawer content
          if (clickSelectedUserId) {
            onRemoveAssignment(clickSelectedUserId);
          }
        }}
        sx={{
          // Desktop: right side content
          ...(isMobile
            ? {}
            : {
                width: "calc(500px - 50px - 2px)",
                height: "100%",
                pt: 8,
              }),
          // Mobile: bottom content
          ...(isMobile
            ? {
                width: "100%",
                height: "calc(60vh - 60px - 2px)",
                pb: 8,
              }
            : {}),
          boxSizing: "border-box",
          p: 2,
          overflowY: "auto",
          overflowX: "hidden",
          // opacity: shouldShowDrawer ? 1 : 0,
          // transition: "opacity 0.2s ease-in-out",
          pointerEvents: "auto",
          position: "relative",
          // ...(clickSelectedUserId && {
          //   "&::before": {
          //     content: '""',
          //     position: "absolute",
          //     top: 0,
          //     left: 0,
          //     right: 0,
          //     bottom: 0,
          //     border: "2px dashed",
          //     borderColor: "primary.main",
          //     borderRadius: 1,
          //     pointerEvents: "none",
          //     animation: "pulse 2s infinite",
          //   },
          // }),
        }}
      >
        <Typography
          variant="h6"
          sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}
        >
          <PersonIcon />
          {t("Available Volunteers")}
        </Typography>

        {clickSelectedUserId && (
          <Box sx={{ mb: 2 }}>
            <Button
              onClick={() => onRemoveAssignment(clickSelectedUserId)}
              variant="contained"
              color="error"
            >
              {t("Click here to remove assignment")}
            </Button>
          </Box>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {unassignedUsers.length} {t("volunteers available")}
        </Typography>

        <Divider sx={{ mb: 2 }} />

        {unassignedUsers.length === 0 ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ textAlign: "center", py: 4 }}
          >
            {t("All volunteers have been assigned to positions")}
          </Typography>
        ) : (
          unassignedUsers.map((user) => (
            <DraggableDetailedUserCard
              key={user.user_id}
              user={user}
              isSelected={clickSelectedUserId === user.user_id}
              onClick={() => onUserClick(user.user_id)}
              isMobile={isMobile}
            />
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
  isSelected = false,
  onClick,
  isMobile = false,
}: {
  registrationForm: RegistrationFormItem;
  isAssigned?: boolean;
  isOptimistic?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  isMobile?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `user-${registrationForm.user_id}`,
    disabled: isMobile, // Disable drag on mobile
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...(isMobile ? {} : attributes)}
      {...(isMobile ? {} : listeners)}
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
      sx={{
        mb: 0.5,
        cursor: isMobile ? "pointer" : "grab",
        "&:active": {
          cursor: isMobile ? "pointer" : "grabbing",
        },
        opacity: isDragging ? 0.5 : 1,
        backgroundColor: isSelected
          ? "action.selected"
          : isAssigned
            ? "action.hover"
            : "background.paper",
        border: isSelected
          ? "2px solid"
          : isAssigned
            ? "1px solid"
            : "1px solid transparent",
        borderColor: isSelected
          ? "primary.main"
          : isAssigned
            ? "primary.main"
            : "transparent",
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
  clickSelectedUserId,
  onPositionClick,
  onUserClick,
  isMobile = false,
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
  clickSelectedUserId: number | null;
  onPositionClick: (positionId: number, hallId?: number) => void;
  onUserClick: (userId: number) => void;
  isMobile?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `position-${position.position_id}`,
  });

  const [isHovered, setIsHovered] = useState(false);

  return (
    <Paper
      ref={setNodeRef}
      onClick={(e) => {
        e.stopPropagation();
        onPositionClick(position.position_id);
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        p: 1.5,
        // minHeight: 300,
        border: isOver
          ? "2px dashed"
          : isHovered && clickSelectedUserId
            ? "2px solid"
            : "1px solid",
        borderColor: isOver
          ? "primary.main"
          : isHovered && clickSelectedUserId
            ? "primary.main"
            : "divider",
        backgroundColor: isOver
          ? "action.hover"
          : isHovered && clickSelectedUserId
            ? "action.selected"
            : "background.paper",
        cursor: clickSelectedUserId ? "pointer" : "default",
        transition: "all 0.2s ease-in-out",
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
                isSelected={clickSelectedUserId === user.user_id}
                onClick={() => onUserClick(user.user_id)}
                isMobile={isMobile}
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
              clickSelectedUserId={clickSelectedUserId}
              onPositionClick={onPositionClick}
              onUserClick={onUserClick}
              isMobile={isMobile}
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
  clickSelectedUserId,
  onPositionClick,
  onUserClick,
  isMobile = false,
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
  clickSelectedUserId: number | null;
  onPositionClick: (positionId: number, hallId?: number) => void;
  onUserClick: (userId: number) => void;
  isMobile?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `hall-${positionId}-${hall.hall_id}`,
  });

  const [isHovered, setIsHovered] = useState(false);

  return (
    <Paper
      ref={setNodeRef}
      onClick={(e) => {
        e.stopPropagation();
        onPositionClick(positionId, hall.hall_id);
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        p: 1,
        // minHeight: 200,
        border: isOver
          ? "2px dashed"
          : isHovered && clickSelectedUserId
            ? "2px solid"
            : "1px solid",
        borderColor: isOver
          ? "secondary.main"
          : isHovered && clickSelectedUserId
            ? "primary.main"
            : "divider",
        backgroundColor: isOver
          ? "action.hover"
          : isHovered && clickSelectedUserId
            ? "action.selected"
            : "background.paper",
        cursor: clickSelectedUserId ? "pointer" : "default",
        transition: "all 0.2s ease-in-out",
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
              isSelected={clickSelectedUserId === user.user_id}
              onClick={() => onUserClick(user.user_id)}
              isMobile={isMobile}
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
  const [isDrawerPinned, setIsDrawerPinned] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

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

  const { data: halls } = useYearHalls(yearId);

  // Fetch days to get current assignment_published value
  // TODO: highly vibe-coded, works for now. Not sure i'd recommend ever touching this.
  const { data: daysData } = useYearDays(yearId);
  const currentDay = daysData?.find((d) => d.day_id === Number(dayId));
  const [assignmentPublished, setAssignmentPublished] = useState(
    currentDay?.assignment_published ?? false,
  );
  const editDayMutation = useEditDay();

  // Update local state when data loads
  React.useEffect(() => {
    if (currentDay) {
      setAssignmentPublished(currentDay.assignment_published);
    }
  }, [currentDay]);

  const handleTogglePublished = () => {
    const newValue = !assignmentPublished;
    setAssignmentPublished(newValue);
    editDayMutation.mutate(
      {
        dayId,
        yearId,
        data: {
          assignment_published: newValue,
        },
      },
      {
        onError: () => {
          // Revert on error
          setAssignmentPublished(!newValue);
        },
      },
    );
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
      disabled: isMobile, // Disable drag sensors on mobile
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

  // Assignment manager hook
  const {
    optimisticUpdates,
    clickSelectedUserId,
    handleUserCardClick,
    handlePositionClick,
    clearSelection,
    handleDragAssignment,
    handleDragRemoval,
  } = useDayAssignmentManager(dayId, {
    assignments: assignmentsData?.assignments || [],
    assignmentToUser,
    findUserById,
  });

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

      // If dropping on a position (general assignment)
      if (overId.startsWith("position-")) {
        const positionId = Number.parseInt(overId.replace("position-", ""), 10);
        handleDragAssignment(userId, positionId);
      }

      // If dropping on a hall (hall-specific assignment)
      if (overId.startsWith("hall-")) {
        const [positionId, hallId] = overId
          .replace("hall-", "")
          .split("-")
          .map(Number);
        handleDragAssignment(userId, positionId, hallId);
      }

      // If dropping on hover drawer area (remove assignment)
      if (overId === "hover-drawer-area") {
        handleDragRemoval(userId);
      }
    }
  };

  const handleRemoveAssignment = useCallback(
    (userId: number) => {
      handleDragRemoval(userId, () => {
        // Clear selection after successful removal
        clearSelection();
      });
    },
    [handleDragRemoval, clearSelection],
  );

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
        {t("Day Assignments")} - id={dayId}
      </Typography>
      {/* Publish Toggle */}
      <FormControlLabel
        control={
          <Switch
            checked={assignmentPublished}
            onChange={handleTogglePublished}
            disabled={editDayMutation.isPending}
            color="primary"
          />
        }
        label={
          <Typography variant="body1" fontWeight="medium">
            {t("Publish Assignments")}
            {editDayMutation.isPending && "..."}
          </Typography>
        }
      />

      {/* Existing Assignments Summary */}
      {assignmentsData && assignmentsData.assignments.length > 0 && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {t("Current assignments:")} {assignmentsData.assignments.length}{" "}
          {t("volunteers assigned to positions")}
        </Alert>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {isMobile
          ? t("Click volunteers to assign them to positions for this day")
          : t(
              "Drag and drop or click volunteers to assign them to positions for this day",
            )}
      </Typography>

      <DndContext
        sensors={sensors}
        collisionDetection={isMobile ? undefined : customCollisionDetection}
        onDragStart={isMobile ? undefined : handleDragStart}
        onDragOver={isMobile ? undefined : handleDragOver}
        onDragEnd={isMobile ? undefined : handleDragEnd}
      >
        <Box
          onClick={clearSelection}
          sx={{ minHeight: "100vh", width: "100%" }}
        >
          <Box
            sx={{
              display: "flex",
              gap: 2,
              flexWrap: "wrap",
              flexDirection: "column",
              // Desktop: right padding for right drawer
              ...(isMobile
                ? {}
                : {
                    pr: isDrawerPinned ? "500px" : "60px",
                    transition: "padding-right 0.3s ease-in-out",
                  }),
              // Mobile: bottom padding for bottom drawer
              ...(isMobile
                ? {
                    pb: isDrawerPinned ? "60vh" : "80px",
                    transition: "padding-bottom 0.3s ease-in-out",
                  }
                : {}),
            }}
          >
            {/* Positions Columns */}
            {positions.map((position) => (
              <Box
                key={position.position_id}
                sx={{
                  flex: isMobile ? "1 1" : "0 0",
                  minWidth: isMobile ? "100%" : "400px",
                  maxWidth: isMobile ? "100%" : "none",
                }}
              >
                <PositionColumn
                  position={position}
                  optimisticUpdates={optimisticUpdates}
                  clickSelectedUserId={clickSelectedUserId}
                  onPositionClick={handlePositionClick}
                  onUserClick={handleUserCardClick}
                  isMobile={isMobile}
                />
              </Box>
            ))}
          </Box>
        </Box>

        {/* Hover Drawer for Available Volunteers */}
        <HoverDrawer
          unassignedUsers={unassignedUsers}
          activeId={activeId}
          isPinned={isDrawerPinned}
          onPinChange={setIsDrawerPinned}
          clickSelectedUserId={clickSelectedUserId}
          onUserClick={handleUserCardClick}
          onRemoveAssignment={handleRemoveAssignment}
          isMobile={isMobile}
        />

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
                      {t("Dragging position...")}
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
