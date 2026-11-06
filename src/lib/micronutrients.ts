/**
 * Definiciones y utilidades para el seguimiento de micronutrientes esenciales (Vitaminas y Minerales).
 */

export type EssentialMicros = {
	// Minerales clave
	potassiumMg?: number | null;
	calciumMg?: number | null;
	magnesiumMg?: number | null;
	ironMg?: number | null;
	sodiumMg?: number | null;

	// Vitaminas fundamentales
	vitaminCMg?: number | null;
	vitaminDIu?: number | null;
	vitaminB12Mcg?: number | null;
	vitaminAMcg?: number | null;
	vitaminB6Mg?: number | null;

	// Desglose de grasas (g)
	saturatedFat?: number | null;
	monounsaturatedFat?: number | null;
	polyunsaturatedFat?: number | null;
	transFat?: number | null;
};

export type FatTypeMeta = {
	key: 'saturatedFat' | 'monounsaturatedFat' | 'polyunsaturatedFat' | 'transFat';
	label: string;
	shortLabel: string;
	unit: string;
	color: string;
};

export const FAT_TYPES_META: FatTypeMeta[] = [
	{ key: 'saturatedFat', label: 'Saturated Fat', shortLabel: 'Sat.', unit: 'g', color: '#F59E0B' },
	{ key: 'monounsaturatedFat', label: 'Monounsaturated Fat', shortLabel: 'Mono.', unit: 'g', color: '#38BDF8' },
	{ key: 'polyunsaturatedFat', label: 'Polyunsaturated Fat', shortLabel: 'Poly.', unit: 'g', color: '#10B981' },
	{ key: 'transFat', label: 'Trans Fat', shortLabel: 'Trans', unit: 'g', color: '#EF4444' }
];

export const ALL_MICROS_AND_FATS_KEYS: Array<keyof EssentialMicros> = [
	...ESSENTIAL_MICROS_META_KEYS(),
	'saturatedFat',
	'monounsaturatedFat',
	'polyunsaturatedFat',
	'transFat'
];

function ESSENTIAL_MICROS_META_KEYS(): Array<keyof EssentialMicros> {
	return [
		'potassiumMg',
		'calciumMg',
		'magnesiumMg',
		'ironMg',
		'sodiumMg',
		'vitaminCMg',
		'vitaminDIu',
		'vitaminB12Mcg',
		'vitaminAMcg',
		'vitaminB6Mg'
	];
}

export type MicroMeta = {
	key: keyof EssentialMicros;
	label: string;
	shortLabel: string;
	unit: string;
	defaultRda: number;
	isMaxLimit?: boolean;
	category: 'mineral' | 'vitamin';
	color: string;
};

export const ESSENTIAL_MICROS_META: MicroMeta[] = [
	// Minerals
	{
		key: 'potassiumMg',
		label: 'Potassium',
		shortLabel: 'K',
		unit: 'mg',
		defaultRda: 3500,
		category: 'mineral',
		color: '#10B981' // emerald
	},
	{
		key: 'calciumMg',
		label: 'Calcium',
		shortLabel: 'Ca',
		unit: 'mg',
		defaultRda: 1000,
		category: 'mineral',
		color: '#38BDF8' // sky
	},
	{
		key: 'magnesiumMg',
		label: 'Magnesium',
		shortLabel: 'Mg',
		unit: 'mg',
		defaultRda: 400,
		category: 'mineral',
		color: '#818CF8' // indigo
	},
	{
		key: 'ironMg',
		label: 'Iron',
		shortLabel: 'Fe',
		unit: 'mg',
		defaultRda: 14,
		category: 'mineral',
		color: '#F43F5E' // rose
	},
	{
		key: 'sodiumMg',
		label: 'Sodium',
		shortLabel: 'Na',
		unit: 'mg',
		defaultRda: 2000,
		isMaxLimit: true,
		category: 'mineral',
		color: '#F59E0B' // amber
	},

	// Vitamins
	{
		key: 'vitaminCMg',
		label: 'Vitamin C',
		shortLabel: 'Vit C',
		unit: 'mg',
		defaultRda: 90,
		category: 'vitamin',
		color: '#FB923C' // orange
	},
	{
		key: 'vitaminDIu',
		label: 'Vitamin D',
		shortLabel: 'Vit D',
		unit: 'IU',
		defaultRda: 800,
		category: 'vitamin',
		color: '#FBBF24' // gold
	},
	{
		key: 'vitaminB12Mcg',
		label: 'Vitamin B12',
		shortLabel: 'Vit B12',
		unit: 'mcg',
		defaultRda: 2.4,
		category: 'vitamin',
		color: '#EC4899' // fuchsia
	},
	{
		key: 'vitaminAMcg',
		label: 'Vitamin A',
		shortLabel: 'Vit A',
		unit: 'mcg',
		defaultRda: 900,
		category: 'vitamin',
		color: '#EA580C' // deep orange
	},
	{
		key: 'vitaminB6Mg',
		label: 'Vitamin B6',
		shortLabel: 'Vit B6',
		unit: 'mg',
		defaultRda: 1.7,
		category: 'vitamin',
		color: '#A855F7' // purple
	}
];

