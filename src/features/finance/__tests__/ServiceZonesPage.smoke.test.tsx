import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppProviders } from '@/app/providers';
import { ServiceZonesPage } from '@/features/finance/ServiceZonesPage';

describe('ServiceZonesPage (p1 — Zone Book Directory)', () => {
  // Async now: AuthProvider resolves the session before rendering the app.
  it('renders the directory with seeded zone books and the primary action', async () => {
    render(
      <AppProviders>
        <ServiceZonesPage />
      </AppProviders>,
    );
    expect(await screen.findByRole('heading', { name: 'Service Zones' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Zone Book' })).toBeInTheDocument();
    // seeded book appears in the list (and the selected-book edit panel)
    expect(screen.getAllByText('Apple Express').length).toBeGreaterThan(0);
    // the selected book's edit panel exposes the Edit Zones entry point
    expect(screen.getByRole('button', { name: 'Edit Zones' })).toBeInTheDocument();
  });
});
