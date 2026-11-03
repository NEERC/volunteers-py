import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import {
  cancelMailingApiV1AdminMailingMailingIdCancelPost,
  createMailingApiV1AdminMailingYearYearIdPost,
  deleteMailingApiV1AdminMailingMailingIdDelete,
  editMailingApiV1AdminMailingMailingIdEditPost,
  getMailingApiV1AdminMailingMailingIdGet,
  getMailingsApiV1AdminMailingYearYearIdGet,
  getRecipientsApiV1AdminMailingYearYearIdRecipientsPost,
  getTemplateVariablesApiV1AdminMailingTemplateVariablesGet,
  previewMessageApiV1AdminMailingYearYearIdPreviewPost,
  resendMessagesApiV1AdminMailingMailingIdResendPost,
  startMailingApiV1AdminMailingMailingIdStartPost,
  testSendMessageApiV1AdminMailingYearYearIdTestSendPost,
} from "@/client";
import type {
  MailingDraft,
  MailingMessageResponse,
  MailingPreviewRequest,
  MailingResponse,
} from "@/client/types.gen";
import { streamEvents } from "@/utils/sse";
import { queryKeys } from "./query-keys";

export const useMailings = (yearId: string | number) =>
  useQuery({
    queryKey: queryKeys.admin.mailings.year(yearId),
    queryFn: async () => {
      const response = await getMailingsApiV1AdminMailingYearYearIdGet({
        path: { year_id: Number(yearId) },
        throwOnError: true,
      });
      return response.data.mailings;
    },
  });

export const useMailing = (mailingId: string | number) =>
  useQuery({
    queryKey: queryKeys.admin.mailings.detail(mailingId),
    queryFn: async () => {
      const response = await getMailingApiV1AdminMailingMailingIdGet({
        path: { mailing_id: Number(mailingId) },
        throwOnError: true,
      });
      return response.data;
    },
  });

export const useTemplateVariables = () =>
  useQuery({
    queryKey: queryKeys.admin.mailings.templateVariables(),
    queryFn: async () => {
      const response =
        await getTemplateVariablesApiV1AdminMailingTemplateVariablesGet({
          throwOnError: true,
        });
      return response.data.variables;
    },
    staleTime: Number.POSITIVE_INFINITY,
  });

export const useMailingRecipients = (
  yearId: string | number,
  draft: MailingDraft,
) =>
  useQuery({
    queryKey: queryKeys.admin.mailings.recipients(yearId, draft),
    queryFn: async () => {
      const response =
        await getRecipientsApiV1AdminMailingYearYearIdRecipientsPost({
          path: { year_id: Number(yearId) },
          body: draft,
          throwOnError: true,
        });
      return response.data;
    },
    placeholderData: keepPreviousData,
  });

export const useMailingPreview = (
  yearId: string | number,
  request: MailingPreviewRequest | null,
) =>
  useQuery({
    queryKey: queryKeys.admin.mailings.preview(yearId, request),
    queryFn: async () => {
      const response =
        await previewMessageApiV1AdminMailingYearYearIdPreviewPost({
          path: { year_id: Number(yearId) },
          // biome-ignore lint/style/noNonNullAssertion: enabled only with a request
          body: request!,
          throwOnError: true,
        });
      return response.data;
    },
    enabled: request !== null,
    placeholderData: keepPreviousData,
  });

const useInvalidateMailings = () => {
  const queryClient = useQueryClient();
  return (mailing: MailingResponse) => {
    queryClient.setQueryData(
      queryKeys.admin.mailings.detail(mailing.mailing_id),
      mailing,
    );
    queryClient.invalidateQueries({
      queryKey: queryKeys.admin.mailings.year(mailing.year_id),
    });
  };
};

export const useCreateMailing = () => {
  const onSuccess = useInvalidateMailings();
  return useMutation({
    mutationFn: async ({
      yearId,
      sourceMailingId,
    }: {
      yearId: string | number;
      sourceMailingId?: number;
    }) => {
      const response = await createMailingApiV1AdminMailingYearYearIdPost({
        path: { year_id: Number(yearId) },
        body: { source_mailing_id: sourceMailingId ?? null },
        throwOnError: true,
      });
      return response.data;
    },
    onSuccess,
  });
};

