import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/Toast';
import { TasksProvider } from '@/store/TasksProvider';
import { AdditionalServicesProvider } from '@/store/AdditionalServicesProvider';
import { TasksPage } from '@/features/tasks/TasksPage';

/**
 * The page now talks to a real API, so the transport is mocked rather than the
 * store. `queryClient.ts` imports ApiError from the same module, so the mock has
 * to provide it too.
 */
vi.mock('@/lib/api', () => {
  class ApiError extends Error {
    status = 500;
    code = 'TEST';
  }

  const row = {
    id: 'c1',
    orderNo: 'DRZ-20260815-0001',
    clientReference: 'DRZ-PK-1',
    client: { id: 'cl1', name: 'Daraz', code: 'DRZ' },
    driver: null,
    status: 'UNASSIGNED',
    statusLabel: 'Unassigned',
    priority: 'NORMAL',
    taskType: 'DELIVERY',
    senderName: 'Daraz Fulfilment Centre',
    senderLine1: 'Warehouse 4',
    senderCity: 'Lahore',
    senderArea: 'Raiwind Road',
    receiverName: 'Taha Shams',
    receiverLine1: 'House 214, Block C',
    receiverCity: 'Lahore',
    receiverArea: 'DHA Phase 5',
    readyBy: null,
    deliverBy: null,
    generalNote: null,
    createdAt: '2026-08-15T09:00:00.000Z',
    itemCount: 1,
    totalQty: 1,
    totalWeightKg: 0.5,
  };

  return {
    ApiError,
    api: {
      listConsignments: vi.fn().mockResolvedValue({
        data: [row],
        meta: { total: 1, page: 1, pageSize: 100, totalPages: 1 },
      }),
      reference: vi.fn().mockResolvedValue({
        clients: [{ id: 'cl1', name: 'Daraz', code: 'DRZ' }],
        drivers: [],
        statuses: [],
        priorities: [],
        taskTypes: [],
        packageTypes: [],
      }),
      listDrivers: vi.fn().mockResolvedValue({ data: [] }),
      getConsignment: vi.fn(),
      createConsignment: vi.fn(),
      updateConsignment: vi.fn(),
      changeStatus: vi.fn(),
      assignDriver: vi.fn(),
      unassignDriver: vi.fn(),
    },
  };
});

function renderPage() {
  // retry: false — a failing request should fail the test immediately rather
  // than retrying for seconds.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/tasks']}>
        <ToastProvider>
          <TasksProvider>
            <AdditionalServicesProvider>
              <TasksPage />
            </AdditionalServicesProvider>
          </TasksProvider>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TasksPage (smoke)', () => {
  it('mounts the toolbar and tabs', async () => {
    renderPage();
    expect(screen.getAllByText(/New consignment/).length).toBeGreaterThan(0);
    // "Active" appears on both the tab and the filter button, so match by role.
    expect(screen.getByRole('tab', { name: /Active/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Delivered/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Search/ })).toBeInTheDocument();
  });

  it('renders a row fetched from the API', async () => {
    renderPage();
    // Arrives asynchronously now — the fixture era rendered it synchronously.
    await waitFor(() => {
      expect(screen.getByText('Taha Shams')).toBeInTheDocument();
    });
  });
});
