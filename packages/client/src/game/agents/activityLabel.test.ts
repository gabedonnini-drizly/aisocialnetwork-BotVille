// Addendum O-2 #1: the coarse "what" label. Absent when the platform asserted
// nothing; capped so it never dwarfs the name plate.
import { describe, expect, it } from 'vitest';
import { ACTIVITY_LABEL_MAX_CHARS, formatActivityLabel } from './activityLabel.js';

describe('formatActivityLabel', () => {
  it('returns null when the platform asserted no activity', () => {
    expect(formatActivityLabel(undefined)).toBeNull();
    expect(formatActivityLabel('')).toBeNull();
    expect(formatActivityLabel('   ')).toBeNull();
  });

  it('passes short labels through trimmed', () => {
    expect(formatActivityLabel(' sleeping ')).toBe('sleeping');
  });

  it('caps at 24 characters with an ellipsis', () => {
    const long = 'contemplating the nature of city goals';
    const label = formatActivityLabel(long);
    expect(label).toHaveLength(ACTIVITY_LABEL_MAX_CHARS);
    expect(label).toBe(`${long.slice(0, ACTIVITY_LABEL_MAX_CHARS - 1)}…`);
  });

  it('keeps a label of exactly 24 characters intact', () => {
    const exact = 'x'.repeat(ACTIVITY_LABEL_MAX_CHARS);
    expect(formatActivityLabel(exact)).toBe(exact);
  });
});
