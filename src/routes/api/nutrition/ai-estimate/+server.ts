import type { RequestHandler } from './$types';
import { authGuard } from '#lib/auth/middleware';
import { db } from '#lib/db';
import { users } from '#lib/db/schema';
import { eq } from 'drizzle-orm';
import { checkRateLimit } from '#lib/server/loginRateLimit';
import { isMaskedApiKey } from '#lib/server/settingsPolicy';
import {
	buildEstimateSystemInstruction,
	sanitizeEstimatedItem,
	type RawAiItem
} from '#lib/server/aiEstimateUtils';

const SYSTEM_INSTRUCTION = buildEstimateSystemInstruction();

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error || !user) return error ?? Response.json({ error: 'Unauthorized' }, { status: 401 });
	// Each call can bill the server's own provider key and try several models.
	if (!checkRateLimit(`ai:${user.id}`, 30)) return Response.json({ error: 'rate_limited' }, { status: 429 });

	let body: {
		text?: string;
		imageBase64?: string;
		imageMimeType?: string;
		provider?: 'gemini' | 'openai';
		apiKey?: string;
		model?: string;
	};
	try {
		body = await event.request.json();
	} catch (e) {
		console.error('[ai-estimate] Failed to parse JSON body:', e);
		return Response.json({ error: 'invalid_json' }, { status: 400 });
	}

	const promptText = (body.text ?? '').trim();
	const imageBase64 = body.imageBase64?.replace(/^data:image\/[a-zA-Z+]+;base64,/, '').trim() || null;
	const imageMimeType = body.imageMimeType || 'image/jpeg';

	if (!promptText && !imageBase64) {
		return Response.json({ error: 'text_or_image_required' }, { status: 400 });
	}

	const userRecord = db.select().from(users).where(eq(users.id, user.id)).get();
	let userSettingsObj: Record<string, unknown> = {};
	try {
		if (userRecord?.settings) userSettingsObj = JSON.parse(userRecord.settings);
	} catch {}

	const provider = body.provider || (userSettingsObj.aiNutritionProvider as 'gemini' | 'openai') || 'gemini';
	const apiKey = (
		(isMaskedApiKey(body.apiKey) ? '' : body.apiKey) ||
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
			// Candidates in order: requested model first, followed by valid active models from Google ModelService
			const candidateModels = [
				model,
				'gemini-flash-lite-latest',
				'gemini-3.5-flash-lite',
				'gemini-flash-latest',
				'gemini-3.5-flash',
				'gemini-2.5-flash'
			].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

			let lastErrorMsg = '';
			let lastStatus = 502;

			for (const currentModel of candidateModels) {
				const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel)}:generateContent`;

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
					if (promptText) {
						parts.push({ text: promptText });
					} else {
						parts.push({ text: 'Identifica y estima nutricionalmente todos los alimentos presentes en esta foto.' });
					}

					return {
						systemInstruction: {
							parts: [{ text: SYSTEM_INSTRUCTION }]
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
						headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
						signal: AbortSignal.timeout(15000),
						body: JSON.stringify(buildPayload('primary'))
					});
				} catch (fetchErr) {
					console.warn(`[ai-estimate] Timeout or network error connecting to Gemini model ${currentModel}:`, fetchErr);
					lastErrorMsg = 'Timeout al conectar con Google Gemini (15s). Verifica tu conexión o clave de API.';
					continue;
				}

				// If model rejects the primary thinking option, try the alternate
				if (!res.ok && res.status === 400) {
					const peek = await res.clone().text().catch(() => '');
					if (peek.toLowerCase().includes('thinking') || peek.toLowerCase().includes('budget') || peek.toLowerCase().includes('level')) {
						try {
							res = await fetch(geminiUrl, {
								method: 'POST',
								headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
								signal: AbortSignal.timeout(12000),
								body: JSON.stringify(buildPayload('alternate'))
							});

							// If still rejected, fallback without thinkingConfig
							if (!res.ok && res.status === 400) {
								res = await fetch(geminiUrl, {
									method: 'POST',
									headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
									signal: AbortSignal.timeout(12000),
									body: JSON.stringify(buildPayload('none'))
								});
							}
						} catch (retryErr) {
							console.warn('[ai-estimate] Retry error:', retryErr);
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
				console.warn(`[ai-estimate] Gemini error on model ${currentModel} (${res.status}):`, errBody);
				lastErrorMsg = parsedMsg ? `Error Gemini (${res.status}): ${parsedMsg}` : `Error al consultar Gemini (${res.status}).`;
				lastStatus = res.status;

				// If it's an invalid API key, no need to retry other models
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
			const userContents: Array<Record<string, unknown>> = [];
			if (promptText) {
				userContents.push({ type: 'text', text: promptText });
			} else {
				userContents.push({ type: 'text', text: 'Identifica y estima nutricionalmente todos los alimentos presentes en esta foto.' });
			}
			if (imageBase64) {
				userContents.push({
					type: 'image_url',
					image_url: {
						url: `data:${imageMimeType};base64,${imageBase64}`
					}
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
							{ role: 'system', content: SYSTEM_INSTRUCTION },
							{ role: 'user', content: userContents }
						],
						response_format: { type: 'json_object' },
						temperature: 0.1,
						max_tokens: 2048
					})
				});
			} catch (fetchErr) {
				console.error('[ai-estimate] OpenAI timeout or fetch error:', fetchErr);
				return Response.json(
					{ error: 'AI_TIMEOUT', message: 'Timeout al conectar con OpenAI (20s). Verifica tu conexión o clave.' },
					{ status: 504 }
				);
			}

			if (!res.ok) {
				const errBody = await res.text().catch(() => '');
				let parsedMsg = '';
				try {
					const errObj = JSON.parse(errBody);
					parsedMsg = errObj?.error?.message || '';
				} catch {}
				console.error('[ai-estimate] OpenAI error:', res.status, errBody);
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

			const data = await res.json().catch(() => null);
			const candidateText = data?.choices?.[0]?.message?.content;
			if (!candidateText) {
				return Response.json({ error: 'EMPTY_RESPONSE', message: 'La IA no devolvió ningún resultado.' }, { status: 502 });
			}
			jsonContent = candidateText;
		}

		let parsed: { items?: RawAiItem[] };
		try {
			let cleaned = jsonContent.trim();
			if (cleaned.startsWith('```')) {
				cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
			}
			parsed = JSON.parse(cleaned);
		} catch {
			return Response.json({ error: 'JSON_PARSE_FAILED', message: 'La respuesta de la IA no es un JSON válido.' }, { status: 502 });
		}

		const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
		if (rawItems.length === 0) {
			return Response.json({ error: 'NO_ITEMS_FOUND', message: 'No se detectaron alimentos en la descripción.' }, { status: 400 });
		}

		const items = rawItems.map((item, idx) => sanitizeEstimatedItem(item, idx));

		return Response.json({ items });
	} catch (e) {
		console.error('[ai-estimate] Unexpected error:', e);
		return Response.json({ error: 'INTERNAL_ERROR', message: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};
