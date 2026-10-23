import { useEffect, type ChangeEvent, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import type { Client } from '@/domain/client';
import { canEditCode } from '@/domain/client';
import type { CreateClientPayload, UpdateClientPayload } from '@/lib/api';
import { Button, Input, Modal, Textarea } from '@/ui';
import { AddressField } from '@/features/tasks/components/AddressAutocomplete';

import { addressFromForm, formFromClient, sameAddress } from '../clientAddress';
import { clientFormSchema, EMPTY_CLIENT_FORM, hasAddress, type ClientFormValues } from '../clientSchema';

/**
 * Create or edit a client.
 *
 * The address is edited through the same picker the consignment form uses, so a
 * client's billing address is pinned exactly the way an order's is — and for the
 * same reason: the coordinate is what routing runs on. The picker owns line 1,
 * city, province and postcode; the four fields it has no notion of (contact,
 * phone, email, instructions) sit beside it and travel in the same value object.
 */

interface ClientFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  client: Client | null;
  onClose: () => void;
  onCreate: (payload: CreateClientPayload) => Promise<unknown>;
  onUpdate: (id: string, patch: UpdateClientPayload) => Promise<unknown>;
}

export function ClientFormDialog({
  open,
  mode,
  client,
  onClose,
  onCreate,
  onUpdate,
}: ClientFormDialogProps) {
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: EMPTY_CLIENT_FORM,
  });
  const { watch, setValue, handleSubmit, reset, formState } = form;
  const { errors, isSubmitting } = formState;
  const v = watch();

  // Re-seed whenever the dialog opens on a different client.
  useEffect(() => {
    if (open) reset(formFromClient(client));
  }, [open, client, reset]);

  const text = (name: keyof ClientFormValues) => ({
    value: String(v[name] ?? ''),
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValue(name, e.target.value as never, { shouldDirty: true }),
  });

  /** The server upper-cases it anyway; doing it here means what you see is what gets stamped. */
  const codeField = {
    value: v.code,
    onChange: (e: ChangeEvent<HTMLInputElement>) =>
      setValue('code', e.target.value.toUpperCase(), { shouldDirty: true }),
  };

  const codeLocked = mode === 'edit' && client !== null && !canEditCode(client);

  const clearAddress = () => {
    for (const k of [
      'contactName',
      'phone',
      'email',
      'line1',
      'city',
      'province',
      'postcode',
      'instructions',
    ] as const) {
      setValue(k, '', { shouldDirty: true });
    }
    setValue('lat', null, { shouldDirty: true });
    setValue('lng', null, { shouldDirty: true });
  };

  const submit = handleSubmit(async (values) => {
    const address = addressFromForm(values);

    if (mode === 'create') {
      const created = await onCreate({
        name: values.name,
        code: values.code,
        ...(address ? { address } : {}),
      });
      if (created) onClose();
      return;
    }

    if (!client) return;

    // Send only what changed — the API refuses an empty patch, and the address
    // is replaced wholesale, so it goes as a whole object or as an explicit null.
    const patch: UpdateClientPayload = {};
    if (values.name !== client.name) patch.name = values.name;
    if (values.code !== client.code) patch.code = values.code;
    if (!sameAddress(address, client.address)) patch.address = address;

    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }

    const saved = await onUpdate(client.id, patch);
    if (saved) onClose();
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={620}
      title={mode === 'create' ? 'New client' : `Edit ${client?.name ?? 'client'}`}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="utility" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={isSubmitting}>
            {mode === 'create' ? 'Create client' : 'Save changes'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <Section title="Identity">
          <div className="grid grid-cols-[1fr_160px] gap-2.5">
            <Field label="Name" required error={errors.name?.message}>
              <Input placeholder="Client name" {...text('name')} />
            </Field>
            <Field
              label="Code"
              required
              error={errors.code?.message}
              hint={
                codeLocked
                  ? 'Stamped into existing order numbers'
                  : '2-6 letters or digits'
              }
            >
              <Input
                placeholder="DRZ"
                inputStyle={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}
                disabled={codeLocked}
                {...codeField}
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Billing address"
          action={
            hasAddress(v) ? (
              <button
                type="button"
                onClick={clearAddress}
                className="text-[11px] text-muted-foreground underline-offset-2 hover:text-danger hover:underline"
              >
                Remove address
              </button>
            ) : null
          }
        >
          <p className="text-[11px] text-muted-foreground">
            Optional. When set, picking this client on a consignment prefills the sender.
          </p>

          <AddressField
            label="Billing address"
            tone="pickup"
            value={{
              line1: v.line1,
              province: v.province,
              city: v.city,
              postcode: v.postcode,
              lat: v.lat,
              lng: v.lng,
            }}
            onSave={(a) => {
              setValue('line1', a.line1, { shouldDirty: true });
              setValue('province', a.province, { shouldDirty: true });
              setValue('city', a.city, { shouldDirty: true });
              setValue('postcode', a.postcode, { shouldDirty: true });
              setValue('lat', a.lat, { shouldDirty: true });
              setValue('lng', a.lng, { shouldDirty: true });
            }}
          />
          {errors.line1?.message && (
            <span role="alert" className="text-[11px] text-danger">
              {errors.line1.message}
            </span>
          )}

          <div className="grid grid-cols-3 gap-2.5">
            <Field label="Contact name" error={errors.contactName?.message}>
              <Input placeholder="Who to ask for" {...text('contactName')} />
            </Field>
            <Field label="Phone" error={errors.phone?.message}>
              <Input placeholder="416 555 0134" {...text('phone')} />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <Input placeholder="dock@example.com" {...text('email')} />
            </Field>
          </div>

          <Field label="Pickup instructions" error={errors.instructions?.message}>
            <Textarea
              rows={2}
              placeholder="Loading bay at the rear, buzz 04"
              {...text('instructions')}
            />
          </Field>
        </Section>
      </div>
    </Modal>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {required && (
          <>
            <span aria-hidden className="ml-0.5 text-danger">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        )}
      </span>
      {children}
      {hint && !error && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      {error && (
        <span role="alert" className="text-[11px] text-danger">
          {error}
        </span>
      )}
    </label>
  );
}
