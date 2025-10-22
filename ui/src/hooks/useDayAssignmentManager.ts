import { useCallback } from "react";
import type { RegistrationFormItem } from "@/client/types.gen";
import { createErrorHandler } from "@/utils/apiErrorHandling";
import { useAssignmentOperations } from "./useAssignmentOperations";
import { useClickSelection } from "./useClickSelection";

interface AssignmentData {
  assignments: any[];
  assignmentToUser: (assignment: any) => RegistrationFormItem | null;
  findUserById: (userId: number) => RegistrationFormItem | null;
}

export function useDayAssignmentManager(
  dayId: string,
  assignmentData: AssignmentData,
) {
  const {
    optimisticUpdates,
    executeAssignmentWithOptimisticUpdate,
    executeRemovalWithOptimisticUpdate,
  } = useAssignmentOperations(dayId, assignmentData);

  const { clickSelectedUserId, selectUser, clearSelection, isUserSelected } =
    useClickSelection();

  const handleUserCardClick = useCallback(
    (userId: number) => {
      selectUser(userId);
    },
    [selectUser],
  );

  const handlePositionClick = useCallback(
    (positionId: number, hallId?: number) => {
      if (clickSelectedUserId === null) return;

      const userId = clickSelectedUserId;
      const user = assignmentData.findUserById(userId);

      if (!user) return;

      executeAssignmentWithOptimisticUpdate(
        userId,
        positionId,
        hallId,
        () => {
          // Clear selection after successful move
          clearSelection();
        },
        createErrorHandler("Assignment"),
      );
    },
    [
      clickSelectedUserId,
      assignmentData,
      executeAssignmentWithOptimisticUpdate,
      clearSelection,
    ],
  );

  const handleDragAssignment = useCallback(
    (
      userId: number,
      positionId: number,
      hallId?: number,
      onSuccess?: () => void,
    ) => {
      executeAssignmentWithOptimisticUpdate(
        userId,
        positionId,
        hallId,
        onSuccess,
        createErrorHandler("Drag assignment"),
      );
    },
    [executeAssignmentWithOptimisticUpdate],
  );

  const handleDragRemoval = useCallback(
    (userId: number, onSuccess?: () => void) => {
      executeRemovalWithOptimisticUpdate(
        userId,
        onSuccess,
        createErrorHandler("Assignment removal"),
      );
    },
    [executeRemovalWithOptimisticUpdate],
  );

  return {
    // Optimistic updates
    optimisticUpdates,

    // Click selection
    clickSelectedUserId,
    handleUserCardClick,
    handlePositionClick,
    clearSelection,
    isUserSelected,

    // Drag and drop
    handleDragAssignment,
    handleDragRemoval,
  };
}
