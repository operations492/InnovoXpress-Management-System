import { useState, type ReactNode } from 'react';
import { Button, Icon, Input, Modal, Switch } from '@/ui';
import { useToast } from '@/components/Toast';
import { nowLabel } from '@/domain/format';
import { nextZoneColor, type Zone } from '@/domain/serviceZone';
import { useServiceZonesStore } from '@/store/ServiceZonesProvider';
import { ColorSwatchPicker } from './ColorSwatchPicker';

interface Props {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  zone: Zone | null;
  bookId: string;
  existingCount: number;
  onOpenImport: () => void;
}

/** New Zone (core fields + Import) / Edit Zone (adds Advanced + Color). */
export function ZoneFormDialog({ open, onClose, mode, zone, bookId, existingCount, onOpenImport }: Props) {
  const store = useServiceZonesStore();
  const { flash } = useToast();

  const [name, setName] = useState(zone?.name ?? '');
  const [aka, setAka] = useState(zone?.aka ?? '');
  const [shortName, setShortName] = useState(zone?.shortName ?? '');
  const [color, setColor] = useState(zone?.color ?? nextZoneColor(existingCount));
  const [locationName, setLocationName] = useState(zone?.locationName ?? '');
  const [address1, setAddress1] = useState(zone?.address1 ?? '');
  const [address2, setAddress2] = useState(zone?.address2 ?? '');
  const [suburb, setSuburb] = useState(zone?.suburb ?? '');
  const [phone, setPhone] = useState(zone?.phone ?? '');
  const [email, setEmail] = useState(zone?.email ?? '');
  const [timeZone, setTimeZone] = useState(zone?.timeZone ?? '');
  const [silentZone, setSilentZone] = useState(zone?.silentZone ?? false);

  const valid = name.trim().length > 0;

  const save = () => {
    if (!valid) return;
    const common = {
      name: name.trim(),
      aka: aka.trim(),
      shortName: shortName.trim(),
      color,
      locationName,
      address1,
      address2,
      suburb,
      phone,
      email,
      timeZone,
      silentZone,
    };
    if (mode === 'edit' && zone) {
      store.updateZone(zone.id, common);
      flash('Zone updated');
    } else {
      store.addZone({
        bookId,
        ...common,
        postcodeRanges: [],
        suburbIds: [],
        polygon: null,
        createdBy: 'You',
        createdAt: nowLabel(),
      });
      flash('Zone created');
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={560}
      title={mode === 'edit' ? `Edit zone — ${zone?.name ?? ''}` : 'New Zone'}
      footer={
        <div className="flex items-center gap-2">
          {mode === 'create' && (
            <Button variant="utility" size="sm" leadingIcon={<Icon name="upload" size={15} />} onClick={onOpenImport}>
              Import Zones
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" disabled={!valid} onClick={save}>
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Zone Name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Toronto" />
          </Field>
          <Field label="Zone Short Name">
            <Input value={shortName} onChange={(e) => setShortName(e.target.value)} placeholder="e.g. TOR" />
          </Field>
        </div>
        <Field label="Other Names (AKA)">
          <Input value={aka} onChange={(e) => setAka(e.target.value)} placeholder="Alternate names" />
        </Field>

        {mode === 'edit' && (
          <>
            <Divider label="Color" />
            <ColorSwatchPicker value={color} onChange={setColor} />

            <Divider label="Advanced" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Location Name">
                <Input value={locationName} onChange={(e) => setLocationName(e.target.value)} />
              </Field>
              <Field label="Time Zone">
                <Input value={timeZone} onChange={(e) => setTimeZone(e.target.value)} placeholder="America/Toronto" />
              </Field>
              <Field label="Address 1">
                <Input value={address1} onChange={(e) => setAddress1(e.target.value)} />
              </Field>
              <Field label="Address 2">
                <Input value={address2} onChange={(e) => setAddress2(e.target.value)} />
              </Field>
              <Field label="Suburb">
                <Input value={suburb} onChange={(e) => setSuburb(e.target.value)} />
              </Field>
              <Field label="Location Phone">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
              <Field label="Location Email">
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
            </div>
            <label className="flex items-center gap-2">
              <Switch checked={silentZone} onChange={(e) => setSilentZone(e.target.checked)} />
              <span className="text-[13px] text-foreground">
                Silent Zone <span className="text-muted-foreground">(hidden from mobile device selection)</span>
              </span>
            </label>
          </>
        )}
      </div>
    </Modal>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">
        {label}
        {required && <span style={{ color: 'var(--status-danger)' }}> *</span>}
      </span>
      {children}
    </label>
  );
}
