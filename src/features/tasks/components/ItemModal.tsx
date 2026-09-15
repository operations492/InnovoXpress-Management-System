import { useEffect } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Modal } from '@/ui';
import { cn } from '@/lib/utils';
import { EMPTY_ITEM, itemFormSchema } from '@/domain/schemas';
import type { ItemFormValues } from '@/domain/schemas';
import { cubicOf } from '@/domain/derive';
import { decimal, parseOptionalNumber } from '@/domain/format';

interface ItemModalProps {
  open: boolean;
  editing: boolean;
  initial: ItemFormValues | null;
  onClose: () => void;
  onSaveClose: (values: ItemFormValues) => void;
  onSaveAnother: (values: ItemFormValues) => void;
}

function Field({
  label,
  required,
  error,
  grow = true,
  children,
}: {
  label: string;
  /** Marks a field the order cannot be saved without. */
  required?: boolean;
  error?: string;
  grow?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={cn('flex flex-col gap-1', grow && 'flex-1')}>
      <span className="t-form-label text-foreground">
        {label}
        {required && (
          <>
            {/* An asterisk alone is announced as "star" or skipped, so pair it
                with a real word for screen readers. */}
            <span aria-hidden className="ml-0.5 text-danger">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        )}
      </span>
      {children}
      {error && (
        <span role="alert" className="text-[11px] text-danger">
          {error}
        </span>
      )}
    </label>
  );
}

export function ItemModal({ open, editing, initial, onClose, onSaveClose, onSaveAnother }: ItemModalProps) {
  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: EMPTY_ITEM,
  });
  // `errors` was previously never read, so a rejected save did nothing at all
  // and the operator was given no clue why.
  const { watch, setValue, handleSubmit, reset, formState } = form;
  const { errors } = formState;
  const v = watch();

  useEffect(() => {
    if (open) reset(initial ?? EMPTY_ITEM);
  }, [open, initial, reset]);

  const text = (name: keyof ItemFormValues) => ({
    value: String(v[name] ?? ''),
    onChange: (e: ChangeEvent<HTMLInputElement>) =>
      setValue(name, e.target.value as never, { shouldDirty: true }),
  });

  // Cubic is never typed: it is read off the three dimensions as they are
  // entered, with the same formula the API applies on save.
  const cubic = cubicOf({
    lengthIn: parseOptionalNumber(v.lengthIn),
    widthIn: parseOptionalNumber(v.widthIn),
    heightIn: parseOptionalNumber(v.heightIn),
  });

  const saveClose = handleSubmit((values) => onSaveClose(values));
  const saveAnother = handleSubmit((values) => {
    onSaveAnother(values);
    reset(EMPTY_ITEM);
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Consignment Item' : 'New Consignment Item'}
      width={560}
      footer={
        <>
          <Button variant="utility" size="sm" onClick={onClose}>
            Close
          </Button>
          <div className="flex gap-2">
            {!editing && (
              <Button variant="utility" size="sm" onClick={saveAnother}>
                Save &amp; Add Another
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={saveClose}>
              Save &amp; Close
            </Button>
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <Field label="Reference">
            <Input placeholder="Client reference" {...text('barcode')} />
          </Field>
          <Field label="Qty" required grow={false} error={errors.qty?.message}>
            {/* min=1 stops the browser's spinner going negative; the schema is
                what actually enforces it, since the field can still be typed. */}
            <Input type="number" min={1} step={1} align="right" className="w-24" {...text('qty')} />
          </Field>
        </div>

        <Field label="Description" required grow={false} error={errors.description?.message}>
          <Input placeholder="Item description" {...text('description')} />
        </Field>

        <div className="flex gap-3">
          <Field label="Total Weight (lb)" error={errors.weightLb?.message}>
            {/* The weight of the whole line as typed, not per unit. */}
            <Input type="number" min={0} step="any" align="right" {...text('weightLb')} />
          </Field>
          <Field label="Length (in)" error={errors.lengthIn?.message}>
            <Input type="number" min={0} step="any" align="right" {...text('lengthIn')} />
          </Field>
          <Field label="Width (in)" error={errors.widthIn?.message}>
            <Input type="number" min={0} step="any" align="right" {...text('widthIn')} />
          </Field>
          <Field label="Height (in)" error={errors.heightIn?.message}>
            <Input type="number" min={0} step="any" align="right" {...text('heightIn')} />
          </Field>
        </div>

        <div className="tnum text-xs text-muted-foreground" aria-live="polite">
          Cubic: {cubic === null ? '— (needs length, width and height)' : `${decimal(cubic, 4)} m³`}
        </div>
      </div>
    </Modal>
  );
}
