import { useCallback, useState } from "react";

export interface OptimisticUpdate {
  userId: number;
  positionId: number;
  hallId?: number;
  type: "add" | "remove";
}

export interface OptimisticUpdatesState {
  [key: string]: OptimisticUpdate;
}

export function useOptimisticUpdates() {
  const [optimisticUpdates, setOptimisticUpdates] =
    useState<OptimisticUpdatesState>({});

  const addOptimisticUpdate = useCallback((update: OptimisticUpdate) => {
    const operationKey = `${update.userId}-${Date.now()}`;
    setOptimisticUpdates((prev) => ({
      ...prev,
      [operationKey]: update,
    }));
    return operationKey;
  }, []);

  const removeOptimisticUpdate = useCallback((operationKey: string) => {
    setOptimisticUpdates((prev) => {
      const { [operationKey]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearAllOptimisticUpdates = useCallback(() => {
    setOptimisticUpdates({});
  }, []);

  const hasOptimisticUpdate = useCallback(
    (
      userId: number,
      positionId: number,
      hallId?: number,
      type?: "add" | "remove",
    ) => {
      return Object.values(optimisticUpdates).some((update) => {
        const matchesUser = update.userId === userId;
        const matchesPosition = update.positionId === positionId;
        const matchesHall =
          hallId === undefined ? !update.hallId : update.hallId === hallId;
        const matchesType = type === undefined || update.type === type;

        return matchesUser && matchesPosition && matchesHall && matchesType;
      });
    },
    [optimisticUpdates],
  );

  const isUserOptimisticallyRemoved = useCallback(
    (userId: number) => {
      return Object.values(optimisticUpdates).some(
        (update) => update.userId === userId && update.type === "remove",
      );
    },
    [optimisticUpdates],
  );

  const isUserOptimisticallyAdded = useCallback(
    (userId: number, positionId: number, hallId?: number) => {
      return Object.values(optimisticUpdates).some(
        (update) =>
          update.userId === userId &&
          update.positionId === positionId &&
          update.hallId === hallId &&
          update.type === "add",
      );
    },
    [optimisticUpdates],
  );

  return {
    optimisticUpdates,
    addOptimisticUpdate,
    removeOptimisticUpdate,
    clearAllOptimisticUpdates,
    hasOptimisticUpdate,
    isUserOptimisticallyRemoved,
    isUserOptimisticallyAdded,
  };
}
