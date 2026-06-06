const { plus2, plus2Single } = require('./math');

describe('plus2Single', () => {
  test('adds 2 to a valid number', () => {
    expect(plus2Single(5)).toBe(7);
    expect(plus2Single(0)).toBe(2);
    expect(plus2Single(-3)).toBe(-1);
    expect(plus2Single(1.5)).toBe(3.5);
  });

  test('handles numeric strings by coercing them', () => {
    expect(plus2Single('5')).toBe(7);
    expect(plus2Single('0')).toBe(2);
    expect(plus2Single('-3')).toBe(-1);
  });

  test('returns empty string for empty inputs', () => {
    expect(plus2Single(null)).toBe('');
    expect(plus2Single(undefined)).toBe('');
    expect(plus2Single('')).toBe('');
  });

  test('returns #VALUE! for invalid non-numeric strings', () => {
    expect(plus2Single('abc')).toBe('#VALUE!');
    expect(plus2Single('one')).toBe('#VALUE!');
    expect(plus2Single(NaN)).toBe('#VALUE!');
  });
});

describe('plus2 (Vectorized)', () => {
  test('processes single scalar value correctly', () => {
    expect(plus2(5)).toBe(7);
    expect(plus2(null)).toBe('');
    expect(plus2('abc')).toBe('#VALUE!');
  });

  test('processes 2D array of values (typical range input)', () => {
    const input = [
      [1, 2, ''],
      [3, 'abc', 4],
      [null, -5, '6']
    ];
    const expected = [
      [3, 4, ''],
      [5, '#VALUE!', 6],
      ['', -3, 8]
    ];
    expect(plus2(input)).toEqual(expected);
  });

  test('processes 1D array of values (fallback format)', () => {
    const input = [1, null, 'abc', 4];
    const expected = [3, '', '#VALUE!', 6];
    expect(plus2(input)).toEqual(expected);
  });
});
