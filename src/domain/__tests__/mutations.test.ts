import { describe, expect, it } from 'vitest';
import { buildItem } from '@/domain/mutations';
import { EMPTY_ITEM } from '@/domain/schemas';

describe('items', () => {
  it('buildItem parses numbers and derives cubic from the three dimensions', () => {
    const it = buildItem({
      ...EMPTY_ITEM,
      barcode: ' LKA001450097 ',
      description: 'ITEM',
      qty: '3',
      weightLb: '14',
      lengthIn: '15',
      widthIn: '13',
      heightIn: '15',
    });
    expect(it.barcode).toBe('LKA001450097');
    expect(it.qty).toBe(3);
    expect(it.weightLb).toBe(14);
    expect(it.lengthIn).toBe(15);
    // 15 × 13 × 15 in³ = 2925 in³ → 0.0479 m³, rounded as the API rounds it.
    expect(it.cubic).toBe(0.0479);
  });

  it('buildItem keeps blank figures null and leaves cubic null without all three dimensions', () => {
    const it = buildItem({ ...EMPTY_ITEM, description: 'ITEM', lengthIn: '10', widthIn: '7' });
    expect(it.weightLb).toBeNull();
    expect(it.heightIn).toBeNull();
    expect(it.cubic).toBeNull();
  });
});
