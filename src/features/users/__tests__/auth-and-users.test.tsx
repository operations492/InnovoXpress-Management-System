import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders } from '@/app/providers';
import { LoginPage } from '@/features/auth/LoginPage';
import { UsersPage } from '@/features/users/UsersPage';
import { TopNav } from '@/components/TopNav/TopNav';

/**
 * Covers the two new surfaces and the rule that ties them together: the Users
 * tab is admin-only, and a driver cannot use the console at all.
 */

const USERS = [
  {
    id: 'u-admin',
    email: 'operations@innovoxpress.com',
    name: 'Operations',
    role: 'admin',
    active: true,
    createdAt: '2026-08-16T00:00:00.000Z',
    driver: null,
  },
  {
    id: 'u-driver',
    email: 'ahsan.iqbal@innovoxpress.com',
    name: 'Ahsan Iqbal',
    role: 'driver',
    active: true,
    createdAt: '2026-08-16T00:00:00.000Z',
    driver: { id: 'd1', name: 'Ahsan Iqbal', code: 'DRV-008', active: true, onShift: true },
  },
  {
    id: 'u-gone',
    email: 'former@innovoxpress.com',
    name: 'Former Operator',
    role: 'operator',
    active: false,
    createdAt: '2026-08-16T00:00:00.000Z',
    driver: null,
  },
];

const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );

/** Sign in as whoever, and serve the users list. */
function stubApi(role: 'admin' | 'operator') {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return json({
          user: {
            id: role === 'admin' ? 'u-admin' : 'u-op',
            email: `${role}@innovoxpress.com`,
            name: role === 'admin' ? 'Operations' : 'Dispatch',
            role,
            active: true,
            driver: null,
          },
        });
      }
      if (url.includes('/api/users')) return json({ data: USERS });
      return json({ error: { code: 'NOT_FOUND', message: `unstubbed ${url}` } }, 404);
    }),
  );
}

afterEach(cleanup);

describe('the login screen', () => {
  it('asks for an email and a password', () => {
    render(<LoginPage onSignIn={async () => ({ ok: true })} />);
    expect(screen.getByPlaceholderText(/you@innovoxpress.com/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeTruthy();
  });

  it('cannot be submitted empty', () => {
    render(<LoginPage onSignIn={async () => ({ ok: true })} />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
  });

  it('shows why a driver was refused, rather than letting them into a broken console', async () => {
    const user = userEvent.setup();
    render(
      <LoginPage
        onSignIn={async () => ({
          ok: false,
          message: 'This account is for the driver app, not the console.',
        })}
      />,
    );
    await user.type(screen.getByPlaceholderText(/you@innovoxpress.com/i), 'ahsan@x.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'Driver!123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/driver app, not the console/i);
  });

  it('surfaces a wrong password in plain language', async () => {
    const user = userEvent.setup();
    render(<LoginPage onSignIn={async () => ({ ok: false, message: 'Wrong email or password' })} />);
    await user.type(screen.getByPlaceholderText(/you@innovoxpress.com/i), 'a@b.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'nope');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/wrong email or password/i);
  });
});

describe('the Users tab', () => {
  beforeEach(() => stubApi('admin'));

  it('is shown to an admin', async () => {
    render(
      <AppProviders>
        <TopNav />
      </AppProviders>,
    );
    expect(await screen.findByRole('button', { name: 'Users' })).toBeTruthy();
  });

  it('is hidden from an operator', async () => {
    stubApi('operator');
    render(
      <AppProviders>
        <TopNav />
      </AppProviders>,
    );
    // Wait for the nav to exist at all before asserting an absence.
    await screen.findByRole('button', { name: 'Consignments' });
    expect(screen.queryByRole('button', { name: 'Users' })).toBeNull();
  });

  it('shows who is signed in', async () => {
    render(
      <AppProviders>
        <TopNav />
      </AppProviders>,
    );
    expect(await screen.findByLabelText(/signed in as Operations/i)).toBeTruthy();
  });
});

describe('the Users page', () => {
  beforeEach(() => stubApi('admin'));

  it('lists everyone with their role and status', async () => {
    render(
      <AppProviders>
        <UsersPage />
      </AppProviders>,
    );
    expect(await screen.findByText('Ahsan Iqbal')).toBeTruthy();
    expect(screen.getByText('Operations')).toBeTruthy();
    expect(screen.getAllByText('driver').length).toBeGreaterThan(0);
    // A driver row shows the roster link, and that they have clocked on.
    expect(screen.getByText('DRV-008')).toBeTruthy();
    expect(screen.getByText('on shift')).toBeTruthy();
  });

  it('hides inactive users until asked', async () => {
    const user = userEvent.setup();
    render(
      <AppProviders>
        <UsersPage />
      </AppProviders>,
    );
    await screen.findByText('Ahsan Iqbal');
    expect(screen.queryByText('Former Operator')).toBeNull();

    await user.click(screen.getByRole('button', { name: /show inactive/i }));
    await waitFor(() => expect(screen.getByText('Former Operator')).toBeTruthy());
  });

  it('marks the signed-in admin as "you", so you know which row is yours', async () => {
    render(
      <AppProviders>
        <UsersPage />
      </AppProviders>,
    );
    expect(await screen.findByText('(you)')).toBeTruthy();
  });

  it('locks the role field when you edit yourself', async () => {
    const user = userEvent.setup();
    render(
      <AppProviders>
        <UsersPage />
      </AppProviders>,
    );
    // Open the row menu on your own row, then Edit.
    await user.click(await screen.findByRole('button', { name: /actions for Operations/i }));
    await user.click(await screen.findByRole('button', { name: 'Edit' }));

    const role = await screen.findByDisplayValue('Admin');
    // The server refuses a self-demotion with a 400 regardless; the field being
    // live meant you found that out only after filling the form and saving.
    expect(role).toBeDisabled();
    expect(screen.getByText(/cannot change your own role/i)).toBeTruthy();
  });

  it('leaves the role field editable on somebody else', async () => {
    const user = userEvent.setup();
    render(
      <AppProviders>
        <UsersPage />
      </AppProviders>,
    );
    await user.click(await screen.findByRole('button', { name: /actions for Ahsan Iqbal/i }));
    await user.click(await screen.findByRole('button', { name: 'Edit' }));

    expect(await screen.findByDisplayValue('Driver')).not.toBeDisabled();
  });

  it('refuses an operator, without pretending that is the real protection', async () => {
    stubApi('operator');
    render(
      <AppProviders>
        <UsersPage />
      </AppProviders>,
    );
    expect(await screen.findByText(/Not available/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /new user/i })).toBeNull();
  });
});
