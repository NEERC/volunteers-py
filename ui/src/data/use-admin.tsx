import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addAssessmentApiV1AdminAssessmentAddPost,
  addDayApiV1AdminDayAddPost,
  addHallApiV1AdminHallAddPost,
  addPositionApiV1AdminPositionAddPost,
  addUserDayApiV1AdminUserDayAddPost,
  addYearApiV1AdminYearAddPost,
  deleteUserDayApiV1AdminUserDayUserDayIdDelete,
  editAssessmentApiV1AdminAssessmentAssessmentIdEditPost,
  editDayApiV1AdminDayDayIdEditPost,
  editHallApiV1AdminHallHallIdEditPost,
  editPositionApiV1AdminPositionPositionIdEditPost,
  editPositionApiV1AdminUserDayUserDayIdEditPost,
  editYearApiV1AdminYearYearIdEditPost,
  getDayAssignmentsApiV1AdminUserDayDayDayIdAssignmentsGet,
  getRegistrationFormsApiV1AdminYearYearIdRegistrationFormsGet,
  getUsersListApiV1AdminYearYearIdUsersGet,
  getYearHallsApiV1AdminHallYearYearIdGet,
  getYearPositionsApiV1AdminYearYearIdPositionsGet,
} from "@/client";
import type {
  AddAssessmentRequest,
  AddDayRequest,
  AddHallRequest,
  AddPositionRequest,
  AddUserDayRequest,
  AddYearRequest,
  EditAssessmentRequest,
  EditDayRequest,
  EditHallRequest,
  EditPositionRequest,
  EditUserDayRequest,
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
        console.log("variables.year_id", variables.year_id);
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
      data,
    }: {
      dayId: string | number;
      data: EditDayRequest;
    }) => {
      const response = await editDayApiV1AdminDayDayIdEditPost({
        path: { day_id: Number(dayId) },
        body: data,
        throwOnError: true,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.days.all() });
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.positions.all(),
      });
      if (variables.year_id) {
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
    onSuccess: (_) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.positions.all(),
      });
      // Invalidate year positions queries for all years since we don't know which year this position belongs to
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.positions.all(),
        predicate: (query) => {
          return query.queryKey.includes("year");
        },
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.year.form(yearId),
      });
    },
  });
};

export const useAddAssessment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AddAssessmentRequest) => {
      const response = await addAssessmentApiV1AdminAssessmentAddPost({
        body: data,
        throwOnError: true,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.assessments.all(),
      });
    },
  });
};

export const useEditAssessment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      assessmentId,
      data,
    }: {
      assessmentId: string | number;
      data: EditAssessmentRequest;
    }) => {
      const response =
        await editAssessmentApiV1AdminAssessmentAssessmentIdEditPost({
          path: { assessment_id: Number(assessmentId) },
          body: data,
          throwOnError: true,
        });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.assessments.all(),
      });
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
  });
};
