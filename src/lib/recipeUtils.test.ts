import { describe, expect, it } from 'vitest';
import { scaleAmount } from './recipeUtils';

describe('scaleAmount', () => {
	it.each([
		['2', 4, 2, '4'],
		['1,5', 4, 2, '3'],
		['1/2', 4, 2, '1'],
		['1 1/2', 4, 2, '3'],
		['½', 4, 2, '1'],
		['1½', 2, 4, '0,75'],
		['1-2', 4, 2, '2-4'],
		['1 – 2', 1, 3, '0,33-0,67']
	])('scales %s from %i to %i servings', (raw, current, original, expected) => {
		expect(scaleAmount(raw, current, original)).toBe(expected);
	});

	it('leaves amounts it cannot read, and zero servings, untouched', () => {
		expect(scaleAmount('etwas', 4, 2)).toBe('etwas');
		expect(scaleAmount('2', 4, 0)).toBe('2');
		expect(scaleAmount(null, 4, 2)).toBeNull();
	});
});
