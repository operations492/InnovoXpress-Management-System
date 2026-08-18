import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppProviders } from '@/app/providers';
import { RateLeviesPage } from '@/features/finance/RateLeviesPage';

describe('RateLeviesPage', () => {
  // Async now: AuthProvider resolves the session before rendering the app, so
  // the tree is empty on the first synchronous pass.
  it('renders the Customer/Supplier tabs, seeded levies and primary action', async () => {
    render(
      <AppProviders>
        <RateLeviesPage />
      </AppProviders>,
    );
    expect(await screen.findByRole('heading', { name: 'Rate Levies' })).toBeInTheDocument();
    expect(screen.getByText('Customer Levies')).toBeInTheDocument();
    expect(screen.getByText('Supplier Levies')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Rate Levy' })).toBeInTheDocument();
    // seeded customer levy appears in the list (and its selected detail panel)
    expect(screen.getAllByText('Metaltrone Manufacturing Inc.').length).toBeGreaterThan(0);
  });
});
