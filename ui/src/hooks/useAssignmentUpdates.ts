import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { queryKeys } from "@/data/query-keys";
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

    const invalidate = () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.assignments.day(dayId),
      });
      if (yearId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.year.dayAssignments(yearId, dayId),
        });
      }
    };

    // Rooms live on the server per connection, so every (re)connect gets a
    // new sid that has to subscribe again. Updates sent while we were
    // disconnected are lost, so refetch after a reconnect as well.
    let wasConnected = socket.connected;
    const handleConnect = () => {
      socket.emit("subscribe_day_assignments", { day_id: dayId });
      if (wasConnected) {
        invalidate();
      }
      wasConnected = true;
    };

    // Handle assignment update events
    const handleAssignmentUpdate = (event: AssignmentUpdateEvent) => {
      if (event.day_id !== dayId) {
        return;
      }
      invalidate();
    };

    socket.on("connect", handleConnect);
    socket.on("assignment_updated", handleAssignmentUpdate);
    if (socket.connected) {
      socket.emit("subscribe_day_assignments", { day_id: dayId });
    }

    // Cleanup on unmount
    return () => {
      socket.off("connect", handleConnect);
      socket.off("assignment_updated", handleAssignmentUpdate);
      if (socket.connected) {
        socket.emit("unsubscribe_day_assignments", { day_id: dayId });
      }
    };
  }, [dayId, yearId, enabled, queryClient]);
};
