import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PodPanel } from '../components/PodPanel';

/**
 * Covers the two things that would be silently wrong otherwise: the empty state
 * (an order with no proof returns 200 + an empty array, not a 404), and the
 * blob download — `<a download>` is ignored cross-origin, and these are signed
 * supabase.co links, so a naive implementation navigates instead of saving.
 */

const LEG = (leg: 'PICKUP' | 'DELIVERY') => ({
  leg,
  capturedAt: '2026-08-15T12:01:05.449Z',
  capturedByDriver: { id: 'd1', name: 'Ahsan Iqbal' },
  photo: { mime: 'image/jpeg', bytes: 302_144, url: `https://x.supabase.co/${leg}/photo.jpg?token=a` },
  signature: { mime: 'image/png', bytes: 5_120, url: `https://x.supabase.co/${leg}/sig.png?token=b` },
  replacedAt: null,
  expiresInSeconds: 300,
});

function mount(proof: unknown[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      // api.ts logs itself in before any call — miss this and every request
      // downstream gets the wrong stub.
      if (url.includes('/api/auth/login')) {
        return Promise.resolve(
          new Response(JSON.stringify({ token: 'test-token', user: { email: 'op@x.com' } })),
        );
      }
      if (url.includes('/pod')) {
        return Promise.resolve(new Response(JSON.stringify({ proof })));
      }
      // The blob fetch behind a download.
      return Promise.resolve(new Response(new Blob(['binary'], { type: 'image/jpeg' })));
    }),
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PodPanel consignmentId="c1" orderNo="TCS-20260815-0003" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  // Patch the two statics only. Replacing the global URL with a spread of the
  // class wipes the constructor — which jsdom, fetch and Response all need.
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn(() => 'blob:fake'),
    writable: true,
    configurable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: vi.fn(),
    writable: true,
    configurable: true,
  });
});

afterEach(cleanup);

describe('PodPanel', () => {
  it('says so plainly when nothing has been captured', async () => {
    mount([]);
    expect(await screen.findByText(/No proof captured yet/i)).toBeTruthy();
    // and explains when it will appear
    expect(screen.getByText(/photo and a signature at pickup/i)).toBeTruthy();
  });

  it('renders both legs with who captured them and when', async () => {
    mount([LEG('PICKUP'), LEG('DELIVERY')]);
    expect(await screen.findByText('Pickup')).toBeTruthy();
    expect(screen.getByText('Delivery')).toBeTruthy();
    expect(screen.getAllByText('Ahsan Iqbal')).toHaveLength(2);
    // photo + signature per leg
    expect(screen.getAllByText('Photo')).toHaveLength(2);
    expect(screen.getAllByText('Signature')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /Download/i })).toHaveLength(4);
  });

  it('shows file sizes so an operator can spot a broken upload', async () => {
    mount([LEG('PICKUP')]);
    expect(await screen.findByText('295 KB')).toBeTruthy(); // 302144 bytes
    expect(screen.getByText('5 KB')).toBeTruthy();
  });

  it('offers no way to delete or replace a proof', async () => {
    mount([LEG('PICKUP'), LEG('DELIVERY')]);
    await screen.findByText('Pickup');
    expect(screen.queryByRole('button', { name: /delete|remove|replace/i })).toBeNull();
    expect(screen.getByText(/cannot be edited or removed/i)).toBeTruthy();
  });

  it('downloads via a blob, not a bare cross-origin link', async () => {
    const user = userEvent.setup();
    mount([LEG('PICKUP')]);
    await screen.findByText('Pickup');

    const clicked: string[] = [];
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function patched(this: HTMLAnchorElement) {
      clicked.push(this.download);
    };

    await user.click(screen.getAllByRole('button', { name: /Download/i })[0]);

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled();
      // Named from the order, leg and file — not "photo.jpg" for everything.
      expect(clicked[0]).toBe('TCS-20260815-0003-pickup-photo.jpg');
    });

    HTMLAnchorElement.prototype.click = realClick;
  });
});
