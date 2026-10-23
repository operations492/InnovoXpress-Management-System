import { z } from 'zod';

/**
 * The Users form.
 *
 * Mirrors the backend's `createUserSchema` so a mistake fails in the dialog
 * rather than as a 400 — including the rule that only a driver carries driver
 * fields.
 */

export const ROLES = ['admin', 'operator', 'driver'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'operator', label: 'Operator' },
  { value: 'driver', label: 'Driver' },
];

/**
 * `mode` changes exactly one rule: a password is required when creating and
 * optional when editing, where blank means "leave it alone". Everything else is
 * identical, so one dialog serves both.
 */
export function userFormSchema(mode: 'create' | 'edit') {
  return z.object({
    name: z.string().trim().min(1, 'Name is required').max(120),
    email: z.email('Enter a valid email address').max(160),
    password:
      mode === 'create'
        ? z.string().min(8, 'Password must be at least 8 characters').max(72)
        : z
            .string()
            .max(72)
            .refine((v) => v === '' || v.length >= 8, 'Password must be at least 8 characters'),
    role: z.enum(ROLES),
    /** Which roster row this login belongs to. Required when the role is driver. */
    driverId: z.string(),
    })
    .superRefine((v, ctx) => {
      // A driver login with no roster row cannot use a single driver endpoint,
      // so the server refuses it too — this just says so before the round trip.
      if (mode === 'create' && v.role === 'driver' && v.driverId === '') {
        ctx.addIssue({
          code: 'custom',
          message: 'Select which driver this login belongs to',
          path: ['driverId'],
        });
      }
    });
}

export type UserFormValues = z.infer<ReturnType<typeof userFormSchema>>;

export const EMPTY_USER_FORM: UserFormValues = {
  name: '',
  email: '',
  password: '',
  role: 'operator',
  driverId: '',
};
