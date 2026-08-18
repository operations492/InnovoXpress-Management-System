/**
 * @/ui — the app's single entry point to the UI kit. Feature code imports DS
 * components from HERE, never from @/components/ui. Each export adapts a
 * shadcn/ui primitive to the app's prop API, so the design-system swap stays
 * contained to this folder.
 */
import type {
  ButtonHTMLAttributes,
  ChangeEventHandler,
  CSSProperties,
  InputHTMLAttributes,
  ReactElement,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
import { ChevronDownIcon, PlusIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button as ShButton } from '@/components/ui/button';
import { Badge as ShBadge } from '@/components/ui/badge';
import { Card as ShCard, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar as ShAvatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input as ShInput } from '@/components/ui/input';
import { Checkbox as ShCheckbox } from '@/components/ui/checkbox';
import { Switch as ShSwitch } from '@/components/ui/switch';
import { Tabs as ShTabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/* ----------------------------------------------------------------- Buttons */

export type ButtonVariant = 'primary' | 'utility' | 'ghost' | 'danger';
export type ControlSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: ButtonVariant;
  size?: ControlSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  type?: 'button' | 'submit' | 'reset';
}
const BTN_VARIANT = { primary: 'default', utility: 'outline', ghost: 'ghost', danger: 'destructive' } as const;
export function Button({ variant = 'utility', size = 'md', leadingIcon, trailingIcon, className, children, ...rest }: ButtonProps) {
  return (
    <ShButton
      variant={BTN_VARIANT[variant]}
      size={size === 'md' ? 'default' : size}
      className={cn(variant === 'primary' && 'shadow-[var(--glow-primary)]', className)}
      {...rest}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </ShButton>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ControlSize;
  active?: boolean;
  accent?: boolean;
}
export function IconButton({ size = 'md', active, accent, className, children, ...rest }: IconButtonProps) {
  const iconSize = size === 'sm' ? 'icon-sm' : size === 'lg' ? 'icon-lg' : 'icon';
  return (
    <ShButton
      type="button"
      variant="ghost"
      size={iconSize}
      className={cn(active && 'bg-accent text-accent-foreground', accent && 'text-primary', className)}
      {...rest}
    >
      {children}
    </ShButton>
  );
}

export interface SplitButtonProps {
  children?: ReactNode;
  onMain?: () => void;
  onToggle?: () => void;
  leadingPlus?: boolean;
  disabled?: boolean;
  style?: CSSProperties;
}
export function SplitButton({ children, onMain, onToggle, leadingPlus, disabled, style }: SplitButtonProps) {
  return (
    <div className="inline-flex" style={style}>
      <ShButton type="button" onClick={onMain} disabled={disabled} className="rounded-r-none">
        {leadingPlus && <PlusIcon />}
        {children}
      </ShButton>
      <ShButton
        type="button"
        size="icon"
        onClick={onToggle}
        disabled={disabled}
        className="rounded-l-none border-l border-primary-foreground/25"
        aria-label="More options"
      >
        <ChevronDownIcon />
      </ShButton>
    </div>
  );
}

/* -------------------------------------------------------------- Data table */

export interface ColumnDef<Row> {
  key: string;
  header?: ReactNode;
  width?: number;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  render?: (row: Row) => ReactNode;
}

export interface DataTableProps<Row> {
  columns: ColumnDef<Row>[];
  rows: Row[];
  selectable?: boolean;
  selectedKeys?: Array<string | number>;
  rowKey?: (row: Row, index: number) => string | number;
  onToggleRow?: (key: string | number, row: Row) => void;
  onToggleAll?: () => void;
  emptyText?: string;
  style?: CSSProperties;
}

const alignClass = (a?: 'left' | 'right' | 'center') =>
  a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : undefined;

export function DataTable<Row>({
  columns,
  rows,
  selectable,
  selectedKeys = [],
  rowKey,
  onToggleRow,
  onToggleAll,
  emptyText = 'No data available',
  style,
}: DataTableProps<Row>): ReactElement {
  const keyOf = (row: Row, i: number) => (rowKey ? rowKey(row, i) : i);
  const allChecked = !!selectable && rows.length > 0 && rows.every((r, i) => selectedKeys.includes(keyOf(r, i)));
  const someChecked = !!selectable && !allChecked && rows.some((r, i) => selectedKeys.includes(keyOf(r, i)));
  const colSpan = columns.length + (selectable ? 1 : 0);
  return (
    <div style={style}>
      <Table>
        <TableHeader>
          <TableRow>
            {selectable && (
              <TableHead className="w-9">
                <ShCheckbox
                  checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                  onCheckedChange={() => onToggleAll?.()}
                  aria-label="Select all rows"
                />
              </TableHead>
            )}
            {columns.map((c) => (
              <TableHead key={c.key} className={alignClass(c.align)} style={c.width ? { width: c.width } : undefined}>
                {c.header ?? c.key}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="h-24 text-center text-muted-foreground">
                {emptyText}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, i) => {
              const k = keyOf(row, i);
              const selected = selectedKeys.includes(k);
              return (
                <TableRow key={k} data-state={selected ? 'selected' : undefined}>
                  {selectable && (
                    <TableCell className="w-9">
                      <ShCheckbox
                        checked={selected}
                        onCheckedChange={() => onToggleRow?.(k, row)}
                        aria-label="Select row"
                      />
                    </TableCell>
                  )}
                  {columns.map((c) => (
                    <TableCell key={c.key} className={alignClass(c.align)}>
                      {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/* ------------------------------------------------------------------- Cards */

export interface CardProps {
  title?: ReactNode;
  action?: ReactNode;
  padding?: number;
  children?: ReactNode;
  style?: CSSProperties;
}
export function Card({ title, action, padding, children, style }: CardProps) {
  return (
    <ShCard style={style}>
      {(title || action) && (
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {action}
        </CardHeader>
      )}
      <CardContent style={padding != null ? { padding } : undefined}>{children}</CardContent>
    </ShCard>
  );
}

export interface StatTileProps {
  label?: string;
  value?: string | number;
  delta?: string | null;
  deltaTone?: 'accent' | 'danger' | 'muted';
  icon?: ReactNode;
  style?: CSSProperties;
}
export function StatTile({ label, value, delta, deltaTone = 'muted', icon, style }: StatTileProps) {
  const tone = deltaTone === 'accent' ? 'text-primary' : deltaTone === 'danger' ? 'text-destructive' : 'text-muted-foreground';
  return (
    <ShCard style={style}>
      <CardContent className="p-4">
        <div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1.5 font-display text-2xl tabular-nums text-foreground">{value}</div>
        {delta && <div className={cn('mt-2 flex items-center gap-1 text-xs font-medium', tone)}>{icon}{delta}</div>}
      </CardContent>
    </ShCard>
  );
}

/* --------------------------------------------------------------- Feedback */

function initials(name?: string) {
  if (!name) return '';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
}

export interface AvatarProps {
  name?: string;
  size?: number;
  tone?: 'accent' | 'neutral' | 'info';
  src?: string | null;
  style?: CSSProperties;
}
export function Avatar({ name, size = 32, src, style }: AvatarProps) {
  return (
    <ShAvatar style={{ width: size, height: size, ...style }}>
      {src ? <AvatarImage src={src} alt={name ?? ''} /> : null}
      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(name)}</AvatarFallback>
    </ShAvatar>
  );
}

export interface BadgeProps {
  tone?: 'neutral' | 'accent' | 'info' | 'warning' | 'danger';
  soft?: boolean;
  children?: ReactNode;
  style?: CSSProperties;
}
const BADGE_VARIANT = { neutral: 'secondary', accent: 'default', info: 'outline', warning: 'outline', danger: 'destructive' } as const;
export function Badge({ tone = 'neutral', children, style }: BadgeProps) {
  return (
    <ShBadge variant={BADGE_VARIANT[tone]} style={style}>
      {children}
    </ShBadge>
  );
}

/* ------------------------------------------------------------------- Forms */

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix' | 'size'> {
  icon?: ReactNode;
  prepend?: ReactNode;
  align?: 'left' | 'right' | 'center';
  inputStyle?: CSSProperties;
}
export function Input({ icon, prepend, align, className, inputStyle, style, ...rest }: InputProps) {
  if (!icon && !prepend) {
    return (
      <ShInput
        className={cn(align === 'right' && 'text-right', align === 'center' && 'text-center', className)}
        style={{ ...inputStyle, ...style }}
        {...rest}
      />
    );
  }
  return (
    <div className="relative flex items-center" style={style}>
      {prepend && (
        <span className="pointer-events-none absolute left-0 flex h-full items-center rounded-l-md border-r bg-muted px-2.5 text-xs font-semibold text-primary">
          {prepend}
        </span>
      )}
      {icon && <span className="pointer-events-none absolute left-2.5 text-muted-foreground">{icon}</span>}
      <ShInput
        className={cn(icon && 'pl-8', prepend && 'pl-16', align === 'right' && 'text-right', className)}
        style={inputStyle}
        {...rest}
      />
    </div>
  );
}

export type SelectOption = string | { value: string; label: string };
export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value' | 'defaultValue'> {
  icon?: ReactNode;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  options?: SelectOption[];
  onChange?: ChangeEventHandler<HTMLSelectElement>;
  style?: CSSProperties;
}
export function Select({ icon, options, placeholder, className, style, ...rest }: SelectProps) {
  return (
    <div className="relative" style={style}>
      {icon && <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>}
      <select
        className={cn(
          'h-9 w-full appearance-none rounded-md border border-input bg-transparent py-1 pl-3 pr-8 text-sm text-foreground shadow-xs outline-none',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          icon && 'pl-8',
          className,
        )}
        {...rest}
      >
        {placeholder != null && <option value="">{placeholder}</option>}
        {options?.map((o) => {
          const v = typeof o === 'string' ? o : o.value;
          const l = typeof o === 'string' ? o : o.label;
          return (
            <option key={v} value={v}>
              {l}
            </option>
          );
        })}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

type InputChange = Parameters<ChangeEventHandler<HTMLInputElement>>[0];

export interface CheckboxProps {
  checked?: boolean;
  disabled?: boolean;
  label?: ReactNode;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  style?: CSSProperties;
}
export function Checkbox({ checked, disabled, label, onChange, style }: CheckboxProps) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm" style={style}>
      <ShCheckbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange?.({ target: { checked: v === true } } as unknown as InputChange)}
      />
      {label && <span>{label}</span>}
    </label>
  );
}

export interface SwitchProps {
  checked?: boolean;
  disabled?: boolean;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  style?: CSSProperties;
}
export function Switch({ checked, disabled, onChange, style }: SwitchProps) {
  return (
    <ShSwitch
      checked={checked}
      disabled={disabled}
      style={style}
      onCheckedChange={(v) => onChange?.({ target: { checked: v === true } } as unknown as InputChange)}
    />
  );
}

/* -------------------------------------------------------------- Navigation */

export interface TabItem {
  value: string;
  label: string;
  icon?: ReactNode;
  count?: number;
}
export interface TabsProps {
  items: Array<string | TabItem>;
  value: string;
  onChange?: (key: string) => void;
  style?: CSSProperties;
}
export function Tabs({ items, value, onChange, style }: TabsProps) {
  return (
    <ShTabs value={value} onValueChange={onChange} style={style}>
      <TabsList>
        {items.map((it) => {
          const v = typeof it === 'string' ? it : it.value;
          const label = typeof it === 'string' ? it : it.label;
          const icon = typeof it === 'string' ? null : it.icon;
          const count = typeof it === 'string' ? undefined : it.count;
          return (
            <TabsTrigger key={v} value={v}>
              {icon}
              {label}
              {count != null && <span className="ml-1 rounded-full bg-muted px-1.5 font-mono text-[10px]">{count}</span>}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </ShTabs>
  );
}

export interface SidebarItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  label?: string;
  active?: boolean;
  badge?: ReactNode;
}
export function SidebarItem({ icon, label, active, badge, className, ...rest }: SidebarItemProps) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm',
        active ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        className,
      )}
      {...rest}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {badge}
    </button>
  );
}

/* ------------------------------------------------ App additions / re-exports */

export { Icon } from './Icon';
export type { IconName } from './Icon';
export { Textarea } from './Textarea';
export { StatusChip } from './StatusChip';
export { Modal } from './Modal';
export { ConfirmDialog } from './ConfirmDialog';
export { Popover } from './Popover';
export { useOnClickOutside } from './hooks/useOnClickOutside';
