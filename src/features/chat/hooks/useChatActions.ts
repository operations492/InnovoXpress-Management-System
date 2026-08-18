import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import type { ChatConversationDto, ChatMessageDto } from '@/lib/api';
import {
  useAddMembers,
  useCreateSpace,
  useLeaveConversation,
  useOpenDirect,
  useRemoveMember,
  useSendAttachment,
  useSendMessage,
  useUpdateSpace,
} from './useChatQueries';

/**
 * The toast layer. Mutations themselves are toast-free; these fire only once
 * the server has answered, matching the useUserActions / UsersProvider split.
 *
 * Every action resolves to `null` on failure rather than throwing, so callers
 * can simply check the result instead of wrapping each call in try/catch.
 */

function reason(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unknown error';
}

export function useChatActions() {
  const { flash } = useToast();

  const send = useSendMessage();
  const sendFile = useSendAttachment();
  const openDirect = useOpenDirect();
  const createSpace = useCreateSpace();
  const updateSpace = useUpdateSpace();
  const addMembers = useAddMembers();
  const removeMember = useRemoveMember();
  const leave = useLeaveConversation();

  return {
    /** Sending is the hot path — no success toast, the bubble is the feedback. */
    sendMessage: async (id: string, body: string): Promise<ChatMessageDto | null> => {
      try {
        return await send.mutateAsync({ id, body });
      } catch (e) {
        flash(`Could not send: ${reason(e)}`);
        return null;
      }
    },
    sending: send.isPending,

    sendFile: async (id: string, file: File, body: string): Promise<ChatMessageDto | null> => {
      try {
        return await sendFile.mutateAsync({ id, file, body });
      } catch (e) {
        flash(`Could not send ${file.name}: ${reason(e)}`);
        return null;
      }
    },
    uploading: sendFile.isPending,

    // 201-vs-200 is invisible to the request layer, so this reads the same
    // whether the conversation was just created or already existed.
    openDirect: async (userId: string): Promise<ChatConversationDto | null> => {
      try {
        return await openDirect.mutateAsync(userId);
      } catch (e) {
        flash(`Could not open that conversation: ${reason(e)}`);
        return null;
      }
    },

    createSpace: async (payload: {
      name: string;
      description?: string;
      userIds?: string[];
    }): Promise<ChatConversationDto | null> => {
      try {
        const space = await createSpace.mutateAsync(payload);
        flash(`Created ${space.name}`);
        return space;
      } catch (e) {
        flash(`Could not create the space: ${reason(e)}`);
        return null;
      }
    },

    renameSpace: async (id: string, name: string): Promise<ChatConversationDto | null> => {
      try {
        const space = await updateSpace.mutateAsync({ id, payload: { name } });
        flash('Space renamed');
        return space;
      } catch (e) {
        flash(`Could not rename: ${reason(e)}`);
        return null;
      }
    },

    addMembers: async (id: string, userIds: string[]): Promise<ChatConversationDto | null> => {
      try {
        const space = await addMembers.mutateAsync({ id, userIds });
        flash(userIds.length === 1 ? 'Added to the space' : `Added ${userIds.length} people`);
        return space;
      } catch (e) {
        flash(`Could not add: ${reason(e)}`);
        return null;
      }
    },

    removeMember: async (id: string, userId: string): Promise<ChatConversationDto | null> => {
      try {
        const space = await removeMember.mutateAsync({ id, userId });
        flash('Removed from the space');
        return space;
      } catch (e) {
        flash(`Could not remove: ${reason(e)}`);
        return null;
      }
    },

    leave: async (id: string): Promise<boolean> => {
      try {
        await leave.mutateAsync(id);
        flash('You left the space');
        return true;
      } catch (e) {
        flash(`Could not leave: ${reason(e)}`);
        return false;
      }
    },
  };
}
