import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getSocket } from "@/integrations/socketio/socket";

interface AssignmentUpdateEvent {
  type:
    | "created"
    | "updated"
    | "deleted"
    | "published"
    | "unpublished"
    | "bulk_created";
  day_id: number;
  assignment?: {
    user_day_id: number;
  } | null;
}

/**
 * Hook to subscribe to real-time assignment updates for a specific day.
 * Automatically refetches assignment data when updates are received.
 *
 * @param dayId - The ID of the day to subscribe to
 * @param yearId - The year ID for query invalidation
 * @param enabled - Whether the subscription is active (default: true)
 */
export const useAssignmentUpdates = (
  dayId: number | undefined,
  yearId: number | undefined,
  enabled = true,
) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !dayId) return;

    const socket = getSocket();

    // Subscribe to assignment updates for this day
    socket.emit("subscribe_day_assignments", { day_id: dayId });

    // Handle assignment update events
    const handleAssignmentUpdate = (event: AssignmentUpdateEvent) => {
      console.log("Assignment update received:", event);

      if (event.day_id !== dayId) {
        return;
      }

      const adminKey = ["admin", "assignments", "day", String(dayId)];
      const yearKey = [
        "year",
        String(yearId),
        "day",
        String(dayId),
        "assignments",
      ];

      queryClient.invalidateQueries({ queryKey: adminKey });
      if (yearId) {
        queryClient.invalidateQueries({ queryKey: yearKey });
      }
    };

    socket.on("assignment_updated", handleAssignmentUpdate);

    // Cleanup on unmount
    return () => {
      socket.off("assignment_updated", handleAssignmentUpdate);
      socket.emit("unsubscribe_day_assignments", { day_id: dayId });
    };
  }, [dayId, yearId, enabled, queryClient]);
};