export const useEditMailing = () => {
  const onSuccess = useInvalidateMailings();
  return useMutation({
    mutationFn: async ({
      mailingId,
      draft,
    }: {
      mailingId: number;
      draft: MailingDraft;
    }) => {
      const response = await editMailingApiV1AdminMailingMailingIdEditPost({
        path: { mailing_id: mailingId },
        body: draft,
        throwOnError: true,
      });
      return response.data;
    },
    onSuccess,
  });
};

export const useDeleteMailing = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (mailing: MailingResponse) => {
      await deleteMailingApiV1AdminMailingMailingIdDelete({
        path: { mailing_id: mailing.mailing_id },
        throwOnError: true,
      });
      return mailing;
    },
    onSuccess: (mailing) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.mailings.year(mailing.year_id),
      });
    },
  });
};

export const useStartMailing = () => {
  const onSuccess = useInvalidateMailings();
  return useMutation({
    mutationFn: async ({
      mailingId,
      draft,
    }: {
      mailingId: number;
      draft: MailingDraft;
    }) => {
      const response = await startMailingApiV1AdminMailingMailingIdStartPost({
        path: { mailing_id: mailingId },
        body: draft,
        throwOnError: true,
      });
      return response.data;
    },
    onSuccess: (data) => onSuccess(data.mailing),
  });
};

export const useCancelMailing = () => {
  const onSuccess = useInvalidateMailings();
  return useMutation({
    mutationFn: async (mailingId: number) => {
      const response = await cancelMailingApiV1AdminMailingMailingIdCancelPost({
        path: { mailing_id: mailingId },
        throwOnError: true,
      });
      return response.data;
    },
    onSuccess,
  });
};

export const useResendMessages = () => {
  const onSuccess = useInvalidateMailings();
  return useMutation({
    mutationFn: async ({
      mailingId,
      messageIds,
    }: {
      mailingId: number;
      messageIds: number[];
    }) => {
      const response = await resendMessagesApiV1AdminMailingMailingIdResendPost(
        {
          path: { mailing_id: mailingId },
          body: { message_ids: messageIds },
          throwOnError: true,
        },
      );
      return response.data;
    },
    onSuccess,
  });
};

export const useTestSendMessage = () =>
  useMutation({
    mutationFn: async ({
      yearId,
      request,
    }: {
      yearId: string | number;
      request: MailingPreviewRequest;
    }) => {
      await testSendMessageApiV1AdminMailingYearYearIdTestSendPost({
        path: { year_id: Number(yearId) },
        body: request,
        throwOnError: true,
      });
    },
  });

type MailingEvent = {
  mailing: MailingResponse;
  messages: MailingMessageResponse[];
};

/**
 * Live state of a started mailing from its server-sent events: the first event has all
 * messages, later ones only the changed messages. `restart` follows the mailing again once
 * it's finished, e.g. after a resend.
 */
export const useMailingEvents = (mailingId: number, enabled: boolean) => {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Map<number, MailingMessageResponse>>(
    () => new Map(),
  );
  const [loaded, setLoaded] = useState(false);
  const [generation, setGeneration] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: generation restarts the stream
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    streamEvents(`/api/v1/admin/mailing/${mailingId}/events`, {
      signal: controller.signal,
      onEvent: ({ event, data }) => {
        if (event !== "update") return;
        const update = JSON.parse(data) as MailingEvent;
        queryClient.setQueryData(
          queryKeys.admin.mailings.detail(mailingId),
          update.mailing,
        );
        setMessages((previous) => {
          if (update.messages.length === 0) return previous;
          const next = new Map(previous);
          for (const message of update.messages) {
            next.set(message.message_id, message);
          }
          return next;
        });
        setLoaded(true);
      },
      onError: (error) => console.error("Mailing events failed", error),
    });
    return () => controller.abort();
  }, [mailingId, enabled, generation, queryClient]);

  const restart = useCallback(() => setGeneration((g) => g + 1), []);
  return { messages, loaded, restart };
};
