/**
 * Quote engine — computes a price from a Rate Plan (used by the Quote Calculator).
 * Simplified but faithful: cubic vs dead weight, tiered/progressive breaks, pro-rata,
 * min/max, then levy + tax stacked on top. Pure; levy/tax percentages injected via ctx.
 */
import { activeVersion, findRateLine, flatCharge, round2, tierCharge, type RatePlan } from './ratePlan';

export interface QuoteLine {
  freightItemId: string;
  qty: number;
  weightKg: number;
  length: number;
  width: number;
  height: number;
  cubicQty: number;
}

export interface QuoteInput {
  serviceLevelId: string;
  laneId: string; // '' = use first lane
  lines: QuoteLine[];
}

export interface QuoteRow {
  label: string;
  amount: number;
}

export interface QuoteContext {
  freightItemName: (id: string) => string;
  levyLabel: string;
  levyPct: number;
  taxLabel: string;
  taxPct: number;
}

export interface QuoteResult {
  ok: boolean;
  message?: string;
  rows: QuoteRow[];
  subtotal: number;
  levyLabel: string;
  levyPct: number;
  levy: number;
  taxLabel: string;
  taxPct: number;
  tax: number;
  total: number;
  notes: string[];
}

export function computeQuote(plan: RatePlan, input: QuoteInput, ctx: QuoteContext, isoDate: string): QuoteResult {
  const empty = (message: string): QuoteResult => ({
    ok: false,
    message,
    rows: [],
    subtotal: 0,
    levyLabel: ctx.levyLabel,
    levyPct: ctx.levyPct,
    levy: 0,
    taxLabel: ctx.taxLabel,
    taxPct: ctx.taxPct,
    tax: 0,
    total: 0,
    notes: [],
  });

  const version = activeVersion(plan, isoDate);
  if (!version) return empty('This plan has no active rate version.');
  const laneId = input.laneId || version.lanes[0]?.id || '';

  const rows: QuoteRow[] = [];
  const notes: string[] = [];
  let matchedLine = null as ReturnType<typeof findRateLine>;

  for (const line of input.lines) {
    const item = version.items.find((it) => it.freightItemId === line.freightItemId);
    const name = ctx.freightItemName(line.freightItemId);
    if (!item) {
      notes.push(`${name}: no rate item configured — skipped.`);
      continue;
    }
    const rateLine = findRateLine(version, input.serviceLevelId, item.id, laneId);
    if (!rateLine) {
      notes.push(`${name}: no rate for this service/lane — skipped.`);
      continue;
    }
    matchedLine = matchedLine ?? rateLine;
    const cats = rateLine.categories;

    const volume = line.length * line.width * line.height * (line.cubicQty || 1);
    const cubicWeight = item.cubicMultiplier ? volume * item.cubicMultiplier : 0;
    const weightUsed = Math.max(line.weightKg, cubicWeight);

    const flat = flatCharge(cats.flat);
    let qtyCharge = cats.quantity.enabled ? tierCharge(cats.quantity.breaks, line.qty, cats.quantity.progressive) : 0;
    const weightCharge = cats.weight.enabled ? tierCharge(cats.weight.breaks, weightUsed, cats.weight.progressive) : 0;

    // pro-rata (per-item weight penalty on the quantity charge)
    if (item.proRataWeight && line.qty > 0) {
      const unitWeight = line.weightKg / line.qty;
      if (unitWeight > item.proRataWeight) {
        const factor = unitWeight / item.proRataWeight;
        const prorated = qtyCharge * factor;
        if (prorated > qtyCharge) {
          notes.push(`${name}: pro-rata ×${factor.toFixed(2)} (unit ${unitWeight.toFixed(0)}kg > ${item.proRataWeight}kg).`);
          qtyCharge = prorated;
        }
      }
    }

    const lineTotal = flat + qtyCharge + weightCharge;
    rows.push({ label: name, amount: round2(lineTotal) });
    notes.push(
      `${name}: flat $${round2(flat)} + qty $${round2(qtyCharge)} + weight $${round2(weightCharge)}` +
        (cubicWeight > line.weightKg ? ` (cubic ${round2(cubicWeight)}kg used)` : ''),
    );
  }

  let subtotal = round2(rows.reduce((s, r) => s + r.amount, 0));

  // consignment min/max from the first matched line
  if (matchedLine) {
    const minC = matchedLine.categories.min;
    const maxC = matchedLine.categories.max;
    if (minC.enabled && minC.breaks[0] && subtotal < minC.breaks[0].rate) {
      notes.push(`Minimum charge $${minC.breaks[0].rate} applied.`);
      subtotal = minC.breaks[0].rate;
    }
    if (maxC.enabled && maxC.breaks[0] && subtotal > maxC.breaks[0].rate) {
      notes.push(`Maximum charge $${maxC.breaks[0].rate} applied.`);
      subtotal = maxC.breaks[0].rate;
    }
  }

  if (plan.fallbackPlanId && subtotal === 0) {
    notes.push('No detailed rate matched — a Fallback plan would apply here.');
  }

  const levy = round2((subtotal * ctx.levyPct) / 100);
  const tax = round2(((subtotal + levy) * ctx.taxPct) / 100);
  const total = round2(subtotal + levy + tax);

  return {
    ok: rows.length > 0,
    message: rows.length === 0 ? 'No lines could be priced with this plan.' : undefined,
    rows,
    subtotal,
    levyLabel: ctx.levyLabel,
    levyPct: ctx.levyPct,
    levy,
    taxLabel: ctx.taxLabel,
    taxPct: ctx.taxPct,
    tax,
    total,
    notes,
  };
}
