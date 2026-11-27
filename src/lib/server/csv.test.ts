import { describe, expect, it } from 'vitest';
import { csvCell } from './csv';

describe('csvCell', () => {
	it('neutralises formula prefixes and quotes special characters', () => {
		expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
		expect(csvCell('+1')).toBe("'+1");
		expect(csvCell('-5 mg')).toBe("'-5 mg");
		expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
		expect(csvCell('Magnesium, citrate')).toBe('"Magnesium, citrate"');
		expect(csvCell('Vitamin D3')).toBe('Vitamin D3');
		expect(csvCell('')).toBe('');
	});
});
