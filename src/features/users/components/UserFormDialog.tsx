import { useEffect } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Modal, Select } from '@/ui';
import type { CreateUserPayload, UpdateUserPayload, UserDto } from '@/lib/api';
import {
  EMPTY_USER_FORM,
  ROLE_OPTIONS,
  userFormSchema,
  type UserFormValues,
} from '../userSchema';

/** No shared Field exists in @/ui; every modal in this codebase defines its own. */
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

export function UserFormDialog({
  open,
  mode,
  user,
  isSelf = false,
  onClose,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  user: UserDto | null;
  /** Editing your own account — the role field is locked. */
  isSelf?: boolean;
  onClose: () => void;
  onCreate: (payload: CreateUserPayload) => Promise<unknown>;
  onUpdate: (id: string, payload: UpdateUserPayload) => Promise<unknown>;
}) {
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema(mode)),
    defaultValues: EMPTY_USER_FORM,
  });
  const { watch, setValue, handleSubmit, reset, formState } = form;
  const { errors, isSubmitting } = formState;
  const v = watch();

  useEffect(() => {
    if (!open) return;
    reset(
      user
        ? {
            name: user.name,
            email: user.email,
            password: '',
            role: user.role,
            driverCode: user.driver?.code ?? '',
            driverMobile: '',
          }
        : EMPTY_USER_FORM,
    );
  }, [open, user, reset]);

  const text = (name: keyof UserFormValues) => ({
    value: String(v[name] ?? ''),
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValue(name, e.target.value as never, { shouldDirty: true }),
  });

  const submit = handleSubmit(async (values) => {
    if (mode === 'create') {
      const payload: CreateUserPayload = {
        email: values.email.trim(),
        password: values.password,
        name: values.name.trim(),
        role: values.role,
        // A driver IS the roster row — creating one creates both. There is no
        // separate "link an existing driver" step; every driver account owns
        // exactly one courier record.
        ...(values.role === 'driver'
          ? {
              newDriver: {
                name: values.name.trim(),
                ...(values.driverCode ? { code: values.driverCode } : {}),
                ...(values.driverMobile ? { mobile: values.driverMobile } : {}),
              },
            }
          : {}),
      };
      await onCreate(payload);
    } else if (user) {
      // Send only what changed — the API accepts any subset, and an unchanged
      // email would otherwise trip its own uniqueness check.
      const payload: UpdateUserPayload = {
        ...(values.name.trim() !== user.name ? { name: values.name.trim() } : {}),
        ...(values.email.trim() !== user.email ? { email: values.email.trim() } : {}),
        ...(values.password ? { password: values.password } : {}),
        ...(values.role !== user.role ? { role: values.role } : {}),
      };
      if (Object.keys(payload).length === 0) {
        onClose();
        return;
      }
      await onUpdate(user.id, payload);
    }
    onClose();
  });

  const roleChanged = mode === 'edit' && user !== null && !isSelf && v.role !== user.role;

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={520}
      title={mode === 'create' ? 'New user' : `Edit ${user?.name ?? 'user'}`}
      footer={
        <>
          <Button variant="utility" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={submit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : mode === 'create' ? 'Create user' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Field label="Name" required error={errors.name?.message}>
          <Input placeholder="Full name" {...text('name')} />
        </Field>

        <Field
          label="Email"
          required
          error={errors.email?.message}
          hint="Used to sign in. It never receives mail, so any valid address works."
        >
          <Input type="email" autoComplete="off" placeholder="name@innovoxpress.com" {...text('email')} />
        </Field>

        <Field
          label="Password"
          required={mode === 'create'}
          error={errors.password?.message}
          hint={mode === 'edit' ? 'Leave blank to keep the current password.' : undefined}
        >
          <Input type="password" autoComplete="new-password" placeholder="••••••••" {...text('password')} />
        </Field>

        <Field
          label="Role"
          required
          error={errors.role?.message}
          // The server refuses this with a 400 either way. Locking the field
          // means the answer arrives before you have typed a password and hit
          // save, rather than after.
          hint={isSelf ? 'You cannot change your own role — ask another admin.' : undefined}
        >
          <Select options={ROLE_OPTIONS} disabled={isSelf} {...text('role')} />
        </Field>

        {roleChanged && (
          <p className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-[12px] text-warning">
            The role travels inside their sign-in token, so it takes effect the next time they sign in.
          </p>
        )}

        {v.role === 'driver' && mode === 'create' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Driver code" error={errors.driverCode?.message}>
              <Input placeholder="DRV-009" {...text('driverCode')} />
            </Field>
            <Field label="Mobile" error={errors.driverMobile?.message}>
              <Input placeholder="+92 300 0000000" {...text('driverMobile')} />
            </Field>
          </div>
        )}

        {v.role === 'driver' && mode === 'edit' && (
          <p className="text-[11.5px] text-muted-foreground">
            Driver details (code, mobile) are part of the roster record and are not edited here.
          </p>
        )}
      </div>
    </Modal>
  );
}
