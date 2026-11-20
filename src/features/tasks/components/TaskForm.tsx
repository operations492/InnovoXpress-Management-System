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
 * **The Logistics card is gone.** Crew, Driver, Handling, COD and Delivery fee
 * had no backend column between them — they were rendered, never persisted —
 * and they were sitting on top of the four scheduling windows,
 * which are the only fields in that area the database actually stores. The
 * windows now have their own Schedule card and the inert controls are not shown.
 * A driver is assigned through the assign picker, which posts a driver id.
 *
 * **Additional services came back**, because they are real now: they persist to
 * `consignment_services` and are priced from the customer's rate card when the
 * job is invoiced. The list is per-customer for that reason.
 *
 * Field *keys* are unchanged from the schema; only labels + arrangement follow
 * the Iris vocabulary. The items grid is injected full-width below via
 * `itemsSlot` (real composition).
 */
import type { ChangeEvent, ReactNode } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Card, Input, Select, Textarea } from '@/ui';
import type { TaskFormValues } from '@/domain/schemas';
import type { ClientRefDto } from '@/lib/api';
import { AddressField } from './AddressAutocomplete';
import { ClientServicesField } from './ClientServicesField';
import { ServiceLevelField } from './ServiceLevelField';
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
  /**
   * Real clients from the API. Used for the Client dropdown and to find the
   * picked client's id (for its rate card's services and service levels).
   * Picking one no longer touches the sender; the address is billing-only.
   */
  clients?: readonly ClientRefDto[];
  /**
   * Active service levels as {value: id, label: name}. The select renders only
   * when this is given, so a screen that has not adopted it shows nothing new.
   */
  serviceLevelOptions?: readonly { value: string; label: string }[];
}

export function TaskForm({ form, itemsSlot, clients, serviceLevelOptions }: TaskFormProps) {
  /*
   * Real customers only. The built-in Walk-in account (code WLK) is left out
   * because "No client" already means exactly that — listing both would offer
   * two names for one choice.
   */
  const clientNames = (clients ?? []).filter((c) => c.code !== 'WLK').map((c) => c.name);

  const { watch, setValue } = form;
  const v = watch();

  const pickedClientId = clients?.find((c) => c.name === v.merchant)?.id ?? null;


  const text = (name: keyof TaskFormValues) => ({
    value: String(v[name] ?? ''),
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setValue(name, e.target.value as never, { shouldDirty: true }),
  });

  /**
   * Picking a client records who the order is for, and nothing else.
   *
   * It used to copy the client's stored address into the sender. That was taken
   * out on purpose: the pickup is often not the client's own depot, and a
   * prefilled sender was easy to save without noticing it was the wrong place.
   * The sender is now always entered for the order itself.
   */
  const pickClient = (e: ChangeEvent<HTMLSelectElement>) => {
    setValue('merchant', e.target.value, { shouldDirty: true });
  };

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
            {/*
              A real customer, or "No client". Nothing can be typed: an order
              either belongs to a customer that exists or to none, and "none" is
              filed under the built-in Walk-in account so it still gets an order
              number. A Walk-in order reopened here shows "No client", because
              that is what it is.
            */}
            <Field label="Client">
              <Select
                placeholder="No client"
                options={clientNames}
                value={clientNames.includes(v.merchant) ? v.merchant : ''}
                onChange={pickClient}
              />
            </Field>
            {serviceLevelOptions && (
              <Field label="Service level" required>
                <ServiceLevelField
                  clientId={pickedClientId}
                  options={serviceLevelOptions}
                  value={v.serviceLevelId}
                  onChange={(id) => setValue('serviceLevelId', id, { shouldDirty: true })}
                />
              </Field>
            )}
            {/*
              The client's own tracking number (the API's `clientReference`),
              unique within the client. Left blank it is NOT left empty: the server
              fills it with the order number it just allocated, so every order has
              one and nobody has to invent a format by hand.
            */}
            <Field label="External ID">
              <Input placeholder="Leave blank to use the order number" {...text('externalId')} />
            </Field>
          </div>

          {/*
            Full width, not in the two-column grid: the rows carry a name, a
            price and a badge, and half a dialog is not enough for all three.
          */}
          <ClientServicesField
            clientId={pickedClientId}
            value={v.additionalServices}
            onChange={(next) =>
              setValue('additionalServices', next, { shouldDirty: true })
            }
          />
          {/*
            Operator notes, saved as `generalNote` — the owner's decision is that
            this is for the operations team, and the new driver app will not
            render it.

            Two places still expose it today, and both need closing before it is
            truly internal: the backend's driver job payload still sends it
            (drivers.repository.ts), which the current test driver app renders;
            and the POD report PDF prints it as "Consignment Note" for the
            customer (documents.render.ts).
          */}
          <Field label="Operator notes">
            <Textarea placeholder="Internal notes for the operations team" {...text('description')} />
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
          {/*
            Saved as `senderInstructions`. Picking a client pre-fills it from the
            client's saved instructions, and the operator can change it for this
            one order without touching the client record. Clearing it clears the
            column: the sender is sent whole, and an empty box sends no value.
          */}
          <Field label="Pickup notes">
            <Textarea
              placeholder="e.g. Use loading dock 4, ring first"
              {...text('dispatchNotes')}
            />
          </Field>
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
          {/* No "Notify" box: it was never sent to the API, which has no
              notification column and no mailer. */}
          <Field label="Email">
            <Input placeholder="Email address" {...text('recipientEmail')} />
          </Field>
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
          {/*
            Saved as `receiverNotes`, and shown in the optional Destination Notes
            column on the list. Clearing it clears the column, for the same reason
            as the pickup notes above.
          */}
          <Field label="Drop notes">
            <Textarea
              placeholder="e.g. Leave with reception, call on arrival"
              {...text('destNotes')}
            />
          </Field>
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
