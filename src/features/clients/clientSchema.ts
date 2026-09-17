import { z } from 'zod';

/**
 * The Clients form.
 *
 * Mirrors the backend's client schema, plus one rule the API states structurally
 * that a flat form cannot: the address is all-or-nothing. Leave every address
 * field blank and the client simply has no address. Touch any of them and line 1,
 * city and a map pin become required — those four are what `/api/clients` demands
 * *inside* the address object, and a half-filled address would prefill an order
 * nothing can route.
 *
 * Note that a *client's* address is validated where a consignment's is not: the
 * backend enforces a Canadian postcode shape, a province enum and a 2-6 character
 * code. Every rule below is a mirror of `backend/schemas/client.schema.ts`, so a
 * mistake fails in the dialog rather than as a 400.
 */

/** Backend: `^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$`, canonicalised server-side to `A1A 1A1`. */
const POSTCODE_RE = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
/** Backend: `^[A-Za-z0-9]{2,6}$`, upper-cased server-side. */
const CODE_RE = /^[A-Za-z0-9]{2,6}$/;
/** The backend's own email rule, copied so the two cannot disagree. */
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** The address half of the form, structurally — keeps the helpers out of the schema's own inference. */
type AddressPart = {
  contactName: string;
  phone: string;
  email: string;
  line1: string;
  city: string;
  province: string;
  postcode: string;
  instructions: string;
  lat: number | null;
  lng: number | null;
};

/** Has the operator touched the address at all? */
export function hasAddress(v: AddressPart): boolean {
  return Boolean(
    v.contactName ||
      v.phone ||
      v.email ||
      v.line1 ||
      v.city ||
      v.province ||
      v.postcode ||
      v.instructions ||
      v.lat !== null ||
      v.lng !== null,
  );
}

/** The four the API requires inside an address object. */
export function isCompleteAddress(v: AddressPart): boolean {
  return Boolean(v.line1 && v.city && v.lat !== null && v.lng !== null);
}

export const clientFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120),
    code: z
      .string()
      .trim()
      .min(1, 'Code is required')
      .regex(CODE_RE, 'Code must be 2-6 letters or digits'),
    contactName: z.string().trim().max(120),
    phone: z.string().trim().max(40),
    email: z
      .string()
      .trim()
      .max(160)
      .refine((v) => v === '' || EMAIL_RE.test(v), 'Enter a valid email address'),
    line1: z.string().trim().max(200),
    city: z.string().trim().max(80),
    province: z.string(),
    postcode: z
      .string()
      .trim()
      .refine((v) => v === '' || POSTCODE_RE.test(v), 'Postcode must look like A1A 1A1'),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
    instructions: z.string().trim().max(500),
  })
  .refine((v) => !hasAddress(v) || isCompleteAddress(v), {
    message: 'Once an address is started, line 1, city and a map pin are all required.',
    path: ['line1'],
  });

export type ClientFormValues = z.infer<typeof clientFormSchema>;

export const EMPTY_CLIENT_FORM: ClientFormValues = {
  name: '',
  code: '',
  contactName: '',
  phone: '',
  email: '',
  line1: '',
  city: '',
  province: '',
  postcode: '',
  lat: null,
  lng: null,
  instructions: '',
};
