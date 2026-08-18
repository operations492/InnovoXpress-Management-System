import { useMemo, useState } from 'react';
import { Button, Modal, Select, Switch, Textarea } from '@/ui';
import { useToast } from '@/components/Toast';
import { nowLabel } from '@/domain/format';
import { nextZoneColor, parseZonesCsv, type Zone } from '@/domain/serviceZone';
import { SUBURBS } from '@/fixtures/suburbs';
import { useServiceZonesStore } from '@/store/ServiceZonesProvider';

interface Props {
  open: boolean;
  onClose: () => void;
  bookId: string;
  bookZones: Zone[];
}

const SAMPLE =
  'Zone Name,Suburb,State,Postcode\nToronto,Toronto,ON,M4C 3C4\nToronto,Scarborough,ON,M1B 2K9\nVancouver,Vancouver,BC,V6B 2W9';
const COL_OPTS = [0, 1, 2, 3, 4, 5].map((i) => ({ value: String(i), label: `Column ${i + 1}` }));

const normPc = (s: string) => s.replace(/\s+/g, '').toUpperCase();

/** CSV import — parse 4 columns, match suburbs by postcode, create/merge zones. */
export function ImportZonesDialog({ open, onClose, bookId, bookZones }: Props) {
  const store = useServiceZonesStore();
  const { flash } = useToast();

  const [text, setText] = useState('');
  const [ignoreFirstRow, setIgnoreFirstRow] = useState(true);
  const [mZone, setMZone] = useState('0');
  const [mSub, setMSub] = useState('1');
  const [mProv, setMProv] = useState('2');
  const [mPc, setMPc] = useState('3');

  const parsed = useMemo(
    () =>
      text.trim()
        ? parseZonesCsv(text, {
            ignoreFirstRow,
            mapping: { zoneName: +mZone, suburb: +mSub, province: +mProv, postcode: +mPc },
          })
        : [],
    [text, ignoreFirstRow, mZone, mSub, mProv, mPc],
  );

  const runImport = () => {
    if (parsed.length === 0) return;
    const pcIndex = new Map(SUBURBS.map((s) => [normPc(s.postcode), s.id] as const));
    const byZone = new Map<string, Set<string>>();
    for (const row of parsed) {
      const set = byZone.get(row.zoneName) ?? new Set<string>();
      const sid = pcIndex.get(normPc(row.postcode));
      if (sid) set.add(sid);
      byZone.set(row.zoneName, set);
    }
    let created = 0;
    let colorIdx = bookZones.length;
    for (const [zoneName, ids] of byZone) {
      const existing = bookZones.find((z) => z.name.toLowerCase() === zoneName.toLowerCase());
      if (existing) {
        store.updateZone(existing.id, { suburbIds: Array.from(new Set([...existing.suburbIds, ...ids])) });
      } else {
        store.addZone({
          bookId,
          name: zoneName,
          aka: '',
          shortName: '',
          color: nextZoneColor(colorIdx++),
          locationName: '',
          address1: '',
          address2: '',
          suburb: '',
          phone: '',
          email: '',
          timeZone: '',
          silentZone: false,
          postcodeRanges: [],
          suburbIds: Array.from(ids),
          polygon: null,
          createdBy: 'You',
          createdAt: nowLabel(),
        });
        created++;
      }
    }
    flash(`Imported ${parsed.length} rows · ${created} new zone${created === 1 ? '' : 's'}`);
    setText('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={620}
      title="Import Zones (CSV)"
      footer={
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">{parsed.length} rows detected</span>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" disabled={parsed.length === 0} onClick={runImport}>
            Import
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 flex items-center justify-between text-[11.5px] font-medium text-muted-foreground">
            CSV data
            <button type="button" className="text-primary hover:underline" onClick={() => setText(SAMPLE)}>
              Paste sample
            </button>
          </span>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Zone Name,Suburb,State,Postcode"
            style={{ fontFamily: 'var(--font-mono)' }}
          />
        </label>

        <label className="flex items-center gap-2">
          <Switch checked={ignoreFirstRow} onChange={(e) => setIgnoreFirstRow(e.target.checked)} />
          <span className="text-[13px] text-foreground">Ignore first row (header)</span>
        </label>

        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            Column mapping
          </div>
          <div className="grid grid-cols-4 gap-2">
            <MapField label="Zone Name" value={mZone} onChange={setMZone} />
            <MapField label="Suburb" value={mSub} onChange={setMSub} />
            <MapField label="Province" value={mProv} onChange={setMProv} />
            <MapField label="Postcode" value={mPc} onChange={setMPc} />
          </div>
          <p className="mt-2 text-[12px] text-muted-foreground">
            Suburbs are matched to the master list by postcode; unmatched rows still create the zone but add no suburb.
          </p>
        </div>
      </div>
    </Modal>
  );
}

function MapField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>
      <Select value={value} options={COL_OPTS} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
