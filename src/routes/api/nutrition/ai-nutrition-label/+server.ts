import type { RequestHandler } from './$types';
import { authGuard } from '#lib/auth/middleware';
import { db } from '#lib/db';
import { users } from '#lib/db/schema';
import { eq } from 'drizzle-orm';
import {
	buildSystemInstruction,
	sanitizeLabelForFoodType,
	parseLabelJson,
	type RawNutritionLabel,
	type NutrientValues
} from '#lib/server/aiNutritionLabel';

export type { RawNutritionLabel, NutrientValues };

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error || !user) return error ?? Response.json({ error: 'Unauthorized', message: 'No has iniciado sesión.' }, { status: 401 });

	let body: {
		foodType?: 'ultraprocessed' | 'natural';
		imageBase64?: string;
		imageMimeType?: string;
		ingredientsImageBase64?: string;
		ingredientsImageMimeType?: string;
		foodContext?: string;
		ingredientsText?: string;
		existingMacros?: {
			kcal?: number | null;
			protein?: number | null;
			fat?: number | null;
			carbs?: number | null;
			servingQuantity?: number | null;
			servingUnit?: 'g' | 'ml' | null;
		};
		provider?: 'gemini' | 'openai';
		apiKey?: string;
		model?: string;
	};
	try {
		body = await event.request.json();
	} catch (e) {
		console.error('[ai-nutrition-label] Failed to parse JSON body:', e);
		return Response.json({ error: 'invalid_json', message: 'El archivo de imagen es demasiado grande o no es un JSON válido.' }, { status: 400 });
	}

	const foodType: 'ultraprocessed' | 'natural' = body.foodType === 'natural' ? 'natural' : 'ultraprocessed';
	const imageBase64 = body.imageBase64?.replace(/^data:image\/[a-zA-Z+]+;base64,/, '').trim() || null;
	const imageMimeType = body.imageMimeType || 'image/jpeg';
	const ingredientsImageBase64 = body.ingredientsImageBase64?.replace(/^data:image\/[a-zA-Z+]+;base64,/, '').trim() || null;
	const ingredientsImageMimeType = body.ingredientsImageMimeType || 'image/jpeg';
	const foodContext = (body.foodContext ?? '').trim();
	const manualIngredientsText = (body.ingredientsText ?? '').trim();

	// Photos are optional if sufficient text context is provided
	if (!imageBase64 && !ingredientsImageBase64) {
		if (foodType === 'natural' && !foodContext && !manualIngredientsText) {
			return Response.json(
				{ error: 'input_required', message: 'Indica el nombre del alimento natural o sube una foto para analizar.' },
				{ status: 400 }
			);
		}
		if (foodType === 'ultraprocessed' && !manualIngredientsText) {
			return Response.json(
				{ error: 'input_required', message: 'Para ultraprocesados sin foto de tabla, debes escribir o pegar la lista de ingredientes.' },
				{ status: 400 }
			);
		}
	}

	const hasImages = !!(imageBase64 || ingredientsImageBase64);
	let userPrompt = hasImages
		? `Analiza la imagen o imágenes en modo "${foodType === 'natural' ? 'ALIMENTO NATURAL 1 INGREDIENTE' : 'ULTRAPROCESADO / MULTI-INGREDIENTE'}" y extrae los datos en el formato JSON indicado.`
		: `Estima y completa la información nutricional y micronutrientes en modo "${foodType === 'natural' ? 'ALIMENTO NATURAL 1 INGREDIENTE' : 'ULTRAPROCESADO / MULTI-INGREDIENTE'}" sin imágenes a partir del nombre y datos provistos, en el formato JSON indicado.`;

	if (foodContext) {
		userPrompt += `\nNombre o contexto del alimento indicado: "${foodContext}".`;
	}
	if (manualIngredientsText) {
		userPrompt += `\nTexto de ingredientes provisto: "${manualIngredientsText}".`;
	}
	if (ingredientsImageBase64) {
		userPrompt += '\nSe incluye una foto adicional con la lista de ingredientes.';
	}
	if (body.existingMacros) {
		const m = body.existingMacros;
		const knownParts: string[] = [];
		if (m.kcal != null) knownParts.push(`Energía: ${m.kcal} kcal`);
		if (m.protein != null) knownParts.push(`Proteínas: ${m.protein} g`);
		if (m.fat != null) knownParts.push(`Grasas: ${m.fat} g`);
		if (m.carbs != null) knownParts.push(`Carbohidratos: ${m.carbs} g`);
		if (m.servingQuantity != null) knownParts.push(`Porción: ${m.servingQuantity} ${m.servingUnit || 'g'}`);
		if (knownParts.length > 0) {
			userPrompt += `\nValores base ya conocidos del alimento: [${knownParts.join(', ')}]. CONSERVA estos valores en el resultado y úsalos como referencia para calcular y escalar los micronutrientes y reparto de grasas.`;
		}
	}

	const systemInstruction = buildSystemInstruction(foodType);

	const userRecord = db.select().from(users).where(eq(users.id, user.id)).get();
	let userSettingsObj: Record<string, unknown> = {};
	try {
		if (userRecord?.settings) userSettingsObj = JSON.parse(userRecord.settings);
	} catch {}

	const provider = body.provider || (userSettingsObj.aiNutritionProvider as 'gemini' | 'openai') || 'gemini';
	const apiKey = (
		body.apiKey ||
		(provider === 'gemini'
			? (userSettingsObj.aiGeminiApiKey as string)
			: (userSettingsObj.aiOpenaiApiKey as string)) ||
		(userSettingsObj.aiNutritionApiKey as string) ||
		(provider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY) ||
		''
	).trim();

	let model = (
		body.model ||
		(provider === 'gemini'
			? (userSettingsObj.aiGeminiModel as string)
			: (userSettingsObj.aiOpenaiModel as string)) ||
		(provider === 'gemini' ? 'gemini-flash-lite-latest' : 'gpt-4o-mini')
	).trim();

	// Auto-upgrade legacy or retired Gemini models
	if (
		provider === 'gemini' &&
		(model === 'gemini-1.5-flash' ||
			model === 'gemini-2.0-flash' ||
			model === 'gemini-2.0-flash-lite' ||
			model === 'gemini-2.5-flash-lite' ||
			!model)
	) {
		model = 'gemini-flash-lite-latest';
	}

	if (!apiKey) {
		return Response.json(
			{
				error: 'NO_API_KEY',
				message: 'No se ha configurado ninguna API Key para la IA. Por favor ingrésala en Ajustes > Inteligencia Artificial.'
			},
			{ status: 400 }
		);
	}

	try {
		let jsonContent = '';

		if (provider === 'gemini') {
			const candidateModels = [
				model,
				'gemini-flash-lite-latest',
				'gemini-2.5-flash-lite',
				'gemini-2.0-flash'
			].filter((m, i, arr) => arr.indexOf(m) === i);

			let lastErrorMsg = '';
			let lastStatus = 502;

			for (const currentModel of candidateModels) {
				const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;
				const isV3OrLater = currentModel.includes('gemini-3') || currentModel.includes('gemini-4') || currentModel.includes('latest');

				const buildPayload = (thinkingMode: 'primary' | 'alternate' | 'none') => {
					let thinkingConfig: Record<string, unknown> = {};
					if (thinkingMode === 'primary') {
						thinkingConfig = isV3OrLater ? { thinkingLevel: 'LOW' } : { thinkingBudget: 0 };
					} else if (thinkingMode === 'alternate') {
						thinkingConfig = isV3OrLater ? { thinkingBudget: 0 } : { thinkingLevel: 'LOW' };
					}

					const parts: Array<Record<string, unknown>> = [];
					if (imageBase64) {
						parts.push({
							inlineData: {
								mimeType: imageMimeType,
								data: imageBase64
							}
						});
					}
					if (ingredientsImageBase64) {
						parts.push({
							inlineData: {
								mimeType: ingredientsImageMimeType,
								data: ingredientsImageBase64
							}
						});
					}
					parts.push({ text: userPrompt });

					return {
						systemInstruction: {
							parts: [{ text: systemInstruction }]
						},
						contents: [
							{
								role: 'user',
								parts
							}
						],
						generationConfig: {
							responseMimeType: 'application/json',
							temperature: 0.1,
							maxOutputTokens: 2048,
							...(thinkingMode !== 'none' ? { thinkingConfig } : {})
						}
					};
				};

				let res: Response;
				try {
					res = await fetch(geminiUrl, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						signal: AbortSignal.timeout(15000),
						body: JSON.stringify(buildPayload('primary'))
					});
				} catch (fetchErr) {
					console.warn(`[ai-nutrition-label] Timeout or network error connecting to Gemini model ${currentModel}:`, fetchErr);
					lastErrorMsg = 'Timeout al conectar con Google Gemini (15s). Verifica tu conexión o clave de API.';
					continue;
				}

				if (!res.ok && res.status === 400) {
					const peek = await res.clone().text().catch(() => '');
					if (peek.toLowerCase().includes('thinking') || peek.toLowerCase().includes('budget') || peek.toLowerCase().includes('level')) {
						try {
							res = await fetch(geminiUrl, {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								signal: AbortSignal.timeout(12000),
								body: JSON.stringify(buildPayload('alternate'))
							});

							if (!res.ok && res.status === 400) {
								res = await fetch(geminiUrl, {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									signal: AbortSignal.timeout(12000),
									body: JSON.stringify(buildPayload('none'))
								});
							}
						} catch (retryErr) {
							console.warn('[ai-nutrition-label] Retry error:', retryErr);
						}
					}
				}

				if (res.ok) {
					const data = await res.json().catch(() => null);
					const parts = data?.candidates?.[0]?.content?.parts;
					let candidateText = '';
					if (Array.isArray(parts)) {
						const textPart = parts.find((p: { text?: string; thought?: boolean }) => p.text && !p.thought) ?? parts[0];
						candidateText = textPart?.text || '';
					}
					if (candidateText) {
						jsonContent = candidateText;
						break;
					}
				}

				const errBody = await res.text().catch(() => '');
				let parsedMsg = '';
				try {
					const errObj = JSON.parse(errBody);
					parsedMsg = errObj?.error?.message || '';
				} catch {}
				console.warn(`[ai-nutrition-label] Gemini error on model ${currentModel} (${res.status}):`, errBody);
				lastErrorMsg = parsedMsg ? `Error Gemini (${res.status}): ${parsedMsg}` : `Error al consultar Gemini (${res.status}).`;
				lastStatus = res.status;

				if (res.status === 400 && (errBody.includes('API_KEY_INVALID') || errBody.includes('API key not valid'))) {
					break;
				}
			}

			if (!jsonContent) {
				return Response.json(
					{
						error: 'AI_CALL_FAILED',
						message: lastErrorMsg || 'Error al consultar Gemini. Verifica tu API Key o prueba otro modelo en Ajustes.'
					},
					{ status: lastStatus >= 400 && lastStatus < 600 ? lastStatus : 502 }
				);
			}
		} else {
			// OpenAI
			const openaiUrl = 'https://api.openai.com/v1/chat/completions';
			const openaiContent: Array<Record<string, unknown>> = [
				{ type: 'text', text: userPrompt }
			];
			if (imageBase64) {
				openaiContent.push({
					type: 'image_url',
					image_url: { url: `data:${imageMimeType};base64,${imageBase64}` }
				});
			}
			if (ingredientsImageBase64) {
				openaiContent.push({
					type: 'image_url',
					image_url: { url: `data:${ingredientsImageMimeType};base64,${ingredientsImageBase64}` }
				});
			}

			let res: Response;
			try {
				res = await fetch(openaiUrl, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${apiKey}`
					},
					signal: AbortSignal.timeout(20000),
					body: JSON.stringify({
						model,
						messages: [
							{ role: 'system', content: systemInstruction },
							{ role: 'user', content: openaiContent }
						],
						response_format: { type: 'json_object' },
						temperature: 0.1,
						max_tokens: 2048
					})
				});
			} catch (fetchErr) {
				console.error('[ai-nutrition-label] OpenAI timeout or fetch error:', fetchErr);
				return Response.json(
					{ error: 'AI_TIMEOUT', message: 'Timeout al conectar con OpenAI (20s). Verifica tu conexión o clave.' },
					{ status: 504 }
				);
			}

			if (!res.ok) {
				const errBody = await res.text();
				let parsedMsg = '';
				try {
					const errObj = JSON.parse(errBody);
					parsedMsg = errObj?.error?.message || '';
				} catch {}
				console.error('[ai-nutrition-label] OpenAI error:', res.status, errBody);
				return Response.json(
					{
						error: 'AI_CALL_FAILED',
						message: parsedMsg
							? `Error OpenAI (${res.status}): ${parsedMsg}`
							: `Error al consultar OpenAI (${res.status}). Verifica tu API Key y modelo seleccionado.`
					},
					{ status: 502 }
				);
			}

			const data = await res.json();
			jsonContent = data?.choices?.[0]?.message?.content || '';
		}

		const label = parseLabelJson(jsonContent);
		if (!label || (!label.perServing && !label.per100)) {
			return Response.json(
				{
					error: 'PARSE_FAILED',
					message: 'No se pudo interpretar la información nutricional de la imagen. Intenta enfocar más cerca la tabla de calorías y nutrientes.'
				},
				{ status: 422 }
			);
		}

		const sanitized = sanitizeLabelForFoodType(label, foodType);
		return Response.json({ label: sanitized });
	} catch (e) {
		console.error('[ai-nutrition-label] Unexpected error:', e);
		return Response.json(
			{
				error: 'INTERNAL_ERROR',
				message: e instanceof Error ? e.message : 'Error inesperado al procesar la imagen'
			},
			{ status: 500 }
		);
	}
};
