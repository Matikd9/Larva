export type NutrientValues = {
	kcal?: number | null;
	protein?: number | null;
	fat?: number | null;
	saturatedFat?: number | null;
	monounsaturatedFat?: number | null;
	polyunsaturatedFat?: number | null;
	transFat?: number | null;
	carbs?: number | null;
	fiber?: number | null;
	sugar?: number | null;
	sodiumMg?: number | null;
	potassiumMg?: number | null;
	calciumMg?: number | null;
	magnesiumMg?: number | null;
	ironMg?: number | null;
	vitaminCMg?: number | null;
	vitaminDIu?: number | null;
	vitaminB12Mcg?: number | null;
	vitaminAMcg?: number | null;
	vitaminB6Mg?: number | null;
};

export type RawNutritionLabel = {
	productName?: string | null;
	brand?: string | null;
	ingredientsText?: string | null;
	servingQuantity?: number | null;
	servingUnit?: 'g' | 'ml' | null;
	servingDescription?: string | null;
	perServing?: NutrientValues | null;
	per100?: NutrientValues | null;
	estimatedNutrients?: string[];
};

export function buildSystemInstruction(foodType: 'ultraprocessed' | 'natural'): string {
	const isNatural = foodType === 'natural';
	return `Eres un asistente experto en digitalización de información nutricional y análisis de alimentos a partir de fotografías de etiquetas o tablas nutricionales (Nutrition Facts), listas de ingredientes, o texto y contexto del producto (incluso cuando no se proporcionan fotografías).
Tu tarea es leer las imágenes y textos proporcionados para extraer y calcular:
1. "productName": Nombre o tipo del producto si es visible en la imagen o indicado en el contexto (por ejemplo "Avena Integral", "Galletas de Chocolate", "Pechuga de pollo"). Si no se indica ni se lee, pon null.
2. "brand": Marca del producto si es visible, o null.
3. "ingredientsText": Transcripción textual y limpia de la lista de ingredientes si aparece en la imagen o texto. Si no hay ingredientes visibles ni textos, pon null.
4. "servingQuantity": El tamaño numérico de 1 porción según la etiqueta o contexto (ejemplo: si dice "1 PORCIÓN 32G", el valor es 32; si dice "1 scoop (30g)", el valor es 30; si dice "100g", el valor es 100). NUNCA inventes números aleatorios. Si no se indica porción, pon 100.
5. "servingUnit": Unidad de la porción ("g" o "ml").
6. "servingDescription": Descripción adicional de la porción si existe (ej. "1 scoop colmado", "1 filete", "2 galletas"), o null.
7. "perServing": Objeto con los valores de los nutrientes POR PORCIÓN.
8. "per100": Objeto con los valores de los nutrientes POR 100g o 100ml.

MODO DEL PRODUCTO: ${isNatural ? 'ALIMENTO NATURAL DE UN SOLO INGREDIENTE (100% PURO)' : 'PRODUCTO ULTRAPROCESADO / MULTI-INGREDIENTE'}

REGLAS DE ORO PARA NUTRIENTES:
- NÚMEROS OFICIALES Y DATOS CONOCIDOS: Extrae con total exactitud los valores impresos en la tabla nutricional. Si se proporcionan valores base ya conocidos (como kcal, proteínas o grasas ya registradas), CONSERVA esos valores y úsalos como referencia para calcular y escalar los micronutrientes y desglose de grasas faltantes.
${isNatural ? `- REGLA PARA ALIMENTOS NATURALES (1 SOLO INGREDIENTE PURO):
  Al tratarse de un alimento natural de un solo ingrediente (ej. pechuga de pollo, avena pura, arroz blanco o integral, lentejas, almendras, aceite de oliva, miel pura, manzana, huevo):
  Si no hay fotos, básate enteramente en el nombre del alimento y en la tabla estándar de composición de alimentos de referencia (USDA FoodData Central) para este alimento puro.
  Rellena las grasas faltantes (saturadas, mono, poli) y TODOS los micronutrientes principales (potasio, calcio, magnesio, hierro, sodio, vitaminas C, D, B12, A, B6) utilizando los valores de las tablas estándar de referencia (USDA FoodData Central) para este alimento puro, escalándolos fielmente a los gramos de la porción y a 100g.
  Registra en "estimatedNutrients" los nombres de las claves de los nutrientes que hayas deducido o completado de las tablas de referencia.` : `- REGLA ESTRICTA PARA ULTRAPROCESADOS (CERO ALUCINACIONES DE MICRONUTRIENTES):
  1. DESGLOSE DE GRASAS: Si la tabla nutricional tiene el total de grasas o se lista la lista de ingredientes, puedes estimar una distribución aproximada y conservadora para "saturatedFat", "monounsaturatedFat", "polyunsaturatedFat" y "transFat" basada en los aceites o grasas del producto, ASEGURANDO ESTRICTAMENTE que (saturatedFat + monounsaturatedFat + polyunsaturatedFat + transFat) NUNCA supere el total de "fat". Añade las claves de grasas estimadas a "estimatedNutrients".
  2. MICRONUTRIENTES Y FIBRA PROHIBIDO INVENTAR: NUNCA deduzcas ni inventes valores para micronutrientes (potassiumMg, calciumMg, magnesiumMg, ironMg, vitaminCMg, vitaminDIu, vitaminB12Mcg, vitaminAMcg, vitaminB6Mg), fibra (fiber) ni azúcar (sugar) si NO están explícitamente impresos con número en la tabla nutricional.
  Cualquier vitamina, mineral, fibra o azúcar que no figure explícitamente en la tabla DEBE ser devuelto estrictamente como null. NUNCA pongas números inventados en ultraprocesados.`}
- "estimatedNutrients": Lista de strings con los nombres exactos de las claves de los nutrientes que fueron ESTIMADOS/DEDUCIDOS por ti por no estar impresos con números en la tabla nutricional (ej: ${isNatural ? '["fiber", "magnesiumMg", "potassiumMg", "monounsaturatedFat"]' : '["monounsaturatedFat", "polyunsaturatedFat"]'}). Si todos los números estaban en la tabla, devuelve [].

Nutrientes numéricos:
- kcal: Calorías / Energía en kcal
- protein: Proteínas en g
- fat: Grasas totales en g
- saturatedFat: Grasas saturadas en g
- monounsaturatedFat: Grasas monoinsaturadas en g
- polyunsaturatedFat: Grasas poliinsaturadas en g
- transFat: Grasas trans en g
- carbs: Carbohidratos (o hidratos de carbono disponibles) en g
- fiber: Fibra dietética en g ${isNatural ? '(extraída o completada según USDA)' : '(extraída SOLO si viene en la tabla, sino null)'}
- sugar: Azúcares totales en g ${isNatural ? '(extraído o completado según USDA)' : '(extraído SOLO si viene en la tabla, sino null)'}
- sodiumMg: Sodio en mg
- potassiumMg: Potasio en mg
- calciumMg: Calcio en mg
- magnesiumMg: Magnesio en mg
- ironMg: Hierro en mg
- vitaminCMg: Vitamina C en mg
- vitaminDIu: Vitamina D en UI
- vitaminB12Mcg: Vitamina B12 en mcg
- vitaminAMcg: Vitamina A en mcg
- vitaminB6Mg: Vitamina B6 en mg

Si un nutriente no está en la tabla ${isNatural ? 'ni corresponde a las tablas estándar de este alimento natural' : ''}, pon null. Si la etiqueta indica 0 o "< 0.5", pon 0.
Ignora listas largas de aminoácidos para evitar truncamientos de tokens.

Responde ÚNICAMENTE con un JSON con la estructura indicada:
{
  "productName": ${isNatural ? '"Avena en Hojuelas Integral"' : '"Galletas Rellenas de Chocolate"'},
  "brand": null,
  "ingredientsText": ${isNatural ? '"Avena integral."' : '"Harina de trigo, azúcar, aceite de palma, cacao en polvo, lecitina de soya, saborizante artificial."'},
  "servingQuantity": 30,
  "servingUnit": "g",
  "servingDescription": ${isNatural ? '"1 porción (3 cucharadas)"' : '"2 galletas"'},
  "perServing": {
    "kcal": 115,
    "protein": 4.0,
    "fat": 2.2,
    "saturatedFat": 0.4,
    "monounsaturatedFat": 0.8,
    "polyunsaturatedFat": 0.9,
    "transFat": 0.0,
    "carbs": 18.5,
    "fiber": ${isNatural ? '3.0' : 'null'},
    "sugar": ${isNatural ? '0.3' : 'null'},
    "sodiumMg": 2,
    "potassiumMg": ${isNatural ? '110' : 'null'},
    "calciumMg": ${isNatural ? '16' : 'null'},
    "magnesiumMg": ${isNatural ? '42' : 'null'},
    "ironMg": ${isNatural ? '1.4' : 'null'},
    "vitaminCMg": null,
    "vitaminDIu": null,
    "vitaminB12Mcg": null,
    "vitaminAMcg": null,
    "vitaminB6Mg": ${isNatural ? '0.04' : 'null'}
  },
  "per100": {
    "kcal": 383,
    "protein": 13.3,
    "fat": 7.3,
    "saturatedFat": 1.3,
    "monounsaturatedFat": 2.7,
    "polyunsaturatedFat": 3.0,
    "transFat": 0.0,
    "carbs": 61.7,
    "fiber": ${isNatural ? '10.0' : 'null'},
    "sugar": ${isNatural ? '1.0' : 'null'},
    "sodiumMg": 6,
    "potassiumMg": ${isNatural ? '367' : 'null'},
    "calciumMg": ${isNatural ? '54' : 'null'},
    "magnesiumMg": ${isNatural ? '140' : 'null'},
    "ironMg": ${isNatural ? '4.7' : 'null'},
    "vitaminCMg": null,
    "vitaminDIu": null,
    "vitaminB12Mcg": null,
    "vitaminAMcg": null,
    "vitaminB6Mg": ${isNatural ? '0.13' : 'null'}
  },
  "estimatedNutrients": ${isNatural ? '["fiber", "monounsaturatedFat", "polyunsaturatedFat", "potassiumMg", "calciumMg", "magnesiumMg", "ironMg", "vitaminB6Mg"]' : '["monounsaturatedFat", "polyunsaturatedFat"]'}
}`;
}

