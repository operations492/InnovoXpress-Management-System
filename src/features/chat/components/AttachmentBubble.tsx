import { Button, Icon } from '@/ui';
import type { ChatMessageDto } from '@/lib/api';
import { useAttachmentLinks } from '../hooks/useChatQueries';

type Attachment = NonNullable<ChatMessageDto['attachment']>;

interface Props {
  conversationId: string;
  messageId: string;
  attachment: Attachment;
}

function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * One file on a message.
 *
 * Links are minted on demand rather than carried on the message, because a
 * signed URL expires — so this fetches them itself. Only images fetch eagerly
 * (they need a preview); everything else waits for a click, which keeps a
 * thread full of documents to zero extra requests.
 */
export function AttachmentBubble({ conversationId, messageId, attachment }: Props) {
  const links = useAttachmentLinks(conversationId, messageId, attachment.isImage);

  const download = async () => {
    // `refetch` works on a disabled query, which is what the non-image path is.
    const data = links.data ?? (await links.refetch()).data;
    if (data) window.open(data.downloadUrl, '_blank', 'noopener,noreferrer');
  };

  if (attachment.isImage && links.data?.previewUrl) {
    return (
      <button
        type="button"
        onClick={() => void download()}
        title={`${attachment.name} · ${readableSize(attachment.bytes)}`}
        className="block overflow-hidden rounded-xl border transition-opacity hover:opacity-90"
      >
        <img
          src={links.data.previewUrl}
          alt={attachment.name}
          className="max-h-60 max-w-full object-cover"
        />
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2">
      <Icon name="note" size={18} />
      <span className="min-w-0">
        <span className="block max-w-48 truncate text-sm text-foreground">{attachment.name}</span>
        <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          {readableSize(attachment.bytes)}
          {attachment.isImage && links.isFetching ? ' · loading' : ''}
        </span>
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => void download()}
        disabled={links.isFetching}
        aria-label={`Download ${attachment.name}`}
        leadingIcon={<Icon name="download" size={15} />}
      >
        Download
      </Button>
    </span>
  );
}
