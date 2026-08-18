import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Input, Modal } from '@/ui';
import type { RateVersion, ServiceChargeOverride } from '@/domain/ratePlan';
import type { AdditionalService } from '@/domain/services';

interface Props {
  open: boolean;
  onClose: () => void;
  version: RateVersion;
  services: AdditionalService[];
  onSave: (charges: ServiceChargeOverride[]) => void;
}

interface Row {
  serviceId: string;
  label: string;
  rate: number | null;
  pctBase: number | null;
  minCharge: number | null;
}

const GRID = 'grid grid-cols-[1fr_90px_90px_90px] items-center gap-2';
const num = (v: string): number | null => (v.trim() === '' ? null : Number(v));
const str = (n: number | null) => (n === null ? '' : String(n));

/** Override additional-service prices for this rate version (-1 = no charge). */
export function ServiceChargesDialog({ open, onClose, version, services, onSave }: Props) {
  const [rows, setRows] = useState<Row[]>(() =>
    services
      .filter((s) => s.active)
      .map((s) => {
        const ex = version.serviceCharges.find((c) => c.serviceId === s.id);
        return {
          serviceId: s.id,
          label: s.name,
          rate: ex?.rate ?? null,
          pctBase: ex?.pctBase ?? null,
          minCharge: ex?.minCharge ?? null,
        };
      }),
  );

  const update = (serviceId: string, p: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.serviceId === serviceId ? { ...r, ...p } : r)));

  const save = () => {
    const charges: ServiceChargeOverride[] = rows
      .filter((r) => r.rate !== null || r.pctBase !== null || r.minCharge !== null)
      .map(({ serviceId, label, rate, pctBase, minCharge }) => ({ serviceId, label, rate, pctBase, minCharge }));
    onSave(charges);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={620}
      title="Service Charges"
      footer={
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Enter -1 for “no charge”.</span>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={save}>
            Save
          </Button>
        </div>
      }
    >
      <div className="overflow-hidden rounded-lg border">
        <div
          className={cn(
            GRID,
            'border-b bg-muted px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground',
          )}
        >
          <span>Service</span>
          <span>Rate ($)</span>
          <span>% of Base</span>
          <span>Min Charge</span>
        </div>
        <div className="max-h-[50vh] overflow-auto">
          {rows.map((r) => (
            <div key={r.serviceId} className={cn(GRID, 'border-b px-3 py-1.5 last:border-b-0')}>
              <span className="truncate text-[13px] text-foreground">{r.label}</span>
              <Input type="number" step={0.01} value={str(r.rate)} onChange={(e) => update(r.serviceId, { rate: num(e.target.value) })} />
              <Input type="number" step={0.01} value={str(r.pctBase)} onChange={(e) => update(r.serviceId, { pctBase: num(e.target.value) })} />
              <Input type="number" step={0.01} value={str(r.minCharge)} onChange={(e) => update(r.serviceId, { minCharge: num(e.target.value) })} />
            </div>
          ))}
          {rows.length === 0 && (
            <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">No active additional services.</div>
          )}
        </div>
      </div>
    </Modal>
  );
}