export function numOrNull(v: unknown): number | null {
	if (typeof v === 'number' && Number.isFinite(v)) return v;
	if (typeof v === 'string') {
		const n = parseFloat(v.replace(',', '.'));
		return Number.isFinite(n) ? n : null;
	}
	return null;
}

export function parseNutrientBlock(raw: unknown): NutrientValues | null {
	if (!raw || typeof raw !== 'object') return null;
	const r = raw as Record<string, unknown>;

	const kcal = numOrNull(r.kcal ?? r.calories ?? r.energyKcal ?? r.energiaKcal);
	const protein = numOrNull(r.protein ?? r.proteina ?? r.proteins);
	const fat = numOrNull(r.fat ?? r.grasa ?? r.grasasTotales ?? r.totalFat);
	const saturatedFat = numOrNull(r.saturatedFat ?? r.grasaSaturada ?? r.grasasSaturadas);
	const monounsaturatedFat = numOrNull(r.monounsaturatedFat ?? r.grasaMonoinsaturada ?? r.grasasMonoinsaturadas);
	const polyunsaturatedFat = numOrNull(r.polyunsaturatedFat ?? r.grasaPoliinsaturada ?? r.grasasPoliinsaturadas);
	const transFat = numOrNull(r.transFat ?? r.grasaTrans ?? r.grasasTrans);
	const carbs = numOrNull(r.carbs ?? r.carbohidratos ?? r.carbohydrates ?? r.hidratosDeCarbono);
	const fiber = numOrNull(r.fiber ?? r.fibra ?? r.fibraDietetica ?? r.dietaryFiber);
	const sugar = numOrNull(r.sugar ?? r.azucar ?? r.azucares ?? r.sugars ?? r.azucaresTotales);
	const sodiumMg = numOrNull(r.sodiumMg ?? r.sodium ?? r.sodio ?? r.sodioMg);
	const potassiumMg = numOrNull(r.potassiumMg ?? r.potassium ?? r.potasio ?? r.potasioMg);
	const calciumMg = numOrNull(r.calciumMg ?? r.calcium ?? r.calcio ?? r.calcioMg);
	const magnesiumMg = numOrNull(r.magnesiumMg ?? r.magnesium ?? r.magnesio ?? r.magnesioMg);
	const ironMg = numOrNull(r.ironMg ?? r.iron ?? r.hierro ?? r.hierroMg);
	const vitaminCMg = numOrNull(r.vitaminCMg ?? r.vitaminC ?? r.vitaminaC ?? r.vitaminaCMg);
	const vitaminDIu = numOrNull(r.vitaminDIu ?? r.vitaminD ?? r.vitaminaD ?? r.vitaminaDIu);
	const vitaminB12Mcg = numOrNull(r.vitaminB12Mcg ?? r.vitaminB12 ?? r.vitaminaB12 ?? r.vitaminaB12Mcg);
	const vitaminAMcg = numOrNull(r.vitaminAMcg ?? r.vitaminA ?? r.vitaminaA ?? r.vitaminaAMcg);
	const vitaminB6Mg = numOrNull(r.vitaminB6Mg ?? r.vitaminB6 ?? r.vitaminaB6 ?? r.vitaminaB6Mg);

	const hasAny = [
		kcal, protein, fat, saturatedFat, monounsaturatedFat, polyunsaturatedFat, transFat,
		carbs, fiber, sugar, sodiumMg, potassiumMg, calciumMg, magnesiumMg, ironMg,
		vitaminCMg, vitaminDIu, vitaminB12Mcg, vitaminAMcg, vitaminB6Mg
	].some((v) => v != null);

	if (!hasAny) return null;

	return {
		kcal,
		protein,
		fat,
		saturatedFat,
		monounsaturatedFat,
		polyunsaturatedFat,
		transFat,
		carbs,
		fiber,
		sugar,
		sodiumMg,
		potassiumMg,
		calciumMg,
		magnesiumMg,
		ironMg,
		vitaminCMg,
		vitaminDIu,
		vitaminB12Mcg,
		vitaminAMcg,
		vitaminB6Mg
	};
}

