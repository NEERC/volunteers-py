import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDayApiV1AdminDayAddPost,
  addHallApiV1AdminHallAddPost,
  addPositionApiV1AdminPositionAddPost,
  addUserDayApiV1AdminUserDayAddPost,
  addYearApiV1AdminYearAddPost,
  copyAssignmentsApiV1AdminDayCopyAssignmentsPost,
  deleteUserDayApiV1AdminUserDayUserDayIdDelete,
  editDayApiV1AdminDayDayIdEditPost,
  editHallApiV1AdminHallHallIdEditPost,
  editPositionApiV1AdminPositionPositionIdEditPost,
  editPositionApiV1AdminUserDayUserDayIdEditPost,
  editUserApiV1AdminUserUserIdEditPost,
  editYearApiV1AdminYearYearIdEditPost,
  getAllUsersApiV1AdminUserGet,
  getDayAssignmentsApiV1AdminUserDayDayDayIdAssignmentsGet,
  getRegistrationFormsApiV1AdminYearYearIdRegistrationFormsGet,
  getUserByIdApiV1AdminUserUserIdGet,
  getUsersListApiV1AdminYearYearIdUsersGet,
  getYearDaysApiV1AdminDayYearYearIdGet,
  getYearHallsApiV1AdminHallYearYearIdGet,
  getYearPositionsApiV1AdminYearYearIdPositionsGet,
  getYearResultsApiV1AdminYearYearIdResultsGet,
} from "@/client";
import type {
  AddDayRequest,
  AddHallRequest,
  AddPositionRequest,
  AddUserDayRequest,
  AddYearRequest,
  CopyAssignmentsRequest,
  EditDayRequest,
  EditHallRequest,
  EditPositionRequest,
  EditUserDayRequest,
  EditUserRequest,
  EditYearRequest,
} from "@/client/types.gen";
import { queryKeys } from "./query-keys";

// Admin mutation hooks
export const useAddYear = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AddYearRequest) => {
      const response = await addYearApiV1AdminYearAddPost({
        body: data,
        throwOnError: true,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.years.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.years.all() });
    },
  });
};

export const useEditYear = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      yearId,
      data,
    }: {
      yearId: string | number;
      data: EditYearRequest;
    }) => {
      const response = await editYearApiV1AdminYearYearIdEditPost({
        path: { year_id: Number(yearId) },
        body: data,
        throwOnError: true,
      });
      return response.data;
    },
    onSuccess: (_, { yearId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.years.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.years.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.year.all(yearId) });
    },
  });
};

export const useAddDay = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AddDayRequest) => {
      const response = await addDayApiV1AdminDayAddPost({
        body: data,
        throwOnError: true,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.days.all() });
      if (variables.year_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.year.all(variables.year_id),
        });
      }
    },
  });
};

export const useEditDay = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dayId,
      yearId: _,
      data,
    }: {
      dayId: string | number;
      yearId: string | number;
      data: EditDayRequest;
    }) => {
      const response = await editDayApiV1AdminDayDayIdEditPost({
        path: { day_id: Number(dayId) },
        body: data,
        throwOnError: true,
      });
      return response.data;
    },
    onSuccess: (_, { yearId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.days.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.year.all(yearId) });
    },
  });
};

export const useAddPosition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AddPositionRequest) => {
      const response = await addPositionApiV1AdminPositionAddPost({
        body: data,
        throwOnError: true,
      });
      return response.data;
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.positions.all(),
      });
      if (variables.year_id) {
        // Force refetch to ensure fresh data
        await queryClient.fetchQuery({
          queryKey: queryKeys.admin.positions.year(variables.year_id),
          queryFn: async () => {
            const resp = await getYearPositionsApiV1AdminYearYearIdPositionsGet(
              {
                path: { year_id: Number(variables.year_id) },
                throwOnError: true,
              },
            );
            return resp.data;
          },
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.year.all(variables.year_id),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.admin.positions.year(variables.year_id),
        });
      }
    },
  });
};

export const useEditPosition = (yearId: string | number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      positionId,
      data,
    }: {
      positionId: string | number;
      data: EditPositionRequest;
    }) => {
      const response = await editPositionApiV1AdminPositionPositionIdEditPost({
        path: { position_id: Number(positionId) },
        body: data,
        throwOnError: true,
      });
      return response.data;
    },
    onSuccess: async (_) => {
      // Invalidate wide caches
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.positions.all(),
      });
      // Force refetch positions for the year to ensure fresh data
      await queryClient.fetchQuery({
        queryKey: queryKeys.admin.positions.year(yearId),
        queryFn: async () => {
          const resp = await getYearPositionsApiV1AdminYearYearIdPositionsGet({
            path: { year_id: Number(yearId) },
            throwOnError: true,
          });
          return resp.data;
        },
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.positions.year(yearId),
      });
      // Invalidate year form since position might be used there
      queryClient.invalidateQueries({ queryKey: queryKeys.year.form(yearId) });
    },
  });
};

export const useAddUserDay = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AddUserDayRequest) => {
      const response = await addUserDayApiV1AdminUserDayAddPost({
        body: data,
        throwOnError: true,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.userDays.all(),
      });
      // Also invalidate assignments for the specific day
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.assignments.day(variables.day_id),
      });
    },
  });
};

