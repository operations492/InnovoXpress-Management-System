import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Avatar, Icon, IconButton, Input } from '@/ui';
import type { IconName } from '@/ui';
import { useAuth } from '@/state/AuthProvider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavEntry {
  key: string;
  label: string;
  icon: IconName;
  path?: string;
  /** Hidden from anyone who is not an admin. */
  adminOnly?: boolean;
}

/** Top-level nav (Iris shell). Only Consignments, Chat, Map and Users are routed today. */
const NAV: NavEntry[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { key: 'consignments', label: 'Consignments', icon: 'package', path: '/tasks' },
  { key: 'allocation', label: 'Allocation', icon: 'map' },
  { key: 'drivers', label: 'Drivers', icon: 'users', path: '/drivers' },
  { key: 'clients', label: 'Clients', icon: 'building', path: '/clients', adminOnly: true },
  { key: 'chat', label: 'Chat', icon: 'message', path: '/chat' },
  { key: 'map', label: 'Map', icon: 'map', path: '/map' },
  { key: 'reports', label: 'Reports', icon: 'receipt' },
  { key: 'users', label: 'Users', icon: 'users', path: '/users', adminOnly: true },
];

export function TopNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();

  /**
   * Hiding a tab is presentation, not security — the bundle is public and
   * anyone can type /users. The enforcement is the backend refusing every
   * /api/users call from a non-admin.
   */
  const nav = useMemo(
    () => NAV.filter((n) => !n.adminOnly || user.role === 'admin'),
    [user.role],
  );

  return (
    <header className="sticky top-0 z-20 flex h-[58px] flex-none items-center gap-1 border-b bg-card px-5">
      {/* Brand */}
      <div className="flex items-center gap-2.5 pr-4">
        <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
          <Icon name="pin" size={16} />
        </span>
        <span className="font-display text-[15px] font-bold tracking-tight text-foreground">Innovo Xpress</span>
      </div>

      {/* Primary nav */}
      <nav className="hidden items-center gap-0.5 md:flex">
        {nav.map((n) => {
          const active = n.path ? pathname.startsWith(n.path) : false;
          return (
            <button
              key={n.key}
              type="button"
              onClick={() => n.path && navigate(n.path)}
              className={cn(
                'relative rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors',
                active
                  ? 'text-primary after:absolute after:inset-x-3 after:-bottom-[11px] after:h-[2.5px] after:rounded-full after:bg-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {n.label}
            </button>
          );
        })}

        {/* Finance — the first nav section with a dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'relative flex items-center gap-1 rounded-md px-3 py-2 text-[13.5px] font-medium outline-none transition-colors',
                'focus-visible:ring-2 focus-visible:ring-ring/50',
                pathname.startsWith('/finance')
                  ? 'text-primary after:absolute after:inset-x-3 after:-bottom-[11px] after:h-[2.5px] after:rounded-full after:bg-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              Finance
              <Icon name="chevronRight" size={13} className="rotate-90 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onSelect={() => navigate('/finance/additional-services')}>
              <Icon name="receipt" size={15} />
              Additional Services
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('/finance/freight-items')}>
              <Icon name="box" size={15} />
              Freight Items
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('/finance/service-levels')}>
              <Icon name="truck" size={15} />
              Service Levels
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('/finance/service-zones')}>
              <Icon name="map" size={15} />
              Service Zones
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('/finance/tax-rates')}>
              <Icon name="receipt" size={15} />
              Tax Rates
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('/finance/rate-levies')}>
              <Icon name="sliders" size={15} />
              Rate Levies
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('/finance/rate-plans')}>
              <Icon name="chart" size={15} />
              Rate Plans
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('/finance/quote')}>
              <Icon name="search" size={15} />
              Quote Calculator
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      <div className="flex-1" />

      {/* Search + actions */}
      <div className="hidden w-52 lg:block">
        <Input icon={<Icon name="search" size={15} />} placeholder="Search" />
      </div>
      <IconButton title="Notifications" aria-label="Notifications">
        <Icon name="bell" size={18} />
      </IconButton>
      <IconButton title="Settings" aria-label="Settings">
        <Icon name="settings" size={18} />
      </IconButton>
      {/* Who is signed in, and the only way to sign out. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Signed in as ${user.name}`}
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Avatar name={user.name} size={32} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>
            <span className="block text-[13px] font-semibold text-foreground">{user.name}</span>
            <span className="block font-mono text-[11px] font-normal text-muted-foreground">
              {user.email}
            </span>
            <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] font-medium text-primary">
              {user.role}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void signOut()}>
            <Icon name="logout" size={15} />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
