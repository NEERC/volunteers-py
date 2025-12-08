import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addAssessmentApiV1AdminAssessmentAddPost,
  deleteAssessmentApiV1AdminAssessmentAssessmentIdDelete,
  editAssessmentApiV1AdminAssessmentAssessmentIdEditPost,
  getAllAttendanceApiV1AttendanceYearIdAllGet,
  getDayAssignmentsApiV1YearYearIdDaysDayIdAssignmentsGet,
  getFormYearApiV1YearYearIdGet,
  saveDayAttendanceApiV1AttendanceSavePost,
  saveFormYearApiV1YearYearIdPost,
  updateUserApiV1AuthUpdatePost,
} from "@/client";
import type {
  ApplicationFormYearSaveRequest,
  SaveDayAttendanceRequest,
  UserUpdateRequest,
} from "@/client/types.gen";
import { authStore } from "@/store/auth";
import { queryKeys } from "./query-keys";

// Year query options
export const yearFormQueryOptions = (yearId: string | number) => ({
  queryKey: queryKeys.year.form(yearId),
  queryFn: async () => {
    const response = await getFormYearApiV1YearYearIdGet({
      path: { year_id: Number(yearId) },
      throwOnError: true,
    });
    return response.data;
  },
  enabled: !!yearId,
});

// Year hooks
export const useYearForm = (yearId: string | number) => {
  return useQuery(yearFormQueryOptions(yearId));
};

export const useSaveYearForm = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      yearId,
      data,
    }: {
      yearId: string | number;
      data: ApplicationFormYearSaveRequest;
    }) => {
      await saveFormYearApiV1YearYearIdPost({
        path: { year_id: Number(yearId) },
        body: data,
        throwOnError: true,
      }); // no response expected
    },
    onSuccess: (_, { yearId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.year.form(yearId) });
    },
  });
};

export const useSaveRegistration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      yearId,
      formData,
      userData,
    }: {
      yearId: string | number;
      formData: ApplicationFormYearSaveRequest;
      userData: UserUpdateRequest;
    }) => {
      const [formResponse, userResponse] = await Promise.all([
        saveFormYearApiV1YearYearIdPost({
          path: { year_id: Number(yearId) },
          body: formData,
          throwOnError: true,
        }),
        updateUserApiV1AuthUpdatePost({
          body: userData,
          throwOnError: true,
        }),
      ]);
      return { formResponse, userResponse };
    },
    onSuccess: (_, { yearId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.year.form(yearId) });
      // Update MobX store with fresh user data (single source of truth for auth)
      authStore.fetchUser();
    },
  });
};

// Day assignments query options
export const dayAssignmentsQueryOptions = (
  yearId: string | number,
  dayId: string | number,
) => ({
  queryKey: queryKeys.year.dayAssignments(yearId, dayId),
  queryFn: async () => {
    const response =
      await getDayAssignmentsApiV1YearYearIdDaysDayIdAssignmentsGet({
        path: { year_id: Number(yearId), day_id: Number(dayId) },
        throwOnError: true,
      });
    return response.data;
  },
  enabled: !!yearId && !!dayId,
  refetchOnWindowFocus: true, // Refetch when window gains focus
  refetchOnMount: true, // Refetch on component mount
  staleTime: 0, // Always consider data stale for immediate updates
});

// Day assignments hook
export const useUserDayAssignments = (
  yearId: string | number,
  dayId: string | number,
) => {
  return useQuery(dayAssignmentsQueryOptions(yearId, dayId));
};

// Attendance query options
export const attendanceQueryOptions = (yearId: string | number) => ({
  queryKey: queryKeys.year.attendance(yearId),
  queryFn: async () => {
    const response = await getAllAttendanceApiV1AttendanceYearIdAllGet({
      path: { year_id: Number(yearId) },
      throwOnError: true,
    });
    return response.data;
  },
  enabled: !!yearId,
});

// Attendance hooks
export const useAttendance = (yearId: string | number) => {
  return useQuery(attendanceQueryOptions(yearId));
};

export const useSaveAttendance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SaveDayAttendanceRequest) => {
      await saveDayAttendanceApiV1AttendanceSavePost({
        body: data,
        throwOnError: true,
      });
    },
    onSuccess: () => {
      // Invalidate all attendance queries - we don't know the year_id from the request
      // so we invalidate all year attendance queries
      queryClient.invalidateQueries({ queryKey: ["year"] });
    },
  });
};

// Assessment hooks
export const useAddAssessment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      user_day_id: number;
      comment: string;
      value: number;
    }) => {
      await addAssessmentApiV1AdminAssessmentAddPost({
        body: data,
        throwOnError: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["year"] });
    },
  });
};

export const useEditAssessment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      assessment_id: number;
      comment?: string | null;
      value?: number | null;
    }) => {
      await editAssessmentApiV1AdminAssessmentAssessmentIdEditPost({
        path: { assessment_id: data.assessment_id },
        body: {
          comment: data.comment,
          value: data.value,
        },
        throwOnError: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["year"] });
    },
  });
};

export const useDeleteAssessment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assessmentId: number) => {
      await deleteAssessmentApiV1AdminAssessmentAssessmentIdDelete({
        path: { assessment_id: assessmentId },
        throwOnError: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["year"] });
    },
  });
};
