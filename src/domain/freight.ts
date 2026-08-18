/**
 * Freight Item — a reusable lookup that links consignment/package descriptions to
 * rate structures (referenced by rate cards, services, etc. later). Client-side only
 * for now; an in-memory store owns the list. Modeled on the reference "Freight Item
 * List" screen (data filter omitted).
 */
export interface FreightItem {
  id: string;
  name: string;
  /** Short code used for export only. */
  shortName: string;
  /** Finance ordering priority; null = unset. */
  priority: number | null;
  /** Alternate names ("also known as"). */
  aka: string;
  /** How many labels to print for this item (default 1). */
  labelPrintQty: number;
  /** Disabled items aren't offered on rate structures. */
  enabled: boolean;
  /** Audit (stubbed until real auth). */
  createdBy: string;
  createdAt: string;
}

/** The create/update payload (everything except the surrogate id). */
export type FreightItemInput = Omit<FreightItem, 'id'>;
