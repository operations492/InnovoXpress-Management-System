/**
 * Shared create/edit form. RHF-controlled — NO document.querySelector.
 *
 * Laid out as a **single column of grouped `Card` sections**, so it reads the
 * same way the task *detail* view does — same primitive, same grouping
 * vocabulary — and fits a normal-width popup rather than a full-bleed panel.
 * Sender and Receiver are stacked with an identical field order, so the two legs
 * of a job mirror each other top to bottom.
 *
 * Every row inside a card is a plain `grid-cols-2` with **no `md:` variant on
 * purpose**: Tailwind breakpoints track the viewport, not the container, so a
 * `md:grid-cols-4` row would still fire inside a 700px dialog on a wide screen
 * and cram four controls into half the space they need.
 *
 * **City, province and postal code are deliberately NOT here.** They live only
 * inside the address picker, next to the map. Having them in both places meant
 * an operator could retype the city while the coordinate stayed where the last
 * search left it — a perfectly valid pin pointing at the previous address, which
 * nothing downstream can detect. One editor, with the pin visible in it, is what
 * makes the text and the coordinate physically unable to disagree. The summary
 * line under each address button shows all three read-only.
 *
 * **The Logistics card is gone.** Crew, Driver, Handling, Additional services,
 * COD and Delivery fee had no backend column between them — they were rendered,
 * never persisted — and they were sitting on top of the four scheduling windows,
 * which are the only fields in that area the database actually stores. The
 * windows now have their own Schedule card and the inert controls are not shown.
 * A driver is assigned through the assign picker, which posts a driver id.
 *
 * Field *keys* are unchanged from the schema; only labels + arrangement follow
 * the Iris vocabulary. The items grid is injected full-width below via
 * `itemsSlot` (real composition).
 */
import type { ChangeEvent, ReactNode } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Card, Checkbox, Input, Select, Textarea } from '@/ui';
import type { TaskFormValues } from '@/domain/schemas';
import { NO_CLIENT } from '@/domain/schemas';
import { MERCHANT_OPTIONS } from '@/fixtures/reference';
import { AddressField } from './AddressAutocomplete';
import { DateTimeField } from './DateTimeField';

/**
 * One option, deliberately.
 *
 * Every consignment here is a collection followed by a drop — the eight-state
 * lifecycle and the two POD legs both say so — and the old Delivery/Pickup split
 * was decorative: nothing in the backend ever branched on it, and a "Pickup" task
 * still demanded a receiver and still ended at DELIVERED.
 *
 * The Select stays rather than becoming a static label so that older orders,
 * which really do carry the retired values, still render their own type when
 * opened for editing.
 */
const TYPE_OPTIONS = [{ value: 'Pickup & Delivery', label: 'Pickup & Delivery' }];
const PRIORITY_OPTIONS = ['Normal', 'High', 'Low'];


function Field({
  label,
  required,
  children,
}: {
  label?: string;
  /** Marks the field the backend will reject if left empty. */
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      {label && (
        <span className="text-xs font-medium text-muted-foreground">
          {label}
          {required && (
            // aria-hidden + a real word for screen readers: an asterisk alone is
            // announced as "star" or skipped entirely.
            <>
              <span aria-hidden className="ml-0.5 text-danger">
                *
              </span>
              <span className="sr-only"> (required)</span>
            </>
          )}
        </span>
      )}
      {children}
    </label>
  );
}

/**
 * Card title carrying the pickup/drop hue.
 *
 * The two location cards are deliberately identical in structure, so colour is
 * the only thing telling them apart at a glance — the same cue the map uses.
 */
function LegTitle({ label, drop }: { label: string; drop?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={drop ? 'size-2 rounded-full bg-cyan' : 'size-2 rounded-full bg-primary'} />
      {label}
    </span>
  );
}

/**
 * The later of two "YYYY-MM-DD h:mm AM/PM" stamps.
 *
 * Compared as DATES, never as strings: "9:00 AM" and "10:00 AM" sort the wrong
 * way round lexically, because "1" precedes "9".
 */
function laterOf(a: string, b: string): string {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (Number.isNaN(da)) return b;
  if (Number.isNaN(db)) return a;
  return da >= db ? a : b;
}

const Two = ({ children }: { children: ReactNode }) => <div className="grid grid-cols-2 gap-2.5">{children}</div>;

/** Vertical rhythm inside a Card — one place to change the density. */
const Stack = ({ children }: { children: ReactNode }) => <div className="flex flex-col gap-2.5">{children}</div>;

interface TaskFormProps {
  form: UseFormReturn<TaskFormValues>;
  itemsSlot?: ReactNode;
  /** Real client names from the API. Falls back to the fixture list if absent. */
  clientOptions?: readonly string[];
}

