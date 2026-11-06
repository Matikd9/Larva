import type { EssentialMicros } from '#lib/micronutrients';

export type RawAiItem = {
	displayName?: string;
	name?: string;
	amount?: number | string;
	unit?: string;
	kcal?: number | string;
	protein?: number | string;
	fat?: number | string;
	saturatedFat?: number | string;
	monounsaturatedFat?: number | string;
	polyunsaturatedFat?: number | string;
	transFat?: number | string;
	carbs?: number | string;
	fiber?: number | string;
	sugar?: number | string;
	sodiumMg?: number | string;
	potassiumMg?: number | string;
	calciumMg?: number | string;
	magnesiumMg?: number | string;
	ironMg?: number | string;
	vitaminCMg?: number | string;
	vitaminDIu?: number | string;
	vitaminB12Mcg?: number | string;
	vitaminAMcg?: number | string;
	vitaminB6Mg?: number | string;
};

export type SanitizedEstimatedItem = {
	id: string;
	displayName: string;
	amount: number;
	unit: 'g' | 'ml';
	kcal: number;
	protein: number;
	fat: number;
	saturatedFat: number | null;
	monounsaturatedFat: number | null;
	polyunsaturatedFat: number | null;
	transFat: number | null;
	carbs: number;
	fiber: number;
	sugar: number;
	salt: number;
	sodiumMg: number;
	micros: EssentialMicros;
};

export function buildEstimateSystemInstruction(): string {
	return `Eres un asistente nutricional experto. Tu tarea es analizar la comida presentada por el usuario, ya sea a través de una imagen (foto del plato/comida), una descripción en texto, o ambos combinados.
Debes identificar cada alimento individual por separado y estimar su peso en gramos (o ml para líquidos), calorías totales (kcal), macronutrientes y distribución detallada de grasas para esa porción específica.

Reglas estrictas:
1. Si se proporciona una imagen: analiza visualmente los alimentos visibles en el plato, sus porciones relativas (tomando como referencia vajilla, cubiertos o elementos estándar) y su estado de preparación (ej. a la plancha, frito, cocido, puré). Si el usuario además escribió notas de texto (ej. "me comí solo la mitad", "sin aceite", "1 marraqueta"), intégralas fielmente a tu estimación visual.
2. Si no hay imagen, guíate por la descripción textual desglosando platos combinados en sus alimentos individuales (por ejemplo: "160g de bistec y 250g de puré" -> 2 ítems: "Bistec de vacuno a la plancha" y "Puré de papas casero").
3. Si se usan medidas caseras ("1 taza", "2 rebanadas", "un plato", "un vaso"), estima los gramos correspondientes a esa porción estándar.
4. DISTRIBUCIÓN DE GRASAS: Para cada alimento, estima con precisión los macronutrientes y la distribución detallada de grasas en gramos: "saturatedFat", "monounsaturatedFat", "polyunsaturatedFat" y "transFat", ASEGURANDO ESTRICTAMENTE que (saturatedFat + monounsaturatedFat + polyunsaturatedFat + transFat) NUNCA supere el total de "fat".
5. CERO ALUCINACIONES DE MICRONUTRIENTES: Al tratarse de platos y preparaciones mixtas, NUNCA deduzcas ni inventes valores para micronutrientes (potasio, calcio, magnesio, hierro, vitamina C, vitamina D, vitamina B12, vitamina A, vitamina B6). Todos estos micronutrientes deben ser devueltos estrictamente como null.
6. Debes responder EXCLUSIVAMENTE con un JSON válido con la siguiente estructura:
{
  "items": [
    {
      "displayName": "Nombre del alimento",
      "amount": 160,
      "unit": "g",
      "kcal": 380,
      "protein": 42.0,
      "fat": 24.0,
      "saturatedFat": 9.5,
      "monounsaturatedFat": 11.0,
      "polyunsaturatedFat": 1.5,
      "transFat": 0.2,
      "carbs": 0.0,
      "fiber": 0.0,
      "sugar": 0.0,
      "sodiumMg": 120
    }
  ]
}
7. displayName debe ser claro y conciso en español. unit debe ser "g" o "ml". amount debe ser un número positivo. Los nutrientes deben ser realistas para la porción indicada.`;
}

