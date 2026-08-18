/**
 * AdditionalServicesSelect — Iris multi-select for the create/edit form's
 * "Additional Services" (extra charges, from the TransVirtual reference screen).
 *
 * Client-side only: ticking a row adds/removes a service label; selected services
 * render below as removable indigo pills. Composed from the @/ui primitives
 * (Popover + Checkbox + Input), mirroring the existing ActiveTasksFilterMenu
 * pattern. No backend — value is a plain string[] owned by the form.
 */
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Checkbox, Icon, Input, Popover } from '@/ui';

interface AdditionalServicesSelectProps {
  value: string[];
  onChange: (next: string[]) => void;
  options: readonly string[];
}

export function AdditionalServicesSelect({ value, onChange, options }: AdditionalServicesSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const toggle = (svc: string) =>
    onChange(value.includes(svc) ? value.filter((s) => s !== svc) : [...value, svc]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const count = value.length;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">Additional Services</span>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        align="left"
        width={340}
        trigger={
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={open}
            className={cn(
              'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-xs outline-none transition-colors',
              'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
              open && 'border-ring ring-[3px] ring-ring/50',
            )}
          >
            <span className={cn('truncate', count === 0 && 'text-muted-foreground')}>
              {count === 0 ? 'Select services…' : `${count} service${count > 1 ? 's' : ''} selected`}
            </span>
            <Icon
              name="chevronRight"
              size={15}
              className={cn('shrink-0 text-muted-foreground transition-transform', open ? '-rotate-90' : 'rotate-90')}
            />
          </button>
        }
      >
        <div className="flex flex-col">
          {/* search */}
          <div className="border-b border-border p-2">
            <Input
              autoFocus
              icon={<Icon name="search" size={15} />}
              placeholder="Search services"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* options */}
          <div className="max-h-[240px] overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">No services match “{query}”.</p>
            ) : (
              filtered.map((svc) => (
                <label
                  key={svc}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted"
                >
                  <Checkbox checked={value.includes(svc)} onChange={() => toggle(svc)} />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{svc}</span>
                </label>
              ))
            )}
          </div>

          {/* footer */}
          <div className="flex items-center justify-between border-t border-border px-3 py-2">
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{count} selected</span>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => onChange([])} disabled={count === 0}>
                Clear all
              </Button>
              <Button variant="utility" size="sm" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      </Popover>

      {/* selected chips */}
      {count > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {value.map((svc) => (
            <span
              key={svc}
              className="inline-flex h-[22px] items-center gap-1 rounded-full border border-primary/25 bg-primary/10 pl-2.5 pr-1 text-xs font-semibold text-primary"
            >
              <span className="max-w-[180px] truncate">{svc}</span>
              <button
                type="button"
                aria-label={`Remove ${svc}`}
                onClick={() => toggle(svc)}
                className="grid size-4 shrink-0 place-items-center rounded-full text-primary/70 transition-colors hover:bg-primary/20 hover:text-primary"
              >
                <Icon name="x" size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
