/** Search tab — filter form + result-display radios + results table. */
import { useState } from 'react';
import { Button, DataTable, Icon, Input, Select, StatusChip } from '@/ui';
import type { ColumnDef } from '@/ui';
import { dash } from '@/domain/format';
import { searchTasks } from '@/domain/derive';
import { STATUS_META, TASK_STATUSES } from '@/domain/status';
import type { Task } from '@/domain/types';
import { useDrivers } from '../hooks/useDrivers';
import { MERCHANTS } from '@/fixtures/reference';

// Optional chaining is load-bearing: this runs at MODULE scope, so a status key
// missing from STATUS_META would throw at import time and take the whole Tasks
// route down — not just this panel.
const STATUS_OPTS = ['All', ...TASK_STATUSES.map((s) => ({ value: s, label: STATUS_META[s]?.label ?? s }))];
const ALL = 'All';
const DISPLAY_OPTS = ['Task List', 'Items / Packages', 'Attachments / POD', 'Custom Task Form', 'History Logs'];

interface SearchPanelProps {
  tasks: Task[];
  onView: (id: string) => void;
}

const initialForm = {
  taskId: '',
  type: 'All',
  externalId: '',
  driver: 'All',
  keyword: '',
  merchant: 'All',
  status: 'All',
  completeBefore: '',
};

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="t-form-label text-foreground">{label}</span>
      {children}
    </label>
  );
}

export function SearchPanel({ tasks, onView }: SearchPanelProps) {
  const driverOpts = [ALL, ...useDrivers().map((d) => d.name)];
  const [f, setF] = useState(initialForm);
  const [results, setResults] = useState<Task[]>([]);
  const [ran, setRan] = useState(false);
  const [display, setDisplay] = useState('Task List');

  const set = (key: keyof typeof initialForm, value: string) => setF((p) => ({ ...p, [key]: value }));

  const run = () => {
    let res = f.keyword.trim() ? searchTasks(tasks, f.keyword) : tasks.slice();
    if (f.taskId) res = res.filter((t) => t.id.toLowerCase().includes(f.taskId.toLowerCase()));
    if (f.externalId) res = res.filter((t) => t.externalId.toLowerCase().includes(f.externalId.toLowerCase()));
    if (f.type !== 'All') res = res.filter((t) => t.type === f.type);
    if (f.driver !== 'All') res = res.filter((t) => t.driver === f.driver);
    if (f.merchant !== 'All') res = res.filter((t) => t.merchant === f.merchant);
    if (f.status !== 'All') res = res.filter((t) => t.status === f.status);
    setResults(res);
    setRan(true);
  };

  const clear = () => {
    setF(initialForm);
    setResults([]);
    setRan(false);
  };

  const columns: ColumnDef<Task>[] = [
    {
      key: 'id',
      header: 'Task ID',
      render: (t) => (
        <button className="ix-reset-btn text-primary" onClick={() => onView(t.id)}>
          {t.id}
        </button>
      ),
    },
    { key: 'type', header: 'Type', render: (t) => t.type },
    { key: 'recipient', header: 'Recipient', render: (t) => dash(t.recipient) },
    {
      key: 'dest',
      header: 'Destination',
      render: (t) => (
        <span className="ix-clip block max-w-[260px]" title={t.dest}>
          {dash(t.dest)}
        </span>
      ),
    },
    { key: 'status', header: 'Status', render: (t) => <StatusChip status={t.status} /> },
    { key: 'driver', header: 'Driver', render: (t) => dash(t.driver) },
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex gap-3">
          <Labeled label="Task ID">
            <Input placeholder="Task ID" value={f.taskId} onChange={(e) => set('taskId', e.target.value)} />
          </Labeled>
          <Labeled label="Task Type">
            <Select options={['All', 'Delivery', 'Pickup']} value={f.type} onChange={(e) => set('type', e.target.value)} />
          </Labeled>
          <Labeled label="External ID">
            <Input placeholder="External ID" value={f.externalId} onChange={(e) => set('externalId', e.target.value)} />
          </Labeled>
        </div>
        <div className="flex gap-3">
          <Labeled label="Driver">
            <Select options={driverOpts} value={f.driver} onChange={(e) => set('driver', e.target.value)} />
          </Labeled>
          <Labeled label="Keyword">
            <Input icon={<Icon name="search" size={15} />} placeholder="Keyword" value={f.keyword} onChange={(e) => set('keyword', e.target.value)} />
          </Labeled>
          <Labeled label="Merchant">
            <Select options={['All', ...MERCHANTS]} value={f.merchant} onChange={(e) => set('merchant', e.target.value)} />
          </Labeled>
        </div>
        <div className="flex gap-3">
          <Labeled label="Status">
            <Select options={STATUS_OPTS} value={f.status} onChange={(e) => set('status', e.target.value)} />
          </Labeled>
          <Labeled label="Complete Before">
            <Input icon={<Icon name="calendar" size={15} />} placeholder="Date range" value={f.completeBefore} onChange={(e) => set('completeBefore', e.target.value)} />
          </Labeled>
          <div className="flex flex-1 items-end gap-2">
            <Button variant="utility" size="md" onClick={clear}>
              Clear
            </Button>
            <Button variant="primary" size="md" leadingIcon={<Icon name="search" size={15} />} onClick={run}>
              Search
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <span className="t-form-label text-foreground">Display Results As</span>
          {DISPLAY_OPTS.map((d) => (
            <label key={d} className="inline-flex items-center gap-1.5 text-sm text-body">
              <input
                type="radio"
                name="search-display"
                checked={display === d}
                onChange={() => setDisplay(d)}
                className="accent-primary"
              />
              {d}
            </label>
          ))}
        </div>
      </div>

      {ran && (
        <div>
          <div className="mb-2 text-sm text-muted-foreground">
            {results.length} {results.length === 1 ? 'result' : 'results'}
          </div>
          {display === 'Task List' ? (
            <DataTable<Task> columns={columns} rows={results} rowKey={(r) => r.id} emptyText="No matching tasks" />
          ) : (
            <div className="p-6 text-center text-muted-foreground">No data available for this view</div>
          )}
        </div>
      )}
    </div>
  );
}
