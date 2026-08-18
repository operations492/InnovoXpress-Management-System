/**
 * Shared create/edit form. RHF-controlled — NO document.querySelector. Laid out
 * as two columns (Shipment | Logistics) per the Iris design; the items grid is
 * injected full-width below via `itemsSlot` (real composition). Field *keys* are
 * unchanged from the schema; only labels + arrangement follow the Iris vocabulary.
 */
import type { ChangeEvent, ReactNode } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { Checkbox, Icon, Input, Select, Textarea } from '@/ui';
import type { TaskFormValues } from '@/domain/schemas';
import { NO_CLIENT } from '@/domain/schemas';
import { ADDITIONAL_SERVICES, MERCHANT_OPTIONS, REQUIREMENT_OPTIONS, TEAMS } from '@/fixtures/reference';
import { AdditionalServicesSelect } from './AdditionalServicesSelect';
import { AddressField } from './AddressAutocomplete';
import { useDrivers } from '../hooks/useDrivers';

const TYPE_OPTIONS = [
  { value: 'Delivery', label: 'Delivery' },
  { value: 'Pickup', label: 'Pickup' },
];
const PRIORITY_OPTIONS = ['Normal', 'High', 'Low'];
const NO_DRIVER = 'Driver not assigned';

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

function ColHead({ code, title }: { code: string; title: string }) {
  return (
    <div className="mb-1 flex items-center gap-2">
      <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-primary">
        {code}
      </span>
      <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );
}

function Eyebrow({ label, drop }: { label: string; drop?: boolean }) {
  return (
    <div className="mt-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
      <span className={cn('size-2 rounded-full', drop ? 'bg-cyan' : 'bg-primary')} />
      {label}
    </div>
  );
}

const Two = ({ children }: { children: ReactNode }) => <div className="grid grid-cols-2 gap-2.5">{children}</div>;

interface TaskFormProps {
  form: UseFormReturn<TaskFormValues>;
  itemsSlot?: ReactNode;
  /** Active additional-services shown in the dropdown (defaults to the full seed list). */
  additionalServiceOptions?: readonly string[];
  /** Real client names from the API. Falls back to the fixture list if absent. */
  clientOptions?: readonly string[];
}

