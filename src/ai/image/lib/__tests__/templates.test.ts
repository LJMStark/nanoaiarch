import { describe, expect, it } from 'vitest';
import { ARCH_TEMPLATES } from '../templates';

describe('ARCH_TEMPLATES', () => {
  it('defaults every template aspect ratio to auto', () => {
    for (const template of ARCH_TEMPLATES) {
      expect(template.defaultAspectRatio).toBe('auto');
    }
  });
});