export function boundFats(
	totalFat: number,
	sat?: number | null,
	mono?: number | null,
	poly?: number | null,
	trans?: number | null
): {
	saturatedFat: number | null;
	monounsaturatedFat: number | null;
	polyunsaturatedFat: number | null;
	transFat: number | null;
} {
	if (totalFat <= 0) {
		return {
			saturatedFat: sat != null ? 0 : null,
			monounsaturatedFat: mono != null ? 0 : null,
			polyunsaturatedFat: poly != null ? 0 : null,
			transFat: trans != null ? 0 : null
		};
	}

	const hasAnyFat = sat != null || mono != null || poly != null || trans != null;
	if (!hasAnyFat) {
		return {
			saturatedFat: null,
			monounsaturatedFat: null,
			polyunsaturatedFat: null,
			transFat: null
		};
	}

	let s = sat != null && sat > 0 ? sat : 0;
	let m = mono != null && mono > 0 ? mono : 0;
	let p = poly != null && poly > 0 ? poly : 0;
	let t = trans != null && trans > 0 ? trans : 0;

	const sum = s + m + p + t;
	if (sum > totalFat && sum > 0) {
		const factor = totalFat / sum;
		s = Math.round(s * factor * 10) / 10;
		m = Math.round(m * factor * 10) / 10;
		p = Math.round(p * factor * 10) / 10;
		t = Math.round(t * factor * 10) / 10;

		// Post-rounding check to avoid float overflow
		const postSum = Math.round((s + m + p + t) * 10) / 10;
		if (postSum > totalFat) {
			const diff = Math.round((postSum - totalFat) * 10) / 10;
			if (s >= m && s >= p && s >= t) s = Math.max(0, Math.round((s - diff) * 10) / 10);
			else if (m >= s && m >= p && m >= t) m = Math.max(0, Math.round((m - diff) * 10) / 10);
			else if (p >= s && p >= m && p >= t) p = Math.max(0, Math.round((p - diff) * 10) / 10);
			else t = Math.max(0, Math.round((t - diff) * 10) / 10);
		}
	} else {
		s = Math.round(s * 10) / 10;
		m = Math.round(m * 10) / 10;
		p = Math.round(p * 10) / 10;
		t = Math.round(t * 10) / 10;
	}

	return {
		saturatedFat: sat != null ? s : null,
		monounsaturatedFat: mono != null ? m : null,
		polyunsaturatedFat: poly != null ? p : null,
		transFat: trans != null ? t : null
	};
}

export function sanitizeEstimatedItem(item: RawAiItem, idx: number): SanitizedEstimatedItem {
	const amount = Math.max(1, Math.round(Number(item.amount) || 100));
	const unit = item.unit === 'ml' ? ('ml' as const) : ('g' as const);
	const kcal = Math.max(0, Math.round(Number(item.kcal) || 0));
	const protein = Math.max(0, Math.round((Number(item.protein) || 0) * 10) / 10);
	const fat = Math.max(0, Math.round((Number(item.fat) || 0) * 10) / 10);
	const carbs = Math.max(0, Math.round((Number(item.carbs) || 0) * 10) / 10);
	const fiber = Math.max(0, Math.round((Number(item.fiber) || 0) * 10) / 10);
	const sugar = Math.max(0, Math.round((Number(item.sugar) || 0) * 10) / 10);
	const sodiumMg = Math.max(0, Math.round(Number(item.sodiumMg) || 0));
	const salt = Math.round((sodiumMg / 400) * 10) / 10;

	const numOrNull = (v: unknown): number | null => {
		if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return Math.round(v * 10) / 10;
		if (typeof v === 'string') {
			const n = parseFloat(v.replace(',', '.'));
			return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : null;
		}
		return null;
	};

	const rawSat = numOrNull(item.saturatedFat);
	const rawMono = numOrNull(item.monounsaturatedFat);
	const rawPoly = numOrNull(item.polyunsaturatedFat);
	const rawTrans = numOrNull(item.transFat);

	const boundedFats = boundFats(fat, rawSat, rawMono, rawPoly, rawTrans);

	// All micronutrients (vitamins and minerals) are strictly null to avoid hallucinations
	const micros: EssentialMicros = {
		saturatedFat: boundedFats.saturatedFat,
		monounsaturatedFat: boundedFats.monounsaturatedFat,
		polyunsaturatedFat: boundedFats.polyunsaturatedFat,
		transFat: boundedFats.transFat,
		sodiumMg: sodiumMg > 0 ? sodiumMg : null,
		potassiumMg: null,
		calciumMg: null,
		magnesiumMg: null,
		ironMg: null,
		vitaminCMg: null,
		vitaminDIu: null,
		vitaminB12Mcg: null,
		vitaminAMcg: null,
		vitaminB6Mg: null
	};

	return {
		id: `ai_${Date.now()}_${idx}`,
		displayName: String(item.displayName || item.name || 'Alimento').trim(),
		amount,
		unit,
		kcal,
		protein,
		fat,
		saturatedFat: boundedFats.saturatedFat,
		monounsaturatedFat: boundedFats.monounsaturatedFat,
		polyunsaturatedFat: boundedFats.polyunsaturatedFat,
		transFat: boundedFats.transFat,
		carbs,
		fiber,
		sugar,
		salt,
		sodiumMg,
		micros
	};
}
