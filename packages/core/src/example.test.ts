import { describe, it, expect } from 'vitest';
import type { Session, FocusQuality } from '@pomofocus/types';

describe('test pipeline validation', () => {
  it('resolves @pomofocus/types cross-package import', () => {
    const quality: FocusQuality = 'locked_in';
    expect(quality).toBe('locked_in');
  });

  it('uses Session type from @pomofocus/types', () => {
    const partial: Pick<Session, 'id' | 'completed'> = {
      id: 'test-uuid',
      completed: false,
    };
    expect(partial.id).toBe('test-uuid');
    expect(partial.completed).toBe(false);
  });
});
