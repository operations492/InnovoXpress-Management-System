import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppProviders } from '@/app/providers';
import { DriversPage } from '@/features/drivers/DriversPage';

/**
 * The roster lives on its own tab now. This asserts the chrome that renders
 * whatever the server returns — the columns and the search — rather than any
 * particular driver, since the list comes from the real API.
 */
describe('DriversPage', () => {
  it('renders the roster chrome', async () => {
    render(
      <AppProviders>
        <DriversPage />
      </AppProviders>,
    );
    expect(await screen.findByRole('heading', { name: 'Drivers' })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Search name, code or mobile'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show inactive' })).toBeInTheDocument();
    // Says plainly where a login comes from, because the two tabs are separate.
    expect(
      screen.getByText(/Logins are created on the Users tab/i),
    ).toBeInTheDocument();
  });
});