export function parseLabelJson(text: string): RawNutritionLabel | null {
	try {
		let clean = text.trim();
		const match = clean.match(/```(?:json)?\s*([\s\S]*?)```/);
		if (match) clean = match[1].trim();
		const parsed = JSON.parse(clean);
		if (!parsed || typeof parsed !== 'object') return null;

		const sq = numOrNull(parsed.servingQuantity);
		const unit: 'g' | 'ml' = parsed.servingUnit === 'ml' ? 'ml' : 'g';
		const desc = typeof parsed.servingDescription === 'string' && parsed.servingDescription.trim() ? parsed.servingDescription.trim() : null;

		let perServing = parseNutrientBlock(parsed.perServing);
		let per100 = parseNutrientBlock(parsed.per100);

		// Fallback if model returned top-level keys
		if (!perServing && !per100) {
			const topLevel = parseNutrientBlock(parsed);
			if (parsed.isPerServing === false) {
				per100 = topLevel;
			} else {
				perServing = topLevel;
			}
		}

		// Cross-fill missing column if portion size is known
		if (sq && sq > 0) {
			if (perServing && !per100) {
				const factor = 100 / sq;
				per100 = {
					kcal: perServing.kcal != null ? Math.round(perServing.kcal * factor * 10) / 10 : null,
					protein: perServing.protein != null ? Math.round(perServing.protein * factor * 10) / 10 : null,
					fat: perServing.fat != null ? Math.round(perServing.fat * factor * 10) / 10 : null,
					carbs: perServing.carbs != null ? Math.round(perServing.carbs * factor * 10) / 10 : null,
					fiber: perServing.fiber != null ? Math.round(perServing.fiber * factor * 10) / 10 : null,
					sugar: perServing.sugar != null ? Math.round(perServing.sugar * factor * 10) / 10 : null,
					sodiumMg: perServing.sodiumMg != null ? Math.round(perServing.sodiumMg * factor) : null,
					potassiumMg: perServing.potassiumMg != null ? Math.round(perServing.potassiumMg * factor) : null,
					calciumMg: perServing.calciumMg != null ? Math.round(perServing.calciumMg * factor) : null,
					magnesiumMg: perServing.magnesiumMg != null ? Math.round(perServing.magnesiumMg * factor) : null,
					ironMg: perServing.ironMg != null ? Math.round(perServing.ironMg * factor * 10) / 10 : null,
					vitaminCMg: perServing.vitaminCMg != null ? Math.round(perServing.vitaminCMg * factor * 10) / 10 : null,
					vitaminDIu: perServing.vitaminDIu != null ? Math.round(perServing.vitaminDIu * factor) : null,
					vitaminB12Mcg: perServing.vitaminB12Mcg != null ? Math.round(perServing.vitaminB12Mcg * factor * 10) / 10 : null,
					vitaminAMcg: perServing.vitaminAMcg != null ? Math.round(perServing.vitaminAMcg * factor) : null,
					vitaminB6Mg: perServing.vitaminB6Mg != null ? Math.round(perServing.vitaminB6Mg * factor * 10) / 10 : null
				};
			} else if (per100 && !perServing) {
				const factor = sq / 100;
				perServing = {
					kcal: per100.kcal != null ? Math.round(per100.kcal * factor * 10) / 10 : null,
					protein: per100.protein != null ? Math.round(per100.protein * factor * 10) / 10 : null,
					fat: per100.fat != null ? Math.round(per100.fat * factor * 10) / 10 : null,
					carbs: per100.carbs != null ? Math.round(per100.carbs * factor * 10) / 10 : null,
					fiber: per100.fiber != null ? Math.round(per100.fiber * factor * 10) / 10 : null,
					sugar: per100.sugar != null ? Math.round(per100.sugar * factor * 10) / 10 : null,
					sodiumMg: per100.sodiumMg != null ? Math.round(per100.sodiumMg * factor) : null,
					potassiumMg: per100.potassiumMg != null ? Math.round(per100.potassiumMg * factor) : null,
					calciumMg: per100.calciumMg != null ? Math.round(per100.calciumMg * factor) : null,
					magnesiumMg: per100.magnesiumMg != null ? Math.round(per100.magnesiumMg * factor) : null,
					ironMg: per100.ironMg != null ? Math.round(per100.ironMg * factor * 10) / 10 : null,
					vitaminCMg: per100.vitaminCMg != null ? Math.round(per100.vitaminCMg * factor * 10) / 10 : null,
					vitaminDIu: per100.vitaminDIu != null ? Math.round(per100.vitaminDIu * factor) : null,
					vitaminB12Mcg: per100.vitaminB12Mcg != null ? Math.round(per100.vitaminB12Mcg * factor * 10) / 10 : null,
					vitaminAMcg: per100.vitaminAMcg != null ? Math.round(per100.vitaminAMcg * factor) : null,
					vitaminB6Mg: per100.vitaminB6Mg != null ? Math.round(per100.vitaminB6Mg * factor * 10) / 10 : null
				};
			}
		}

		return {
			productName: typeof parsed.productName === 'string' && parsed.productName.trim() ? parsed.productName.trim() : null,
			brand: typeof parsed.brand === 'string' && parsed.brand.trim() ? parsed.brand.trim() : null,
			ingredientsText: typeof parsed.ingredientsText === 'string' && parsed.ingredientsText.trim() ? parsed.ingredientsText.trim() : null,
			servingQuantity: sq,
			servingUnit: unit,
			servingDescription: desc,
			perServing,
			per100,
			estimatedNutrients: Array.isArray(parsed.estimatedNutrients)
				? parsed.estimatedNutrients.filter((k: unknown): k is string => typeof k === 'string')
				: []
		};
	} catch (e) {
		console.error('[ai-nutrition-label] Failed to parse JSON:', e, text);
		return null;
	}
}

