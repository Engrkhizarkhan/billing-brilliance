import { expect, it } from 'vitest';
import { toLocalDateTimeInput } from './dateTime';
it('round trips a datetime-local input without changing the represented minute', () => {
  const instant = new Date('2026-09-23T12:30:00.000Z');
  const value = toLocalDateTimeInput(instant);
  expect(new Date(value).getTime()).toBe(instant.getTime());
  expect(Number(value.slice(11,13))).toBe(instant.getHours());
});