export function TaskForm({ form, itemsSlot, clientOptions }: TaskFormProps) {
  // Real clients when the API has answered, the fixture list until then.
  const clients = clientOptions?.length ? [NO_CLIENT, ...clientOptions] : MERCHANT_OPTIONS;

  const { watch, setValue } = form;
  const v = watch();

  const text = (name: keyof TaskFormValues) => ({
    value: String(v[name] ?? ''),
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setValue(name, e.target.value as never, { shouldDirty: true }),
  });

  return (
    <div className="flex flex-col gap-4">
      {/* -------- Shipment -------- */}
      <Card title="Shipment">
        <Stack>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Type">
              <Select options={TYPE_OPTIONS} {...text('taskType')} />
            </Field>
            <Field label="Priority">
              <Select options={PRIORITY_OPTIONS} {...text('priority')} />
            </Field>
            <Field label="Client" required>
              <Select options={clients} {...text('merchant')} />
            </Field>
            <Field label="Reference">
              <Input placeholder="e.g. Purolator #" {...text('externalId')} />
            </Field>
          </div>
          <Field label="Note">
            <Textarea placeholder="Anything the driver should know" {...text('description')} />
          </Field>
        </Stack>
      </Card>

      {/* -------- Sender / pickup -------- */}
      <Card title={<LegTitle label="Sender · pickup" />}>
        <Stack>
          <Two>
            <Field label="Name" required>
              <Input placeholder="Sender name" {...text('requester')} />
            </Field>
            <Field label="Phone">
              <Input placeholder="Phone" {...text('requesterPhone')} />
            </Field>
          </Two>
          <Field label="Email">
            <Input placeholder="Email address" {...text('requesterEmail')} />
          </Field>
          <AddressField
            label="Pickup address"
            tone="pickup"
            value={{
              line1: v.dispatchAddress,
              province: v.dispatchProvince,
              city: v.dispatchCity,
              postcode: v.dispatchPostcode,
              lat: v.dispatchLat,
              lng: v.dispatchLng,
            }}
            onSave={(a) => {
              setValue('dispatchAddress', a.line1, { shouldDirty: true });
              setValue('dispatchProvince', a.province, { shouldDirty: true });
              setValue('dispatchCity', a.city, { shouldDirty: true });
              setValue('dispatchPostcode', a.postcode, { shouldDirty: true });
              setValue('dispatchLat', a.lat, { shouldDirty: true });
              setValue('dispatchLng', a.lng, { shouldDirty: true });
            }}
          />
          <Two>
            <Field label="Suite / floor">
              <Input placeholder="Unit / dock" {...text('dispatchBuilding')} />
            </Field>
            <Field label="Instructions">
              <Input placeholder="Pickup instructions" {...text('dispatchNotes')} />
            </Field>
          </Two>
        </Stack>
      </Card>

      {/* -------- Receiver / drop -------- */}
      <Card title={<LegTitle label="Receiver · drop" drop />}>
        <Stack>
          <Two>
            <Field label="Name" required>
              <Input placeholder="Receiver name" {...text('recipient')} />
            </Field>
            <Field label="Phone">
              <Input placeholder="Phone" {...text('recipientPhone')} />
            </Field>
          </Two>
          <div className="grid grid-cols-[1fr_auto] items-end gap-2.5">
            <Field label="Email">
              <Input placeholder="Email address" {...text('recipientEmail')} />
            </Field>
            <div className="pb-2">
              <Checkbox
                label="Notify"
                checked={v.notification}
                onChange={(e) => setValue('notification', e.target.checked, { shouldDirty: true })}
              />
            </div>
          </div>
          <AddressField
            label="Drop address"
            tone="drop"
            value={{
              line1: v.dest,
              province: v.destProvince,
              city: v.destCity,
              postcode: v.destPostcode,
              lat: v.destLat,
              lng: v.destLng,
            }}
            onSave={(a) => {
              setValue('dest', a.line1, { shouldDirty: true });
              setValue('destProvince', a.province, { shouldDirty: true });
              setValue('destCity', a.city, { shouldDirty: true });
              setValue('destPostcode', a.postcode, { shouldDirty: true });
              setValue('destLat', a.lat, { shouldDirty: true });
              setValue('destLng', a.lng, { shouldDirty: true });
            }}
          />
          <Two>
            <Field label="Suite / floor">
              <Input placeholder="Suite / floor" {...text('destBuilding')} />
            </Field>
            <Field label="Leave at / note">
              <Input placeholder="Leave at / note" {...text('destNotes')} />
            </Field>
          </Two>
        </Stack>
      </Card>

      {/* -------- Schedule -------- */}
      {/*
        `overflow: visible` is required, not cosmetic. shadcn's Card carries
        `overflow-hidden`, which clipped the date panel to the card's own bottom
        edge — the calendar appeared as a header and a row of weekday initials
        with the days themselves sliced off.
      */}
      <Card title="Schedule" style={{ overflow: 'visible' }}>
        <Stack>
          {/*
            The four windows own a card of their own rather than sharing one with
            unrelated controls. They are the only fields here backed by NOT NULL
            columns, they are ordered against each other by three database CHECK
            constraints, and an operator reads them as one block — pickup opens,
            pickup closes, delivery opens, delivery closes.
          */}
          <Two>
            <DateTimeField
              label="Pickup after"
              value={String(v.pickupAfter ?? '')}
              onChange={(next) => setValue('pickupAfter', next, { shouldDirty: true })}
            />
            <DateTimeField
              label="Pickup before"
              notBefore={String(v.pickupAfter ?? '')}
              value={String(v.pickupBefore ?? '')}
              onChange={(next) => setValue('pickupBefore', next, { shouldDirty: true })}
            />
          </Two>
          <Two>
            <DateTimeField
              label="Deliver after"
              value={String(v.deliverAfter ?? '')}
              onChange={(next) => setValue('deliverAfter', next, { shouldDirty: true })}
            />
            <DateTimeField
              label="Deliver before"
              notBefore={laterOf(String(v.deliverAfter ?? ''), String(v.pickupAfter ?? ''))}
              value={String(v.deliverBefore ?? '')}
              onChange={(next) => setValue('deliverBefore', next, { shouldDirty: true })}
            />
          </Two>
        </Stack>
      </Card>

      {/* -------- Items (full width) -------- */}
      {itemsSlot}
    </div>
  );
}
