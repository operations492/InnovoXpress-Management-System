/**
 * The test quote, drawn as the invoice Innovo actually sends.
 *
 * It is one HTML string rather than a component so that the page and the print
 * window render the same bytes — a second JSX copy for printing is the kind of
 * duplicate that drifts the moment a column is renamed.
 *
 * Nothing here is invented. The real invoice carries a consignment number, an
 * invoice number, two dates and both street addresses; a dry run has none of
 * those, so those columns are gone rather than filled with plausible-looking
 * fiction. What is left — the route, the distance, the base price, the extras,
 * the levy and the total — is every number the rate card actually decides.
 */
import type { RateCardQuoteDto } from '@/lib/api';

/** The company block is fixed: it describes Innovo, not the quote. */
const ISSUER = {
  tax: '719574089RT0001',
  name: 'Innovo Xpress Inc',
  line1: '6660 Kennedy Road Unit 23',
  line2: 'Mississauga ON, L5T 2M9',
  terms: '15 Days',
  bank: [
    'Account Holder: 11163779 CANADA INC',
    'Financial Institution: BANK OF MONTREAL',
    'Transit Number: 38582',
    'Institution Number: 001',
    'Account No:1947131',
  ],
  etransfer: 'payments@innovoxpress.com',
  billing: 'billing@innovoxpress.com',
};

const ENT: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Names come from the database and land in markup, so they are escaped. */
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ENT[c]);