export function TaskForm({
  form,
  itemsSlot,
  additionalServiceOptions = ADDITIONAL_SERVICES,
  clientOptions,
}: TaskFormProps) {
  // Real clients when the API has answered, the fixture list until then.
  const clients = clientOptions?.length ? [NO_CLIENT, ...clientOptions] : MERCHANT_OPTIONS;

  // Display only — assignment happens through the driver popover, which posts a
  // driver id. Nothing chosen here is sent with the consignment.
  const driverOptions = [NO_DRIVER, ...useDrivers().map((d) => d.name)];
  const { watch, setValue } = form;
  const v = watch();

  const text = (name: keyof TaskFormValues) => ({
    value: String(v[name] ?? ''),
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setValue(name, e.target.value as never, { shouldDirty: true }),
  });

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
      {/* -------- LEFT: Shipment -------- */}
      <div className="flex flex-col gap-2.5">
        <ColHead code="Ship" title="Shipment" />
        <Two>
          <Field label="Type">
            <Select options={TYPE_OPTIONS} {...text('taskType')} />
          </Field>
          <Field label="Priority">
            <Select options={PRIORITY_OPTIONS} {...text('priority')} />
          </Field>
        </Two>
        <Two>
          <Field label="Client" required>
            <Select options={clients} {...text('merchant')} />
          </Field>
          <Field label="Reference">
            <Input placeholder="e.g. Purolator #" {...text('externalId')} />
          </Field>
        </Two>
        <Field label="Note">
          <Textarea placeholder="Anything the driver should know" {...text('description')} />
        </Field>

        <Eyebrow label="Sender · pickup" />
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
            area: v.dispatchArea,
            city: v.dispatchCity,
            postcode: v.dispatchPostcode,
            lat: v.dispatchLat,
            lng: v.dispatchLng,
          }}
          onSave={(a) => {
            setValue('dispatchAddress', a.line1, { shouldDirty: true });
            setValue('dispatchArea', a.area, { shouldDirty: true });
            setValue('dispatchCity', a.city, { shouldDirty: true });
            setValue('dispatchPostcode', a.postcode, { shouldDirty: true });
            setValue('dispatchLat', a.lat, { shouldDirty: true });
            setValue('dispatchLng', a.lng, { shouldDirty: true });
          }}
        />
        <Two>
          <Field label="Area">
            <Input placeholder="Area / locality" {...text('dispatchArea')} />
          </Field>
          <Field label="City" required>
            <Input placeholder="City" {...text('dispatchCity')} />
          </Field>
        </Two>
        <Two>
          <Field label="Postcode">
            <Input placeholder="Postcode" {...text('dispatchPostcode')} />
          </Field>
          <Field label="Suite / floor">
            <Input placeholder="Unit / dock" {...text('dispatchBuilding')} />
          </Field>
        </Two>
        <Field label="Instructions">
          <Input placeholder="Pickup instructions" {...text('dispatchNotes')} />
        </Field>

        <Eyebrow label="Receiver · drop" drop />
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
            area: v.destArea,
            city: v.destCity,
            postcode: v.destPostcode,
            lat: v.destLat,
            lng: v.destLng,
          }}
          onSave={(a) => {
            setValue('dest', a.line1, { shouldDirty: true });
            setValue('destArea', a.area, { shouldDirty: true });
            setValue('destCity', a.city, { shouldDirty: true });
            setValue('destPostcode', a.postcode, { shouldDirty: true });
            setValue('destLat', a.lat, { shouldDirty: true });
            setValue('destLng', a.lng, { shouldDirty: true });
          }}
        />
        <Two>
          <Field label="Area">
            <Input placeholder="Area / locality" {...text('destArea')} />
          </Field>
          <Field label="City" required>
            <Input placeholder="City" {...text('destCity')} />
          </Field>
        </Two>
        <Two>
          <Field label="Postcode">
            <Input placeholder="Postcode" {...text('destPostcode')} />
          </Field>
          <Field label="Suite / floor">
            <Input placeholder="Suite / floor" {...text('destBuilding')} />
          </Field>
        </Two>
        <Field label="Leave at / note">
          <Input placeholder="Leave at / note" {...text('destNotes')} />
        </Field>
      </div>

      {/* -------- RIGHT: Logistics -------- */}
      <div className="flex flex-col gap-2.5">
        <ColHead code="Ops" title="Logistics" />
        <Two>
          <Field label="Ready by">
            <Input icon={<Icon name="calendar" size={15} />} placeholder="Ready by" {...text('completeAfter')} />
          </Field>
          <Field label="Deliver by">
            <Input icon={<Icon name="calendar" size={15} />} placeholder="Deliver by" {...text('completeBefore')} />
          </Field>
        </Two>
        <Two>
          <Field label="Crew">
            <Select options={TEAMS} {...text('team')} />
          </Field>
          <Field label="Driver">
            <Select options={driverOptions} {...text('driver')} />
          </Field>
        </Two>
        <Field label="Handling">
          <Select options={REQUIREMENT_OPTIONS} {...text('requirementsLabel')} />
        </Field>
        <AdditionalServicesSelect
          options={additionalServiceOptions}
          value={v.additionalServices}
          onChange={(next) => setValue('additionalServices', next, { shouldDirty: true })}
        />
        <Two>
          <Field label="COD due">
            <Input align="right" placeholder="0.00" {...text('dueAmount')} />
          </Field>
          <Field label="Delivery fee">
            <Input align="right" placeholder="0.00" {...text('shippingFee')} />
          </Field>
        </Two>
      </div>

      {/* -------- Items (full width) -------- */}
      {itemsSlot && <div className="md:col-span-2">{itemsSlot}</div>}
    </div>
  );
}
