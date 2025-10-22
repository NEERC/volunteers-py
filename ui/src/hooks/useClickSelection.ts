import { useCallback, useState } from "react";

export function useClickSelection() {
  const [clickSelectedUserId, setClickSelectedUserId] = useState<number | null>(
    null,
  );

  const selectUser = useCallback(
    (userId: number) => {
      if (clickSelectedUserId === userId) {
        // If clicking the same user, deselect
        setClickSelectedUserId(null);
      } else {
        // Select the clicked user
        setClickSelectedUserId(userId);
      }
    },
    [clickSelectedUserId],
  );

  const clearSelection = useCallback(() => {
    setClickSelectedUserId(null);
  }, []);

  const isUserSelected = useCallback(
    (userId: number) => {
      return clickSelectedUserId === userId;
    },
    [clickSelectedUserId],
  );

  return {
    clickSelectedUserId,
    selectUser,
    clearSelection,
    isUserSelected,
  };
}
