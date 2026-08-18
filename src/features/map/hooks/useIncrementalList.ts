import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Reveal a long list in chunks as the operator scrolls.
 *
 * Filtering a few thousand rows costs nothing; rendering them does — each row is
 * a dozen DOM nodes. This keeps the initial paint small without pulling in a
 * virtualiser, which would be the wrong trade while rows have variable heights
 * and search narrows the set anyway.
 *
 * Reach for `@tanstack/react-virtual` instead if this list ever routinely
 * exceeds a thousand rows.
 */
export function useIncrementalList<T>(items: T[], step = 100) {
  const [limit, setLimit] = useState(step);
  const sentinel = useRef<HTMLDivElement | null>(null);

  // Any change of filter starts again from the top.
  useEffect(() => {
    setLimit(step);
  }, [items, step]);

  const grow = useCallback(() => {
    setLimit((current) => (current >= items.length ? current : current + step));
  }, [items.length, step]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    if (limit >= items.length) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) grow();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [grow, limit, items.length]);

  return {
    visible: items.slice(0, limit),
    hasMore: limit < items.length,
    remaining: Math.max(0, items.length - limit),
    sentinel,
  };
}
