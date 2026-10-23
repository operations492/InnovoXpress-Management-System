import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppProviders } from '@/app/providers';
import { RatePlansPage } from '@/features/finance/RatePlansPage';
import { QuoteCalculatorPage } from '@/features/finance/QuoteCalculatorPage';

/*
 * Both pages are on the real API now, so these assert the chrome that renders
 * regardless of what the server returns. The old versions checked for scope tabs,
 * a seeded fixture plan and a "Basic details" card — all three went when rate
 * plans were cut down to what the backend actually stores: one plan per client,
 * a base rate plus distance blocks, and a flat price per catalogue entry.
 */

describe('RatePlansPage', () => {
  it('renders the heading and the primary actions', async () => {
    render(
      <AppProviders>
        <RatePlansPage />
      </AppProviders>,
    );
    expect(await screen.findByRole('heading', { name: 'Rate Plans' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Rate Plan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quote Calculator' })).toBeInTheDocument();
    // The grid header, which is present whether or not any plan loads.
    expect(screen.getByText('Base rate')).toBeInTheDocument();
  });
});

describe('QuoteCalculatorPage', () => {
  it('renders the inputs and the invoice panel', async () => {
    render(
      <AppProviders>
        <QuoteCalculatorPage />
      </AppProviders>,
    );
    expect(await screen.findByRole('heading', { name: 'Quote Calculator' })).toBeInTheDocument();
    expect(screen.getByText('Distance (km)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Calculate' })).toBeInTheDocument();
    // Nothing is priced until Calculate is pressed — the panel says so.
    expect(screen.getByText('Select a client and press Calculate.')).toBeInTheDocument();
  });
});
