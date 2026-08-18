/**
 * Tasks screen orchestrator: page tabs + filters + toolbar + table, and the routing
 * of every modal/popover. Tab/filters/sort live in the URL (useTaskFilters); selection
 * and which modal is open are local UI state.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SplitButton, Tabs } from '@/ui';
import { useToast } from '@/components/Toast';
import { TASK_TABS, TAB_LABELS } from '@/domain/status';
import type { TaskStatus } from '@/domain/status';
import type { TaskFormValues } from '@/domain/schemas';
import type { TaskItem } from '@/domain/types';
import type { BulkPatch } from '@/domain/mutations';
import { useTaskFilters } from './hooks/useTaskFilters';
import { useTask, useTasks } from './hooks/useTasks';
import { useSelection } from './hooks/useSelection';
import { useTableColumns } from './hooks/useTableColumns';
import { useTaskActions } from './hooks/useTaskActions';
import { useDrivers } from './hooks/useDrivers';
import { useTasksStore } from '@/store/TasksProvider';
import { TaskToolbar } from './components/TaskToolbar';
import type { ToolbarActions } from './components/TaskToolbar';
import { TaskTable } from './components/TaskTable';
import type { ColumnHandlers } from './components/taskColumns';
import { DateFilterMenu } from './components/DateFilterMenu';
import { ActiveTasksFilterMenu } from './components/ActiveTasksFilterMenu';
import { DriverAssignPopover } from './components/DriverAssignPopover';
import { ChangeStatusModal } from './components/ChangeStatusModal';
import { TaskCardModal } from './components/TaskCardModal';
import { NewConsignmentCard } from './components/NewConsignmentCard';
import { ViewTaskModal } from './components/ViewTaskModal';
import { DriverLocationModal } from './components/DriverLocationModal';
import { BulkUpdateModal } from './components/BulkUpdateModal';
import { TableSettingsModal } from './components/TableSettingsModal';
import { SearchPanel } from './components/SearchPanel';

const TAB_ITEMS = TASK_TABS.map((t) => ({ value: t, label: TAB_LABELS[t] }));

export function TasksPage() {
  const { flash } = useToast();
  const {
    filters,
    setTab,
    setTableQ,
    setDatePreset,
    setDate,
    setTimeWindow,
    setStatus,
    setType,
    setDriver,
    clearChecklists,
    setSort,
  } = useTaskFilters();
  const { allTasks, rows, totals } = useTasks(filters);
  const selection = useSelection();
  const columns = useTableColumns();
  const actions = useTaskActions();

  // Modal / popover state.
  const [cardId, setCardId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [trackId, setTrackId] = useState<string | null>(null);
  const [statusId, setStatusId] = useState<string | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [showTableSettings, setShowTableSettings] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTaskId, setAssignTaskId] = useState<string | null>(null); // null = bulk

  const byId = useCallback((id: string | null) => (id ? allTasks.find((t) => t.id === id) ?? null : null), [allTasks]);

  // Clear selection whenever the tab changes.
  useEffect(() => {
    selection.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.tab]);

  const needSelection = useCallback(() => flash('Select one or more tasks first'), [flash]);

  /* ----------------------------------------------------------- Row handlers */
  const openAssign = useCallback((taskId: string | null) => {
    setAssignTaskId(taskId);
    setAssignOpen(true);
  }, []);

  const onDelete = useCallback(
    (id: string) => {
      actions.remove([id]);
      selection.set(selection.selected.filter((x) => x !== id));
    },
    [actions, selection],
  );

  const handlers: ColumnHandlers = useMemo(
    () => ({
      onView: (id) => setViewId(id),
      onAssign: (id) => openAssign(id),
      onChangeStatus: (id) => setStatusId(id),
      onEdit: (id) => setCardId(id),
      onDelete,
      onSort: setSort,
      sortKey: filters.sortKey,
      sortDir: filters.sortDir,
      onOpenTableSettings: () => setShowTableSettings(true),
    }),
    [openAssign, onDelete, setSort, filters.sortKey, filters.sortDir],
  );

  /* ------------------------------------------------------- Toolbar handlers */
  const toolbarActions: ToolbarActions = useMemo(
    () => ({
      onNewTask: () => setShowNewTask((s) => !s),
      onAssign: () => (selection.selected.length ? openAssign(null) : needSelection()),
      onBulkEdit: () => (selection.selected.length ? setShowBulkEdit(true) : needSelection()),
      onDelete: () => {
        if (!selection.selected.length) return needSelection();
        actions.remove(selection.selected);
        selection.clear();
      },
      onLabel: actions.label,
      onDocket: actions.docket,
      onDownload: actions.download,
      onCardView: () => flash('Card view'),
      onTableSettings: () => setShowTableSettings(true),
      onEditFirst: () => (rows.length ? setCardId(rows[0].id) : needSelection()),
      onClearSelection: selection.clear,
    }),
    [selection, openAssign, needSelection, actions, flash, rows],
  );

  /* --------------------------------------------------------- Selection: all */
  const onToggleAll = useCallback(() => {
    const ids = rows.map((r) => r.id);
    const allSelected = ids.length > 0 && ids.every((id) => selection.selected.includes(id));
    selection.set(allSelected ? [] : ids);
  }, [rows, selection]);

  const drivers = useDrivers();
  const { assigning } = useTasksStore();

  /* ----------------------------------------------------------------- Assign */
  const assignTask = byId(assignTaskId);
  const assignCount = assignTaskId ? 1 : selection.selected.length;
  // Tasks carry the driver's NAME for display; the popover selects by id, so
  // resolve it through the roster.
  const currentDriverId = assignTask?.driverAssigned
    ? (drivers.find((d) => d.name === assignTask.driver)?.id ?? null)
    : null;
  const doAssign = (driverId: string) => {
    const ids = assignTaskId ? [assignTaskId] : selection.selected;
    actions.assign(ids, driverId);
    setAssignOpen(false);
    if (!assignTaskId) selection.clear();
  };

  /* ---------------------------------------------------------- Change status */
  const statusTask = byId(statusId);
  const doChangeStatus = (status: TaskStatus) => {
    if (statusId) actions.changeStatus(statusId, status);
    setStatusId(null);
  };

  /* ------------------------------------------------------------------- Card */
  // Fetched in full, not taken from the list: the grid rows carry no items and
  // no timeline, so a summary here would show an itemless order and then fail
  // to save.
  const cardTask = useTask(cardId);
  const onCardSave = (id: string, values: TaskFormValues, items: TaskItem[]) => actions.update(id, values, items);

  /* --------------------------------------------------------------- New task */
  const onCreate = async (values: TaskFormValues, items: TaskItem[]) => {
    const created = await actions.create(values, items);
    // Only jump tabs on success — on failure the card stays open with the
    // operator's input intact.
    if (created) setTab('new');
    return created;
  };

  /* ------------------------------------------------------------ Bulk update */
  const onBulkSave = (patch: BulkPatch) => {
    actions.bulkUpdate(selection.selected, patch);
    selection.clear();
    setShowBulkEdit(false);
  };

  // Same reason: the read-only view shows items and history.
  const viewTask = useTask(viewId);
  // The map needs the detail record too — the grid row carries no driver id.
  const trackTask = useTask(trackId);

  return (
    <div className="flex h-full flex-col">
      {/* Page head */}
      <div className="flex items-baseline gap-3 px-4 pt-4 pb-2">
        <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">Consignments</h1>
        <span className="font-mono text-[11px] text-muted-foreground">
          <b className="font-semibold text-foreground">{rows.length}</b> shown · Lower Mainland · today
        </span>
      </div>

      {/* Page tabs + filters */}
      <div className="flex items-end justify-between border-b pr-4">
        <div className="flex-1">
          <Tabs value={filters.tab} onChange={setTab} items={TAB_ITEMS} />
        </div>
        {filters.tab !== 'search' && (
          <div className="flex gap-2 pb-2 pl-3">
            <DateFilterMenu
              dateFilter={filters.dateFilter}
              dateFrom={filters.dateFrom}
              dateTo={filters.dateTo}
              timeFrom={filters.timeFrom}
              timeTo={filters.timeTo}
              onPreset={setDatePreset}
              onPickDate={setDate}
              onTime={setTimeWindow}
            />
            <ActiveTasksFilterMenu
              fStatus={filters.fStatus}
              fType={filters.fType}
              fDriver={filters.fDriver}
              onStatus={setStatus}
              onType={setType}
              onDriver={setDriver}
              onClear={clearChecklists}
            />
            <SplitButton onMain={() => setShowNewTask((s) => !s)} onToggle={() => setShowNewTask((s) => !s)} leadingPlus>
              New consignment
            </SplitButton>
          </div>
        )}
      </div>

      {filters.tab === 'search' ? (
        <SearchPanel tasks={allTasks} onView={(id) => setViewId(id)} />
      ) : (
        <>
          <TaskToolbar
            selectedCount={selection.selected.length}
            totals={totals}
            tableQ={filters.tableQ}
            onTableQ={setTableQ}
            actions={toolbarActions}
          />
          <div className="min-h-0 flex-1 overflow-auto p-4">
            <NewConsignmentCard open={showNewTask} onClose={() => setShowNewTask(false)} onCreate={onCreate} />
            <TaskTable
              rows={rows}
              visibleKeys={columns.visibleKeys}
              selected={selection.selected}
              onToggleRow={selection.toggle}
              onToggleAll={onToggleAll}
              handlers={handlers}
            />
          </div>
        </>
      )}

      {/* Modals & popovers */}
      <DriverAssignPopover
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        taskCount={assignCount}
        // null for a bulk assign, which is what switches the ranking and map off:
        // several orders have no single pickup to measure against.
        consignmentId={assignTaskId}
        currentDriverId={currentDriverId}
        onAssign={doAssign}
        onNotify={actions.notify}
        pending={assigning}
      />
      <ChangeStatusModal open={!!statusId} task={statusTask} onClose={() => setStatusId(null)} onSave={doChangeStatus} />
      <TaskCardModal
        open={!!cardId}
        task={cardTask}
        onClose={() => setCardId(null)}
        onSave={onCardSave}
        onChangeStatus={(id) => {
          setCardId(null);
          setStatusId(id);
        }}
        onDelete={(id) => {
          setCardId(null);
          onDelete(id);
        }}
      />
      <DriverLocationModal
        open={!!trackId}
        task={trackTask}
        onClose={() => setTrackId(null)}
      />
      <ViewTaskModal
        open={!!viewId}
        task={viewTask}
        onClose={() => setViewId(null)}
        onTrack={(id) => setTrackId(id)}
        onEdit={(id) => {
          setViewId(null);
          setCardId(id);
        }}
      />
      <BulkUpdateModal
        open={showBulkEdit}
        count={selection.selected.length}
        onClose={() => setShowBulkEdit(false)}
        onSave={onBulkSave}
      />
      <TableSettingsModal
        open={showTableSettings}
        onClose={() => setShowTableSettings(false)}
        order={columns.order}
        visible={columns.visible}
        toggle={columns.toggle}
        reset={columns.reset}
        move={columns.move}
      />
    </div>
  );
}
