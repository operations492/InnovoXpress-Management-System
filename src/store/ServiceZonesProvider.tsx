import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';
import { genId } from '@/domain/id';
import type { Zone, ZoneBook, ZoneBookInput, ZoneInput } from '@/domain/serviceZone';
import { SEED_ZONE_BOOKS, SEED_ZONES } from '@/fixtures/serviceZones';

interface State {
  books: ZoneBook[];
  zones: Zone[];
}

type Action =
  | { type: 'addBook'; book: ZoneBook }
  | { type: 'updateBook'; id: string; patch: Partial<ZoneBookInput> }
  | { type: 'removeBook'; id: string }
  | { type: 'addZone'; zone: Zone }
  | { type: 'updateZone'; id: string; patch: Partial<ZoneInput> }
  | { type: 'removeZone'; id: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'addBook':
      return { ...state, books: [...state.books, action.book] };
    case 'updateBook':
      return {
        ...state,
        books: state.books.map((b) => (b.id === action.id ? { ...b, ...action.patch } : b)),
      };
    case 'removeBook':
      // cascade: drop the book and every zone that belonged to it
      return {
        books: state.books.filter((b) => b.id !== action.id),
        zones: state.zones.filter((z) => z.bookId !== action.id),
      };
    case 'addZone':
      return { ...state, zones: [...state.zones, action.zone] };
    case 'updateZone':
      return {
        ...state,
        zones: state.zones.map((z) => (z.id === action.id ? { ...z, ...action.patch } : z)),
      };
    case 'removeZone':
      return { ...state, zones: state.zones.filter((z) => z.id !== action.id) };
  }
}

interface ServiceZonesStore extends State {
  addBook: (input: ZoneBookInput) => ZoneBook;
  updateBook: (id: string, patch: Partial<ZoneBookInput>) => void;
  removeBook: (id: string) => void;
  addZone: (input: ZoneInput) => Zone;
  updateZone: (id: string, patch: Partial<ZoneInput>) => void;
  removeZone: (id: string) => void;
}

const ServiceZonesContext = createContext<ServiceZonesStore | null>(null);

export function ServiceZonesProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { books: SEED_ZONE_BOOKS, zones: SEED_ZONES });

  const addBook = useCallback((input: ZoneBookInput) => {
    const book: ZoneBook = { ...input, id: genId() };
    dispatch({ type: 'addBook', book });
    return book;
  }, []);
  const updateBook = useCallback(
    (id: string, patch: Partial<ZoneBookInput>) => dispatch({ type: 'updateBook', id, patch }),
    [],
  );
  const removeBook = useCallback((id: string) => dispatch({ type: 'removeBook', id }), []);

  const addZone = useCallback((input: ZoneInput) => {
    const zone: Zone = { ...input, id: genId() };
    dispatch({ type: 'addZone', zone });
    return zone;
  }, []);
  const updateZone = useCallback(
    (id: string, patch: Partial<ZoneInput>) => dispatch({ type: 'updateZone', id, patch }),
    [],
  );
  const removeZone = useCallback((id: string) => dispatch({ type: 'removeZone', id }), []);

  const value = useMemo<ServiceZonesStore>(
    () => ({ ...state, addBook, updateBook, removeBook, addZone, updateZone, removeZone }),
    [state, addBook, updateBook, removeBook, addZone, updateZone, removeZone],
  );

  return <ServiceZonesContext.Provider value={value}>{children}</ServiceZonesContext.Provider>;
}

export function useServiceZonesStore(): ServiceZonesStore {
  const ctx = useContext(ServiceZonesContext);
  if (!ctx) throw new Error('useServiceZonesStore must be used within <ServiceZonesProvider>');
  return ctx;
}
