export type Ingredient = { id: string; amount: string | null; unit: string | null; name: string; sortOrder: number };
export type Step = { id: string; stepNumber: number; text: string };
export type Recipe = {
	id: string;
	title: string;
	description: string | null;
	imageUrl: string | null;
	sourceUrl: string | null;
	servings: number;
	prepTime: number | null;
	cookTime: number | null;
	ingredients: Ingredient[];
	steps: Step[];
	isFavorite?: boolean;
	rating?: number | null;
	cookCount?: number;
	lastCookedAt?: number | null;
	tags?: string[];
};

const VULGAR_FRACTIONS: Record<string, number> = { '¼': 1 / 4, '½': 1 / 2, '¾': 3 / 4, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8 };

// Accepts "2", "1,5", "1/2", "1 1/2", "½" and "1½" — the forms the recipe importer produces.
function parseQuantity(text: string): number | null {
	let m = text.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/);
	if (m) return Number(m[3]) > 0 ? Number(m[1] ?? 0) + Number(m[2]) / Number(m[3]) : null;
	m = text.match(/^(\d+(?:[.,]\d+)?)?\s*([¼½¾⅓⅔⅛⅜⅝⅞])$/);
	if (m) return Number((m[1] ?? '0').replace(',', '.')) + VULGAR_FRACTIONS[m[2]];
	return /^\d+(?:[.,]\d+)?$/.test(text) ? Number(text.replace(',', '.')) : null;
}

export function scaleAmount(raw: string | null, currentServings: number, originalServings: number): string | null {
	if (!raw) return null;
	if (!(originalServings > 0)) return raw;
	const parts = raw.trim().split(/\s*[–-]\s*/); // "1-2" ranges scale both ends
	const values = parts.length <= 2 ? parts.map(parseQuantity) : [null];
	if (values.some((v) => v == null)) return raw;
	return values
		.map((v) => parseFloat(((v! * currentServings) / originalServings).toFixed(2)).toString().replace('.', ','))
		.join('-');
}