export const useEditUserDay = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userDayId,
      data,
    }: {
      userDayId: string | number;
      data: EditUserDayRequest;
    }) => {
      const response = await editPositionApiV1AdminUserDayUserDayIdEditPost({
        path: { user_day_id: Number(userDayId) },
        body: data,
        throwOnError: true,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.userDays.all(),
      });
      // Invalidate all assignment queries since we don't know which day this affects
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.assignments.all(),
      });
    },
  });
};

export const useDeleteUserDay = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userDayId: string | number) => {
      const response = await deleteUserDayApiV1AdminUserDayUserDayIdDelete({
        path: { user_day_id: Number(userDayId) },
        throwOnError: true,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.userDays.all(),
      });
      // Invalidate all assignment queries since we don't know which day this affects
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.assignments.all(),
      });
    },
  });
};

// Query hooks
export const useUsersList = (yearId: string | number) => {
  return useQuery({
    queryKey: queryKeys.admin.users.list(yearId),
    queryFn: async () => {
      const response = await getUsersListApiV1AdminYearYearIdUsersGet({
        path: { year_id: Number(yearId) },
        throwOnError: true,
      });
      return response.data;
    },
  });
};

export const useAllUsers = () => {
  return useQuery({
    queryKey: queryKeys.admin.users.allUsers(),
    queryFn: async () => {
      const response = await getAllUsersApiV1AdminUserGet({
        throwOnError: true,
      });
      return response.data;
    },
  });
};

export const useUser = (userId: string | number) => {
  return useQuery({
    queryKey: queryKeys.admin.users.detail(userId),
    queryFn: async () => {
      const response = await getUserByIdApiV1AdminUserUserIdGet({
        path: { user_id: Number(userId) },
        throwOnError: true,
      });
      return response.data;
    },
    enabled: !!userId,
  });
};

export const useEditUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      data,
    }: {
      userId: string | number;
      data: EditUserRequest;
    }) => {
      const response = await editUserApiV1AdminUserUserIdEditPost({
        path: { user_id: Number(userId) },
        body: data,
        throwOnError: true,
      });
      return response.data;
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.users.all(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.users.detail(userId),
      });
    },
  });
};

export const useYearPositions = (yearId: string | number) => {
  return useQuery({
    queryKey: queryKeys.admin.positions.year(yearId),
    queryFn: async () => {
      const response = await getYearPositionsApiV1AdminYearYearIdPositionsGet({
        path: { year_id: Number(yearId) },
        throwOnError: true,
      });
      return response.data;
    },
    enabled: !!yearId,
  });
};

export const useYearHalls = (yearId: string | number) => {
  return useQuery({
    queryKey: queryKeys.admin.halls.year(yearId),
    queryFn: async () => {
      const response = await getYearHallsApiV1AdminHallYearYearIdGet({
        path: { year_id: Number(yearId) },
        throwOnError: true,
      });
      return response.data;
    },
    enabled: !!yearId,
  });
};

export const useYearDays = (yearId: string | number) => {
  return useQuery({
    queryKey: queryKeys.admin.days.year(yearId),
    queryFn: async () => {
      const response = await getYearDaysApiV1AdminDayYearYearIdGet({
        path: { year_id: Number(yearId) },
        throwOnError: true,
      });
      return response.data;
    },
    enabled: !!yearId,
  });
};

export const useAddHall = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: AddHallRequest) => {
      const response = await addHallApiV1AdminHallAddPost({
        body: data,
        throwOnError: true,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.halls.all(),
      });
    },
  });
};

export const useEditHall = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { hallId: number; data: EditHallRequest }) => {
      const response = await editHallApiV1AdminHallHallIdEditPost({
        path: { hall_id: data.hallId },
        body: data.data,
        throwOnError: true,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.halls.all(),
      });
    },
  });
};

export const useRegistrationForms = (yearId: string | number) => {
  return useQuery({
    queryKey: queryKeys.admin.registrationForms.year(yearId),
    queryFn: async () => {
      const response =
        await getRegistrationFormsApiV1AdminYearYearIdRegistrationFormsGet({
          path: { year_id: Number(yearId) },
          throwOnError: true,
        });
      return response.data;
    },
    enabled: !!yearId,
  });
};

export const useYearResults = (yearId: string | number) => {
  return useQuery({
    queryKey: queryKeys.admin.results.year(yearId),
    queryFn: async () => {
      const response = await getYearResultsApiV1AdminYearYearIdResultsGet({
        path: { year_id: Number(yearId) },
        throwOnError: true,
      });
      return response.data;
    },
    enabled: !!yearId,
  });
};

export const useDayAssignments = (dayId: string | number) => {
  return useQuery({
    queryKey: queryKeys.admin.assignments.day(dayId),
    queryFn: async () => {
      const response =
        await getDayAssignmentsApiV1AdminUserDayDayDayIdAssignmentsGet({
          path: { day_id: Number(dayId) },
          throwOnError: true,
        });
      return response.data;
    },
    enabled: !!dayId,
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Refetch on component mount
    staleTime: 0, // Always consider data stale for immediate updates
  });
};

export const useCopyAssignments = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CopyAssignmentsRequest) => {
      const response = await copyAssignmentsApiV1AdminDayCopyAssignmentsPost({
        body: data,
        throwOnError: true,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate assignments for the target day
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.assignments.day(variables.target_day_id),
      });
      // Also invalidate assignments for the source day in case it's being viewed
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.assignments.day(variables.source_day_id),
      });
    },
  });
};
