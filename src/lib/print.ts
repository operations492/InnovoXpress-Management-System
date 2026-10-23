/**
 * Opening a generated PDF for printing.
 *
 * These have to go through `fetch` rather than a plain `<a href>` or
 * `window.open`: the endpoints require the Authorization header, and a bare
 * navigation would arrive unauthenticated and render a 401 envelope in a tab.
 * So the bytes are fetched, wrapped in a blob URL, and handed to a new tab —
 * which gives the operator the browser's own print dialog, paper size and all.
 */

export async function openPdfInTab(load: () => Promise<Blob>): Promise<void> {
  const url = URL.createObjectURL(await load());
  const win = window.open(url, '_blank', 'noopener');

  if (!win) {
    URL.revokeObjectURL(url);
    throw new Error('Your browser blocked the pop-up — allow pop-ups for this site to print');
  }

  // Revoked on a timer rather than immediately: the new tab still has to load it.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Fire-and-forget variant for menu items, reporting failure through a toast. */
export function printDocument(load: () => Promise<Blob>, onError: (message: string) => void) {
  void openPdfInTab(load).catch((e: unknown) =>
    onError(e instanceof Error ? e.message : 'Could not generate the document'),
  );
}