export const MINERALS_META = ESSENTIAL_MICROS_META.filter((m) => m.category === 'mineral');
export const VITAMINS_META = ESSENTIAL_MICROS_META.filter((m) => m.category === 'vitamin');

/**
 * Parsea un JSON de micronutrientes y sub-grasas de forma segura.
 */
export function parseMicrosJson(raw: string | null | undefined): EssentialMicros {
	if (!raw || typeof raw !== 'string') return {};
	try {
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object') return {};
		const clean: EssentialMicros = {};
		for (const key of ALL_MICROS_AND_FATS_KEYS) {
			const v = parsed[key];
			if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
				clean[key] = Math.round(v * 100) / 100;
			}
		}
		return clean;
	} catch {
		return {};
	}
}

/**
 * Serializa un objeto de micronutrientes y sub-grasas descartando valores nulos o vacíos.
 */
export function stringifyMicrosJson(micros: EssentialMicros | null | undefined): string | null {
	if (!micros || typeof micros !== 'object') return null;
	const out: Record<string, number> = {};
	let count = 0;
	for (const key of ALL_MICROS_AND_FATS_KEYS) {
		const v = micros[key];
		if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
			out[key] = Math.round(v * 100) / 100;
			count++;
		}
	}
	return count > 0 ? JSON.stringify(out) : null;
}

/**
 * Escala los micronutrientes y sub-grasas en base al factor de porción / peso consumido.
 */
export function scaleMicros(micros: EssentialMicros | null | undefined, factor: number): EssentialMicros {
	if (!micros || typeof micros !== 'object' || factor <= 0) return {};
	const scaled: EssentialMicros = {};
	for (const key of ALL_MICROS_AND_FATS_KEYS) {
		const v = micros[key];
		if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
			scaled[key] = Math.round(v * factor * 100) / 100;
		}
	}
	return scaled;
}

/**
 * Suma dos conjuntos de micronutrientes y sub-grasas.
 */
export function addMicros(a: EssentialMicros, b: EssentialMicros): EssentialMicros {
	const out: EssentialMicros = { ...a };
	for (const key of ALL_MICROS_AND_FATS_KEYS) {
		const va = a[key] ?? 0;
		const vb = b[key] ?? 0;
		const sum = va + vb;
		if (sum > 0) {
			out[key] = Math.round(sum * 100) / 100;
		}
	}
	return out;
}

/**
 * Calcula el porcentaje de avance hacia la meta diaria (RDA).
 */
export function computeRdaPercent(current: number, target: number): number {
	if (target <= 0) return 0;
	return Math.min(999, Math.round((current / target) * 100));
}

/**
 * Formatea un valor numérico para presentación con su unidad.
 */
export function formatMicroValue(val: number | null | undefined, unit: string): string {
	if (val == null || val <= 0) return `0 ${unit}`;
	if (unit === 'mcg' || unit === 'UI' || unit === 'mg') {
		if (val >= 100) {
			return `${Math.round(val).toLocaleString()} ${unit}`;
		}
		return `${Number(val.toFixed(1))} ${unit}`;
	}
	return `${Number(val.toFixed(1))} ${unit}`;
}
