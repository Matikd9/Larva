// Canonical unit strings stored in DB (German)
export const SUPPLEMENT_UNITS = ['Stück', 'g', 'ml', 'Tablette', 'Kapsel'];

const DE_TO_EN: Record<string, string> = {
	'Kapsel': 'Capsule',
	'Tablette': 'Tablet',
	'Stück': 'Piece',
	'Portion': 'Serving',
};

const DE_TO_ES: Record<string, string> = {
	'Kapsel': 'Cápsula',
	'Tablette': 'Comprimido',
	'Stück': 'Pieza',
	'Portion': 'Porción',
};

export function displayUnit(unit: string, lang: string): string {
	if (lang === 'en') return DE_TO_EN[unit] ?? unit;
	if (lang === 'es') return DE_TO_ES[unit] ?? unit;
	return unit;
}

const DE_SHORT: Record<string, string> = {
	'Kapsel': 'Kps.',
	'Tablette': 'Tbl.',
	'Stück': 'Stk.',
	'Portion': 'Port.',
	'g': 'g',
	'ml': 'ml',
};

const EN_SHORT: Record<string, string> = {
	'Kapsel': 'Cap.',
	'Tablette': 'Tab.',
	'Stück': 'pc.',
	'Portion': 'srv.',
	'g': 'g',
	'ml': 'ml',
};

const ES_SHORT: Record<string, string> = {
	'Kapsel': 'Cáps.',
	'Tablette': 'Comp.',
	'Stück': 'Pz.',
	'Portion': 'Porc.',
	'g': 'g',
	'ml': 'ml',
};

export function shortUnit(unit: string, lang: string): string {
	if (lang === 'en') return EN_SHORT[unit] ?? unit;
	if (lang === 'es') return ES_SHORT[unit] ?? unit;
	return DE_SHORT[unit] ?? unit;
}
