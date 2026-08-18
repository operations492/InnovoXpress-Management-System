import { Icon, IconButton } from '@/ui';

interface Props {
  page: number;
  pageCount: number;
  total: number;
  onPage: (p: number) => void;
}

/** Right-aligned server-style pager used by the rule tabs. */
export function Pager({ page, pageCount, total, onPage }: Props) {
  return (
    <div className="mt-auto flex items-center gap-2 px-4 py-3">
      <span className="mr-auto font-mono text-[11px] text-muted-foreground">{total} records</span>
      <IconButton size="sm" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <Icon name="chevronLeft" size={16} />
      </IconButton>
      <span className="font-mono text-[12px] text-muted-foreground">
        Page {page} of {pageCount}
      </span>
      <IconButton size="sm" aria-label="Next page" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
        <Icon name="chevronRight" size={16} />
      </IconButton>
    </div>
  );
}
