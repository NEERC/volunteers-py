import { useCallback } from "react";
import type { AssignmentItem, RegistrationFormItem } from "@/client/types.gen";
import {
  useAddUserDay,
  useDeleteUserDay,
  useEditUserDay,
} from "@/data/use-admin";
import { useOptimisticUpdates } from "./useOptimisticUpdates";

interface AssignmentData {
  assignments: AssignmentItem[];
  assignmentToUser: (assignment: AssignmentItem) => RegistrationFormItem | null;
  findUserById: (userId: number) => RegistrationFormItem | null;
}

export function useAssignmentOperations(
  dayId: string,
  assignmentData: AssignmentData,
) {
  const addUserDayMutation = useAddUserDay();
  const editUserDayMutation = useEditUserDay();
  const deleteUserDayMutation = useDeleteUserDay();

  const { addOptimisticUpdate, removeOptimisticUpdate, optimisticUpdates } =
    useOptimisticUpdates();

  const saveAssignment = useCallback(
    async (userId: number, positionId: number, hallId?: number) => {
      try {
        // Find the user to get their application_form_id
        const user = assignmentData.findUserById(userId);
        if (!user) {
          console.error("User not found for assignment");
          return;
        }

        // Check if assignment already exists by looking for the user in assignments
        const existingAssignment = assignmentData.assignments.find(
          (assignment) => {
            const assignmentUser = assignmentData.assignmentToUser(assignment);
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
            position_id: positionId,
            hall_id: hallId || null,
          });
        }
      } catch (error) {
        console.error("Failed to save assignment:", error);
        throw error;
      }
    },
    [dayId, assignmentData, addUserDayMutation, editUserDayMutation],
  );

  const removeAssignment = useCallback(
    async (userId: number) => {
      try {
        // Find existing assignment
        const existingAssignment = assignmentData.assignments.find(
          (assignment) => {
            const assignmentUser = assignmentData.assignmentToUser(assignment);
            return assignmentUser?.user_id === userId;
          },
        );

        if (existingAssignment) {
          await deleteUserDayMutation.mutateAsync(
            existingAssignment.user_day_id,
          );
        }
      } catch (error) {
        console.error("Failed to remove assignment:", error);
        throw error;
      }
    },
    [assignmentData, deleteUserDayMutation],
  );

  const executeAssignmentWithOptimisticUpdate = useCallback(
    async (
      userId: number,
      positionId: number,
      hallId?: number,
      onSuccess?: () => void,
      onError?: (error: Error) => void,
    ) => {
      const operationKey = addOptimisticUpdate({
        userId,
        positionId,
        hallId,
        type: "add",
      });

      try {
        await saveAssignment(userId, positionId, hallId);
        removeOptimisticUpdate(operationKey);
        onSuccess?.();
      } catch (error) {
        removeOptimisticUpdate(operationKey);
        if (error instanceof Error) {
          onError?.(error);
        } else {
          onError?.(new Error("Unknown error"));
        }
      }
    },
    [addOptimisticUpdate, removeOptimisticUpdate, saveAssignment],
  );

  const executeRemovalWithOptimisticUpdate = useCallback(
    async (
      userId: number,
      onSuccess?: () => void,
      onError?: (error: Error) => void,
    ) => {
      // Find which position/hall the user is currently assigned to
      const currentAssignment = assignmentData.assignments.find(
        (assignment) => {
          const assignmentUser = assignmentData.assignmentToUser(assignment);
          return assignmentUser?.user_id === userId;
        },
      );

      if (!currentAssignment) {
        console.error("No assignment found for user");
        return;
      }

      const operationKey = addOptimisticUpdate({
        userId,
        positionId: currentAssignment.position_id,
        hallId: currentAssignment.hall_id || undefined,
        type: "remove",
      });

      try {
        await removeAssignment(userId);
        removeOptimisticUpdate(operationKey);
        onSuccess?.();
      } catch (error) {
        removeOptimisticUpdate(operationKey);
        if (error instanceof Error) {
          onError?.(error);
        } else {
          onError?.(new Error("Unknown error"));
        }
      }
    },
    [
      addOptimisticUpdate,
      removeOptimisticUpdate,
      removeAssignment,
      assignmentData,
    ],
  );

  return {
    optimisticUpdates,
    saveAssignment,
    removeAssignment,
    executeAssignmentWithOptimisticUpdate,
    executeRemovalWithOptimisticUpdate,
    addOptimisticUpdate,
    removeOptimisticUpdate,
  };
}
