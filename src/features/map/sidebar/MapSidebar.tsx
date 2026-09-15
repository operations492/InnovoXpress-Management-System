import { Icon, Input, Switch } from '@/ui';
import type { ReactNode } from 'react';
import type { MapDriverDto, MapPinDto } from '@/lib/api';
import { TASK_TABS, type MapViewAction, type MapViewState, type TaskTab } from '../state/mapView';
import { useIncrementalList } from '../hooks/useIncrementalList';
import { DriverRow } from './DriverRow';
import { TaskRow } from './TaskRow';

interface MapSidebarProps {
  state: MapViewState;
  dispatch: (action: MapViewAction) => void;
  counts: Record<TaskTab, number>;
  /** Rows for the TASKS tab, already filtered by tab and search. */
  taskPins: MapPinDto[];
  drivers: MapDriverDto[];
  tasksForDriver: (driverId: string) => MapPinDto[];
  borderColourOf: (pin: MapPinDto) => string;
  editableOf: (pin: MapPinDto) => boolean;
  onOpenTask: (taskId: string) => void;
  onAssign: (taskId: string) => void;
  onEdit: (taskId: string) => void;
  loading: boolean;
  /**
   * The selected driver's planned run, rendered in place of their task accordion.
   *
   * Passed in rather than fetched here: MapPage owns the route mutations and the
   * map layer that must stay in step with this list, and splitting that ownership
   * is how the sidebar and the line end up showing different orders.
   */
  routePanel?: ReactNode;
}

const TAB_LABELS: Record<TaskTab, string> = {
  unassigned: 'Unassigned',
  assigned: 'Assigned',
  completed: 'Completed',
};

/**
 * The right-hand panel: TASKS / DRIVERS, and everything under them.
 *
 * It is also the accessible interface to the map — several hundred divIcons are
 * not focusable, so this list is how a keyboard or screen-reader user reaches the
 * same information. That makes it structural, not decorative.
 */
export function MapSidebar({
  state,
  dispatch,
  counts,
  taskPins,
  drivers,
  tasksForDriver,
  borderColourOf,
  editableOf,
  onOpenTask,
  onAssign,
  onEdit,
  loading,
  routePanel,
}: MapSidebarProps) {
  const { visible, hasMore, remaining, sentinel } = useIncrementalList(taskPins, 100);

  return (
    <aside className="flex w-80 flex-none flex-col border-l bg-card">
      {/* TASKS | DRIVERS */}
      <div className="flex flex-none border-b">
        {(['tasks', 'drivers'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => dispatch({ type: 'SELECT_TAB', tab })}
            aria-current={state.tab === tab}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors ${
              state.tab === tab
                ? 'border-b-2 border-primary font-semibold text-primary'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Icon name={tab === 'tasks' ? 'package' : 'users'} size={14} />
            {tab === 'tasks' ? 'Tasks' : 'Drivers'}
          </button>
        ))}
      </div>

      {state.tab === 'tasks' ? (
        <>
          <div className="flex flex-none border-b">
            {TASK_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => dispatch({ type: 'SELECT_TASK_TAB', taskTab: tab })}
                aria-current={state.taskTab === tab}
                // The visible text is a bare number above a word; spelled out
                // here so the control has a sensible accessible name.
                aria-label={`${TAB_LABELS[tab]} tasks`}
                className={`flex flex-1 flex-col items-center py-2 transition-colors ${
                  state.taskTab === tab ? 'text-primary' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <span className="font-mono text-base leading-none font-semibold">
                  {counts[tab]}
                </span>
                <span className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em]">
                  {TAB_LABELS[tab]}
                </span>
              </button>
            ))}
          </div>

          <div className="flex-none border-b p-2">
            <Input
              icon={<Icon name="search" size={14} />}
              placeholder="Search address, customer, order"
              aria-label="Search tasks"
              value={state.query}
              onChange={(e) => dispatch({ type: 'SET_QUERY', query: e.target.value })}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && taskPins.length === 0 && (
              <p className="px-3 py-6 text-sm text-muted-foreground">Loading tasks…</p>
            )}
            {!loading && taskPins.length === 0 && (
              <p className="px-3 py-6 text-sm text-muted-foreground">
                Nothing in {TAB_LABELS[state.taskTab].toLowerCase()}.
              </p>
            )}

            {visible.map((pin) => (
              <TaskRow
                key={pin.id}
                pin={pin}
                plotEnd={state.plotEnd}
                borderColour={borderColourOf(pin)}
                selected={pin.id === state.openTaskId}
                onOpen={onOpenTask}
                onAssign={onAssign}
                onEdit={onEdit}
                showDriver={state.taskTab !== 'unassigned'}
                editable={editableOf(pin)}
              />
            ))}

            {hasMore && (
              <div ref={sentinel} className="px-3 py-3 text-center text-xs text-muted-foreground">
                Loading {remaining} more…
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <label className="flex flex-none items-center gap-2.5 border-b p-3">
            <Switch
              checked={state.colourByDriver}
              onChange={(e) =>
                dispatch({ type: 'SET_COLOUR_BY_DRIVER', value: e.target.checked })
              }
            />
            <span className="text-xs text-foreground">
              Display task icons in different colours for each team member
            </span>
          </label>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && drivers.length === 0 && (
              <p className="px-3 py-6 text-sm text-muted-foreground">Loading drivers…</p>
            )}

            {drivers.map((driver) => {
              const expanded = state.selectedDriverId === driver.id;
              return (
                <DriverRow
                  key={driver.id}
                  driver={driver}
                  expanded={expanded}
                  // Only the open driver's tasks are computed, so a long roster
                  // costs nothing.
                  tasks={expanded ? tasksForDriver(driver.id) : []}
                  plotEnd={state.plotEnd}
                  showSwatch={state.colourByDriver}
                  borderColourOf={borderColourOf}
                  editableOf={editableOf}
                  openTaskId={state.openTaskId}
                  onToggle={(driverId) => dispatch({ type: 'SELECT_DRIVER', driverId })}
                  onOpenTask={onOpenTask}
                  onAssign={onAssign}
                  onEdit={onEdit}
                />
              );
            })}

            {/* The open driver's plan, below their card. Placed here rather than
                inside DriverRow so the accordion stays a pure presentation of
                tasks and the route keeps its own state and mutations. */}
            {routePanel && (
              <div className="border-t px-2 py-2">{routePanel}</div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
