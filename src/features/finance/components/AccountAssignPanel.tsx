import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Checkbox, Icon, Input } from '@/ui';
import { accountsForScope, type Account, type LevyScope } from '@/domain/rateLevy';

interface Props {
  scope: LevyScope;
  accounts: Account[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

/** Collapsible M:N assignment of customers/suppliers to a levy card. */
export function AccountAssignPanel({ scope, accounts, selectedIds, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const label = scope === 'customer' ? 'Customers' : 'Suppliers';
  const scoped = accountsForScope(accounts, scope);
  const filtered = scoped.filter((a) => a.name.toLowerCase().includes(q.trim().toLowerCase()));

  const toggle = (id: string) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);

  return (
    <div className="overflow-hidden rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 bg-muted px-3 py-2 text-left"
      >
        <Icon
          name="chevronRight"
          size={14}
          className={cn('text-muted-foreground transition-transform', open && 'rotate-90')}
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          Assigned {label}
        </span>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">{selectedIds.length}</span>
      </button>
      {open && (
        <div className="space-y-2 p-3">
          <Input
            icon={<Icon name="search" size={14} />}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Filter ${label.toLowerCase()}…`}
          />
          <div className="max-h-48 space-y-0.5 overflow-auto">
            {filtered.map((a) => (
              <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
                <Checkbox checked={selectedIds.includes(a.id)} onChange={() => toggle(a.id)} />
                <span className="text-[13px] text-foreground">{a.name}</span>
              </label>
            ))}
            {filtered.length === 0 && (
              <div className="px-2 py-3 text-center text-[12px] text-muted-foreground">
                No {label.toLowerCase()} match.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