export function sanitizeLabelForFoodType(label: RawNutritionLabel, foodType: 'ultraprocessed' | 'natural'): RawNutritionLabel {
	if (foodType !== 'ultraprocessed') return label;

	const copy: RawNutritionLabel = {
		...label,
		perServing: label.perServing ? { ...label.perServing } : null,
		per100: label.per100 ? { ...label.per100 } : null,
		estimatedNutrients: label.estimatedNutrients ? [...label.estimatedNutrients] : []
	};

	// Strip any hallucinated micronutrients, fiber or sugar if marked as estimated
	const microKeys: Array<keyof NutrientValues> = [
		'potassiumMg', 'calciumMg', 'magnesiumMg', 'ironMg',
		'vitaminCMg', 'vitaminDIu', 'vitaminB12Mcg', 'vitaminAMcg', 'vitaminB6Mg',
		'fiber', 'sugar'
	];
	if (copy.estimatedNutrients && copy.estimatedNutrients.length > 0) {
		const estimatedSet = new Set(copy.estimatedNutrients);
		for (const k of microKeys) {
			if (estimatedSet.has(k)) {
				if (copy.perServing) (copy.perServing as Record<string, unknown>)[k] = null;
				if (copy.per100) (copy.per100 as Record<string, unknown>)[k] = null;
			}
		}
		copy.estimatedNutrients = copy.estimatedNutrients.filter((k) => !microKeys.includes(k as keyof NutrientValues));
	}

	// Validate fat breakdown sum <= total fat
	const enforceFatBounds = (block: NutrientValues | null | undefined) => {
		if (!block || block.fat == null) return;
		const sum = (block.saturatedFat ?? 0) + (block.monounsaturatedFat ?? 0) + (block.polyunsaturatedFat ?? 0) + (block.transFat ?? 0);
		if (sum > block.fat && sum > 0) {
			const scale = block.fat / sum;
			if (block.saturatedFat != null) block.saturatedFat = Math.round(block.saturatedFat * scale * 10) / 10;
			if (block.monounsaturatedFat != null) block.monounsaturatedFat = Math.round(block.monounsaturatedFat * scale * 10) / 10;
			if (block.polyunsaturatedFat != null) block.polyunsaturatedFat = Math.round(block.polyunsaturatedFat * scale * 10) / 10;
			if (block.transFat != null) block.transFat = Math.round(block.transFat * scale * 10) / 10;

			// If decimal rounding caused sum to slightly exceed total fat, adjust to guarantee sum <= total fat
			let roundedSum = Math.round(((block.saturatedFat ?? 0) + (block.monounsaturatedFat ?? 0) + (block.polyunsaturatedFat ?? 0) + (block.transFat ?? 0)) * 10) / 10;
			if (roundedSum > block.fat) {
				const diff = Math.round((roundedSum - block.fat) * 10) / 10;
				if (block.monounsaturatedFat != null && block.monounsaturatedFat >= diff) {
					block.monounsaturatedFat = Math.round((block.monounsaturatedFat - diff) * 10) / 10;
				} else if (block.polyunsaturatedFat != null && block.polyunsaturatedFat >= diff) {
					block.polyunsaturatedFat = Math.round((block.polyunsaturatedFat - diff) * 10) / 10;
				} else if (block.saturatedFat != null && block.saturatedFat >= diff) {
					block.saturatedFat = Math.round((block.saturatedFat - diff) * 10) / 10;
				}
			}
		}
	};
	enforceFatBounds(copy.perServing);
	enforceFatBounds(copy.per100);

	return copy;
}