const money = (n: number) =>
  `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface ReceiptMeta {
  /** The day the quote was judged against — the one typed on the form. */
  on: string;
  distanceKm: number;
  waitMinutes: number;
}

/**
 * The style block is scoped under `.ix-receipt` so that injecting it into the
 * console cannot touch anything else on the page.
 */
const STYLE = `
<style>
.ix-receipt{background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.45;padding:28px 30px;}
.ix-receipt *{box-sizing:border-box;}
.ix-receipt .ix-top{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;}
.ix-receipt .ix-mark{font-weight:700;font-size:22px;letter-spacing:1px;color:#1b3a8f;}
.ix-receipt .ix-mark span{color:#f4a300;}
.ix-receipt .ix-kicker{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#6b7280;margin-top:2px;}
.ix-receipt .ix-right{text-align:right;}
.ix-receipt h1{margin:0;font-size:19px;font-weight:700;}
.ix-receipt .ix-bold{font-weight:700;}
.ix-receipt .ix-meta{margin-top:18px;display:flex;justify-content:space-between;gap:24px;}
.ix-receipt .ix-pairs td{padding:1px 0;}
.ix-receipt .ix-pairs td:first-child{padding-right:26px;font-weight:700;}
.ix-receipt .ix-pairs td:last-child{text-align:right;}
.ix-receipt table.ix-grid{width:100%;border-collapse:collapse;margin-top:22px;}
.ix-receipt table.ix-grid th{border-top:1.5px solid #111;border-bottom:1px solid #111;padding:5px 6px;text-align:left;font-weight:400;font-size:10px;}
.ix-receipt table.ix-grid td{padding:8px 6px;vertical-align:top;}
.ix-receipt .ix-num{text-align:right;white-space:nowrap;}
.ix-receipt .ix-working{color:#6b7280;font-size:9.5px;margin-top:3px;}
.ix-receipt .ix-tail{width:100%;margin-top:2px;}
.ix-receipt .ix-tail td{padding:4px 6px;}
.ix-receipt .ix-tail td:first-child{text-align:right;}
.ix-receipt .ix-tail td:last-child{text-align:right;white-space:nowrap;width:110px;}
.ix-receipt .ix-total td{font-weight:700;border-top:1px solid #111;padding-top:7px;}
.ix-receipt .ix-foot{margin-top:46px;font-size:10px;}
.ix-receipt .ix-foot .ix-blue{color:#1b3a8f;}
.ix-receipt .ix-note{margin-top:30px;font-size:9.5px;color:#6b7280;border-top:1px dashed #d1d5db;padding-top:8px;}
@media print{@page{size:A4;margin:12mm;}body{margin:0;}.ix-receipt{padding:0;}}
</style>`;

export function receiptHtml(quote: RateCardQuoteDto, meta: ReceiptMeta): string {
  const find = (key: string) => quote.lines.find((l) => l.key === key);
  const amount = (key: string) => find(key)?.amount ?? 0;

  // What the invoice calls Base Price: the carriage itself, in one number.
  const basePrice = amount('base') + amount('distance') + amount('waiting');
  const services = quote.lines.filter((l) => l.key.startsWith('service:'));
  const levy = find('levy');

  // Destination first, because that is what was priced. The collection point is
  // printed underneath when one was given, as context rather than as a factor.
  const route = quote.to ? `to ${esc(quote.to.matched)}` : '&mdash;';
  const zones = quote.to ? esc(quote.to.zoneName) : '';
  const origin = quote.from ? `collected at ${esc(quote.from.matched)}` : '';

  const working = [
    `base ${money(amount('base')).slice(1)}`,
    `distance ${money(amount('distance')).slice(1)} (${meta.distanceKm} km)`,
    `waiting ${money(amount('waiting')).slice(1)} (${meta.waitMinutes} min)`,
  ].join(' + ');

  const tail = [
    ...services.map((s) => `<tr><td>${esc(s.label)}</td><td>${money(s.amount)}</td></tr>`),
    levy ? `<tr><td class="ix-bold">${esc(levy.label)}</td><td>${money(levy.amount)}</td></tr>` : '',
    `<tr class="ix-total"><td>Grand Total</td><td>${money(quote.total)} ${esc(quote.card.currency)}</td></tr>`,
  ].join('');

  return `${STYLE}
<div class="ix-receipt">
  <div class="ix-top">
    <div>
      <div class="ix-mark">IN<span>N</span>OVO</div>
      <div class="ix-kicker">Xpress</div>
    </div>
    <div class="ix-right">
      <h1>Test price</h1>
      <div class="ix-bold">Tax Number: ${esc(ISSUER.tax)}</div>
      <div style="margin-top:10px" class="ix-bold">${esc(ISSUER.name)}</div>
      <div class="ix-bold">${esc(ISSUER.line1)}</div>
      <div class="ix-bold">${esc(ISSUER.line2)}</div>
    </div>
  </div>

  <div class="ix-meta">
    <div>
      <div class="ix-bold">${esc(quote.card.client.name)}</div>
      <div>Customer code ${esc(quote.card.client.code)}</div>
    </div>
    <table class="ix-pairs">
      <tr><td>Priced on</td><td>${esc(meta.on)}</td></tr>
      <tr><td>Rate card</td><td>${esc(quote.card.name)}</td></tr>
      <tr><td>Zone listing</td><td>${esc(quote.card.zoneList.name)}</td></tr>
    </table>
  </div>

  <table class="ix-grid">
    <thead>
      <tr>
        <th style="width:34%">Destination</th>
        <th style="width:21%">Service level</th>
        <th style="width:21%">Freight item</th>
        <th style="width:12%" class="ix-num">Distance (km)</th>
        <th style="width:12%" class="ix-num">Base Price</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <span class="ix-bold">${route}</span>
          ${zones ? `<div>${zones}</div>` : ''}
          ${origin ? `<div class="ix-working">${origin}</div>` : ''}
          <div class="ix-working">${working}</div>
        </td>
        <td>${esc(quote.serviceLevel.name)}</td>
        <td>${esc(quote.freightItem.name)}</td>
        <td class="ix-num">${meta.distanceKm}</td>
        <td class="ix-num">${money(basePrice)}</td>
      </tr>
    </tbody>
  </table>

  <table class="ix-tail">${tail}</table>

  <div class="ix-foot">
    <div>Payment Terms: ${esc(ISSUER.terms)}</div>
    <div style="margin-top:12px">Payment methods:</div>
    <div style="margin-top:8px" class="ix-blue">1. Direct Deposit Details:</div>
    ${ISSUER.bank.map((b) => `<div class="ix-blue">${esc(b)}</div>`).join('')}
    <div style="margin-top:10px" class="ix-blue">2. E-transfer ${esc(ISSUER.etransfer)}</div>
    <div style="margin-top:16px" class="ix-blue">
      Thank you for your business! If you have any questions regarding this quote, please
      don&rsquo;t hesitate to reach out to us.<br />
      You can email us at ${esc(ISSUER.billing)}, and we will be happy to assist you promptly.
    </div>
  </div>

  <div class="ix-note">
    This is a test price produced from the ${esc(quote.card.name)} rate card. It is not an invoice:
    no consignment exists, nothing was saved, and no payment is due.
  </div>
</div>`;
}

/** Hands the same markup to a print window, where the browser offers Save as PDF. */
export function printReceipt(html: string) {
  const w = window.open('', '_blank', 'width=900,height=1180');
  if (!w) return false;
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>Test price</title></head><body>${html}</body></html>`,
  );
  w.document.close();
  w.focus();
  // Everything is inline — there is no image or font to wait for.
  w.print();
  return true;
}
