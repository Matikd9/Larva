/** One CSV cell. A leading = + - @ (or tab/CR) would run as a formula in spreadsheet apps, so it gets a ' prefix. */
export function csvCell(value: string): string {
	const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
	if (safe.includes(',') || safe.includes('"') || safe.includes('\n') || safe.includes('\r')) {
		return `"${safe.replace(/"/g, '""')}"`;
	}
	return safe;
}
