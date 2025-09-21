import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addAssessmentApiV1AdminAssessmentAddPost,
  addDayApiV1AdminDayAddPost,
  addPositionApiV1AdminPositionAddPost,
  addUserDayApiV1AdminUserDayAddPost,
  addYearApiV1AdminYearAddPost,
  editAssessmentApiV1AdminAssessmentAssessmentIdEditPost,
  editDayApiV1AdminDayDayIdEditPost,
  editPositionApiV1AdminPositionPositionIdEditPost,
  editPositionApiV1AdminUserDayUserDayIdEditPost,
  editYearApiV1AdminYearYearIdEditPost,
} from "@/client";
import type {
  AddAssessmentRequest,
  AddDayRequest,
  AddPositionRequest,
  AddUserDayRequest,
  AddYearRequest,
  EditAssessmentRequest,
  EditDayRequest,
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
      }
    },
  });
};

export const useEditPosition = () => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.positions.all(),
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
      if (variables.day_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.year.days(variables.day_id),
        });
      }
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
    },
  });
};
