import { cn } from '@/lib/utils';
import { ZONE_COLORS } from '@/domain/serviceZone';

interface Props {
  value: string;
  onChange: (hex: string) => void;
  size?: number;
}

/** Fixed categorical palette (master.md §12). Selected swatch gets a focus ring. */
export function ColorSwatchPicker({ value, onChange, size = 26 }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {ZONE_COLORS.map((c) => {
        const active = c.hex.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={c.hex}
            type="button"
            title={c.name}
            aria-label={c.name}
            aria-pressed={active}
            onClick={() => onChange(c.hex)}
            className={cn(
              'rounded-md border border-border transition-transform',
              active ? 'ring-2 ring-ring ring-offset-2 ring-offset-card' : 'hover:scale-110',
            )}
            style={{ backgroundColor: c.hex, width: size, height: size }}
          />
        );
      })}
    </div>
  );
}
