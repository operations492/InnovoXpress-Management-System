import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Calls `handler` when a pointer event occurs outside `ref`. The React-idiomatic
 * replacement for the prototype's `_skip` outside-click flag hack.
 */
export function useOnClickOutside(
  ref: RefObject<HTMLElement | null>,
  handler: () => void,
  active = true,
) {
  useEffect(() => {
    if (!active) return;
    function onPointer(event: MouseEvent | TouchEvent) {
      const el = ref.current;
      if (!el || el.contains(event.target as Node)) return;
      handler();
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
    };
  }, [ref, handler, active]);
}
