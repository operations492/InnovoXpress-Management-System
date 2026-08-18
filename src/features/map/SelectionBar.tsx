import { Button, Icon } from '@/ui';

/**
 * The bar that appears over the map once a lasso has caught something.
 *
 * Shown from ONE selected task upward rather than two: an operator who lassoed a
 * single pin has still made a selection, and hiding the controls at that point
 * looks like the drag failed.
 */
interface SelectionBarProps {
  count: number;
  /** How many of the selection are unassigned — the only ones a route can plan. */
  routable: number;
  onAssign: () => void;
  onCreateRoute: () => void;
  onClear: () => void;
  busy?: boolean;
}

export function SelectionBar({
  count,
  routable,
  onAssign,
  onCreateRoute,
  onClear,
  busy,
}: SelectionBarProps) {
  if (count === 0) return null;

  return (
    <div className="pointer-events-auto flex items-center gap-2 rounded-xl border bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
      <span className="text-sm font-semibold text-foreground tabular-nums">
        {count} selected
      </span>

      <span aria-hidden className="mx-1 h-5 w-px bg-border" />

      <Button variant="utility" size="sm" onClick={onAssign} disabled={busy}>
        <Icon name="user" size={14} />
        Assign
      </Button>

      <Button variant="utility" size="sm" onClick={onCreateRoute} disabled={busy || routable < 2}>
        <Icon name="navigation" size={14} />
        Create route
      </Button>

      <Button variant="ghost" size="sm" onClick={onClear} disabled={busy}>
        Unselect
      </Button>
    </div>
  );
}
