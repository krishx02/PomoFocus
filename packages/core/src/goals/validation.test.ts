import { describe, it, expect } from 'vitest';
import { validateIntention, validateProcessGoal, validateLongTermGoal } from './validation.js';

describe('validateIntention', () => {
  it('returns trimmed text for valid intention', () => {
    const result = validateIntention('  Finish problem set 4  ');
    expect(result).toEqual({ ok: true, value: 'Finish problem set 4' });
  });

  it('accepts empty string (intentions are optional — empty is valid)', () => {
    const result = validateIntention('');
    expect(result).toEqual({ ok: true, value: '' });
  });

  it('accepts intention at exactly 200 characters', () => {
    const text = 'a'.repeat(200);
    const result = validateIntention(text);
    expect(result).toEqual({ ok: true, value: text });
  });

  it('rejects intention over 200 characters', () => {
    const text = 'a'.repeat(201);
    const result = validateIntention(text);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('200');
      expect(result.error).toContain('201');
    }
  });

  it('trims before checking length (201 chars with surrounding spaces passes if trimmed is 200)', () => {
    const text = ' ' + 'a'.repeat(200) + ' ';
    const result = validateIntention(text);
    expect(result).toEqual({ ok: true, value: 'a'.repeat(200) });
  });

  it('rejects when trimmed text exceeds 200 characters', () => {
    const text = ' ' + 'a'.repeat(201) + ' ';
    const result = validateIntention(text);
    expect(result.ok).toBe(false);
  });

  it('accepts whitespace-only string (trims to empty)', () => {
    const result = validateIntention('   ');
    expect(result).toEqual({ ok: true, value: '' });
  });
});

describe('validateProcessGoal', () => {
  it('returns validated input for valid process goal', () => {
    const result = validateProcessGoal({ title: 'Study calculus', targetSessionsPerDay: 3 });
    expect(result).toEqual({ ok: true, value: { title: 'Study calculus', targetSessionsPerDay: 3 } });
  });

  it('trims the title', () => {
    const result = validateProcessGoal({ title: '  Study calculus  ', targetSessionsPerDay: 1 });
    expect(result).toEqual({ ok: true, value: { title: 'Study calculus', targetSessionsPerDay: 1 } });
  });

  it('rejects empty title', () => {
    const result = validateProcessGoal({ title: '', targetSessionsPerDay: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('title');
    }
  });

  it('rejects whitespace-only title', () => {
    const result = validateProcessGoal({ title: '   ', targetSessionsPerDay: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('title');
    }
  });

  it('accepts targetSessionsPerDay of 1', () => {
    const result = validateProcessGoal({ title: 'Study', targetSessionsPerDay: 1 });
    expect(result.ok).toBe(true);
  });

  it('rejects targetSessionsPerDay of 0', () => {
    const result = validateProcessGoal({ title: 'Study', targetSessionsPerDay: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('at least 1');
    }
  });

  it('rejects negative targetSessionsPerDay', () => {
    const result = validateProcessGoal({ title: 'Study', targetSessionsPerDay: -5 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('at least 1');
    }
  });

  it('rejects non-integer targetSessionsPerDay', () => {
    const result = validateProcessGoal({ title: 'Study', targetSessionsPerDay: 2.5 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('whole number');
    }
  });

  it('accepts large integer targetSessionsPerDay', () => {
    const result = validateProcessGoal({ title: 'Study', targetSessionsPerDay: 10 });
    expect(result.ok).toBe(true);
  });
});

describe('validateLongTermGoal', () => {
  it('returns validated input for valid long-term goal', () => {
    const result = validateLongTermGoal({ title: 'Get strong at calculus', description: 'Master integration' });
    expect(result).toEqual({
      ok: true,
      value: { title: 'Get strong at calculus', description: 'Master integration' },
    });
  });

  it('trims the title', () => {
    const result = validateLongTermGoal({ title: '  Get strong at calculus  ' });
    expect(result).toEqual({
      ok: true,
      value: { title: 'Get strong at calculus', description: null },
    });
  });

  it('trims the description', () => {
    const result = validateLongTermGoal({ title: 'Study', description: '  Master integration  ' });
    expect(result).toEqual({
      ok: true,
      value: { title: 'Study', description: 'Master integration' },
    });
  });

  it('rejects empty title', () => {
    const result = validateLongTermGoal({ title: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('title');
    }
  });

  it('rejects whitespace-only title', () => {
    const result = validateLongTermGoal({ title: '   ' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('title');
    }
  });

  it('handles null description', () => {
    const result = validateLongTermGoal({ title: 'Study', description: null });
    expect(result).toEqual({ ok: true, value: { title: 'Study', description: null } });
  });

  it('handles undefined description', () => {
    const result = validateLongTermGoal({ title: 'Study' });
    expect(result).toEqual({ ok: true, value: { title: 'Study', description: null } });
  });

  it('normalizes empty description to null', () => {
    const result = validateLongTermGoal({ title: 'Study', description: '   ' });
    expect(result).toEqual({ ok: true, value: { title: 'Study', description: '' } });
  });
});
