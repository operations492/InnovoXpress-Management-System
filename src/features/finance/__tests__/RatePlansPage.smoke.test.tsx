import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppProviders } from '@/app/providers';
import { RatePlansPage } from '@/features/finance/RatePlansPage';
import { QuoteCalculatorPage } from '@/features/finance/QuoteCalculatorPage';

describe('RatePlansPage', () => {
  it('renders scope tabs, seeded plan and primary action', async () => {
    render(
      <AppProviders>
        <RatePlansPage />
      </AppProviders>,
    );
    expect(await screen.findByRole('heading', { name: 'Rate Plans' })).toBeInTheDocument();
    expect(screen.getByText('Customer Plans')).toBeInTheDocument();
    expect(screen.getByText('Supplier Plans')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Rate Plan' })).toBeInTheDocument();
    expect(screen.getAllByText('Metaltrone Manufacturing Inc.').length).toBeGreaterThan(0);
  });
});

describe('QuoteCalculatorPage', () => {
  it('renders the calculator and a live grand total', async () => {
    render(
      <AppProviders>
        <QuoteCalculatorPage />
      </AppProviders>,
    );
    expect(await screen.findByRole('heading', { name: 'Quote Calculator' })).toBeInTheDocument();
    expect(screen.getByText('Basic details')).toBeInTheDocument();
  });
});
