import { presetRange } from '@/domain/derive';
import { DateFilterMenu } from '@/features/tasks/components/DateFilterMenu';
import { ActiveTasksFilterMenu } from '@/features/tasks/components/ActiveTasksFilterMenu';
import type { MapViewAction, MapViewState } from './state/mapView';

interface MapFilterBarProps {
  state: MapViewState;
  dispatch: (action: MapViewAction) => void;
}

/**
 * The consignments page's two filter menus, floating over the map.
 *
 * Both components are imported from `features/tasks/components` **unchanged**.
 * They are purely prop-driven — no `useTaskFilters`, no router, no page state —
 * so the same menus drive both screens and an operator learns one set of
 * controls. If either grows a dependency on the tasks page, this breaks, and the
 * fix is to lift it rather than fork it.
 *
 * `presetRange` is likewise shared, so "Today" means the same span here as it
 * does in the table.
 */
export function MapFilterBar({ state, dispatch }: MapFilterBarProps) {
  return (
    /*
     * Positioning belongs to the caller — this sits inside MapPage's existing
     * top-left overlay column, above the legend. `pointer-events-auto` per
     * control rather than on the row: the row is wider than the buttons, and a
     * drag starting in the gap beside them should pan the map, not be swallowed.
     */
    <div className="flex items-center gap-2">
      <div className="pointer-events-auto">
        <DateFilterMenu
          align="left"
          dateFilter={state.dateFilter}
          dateFrom={state.dateFrom}
          dateTo={state.dateTo}
          timeFrom={state.timeFrom}
          timeTo={state.timeTo}
          onPreset={(key) => {
            const { from, to } = presetRange(key);
            dispatch({ type: 'SET_DATE_PRESET', key, from, to });
          }}
          onPickDate={(iso) => dispatch({ type: 'SET_CUSTOM_DATE', iso })}
          onTime={(from, to) => dispatch({ type: 'SET_TIME', from, to })}
        />
      </div>

      <div className="pointer-events-auto">
        <ActiveTasksFilterMenu
          align="left"
          fStatus={state.fStatus}
          fType={state.fType}
          fDriver={state.fDriver}
          onStatus={(values) => dispatch({ type: 'SET_STATUS_FILTER', values })}
          onType={(values) => dispatch({ type: 'SET_TYPE_FILTER', values })}
          onDriver={(values) => dispatch({ type: 'SET_DRIVER_FILTER', values })}
          onClear={() => dispatch({ type: 'CLEAR_FILTERS' })}
        />
      </div>
    </div>
  );
}
