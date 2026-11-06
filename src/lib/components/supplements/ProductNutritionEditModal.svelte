<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n.svelte';
	import { userSettings } from '#lib/userSettings.svelte';
	import ManageSheetShell from './ManageSheetShell.svelte';
	import { type EssentialMicros } from '#lib/micronutrients';

	export type UpdatedProductData = {
		name: string;
		brand: string | null;
		servingQuantity: number | null;
		servingSize: string | null;
		kcalPer100: number | null;
		proteinPer100: number | null;
		fatPer100: number | null;
		carbsPer100: number | null;
		sugarPer100: number | null;
		fiberPer100: number | null;
		saltPer100: number | null;
		micros?: EssentialMicros | null;
		ingredientsText?: string | null;
	};

	type NutrientValues = {
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

	let {
		barcode = null,
		initialData,
		autoTakePhoto = false,
		initialFoodType = 'ultraprocessed',
		onclose,
		onsave
	}: {
		barcode?: string | null;
		initialData: {
			name: string;
			brand?: string | null;
			servingQuantity?: number | null;
			servingSize?: string | null;
			kcalPer100?: number | null;
			proteinPer100?: number | null;
			fatPer100?: number | null;
			carbsPer100?: number | null;
			sugarPer100?: number | null;
			fiberPer100?: number | null;
			saltPer100?: number | null;
			micros?: EssentialMicros | null;
			ingredientsText?: string | null;
		};
		autoTakePhoto?: boolean;
		initialFoodType?: 'ultraprocessed' | 'natural';
		onclose: () => void;
		onsave: (data: UpdatedProductData) => void;
	} = $props();

	let foodType = $state<'ultraprocessed' | 'natural'>('ultraprocessed');
	let name = $state('');
	let brand = $state('');
	let foodContext = $state('');
	let ingredientsText = $state('');
	let servingQuantity = $state('30');
	let servingUnit = $state<'g' | 'ml'>('g');
	let inputMode = $state<'perServing' | 'per100g'>('perServing');

	// Inputs for nutrients
	let kcalInput = $state<string>('');
	let proteinInput = $state<string>('');
	let fatInput = $state<string>('');
	let saturatedFatInput = $state<string>('');
	let monounsaturatedFatInput = $state<string>('');
	let polyunsaturatedFatInput = $state<string>('');
	let transFatInput = $state<string>('');
	let showFatsBreakdown = $state(false);
	let carbsInput = $state<string>('');
	let fiberInput = $state<string>('');
	let sugarInput = $state<string>('');
	let sodiumMgInput = $state<string>('');

	// Essential Vitamins & Minerals
	let potassiumMgInput = $state<string>('');
	let calciumMgInput = $state<string>('');
	let magnesiumMgInput = $state<string>('');
	let ironMgInput = $state<string>('');
	let vitaminCMgInput = $state<string>('');
	let vitaminDIuInput = $state<string>('');
	let vitaminB12McgInput = $state<string>('');
	let vitaminAMcgInput = $state<string>('');
	let vitaminB6MgInput = $state<string>('');

	// Stored raw extractions from AI
	let extractedPerServing = $state<NutrientValues | null>(null);
	let extractedPer100 = $state<NutrientValues | null>(null);

	// Photos state for dual scanning
	let tableImageBase64 = $state<string | null>(null);
	let tableImageMime = $state<string>('image/jpeg');
	let tableImagePreview = $state<string | null>(null);

	let ingredientsImageBase64 = $state<string | null>(null);
	let ingredientsImageMime = $state<string>('image/jpeg');
	let ingredientsImagePreview = $state<string | null>(null);

	// Estimated nutrients tracking (~ IA)
	let estimatedNutrientKeys = $state<Set<string>>(new Set());

	let showMicros = $state(false);
	let showVitaminsAndMinerals = $state(false);
	let analyzingPhoto = $state(false);
	let aiSuccessMsg = $state<string | null>(null);
	let aiErrorMsg = $state<string | null>(null);

	let tableInputRef = $state<HTMLInputElement | null>(null);
	let ingredientsInputRef = $state<HTMLInputElement | null>(null);
	let activeAbortController = $state<AbortController | null>(null);

	onMount(() => {
		foodType = initialFoodType || 'ultraprocessed';
		name = initialData.name || '';
		brand = initialData.brand || '';
		ingredientsText = initialData.ingredientsText || '';
		if (initialData.name && !foodContext) {
			foodContext = initialData.name;
		}

		const sq = initialData.servingQuantity;
		if (sq && sq > 0 && initialData.kcalPer100 != null) {
			inputMode = 'perServing';
			servingQuantity = String(sq);
			kcalInput = String(Math.round((initialData.kcalPer100 * sq) / 100 * 10) / 10);
			proteinInput = initialData.proteinPer100 != null ? String(Math.round((initialData.proteinPer100 * sq) / 100 * 10) / 10) : '';
			fatInput = initialData.fatPer100 != null ? String(Math.round((initialData.fatPer100 * sq) / 100 * 10) / 10) : '';
			carbsInput = initialData.carbsPer100 != null ? String(Math.round((initialData.carbsPer100 * sq) / 100 * 10) / 10) : '';
			fiberInput = initialData.fiberPer100 != null ? String(Math.round((initialData.fiberPer100 * sq) / 100 * 10) / 10) : '';
			sugarInput = initialData.sugarPer100 != null ? String(Math.round((initialData.sugarPer100 * sq) / 100 * 10) / 10) : '';
			if (initialData.saltPer100 != null) {
				const sod100 = (initialData.saltPer100 / 2.5) * 1000;
				sodiumMgInput = String(Math.round((sod100 * sq) / 100));
			}
		} else if (initialData.kcalPer100 != null) {
			inputMode = 'per100g';
			kcalInput = String(initialData.kcalPer100);
			proteinInput = initialData.proteinPer100 != null ? String(initialData.proteinPer100) : '';
			fatInput = initialData.fatPer100 != null ? String(initialData.fatPer100) : '';
			carbsInput = initialData.carbsPer100 != null ? String(initialData.carbsPer100) : '';
			fiberInput = initialData.fiberPer100 != null ? String(initialData.fiberPer100) : '';
			sugarInput = initialData.sugarPer100 != null ? String(initialData.sugarPer100) : '';
			if (initialData.saltPer100 != null) {
				sodiumMgInput = String(Math.round((initialData.saltPer100 / 2.5) * 1000));
			}
		} else if (initialData.servingQuantity != null && initialData.servingQuantity > 0) {
			servingQuantity = String(initialData.servingQuantity);
		}

		if (initialData.micros) {
			const m = initialData.micros;
			const factor = inputMode === 'perServing' && sq && sq > 0 ? sq / 100 : 1;
			if (m.saturatedFat != null) saturatedFatInput = String(Math.round(m.saturatedFat * factor * 10) / 10);
			if (m.monounsaturatedFat != null) monounsaturatedFatInput = String(Math.round(m.monounsaturatedFat * factor * 10) / 10);
			if (m.polyunsaturatedFat != null) polyunsaturatedFatInput = String(Math.round(m.polyunsaturatedFat * factor * 10) / 10);
			if (m.transFat != null) transFatInput = String(Math.round(m.transFat * factor * 10) / 10);
			if (saturatedFatInput || monounsaturatedFatInput || polyunsaturatedFatInput || transFatInput) {
				showFatsBreakdown = true;
			}

			if (m.potassiumMg != null) potassiumMgInput = String(Math.round(m.potassiumMg * factor * 10) / 10);
			if (m.calciumMg != null) calciumMgInput = String(Math.round(m.calciumMg * factor * 10) / 10);
			if (m.magnesiumMg != null) magnesiumMgInput = String(Math.round(m.magnesiumMg * factor * 10) / 10);
			if (m.ironMg != null) ironMgInput = String(Math.round(m.ironMg * factor * 10) / 10);
			if (m.vitaminCMg != null) vitaminCMgInput = String(Math.round(m.vitaminCMg * factor * 10) / 10);
			if (m.vitaminDIu != null) vitaminDIuInput = String(Math.round(m.vitaminDIu * factor));
			if (m.vitaminB12Mcg != null) vitaminB12McgInput = String(Math.round(m.vitaminB12Mcg * factor * 10) / 10);
			if (m.vitaminAMcg != null) vitaminAMcgInput = String(Math.round(m.vitaminAMcg * factor));
			if (m.vitaminB6Mg != null) vitaminB6MgInput = String(Math.round(m.vitaminB6Mg * factor * 10) / 10);

			if (potassiumMgInput || calciumMgInput || magnesiumMgInput || ironMgInput ||
			    vitaminCMgInput || vitaminDIuInput || vitaminB12McgInput || vitaminAMcgInput || vitaminB6MgInput) {
				showVitaminsAndMinerals = true;
			}
		}

		if (autoTakePhoto) {
			setTimeout(() => {
				tableInputRef?.click();
			}, 100);
		}
	});

	function parseNum(val: string): number | null {
		if (!val.trim()) return null;
		const parsed = parseFloat(val.replace(',', '.'));
		return Number.isFinite(parsed) ? parsed : null;
	}

	function applyNutrientValues(n: NutrientValues) {
		if (n.kcal != null || !kcalInput) kcalInput = n.kcal != null ? String(n.kcal) : '';
		if (n.protein != null || !proteinInput) proteinInput = n.protein != null ? String(n.protein) : '';
		if (n.fat != null || !fatInput) fatInput = n.fat != null ? String(n.fat) : '';
		if (n.saturatedFat != null || !saturatedFatInput) saturatedFatInput = n.saturatedFat != null ? String(n.saturatedFat) : '';
		if (n.monounsaturatedFat != null || !monounsaturatedFatInput) monounsaturatedFatInput = n.monounsaturatedFat != null ? String(n.monounsaturatedFat) : '';
		if (n.polyunsaturatedFat != null || !polyunsaturatedFatInput) polyunsaturatedFatInput = n.polyunsaturatedFat != null ? String(n.polyunsaturatedFat) : '';
		if (n.transFat != null || !transFatInput) transFatInput = n.transFat != null ? String(n.transFat) : '';
		if (saturatedFatInput || monounsaturatedFatInput || polyunsaturatedFatInput || transFatInput) {
			showFatsBreakdown = true;
		}
		if (n.carbs != null || !carbsInput) carbsInput = n.carbs != null ? String(n.carbs) : '';
		if (n.fiber != null || !fiberInput) fiberInput = n.fiber != null ? String(n.fiber) : '';
		if (n.sugar != null || !sugarInput) sugarInput = n.sugar != null ? String(n.sugar) : '';
		if (n.sodiumMg != null || !sodiumMgInput) sodiumMgInput = n.sodiumMg != null ? String(n.sodiumMg) : '';

		if (n.potassiumMg != null) potassiumMgInput = String(n.potassiumMg);
		if (n.calciumMg != null) calciumMgInput = String(n.calciumMg);
		if (n.magnesiumMg != null) magnesiumMgInput = String(n.magnesiumMg);
		if (n.ironMg != null) ironMgInput = String(n.ironMg);
		if (n.vitaminCMg != null) vitaminCMgInput = String(n.vitaminCMg);
		if (n.vitaminDIu != null) vitaminDIuInput = String(n.vitaminDIu);
		if (n.vitaminB12Mcg != null) vitaminB12McgInput = String(n.vitaminB12Mcg);
		if (n.vitaminAMcg != null) vitaminAMcgInput = String(n.vitaminAMcg);
		if (n.vitaminB6Mg != null) vitaminB6MgInput = String(n.vitaminB6Mg);

		if (potassiumMgInput || calciumMgInput || magnesiumMgInput || ironMgInput ||
		    vitaminCMgInput || vitaminDIuInput || vitaminB12McgInput || vitaminAMcgInput || vitaminB6MgInput) {
			showVitaminsAndMinerals = true;
		}
	}

	function switchMode(newMode: 'perServing' | 'per100g') {
		if (inputMode === newMode) return;
		const sq = parseNum(servingQuantity) || 100;

		if (newMode === 'per100g') {
			if (extractedPer100) {
				applyNutrientValues(extractedPer100);
			} else {
				const scale = sq > 0 ? 100 / sq : 1;
				scaleInputs(scale);
			}
		} else {
			if (extractedPerServing) {
				applyNutrientValues(extractedPerServing);
			} else {
				const scale = sq / 100;
				scaleInputs(scale);
			}
		}
		inputMode = newMode;
	}

	function scaleInputs(factor: number) {
		const k = parseNum(kcalInput);
		const p = parseNum(proteinInput);
		const f = parseNum(fatInput);
		const satF = parseNum(saturatedFatInput);
		const monoF = parseNum(monounsaturatedFatInput);
		const polyF = parseNum(polyunsaturatedFatInput);
		const transF = parseNum(transFatInput);
		const c = parseNum(carbsInput);
		const fib = parseNum(fiberInput);
		const sug = parseNum(sugarInput);
		const sod = parseNum(sodiumMgInput);

		const pot = parseNum(potassiumMgInput);
		const cal = parseNum(calciumMgInput);
		const mag = parseNum(magnesiumMgInput);
		const fe = parseNum(ironMgInput);
		const vc = parseNum(vitaminCMgInput);
		const vd = parseNum(vitaminDIuInput);
		const vb12 = parseNum(vitaminB12McgInput);
		const va = parseNum(vitaminAMcgInput);
		const vb6 = parseNum(vitaminB6MgInput);

		if (k != null) kcalInput = String(Math.round(k * factor * 10) / 10);
		if (p != null) proteinInput = String(Math.round(p * factor * 10) / 10);
		if (f != null) fatInput = String(Math.round(f * factor * 10) / 10);
		if (satF != null) saturatedFatInput = String(Math.round(satF * factor * 10) / 10);
		if (monoF != null) monounsaturatedFatInput = String(Math.round(monoF * factor * 10) / 10);
		if (polyF != null) polyunsaturatedFatInput = String(Math.round(polyF * factor * 10) / 10);
		if (transF != null) transFatInput = String(Math.round(transF * factor * 10) / 10);
		if (c != null) carbsInput = String(Math.round(c * factor * 10) / 10);
		if (fib != null) fiberInput = String(Math.round(fib * factor * 10) / 10);
		if (sug != null) sugarInput = String(Math.round(sug * factor * 10) / 10);
		if (sod != null) sodiumMgInput = String(Math.round(sod * factor));

		if (pot != null) potassiumMgInput = String(Math.round(pot * factor * 10) / 10);
		if (cal != null) calciumMgInput = String(Math.round(cal * factor * 10) / 10);
		if (mag != null) magnesiumMgInput = String(Math.round(mag * factor * 10) / 10);
		if (fe != null) ironMgInput = String(Math.round(fe * factor * 10) / 10);
		if (vc != null) vitaminCMgInput = String(Math.round(vc * factor * 10) / 10);
		if (vd != null) vitaminDIuInput = String(Math.round(vd * factor));
		if (vb12 != null) vitaminB12McgInput = String(Math.round(vb12 * factor * 10) / 10);
		if (va != null) vitaminAMcgInput = String(Math.round(va * factor));
		if (vb6 != null) vitaminB6MgInput = String(Math.round(vb6 * factor * 10) / 10);
	}

	async function compressImageFile(file: File): Promise<{ base64: string; mimeType: string }> {
		const maxDimension = 1000;

		function canvasToBase64(canvas: HTMLCanvasElement): string {
			let quality = 0.75;
			let dataUrl = canvas.toDataURL('image/jpeg', quality);
			if (dataUrl.length > 450_000) {
				quality = 0.60;
				dataUrl = canvas.toDataURL('image/jpeg', quality);
			}
			if (dataUrl.length > 450_000) {
				const smallCanvas = document.createElement('canvas');
				smallCanvas.width = Math.max(1, Math.round(canvas.width * 0.75));
				smallCanvas.height = Math.max(1, Math.round(canvas.height * 0.75));
				const sCtx = smallCanvas.getContext('2d');
				if (sCtx) {
					sCtx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
					dataUrl = smallCanvas.toDataURL('image/jpeg', 0.60);
				}
			}
			return dataUrl.split(',')[1] || dataUrl;
		}

		// 1. Try URL.createObjectURL + HTMLImageElement (rock solid on iOS camera files & HEIC)
		try {
			return await new Promise<{ base64: string; mimeType: string }>((resolve, reject) => {
				const url = URL.createObjectURL(file);
				const img = new Image();
				img.onload = () => {
					URL.revokeObjectURL(url);
					try {
						const nw = img.naturalWidth || img.width;
						const nh = img.naturalHeight || img.height;
						const scale = Math.min(1, maxDimension / Math.max(nw, nh));
						const width = Math.max(1, Math.round(nw * scale));
						const height = Math.max(1, Math.round(nh * scale));

						const canvas = document.createElement('canvas');
						canvas.width = width;
						canvas.height = height;
						const ctx = canvas.getContext('2d');
						if (!ctx) {
							reject(new Error('No canvas context'));
							return;
						}
						ctx.drawImage(img, 0, 0, width, height);
						const base64 = canvasToBase64(canvas);
						resolve({
							base64,
							mimeType: 'image/jpeg'
						});
					} catch (e) {
						reject(e);
					}
				};
				img.onerror = (e) => {
					URL.revokeObjectURL(url);
					reject(e);
				};
				img.src = url;
			});
		} catch (imgErr) {
			console.warn('Image element loading failed, trying createImageBitmap:', imgErr);
		}

		// 2. Fallback: createImageBitmap
		if (typeof createImageBitmap === 'function') {
			try {
				const bitmap = await createImageBitmap(file);
				const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
				const width = Math.max(1, Math.round(bitmap.width * scale));
				const height = Math.max(1, Math.round(bitmap.height * scale));
				const canvas = document.createElement('canvas');
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext('2d');
				if (ctx) {
					ctx.drawImage(bitmap, 0, 0, width, height);
					bitmap.close();
					const base64 = canvasToBase64(canvas);
					return {
						base64,
						mimeType: 'image/jpeg'
					};
				}
				bitmap.close();
			} catch (bmErr) {
				console.warn('createImageBitmap failed:', bmErr);
			}
		}

		// 3. Fallback: FileReader
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const res = reader.result as string;
				resolve({
					base64: res.split(',')[1] || res,
					mimeType: file.type || 'image/jpeg'
				});
			};
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	function clearEstimated(key: string) {
		if (estimatedNutrientKeys.has(key)) {
			const next = new Set(estimatedNutrientKeys);
			next.delete(key);
			estimatedNutrientKeys = next;
		}
	}

	async function handleTablePhoto(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		try {
			const { base64, mimeType } = await compressImageFile(file);
			tableImageBase64 = base64;
			tableImageMime = mimeType;
			tableImagePreview = `data:${mimeType};base64,${base64}`;
			aiErrorMsg = null;
		} catch (err) {
			console.error('[ProductNutritionEditModal] Error table photo:', err);
			aiErrorMsg = 'Failed to process nutrition table photo.';
		} finally {
			if (tableInputRef) tableInputRef.value = '';
		}
	}

	async function handleIngredientsPhoto(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		try {
			const { base64, mimeType } = await compressImageFile(file);
			ingredientsImageBase64 = base64;
			ingredientsImageMime = mimeType;
			ingredientsImagePreview = `data:${mimeType};base64,${base64}`;
			aiErrorMsg = null;
		} catch (err) {
			console.error('[ProductNutritionEditModal] Error ingredients photo:', err);
			aiErrorMsg = 'Failed to process ingredients photo.';
		} finally {
			if (ingredientsInputRef) ingredientsInputRef.value = '';
		}
	}

	function cancelAiAnalysis() {
		if (activeAbortController) {
			activeAbortController.abort();
			activeAbortController = null;
		}
		analyzingPhoto = false;
		aiErrorMsg = 'AI analysis cancelled.';
	}

	async function runAiAnalysis() {
		const effectiveFoodContext = foodContext.trim() || name.trim();
		if (foodType === 'ultraprocessed' && !tableImageBase64 && !ingredientsText.trim()) {
			aiErrorMsg = 'Upload a photo of the nutrition table, or write/paste the ingredients list to estimate fats.';
			return;
		}
		if (foodType === 'natural' && !tableImageBase64 && !ingredientsImageBase64 && !ingredientsText.trim() && !effectiveFoodContext) {
			aiErrorMsg = 'Provide at least the food name (e.g. Chicken breast) or a photo to analyze.';
			return;
		}

		analyzingPhoto = true;
		aiSuccessMsg = null;
		aiErrorMsg = null;

		activeAbortController = new AbortController();
		const timeoutId = setTimeout(() => {
			if (activeAbortController) {
				activeAbortController.abort();
			}
		}, 25000);

		try {
			const currentProvider = userSettings.aiNutritionProvider || 'gemini';
			const apiKey = (currentProvider === 'gemini' ? userSettings.aiGeminiApiKey : userSettings.aiOpenaiApiKey) || '';
			const model = (currentProvider === 'gemini' ? userSettings.aiGeminiModel : userSettings.aiOpenaiModel) || (currentProvider === 'gemini' ? 'gemini-flash-lite-latest' : 'gpt-4o-mini');

			const currentKcal = parseNum(kcalInput);
			const currentProtein = parseNum(proteinInput);
			const currentFat = parseNum(fatInput);
			const currentCarbs = parseNum(carbsInput);
			const currentSq = parseNum(servingQuantity);
			const existingMacros = (currentKcal != null || currentProtein != null || currentFat != null || currentCarbs != null) ? {
				kcal: currentKcal,
				protein: currentProtein,
				fat: currentFat,
				carbs: currentCarbs,
				servingQuantity: currentSq,
				servingUnit
			} : undefined;

			const res = await fetch('/api/nutrition/ai-nutrition-label', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				signal: activeAbortController.signal,
				body: JSON.stringify({
					foodType,
					imageBase64: tableImageBase64 || undefined,
					imageMimeType: tableImageMime,
					ingredientsImageBase64: foodType === 'natural' ? (ingredientsImageBase64 || undefined) : undefined,
					ingredientsImageMimeType: ingredientsImageMime,
					foodContext: effectiveFoodContext || undefined,
					ingredientsText: ingredientsText.trim() || undefined,
					existingMacros,
					provider: currentProvider,
					apiKey,
					model
				})
			});

			const data = await res.json().catch(() => null);

			if (!res.ok) {
				if (data?.error === 'NO_API_KEY') {
					aiErrorMsg = 'Configure your API key in Settings > Artificial Intelligence to use AI analysis.';
				} else {
					aiErrorMsg = data?.message || data?.error || `Server error (${res.status}).`;
				}
				return;
			}

			const label = data?.label;
			if (!label) {
				aiErrorMsg = 'No readable data found in the image. Try taking a clearer photo closer to the label.';
				return;
			}

			extractedPerServing = label.perServing ?? null;
			extractedPer100 = label.per100 ?? null;

			if (Array.isArray(label.estimatedNutrients)) {
				estimatedNutrientKeys = new Set(label.estimatedNutrients);
			} else {
				estimatedNutrientKeys = new Set();
			}

			// Populate product name if empty or default
			if (label.productName && (!name.trim() || name.includes(barcode ?? '___') || name.startsWith('Producto ') || name.startsWith('Product '))) {
				name = label.productName;
			} else if (!name.trim() && foodContext.trim()) {
				name = foodContext.trim();
			}

			// Populate transcribed ingredients
			if (label.ingredientsText && !ingredientsText.trim()) {
				ingredientsText = label.ingredientsText;
			}

			// Populate serving quantity
			if (label.servingQuantity != null && label.servingQuantity > 0) {
				servingQuantity = String(label.servingQuantity);
			}
			if (label.servingUnit === 'ml') {
				servingUnit = 'ml';
			}

			// Prefer perServing if available, else per100
			if (extractedPerServing && (extractedPerServing.kcal != null || extractedPerServing.protein != null)) {
				inputMode = 'perServing';
				applyNutrientValues(extractedPerServing);
			} else if (extractedPer100) {
				inputMode = 'per100g';
				applyNutrientValues(extractedPer100);
			}

			if (fiberInput || sugarInput || sodiumMgInput) {
				showMicros = true;
			}

			if (potassiumMgInput || calciumMgInput || magnesiumMgInput || ironMgInput ||
			    vitaminCMgInput || vitaminDIuInput || vitaminB12McgInput || vitaminAMcgInput || vitaminB6MgInput) {
				showVitaminsAndMinerals = true;
			}

			const estimatedCount = estimatedNutrientKeys.size;
			aiSuccessMsg = estimatedCount > 0
				? `Nutrition facts extracted! ${estimatedCount} nutrients (~ AI) estimated.`
				: 'Nutrition facts extracted successfully! Review or adjust values if needed.';
		} catch (err) {
			if (err instanceof Error && err.name === 'AbortError') {
				aiErrorMsg = 'Request timed out (25s) or was cancelled. Please check your internet connection or API key.';
			} else {
				console.error('[ProductNutritionEditModal] Error processing photo:', err);
				aiErrorMsg = err instanceof Error ? err.message : 'Error processing image.';
			}
		} finally {
			clearTimeout(timeoutId);
			activeAbortController = null;
			analyzingPhoto = false;
		}
	}

	function handleSave() {
		const trimmedName = name.trim() || initialData.name || (barcode ? `Product ${barcode}` : 'Food');
		const sqNum = parseNum(servingQuantity);
		const kcalVal = parseNum(kcalInput);
		const proteinVal = parseNum(proteinInput);
		const fatVal = parseNum(fatInput);
		const carbsVal = parseNum(carbsInput);
		const fiberVal = parseNum(fiberInput);
		const sugarVal = parseNum(sugarInput);
		const sodiumMgVal = parseNum(sodiumMgInput);

		// Calculate 100g baseline values
		let scale = 1;
		if (inputMode === 'perServing') {
			if (sqNum && sqNum > 0) {
				scale = 100 / sqNum;
			}
		}

		// Use exact extracted per100 numbers if user didn't modify them
		const kcalPer100 = inputMode === 'per100g'
			? kcalVal
			: (extractedPer100?.kcal != null && kcalVal === extractedPerServing?.kcal)
				? extractedPer100.kcal
				: (kcalVal != null ? Math.round(kcalVal * scale * 10) / 10 : null);

		const proteinPer100 = inputMode === 'per100g'
			? proteinVal
			: (extractedPer100?.protein != null && proteinVal === extractedPerServing?.protein)
				? extractedPer100.protein
				: (proteinVal != null ? Math.round(proteinVal * scale * 10) / 10 : null);

		const fatPer100 = inputMode === 'per100g'
			? fatVal
			: (extractedPer100?.fat != null && fatVal === extractedPerServing?.fat)
				? extractedPer100.fat
				: (fatVal != null ? Math.round(fatVal * scale * 10) / 10 : null);

		const carbsPer100 = inputMode === 'per100g'
			? carbsVal
			: (extractedPer100?.carbs != null && carbsVal === extractedPerServing?.carbs)
				? extractedPer100.carbs
				: (carbsVal != null ? Math.round(carbsVal * scale * 10) / 10 : null);

		const fiberPer100 = inputMode === 'per100g'
			? fiberVal
			: (extractedPer100?.fiber != null && fiberVal === extractedPerServing?.fiber)
				? extractedPer100.fiber
				: (fiberVal != null ? Math.round(fiberVal * scale * 10) / 10 : null);

		const sugarPer100 = inputMode === 'per100g'
			? sugarVal
			: (extractedPer100?.sugar != null && sugarVal === extractedPerServing?.sugar)
				? extractedPer100.sugar
				: (sugarVal != null ? Math.round(sugarVal * scale * 10) / 10 : null);

		const saltPer100 = sodiumMgVal != null
			? Math.round(((sodiumMgVal / 1000) * 2.5 * scale) * 100) / 100
			: null;

		const potVal = parseNum(potassiumMgInput);
		const calVal = parseNum(calciumMgInput);
		const magVal = parseNum(magnesiumMgInput);
		const feVal = parseNum(ironMgInput);
		const vcVal = parseNum(vitaminCMgInput);
		const vdVal = parseNum(vitaminDIuInput);
		const vb12Val = parseNum(vitaminB12McgInput);
		const vaVal = parseNum(vitaminAMcgInput);
		const vb6Val = parseNum(vitaminB6MgInput);

		const satFVal = parseNum(saturatedFatInput);
		const monoFVal = parseNum(monounsaturatedFatInput);
		const polyFVal = parseNum(polyunsaturatedFatInput);
		const transFVal = parseNum(transFatInput);

		const micros: EssentialMicros = {};
		if (potVal != null) micros.potassiumMg = Math.round(potVal * scale * 10) / 10;
		if (calVal != null) micros.calciumMg = Math.round(calVal * scale * 10) / 10;
		if (magVal != null) micros.magnesiumMg = Math.round(magVal * scale * 10) / 10;
		if (feVal != null) micros.ironMg = Math.round(feVal * scale * 10) / 10;
		if (sodiumMgVal != null) micros.sodiumMg = Math.round(sodiumMgVal * scale);
		if (vcVal != null) micros.vitaminCMg = Math.round(vcVal * scale * 10) / 10;
		if (vdVal != null) micros.vitaminDIu = Math.round(vdVal * scale);
		if (vb12Val != null) micros.vitaminB12Mcg = Math.round(vb12Val * scale * 10) / 10;
		if (vaVal != null) micros.vitaminAMcg = Math.round(vaVal * scale);
		if (vb6Val != null) micros.vitaminB6Mg = Math.round(vb6Val * scale * 10) / 10;

		if (satFVal != null) micros.saturatedFat = Math.round(satFVal * scale * 10) / 10;
		if (monoFVal != null) micros.monounsaturatedFat = Math.round(monoFVal * scale * 10) / 10;
		if (polyFVal != null) micros.polyunsaturatedFat = Math.round(polyFVal * scale * 10) / 10;
		if (transFVal != null) micros.transFat = Math.round(transFVal * scale * 10) / 10;

		const hasMicros = Object.values(micros).some((v) => v != null && v > 0);

		onsave({
			name: trimmedName,
			brand: brand.trim() || null,
			servingQuantity: sqNum,
			servingSize: sqNum ? `${sqNum} ${servingUnit}` : null,
			kcalPer100,
			proteinPer100,
			fatPer100,
			carbsPer100,
			sugarPer100,
			fiberPer100,
			saltPer100,
			micros: hasMicros ? micros : null,
			ingredientsText: ingredientsText.trim() || null
		});
	}
</script>

<ManageSheetShell
	accent="#DC2626"
	title="Nutrition Facts"
	subtitle={barcode ? `Barcode: ${barcode}` : 'Edit product'}
	onclose={onclose}
	zIndex={95}
	maxHeight="92dvh"
>
	{#snippet body()}
		<div class="space-y-4">
			<!-- Dual Scan Section with AI -->
			<div class="space-y-3 p-3.5 rounded-2xl bg-[var(--color-surface-container)] border border-[var(--bubble-container-border)]">
				<!-- Food Type Selector (Ultra-processed vs Natural 1-ingredient) -->
				<div>
					<div class="flex items-center justify-between mb-1.5">
						<span class="text-xs font-bold" style="color: var(--color-on-surface)">Food type</span>
						<span class="text-[11px] opacity-70">
							{foodType === 'ultraprocessed' ? 'Exact label facts & fats only' : 'Completes standard real food micros'}
						</span>
					</div>
					<div class="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-black/20 border border-[var(--bubble-container-border)]">
						<button
							type="button"
							class="py-1.5 px-2 rounded-lg text-xs font-semibold transition-all text-center cursor-pointer"
							class:active-type-btn={foodType === 'ultraprocessed'}
							class:inactive-type-btn={foodType !== 'ultraprocessed'}
							onclick={() => (foodType = 'ultraprocessed')}
						>
							Ultra-processed
						</button>
						<button
							type="button"
							class="py-1.5 px-2 rounded-lg text-xs font-semibold transition-all text-center cursor-pointer"
							class:active-type-btn={foodType === 'natural'}
							class:inactive-type-btn={foodType !== 'natural'}
							onclick={() => (foodType = 'natural')}
						>
							Natural (1 ingredient)
						</button>
					</div>
				</div>

				<!-- Food Context (Visible only in natural mode) -->
				{#if foodType === 'natural'}
					<div>
						<label for="food-context-input" class="block text-xs font-semibold mb-1" style="color: var(--color-on-surface)">
							What natural food is this? <span class="font-normal opacity-70">(helps infer accurate micronutrients)</span>
						</label>
						<input
							id="food-context-input"
							type="text"
							bind:value={foodContext}
							placeholder="e.g. Rolled oats, Basmati rice, Raw almonds, Pure olive oil..."
							class="manage-settings-input w-full text-xs"
						/>
					</div>
				{/if}

				<!-- Photo Pickers -->
				{#if foodType === 'ultraprocessed'}
					<!-- Nutrition Table Photo (Full width in ultraprocessed) -->
					<div>
						<input
							type="file"
							accept="image/*"
							capture="environment"
							bind:this={tableInputRef}
							onchange={handleTablePhoto}
							class="hidden"
						/>
						<div class="photo-card" class:has-photo={!!tableImagePreview}>
							{#if tableImagePreview}
								<div class="relative w-full h-28 rounded-xl overflow-hidden">
									<img src={tableImagePreview} alt="Nutrition facts table" class="w-full h-full object-cover" />
									<button
										type="button"
										class="photo-delete-btn"
										onclick={() => { tableImageBase64 = null; tableImagePreview = null; }}
										title="Remove photo"
										aria-label="Remove nutrition table photo"
									>
										✕
									</button>
									<button
										type="button"
										class="photo-change-btn"
										onclick={() => tableInputRef?.click()}
									>
										Change
									</button>
								</div>
								<span class="photo-card-label">Nutrition facts table ✓</span>
							{:else}
								<button
									type="button"
									class="photo-empty-btn !h-24"
									onclick={() => tableInputRef?.click()}
								>
									<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
										<circle cx="12" cy="13" r="4"/>
									</svg>
									<span class="font-semibold text-xs">Nutrition facts table</span>
									<span class="text-[10px] opacity-70">Take photo or upload (Optional)</span>
								</button>
							{/if}
						</div>
					</div>
				{:else}
					<!-- Dual Photo Pickers: Nutrition Table + Ingredients -->
					<div class="grid grid-cols-2 gap-2.5">
						<!-- Nutrition Table Photo -->
						<input
							type="file"
							accept="image/*"
							capture="environment"
							bind:this={tableInputRef}
							onchange={handleTablePhoto}
							class="hidden"
						/>
						<div class="photo-card" class:has-photo={!!tableImagePreview}>
							{#if tableImagePreview}
								<div class="relative w-full h-24 rounded-xl overflow-hidden">
									<img src={tableImagePreview} alt="Nutrition facts table" class="w-full h-full object-cover" />
									<button
										type="button"
										class="photo-delete-btn"
										onclick={() => { tableImageBase64 = null; tableImagePreview = null; }}
										title="Remove photo"
										aria-label="Remove nutrition table photo"
									>
										✕
									</button>
									<button
										type="button"
										class="photo-change-btn"
										onclick={() => tableInputRef?.click()}
									>
										Change
									</button>
								</div>
								<span class="photo-card-label">Nutrition facts ✓</span>
							{:else}
								<button
									type="button"
									class="photo-empty-btn"
									onclick={() => tableInputRef?.click()}
								>
									<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
										<circle cx="12" cy="13" r="4"/>
									</svg>
									<span class="font-semibold text-xs">Nutrition facts table</span>
									<span class="text-[10px] opacity-70">Take / upload photo (Optional)</span>
								</button>
							{/if}
						</div>

						<!-- Ingredients Photo -->
						<input
							type="file"
							accept="image/*"
							capture="environment"
							bind:this={ingredientsInputRef}
							onchange={handleIngredientsPhoto}
							class="hidden"
						/>
						<div class="photo-card" class:has-photo={!!ingredientsImagePreview}>
							{#if ingredientsImagePreview}
								<div class="relative w-full h-24 rounded-xl overflow-hidden">
									<img src={ingredientsImagePreview} alt="Ingredients" class="w-full h-full object-cover" />
									<button
										type="button"
										class="photo-delete-btn"
										onclick={() => { ingredientsImageBase64 = null; ingredientsImagePreview = null; }}
										title="Remove photo"
										aria-label="Remove ingredients photo"
									>
										✕
									</button>
									<button
										type="button"
										class="photo-change-btn"
										onclick={() => ingredientsInputRef?.click()}
									>
										Change
									</button>
								</div>
								<span class="photo-card-label">Ingredients ✓</span>
							{:else}
								<button
									type="button"
									class="photo-empty-btn"
									onclick={() => ingredientsInputRef?.click()}
								>
									<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
										<circle cx="12" cy="13" r="4"/>
									</svg>
									<span class="font-semibold text-xs">Ingredients</span>
									<span class="text-[10px] opacity-70">Photo to verify (Optional)</span>
								</button>
							{/if}
						</div>
					</div>
				{/if}

				<!-- AI Action Buttons (Analyze / Estimate with cancel option) -->
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={runAiAnalysis}
						disabled={analyzingPhoto || (foodType === 'ultraprocessed' ? (!tableImageBase64 && !ingredientsText.trim()) : (!tableImageBase64 && !ingredientsImageBase64 && !ingredientsText.trim() && !foodContext.trim() && !name.trim()))}
						class="ai-analyze-btn flex-1"
					>
						{#if analyzingPhoto}
							<div class="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin"></div>
							<span>{tableImageBase64 || ingredientsImageBase64 ? 'Analyzing photo...' : 'Estimating with AI...'}</span>
						{:else}
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
							</svg>
							<span>{tableImageBase64 || ingredientsImageBase64 ? 'Analyze photo with AI' : '✨ Estimate with AI'}</span>
						{/if}
					</button>
					{#if analyzingPhoto}
						<button
							type="button"
							class="py-2.5 px-3 rounded-xl border border-[var(--bubble-container-border)] text-xs font-semibold bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 active:scale-95 transition-all cursor-pointer"
							onclick={cancelAiAnalysis}
							title="Cancel AI analysis"
						>
							Cancel
						</button>
					{/if}
				</div>
			</div>

			{#if aiSuccessMsg}
				<div class="p-3 text-xs rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-2">
					<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
					<span>{aiSuccessMsg}</span>
				</div>
			{/if}

			{#if aiErrorMsg}
				<div class="p-3 text-xs rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-2">
					<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
					<span>{aiErrorMsg}</span>
				</div>
			{/if}

			<!-- General Data -->
			<div>
				<span class="manage-section-title">Product</span>
				<section class="manage-settings-surface">
					<label class="manage-settings-row nutrition-edit-field">
						<span class="manage-settings-label">Name</span>
						<input type="text" bind:value={name} placeholder="Product name" class="manage-settings-input" />
					</label>
					<label class="manage-settings-row nutrition-edit-field">
						<span class="manage-settings-label">Brand (optional)</span>
						<input type="text" bind:value={brand} placeholder="Brand" class="manage-settings-input" />
					</label>
					<div class="manage-settings-row nutrition-edit-field !items-start pt-2">
						<span class="manage-settings-label pt-1">Ingredients (optional)</span>
						<textarea
							bind:value={ingredientsText}
							placeholder="Transcribed or editable ingredients list..."
							rows="2"
							class="manage-settings-input w-full text-xs py-1.5 resize-y"
						></textarea>
					</div>
				</section>
			</div>

			<!-- Serving Size -->
			<div>
				<span class="manage-section-title">Serving Size</span>
				<section class="manage-settings-surface">
					<div class="manage-settings-row nutrition-portion-field">
						<span class="manage-settings-label">1 serving equals</span>
						<div class="flex items-center gap-1.5 justify-end">
							<input
								type="text"
								inputmode="decimal"
								bind:value={servingQuantity}
								placeholder="30"
								class="manage-settings-input text-right w-20"
							/>
							<select bind:value={servingUnit} class="portion-unit-select">
								<option value="g">g</option>
								<option value="ml">ml</option>
							</select>
						</div>
					</div>
				</section>
			</div>

			<!-- Nutrient Input Mode -->
			<div>
				<div class="flex items-center justify-between mb-1.5">
					<span class="manage-section-title !mb-0">Nutritional Values</span>
					<div class="mode-toggle-group">
						<button
							type="button"
							class="mode-pill"
							class:active={inputMode === 'perServing'}
							onclick={() => switchMode('perServing')}
						>
							Per serving ({servingQuantity || '30'}{servingUnit})
						</button>
						<button
							type="button"
							class="mode-pill"
							class:active={inputMode === 'per100g'}
							onclick={() => switchMode('per100g')}
						>
							Per 100{servingUnit}
						</button>
					</div>
				</div>

				<section class="manage-settings-surface">
					<label class="manage-settings-row nutrition-nutrient-row">
						<div class="flex items-center gap-1.5">
							<span class="nutrient-name">Calories</span>
							{#if estimatedNutrientKeys.has('kcal')}
								<span class="ia-estimate-badge" title="Estimated by AI">~ AI</span>
							{/if}
						</div>
						<div class="flex items-center gap-1 justify-end">
							<input
								type="text"
								inputmode="decimal"
								bind:value={kcalInput}
								oninput={() => clearEstimated('kcal')}
								placeholder="—"
								class="manage-settings-input text-right w-24"
								class:is-estimated={estimatedNutrientKeys.has('kcal')}
							/>
							<span class="unit-text">kcal</span>
						</div>
					</label>
					<label class="manage-settings-row nutrition-nutrient-row">
						<div class="flex items-center gap-1.5">
							<span class="nutrient-name text-rose-500">Protein</span>
							{#if estimatedNutrientKeys.has('protein')}
								<span class="ia-estimate-badge" title="Estimated by AI">~ AI</span>
							{/if}
						</div>
						<div class="flex items-center gap-1 justify-end">
							<input
								type="text"
								inputmode="decimal"
								bind:value={proteinInput}
								oninput={() => clearEstimated('protein')}
								placeholder="—"
								class="manage-settings-input text-right w-24"
								class:is-estimated={estimatedNutrientKeys.has('protein')}
							/>
							<span class="unit-text">g</span>
						</div>
					</label>
					<label class="manage-settings-row nutrition-nutrient-row">
						<div class="flex items-center gap-1.5">
							<span class="nutrient-name text-amber-500">Total Fat</span>
							{#if estimatedNutrientKeys.has('fat')}
								<span class="ia-estimate-badge" title="Estimated by AI">~ AI</span>
							{/if}
						</div>
						<div class="flex items-center gap-1 justify-end">
							<input
								type="text"
								inputmode="decimal"
								bind:value={fatInput}
								oninput={() => clearEstimated('fat')}
								placeholder="—"
								class="manage-settings-input text-right w-24"
								class:is-estimated={estimatedNutrientKeys.has('fat')}
							/>
							<span class="unit-text">g</span>
						</div>
					</label>

					<!-- Fat Breakdown (Optional) -->
					<div class="px-3 py-1 bg-[var(--color-surface-container)] rounded-xl mx-2 my-1 border border-[var(--bubble-container-border)]">
						<button
							type="button"
							class="w-full flex items-center justify-between py-1 text-[11px] font-semibold text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] transition-colors"
							onclick={() => (showFatsBreakdown = !showFatsBreakdown)}
							aria-expanded={showFatsBreakdown}
						>
							<span class="flex items-center gap-1.5">
								<svg class="w-3 h-3 transition-transform duration-200" style="transform: rotate({showFatsBreakdown ? '90' : '0'}deg)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="9 18 15 12 9 6"></polyline>
								</svg>
								<span>Fat breakdown (saturated, mono, poly, trans)</span>
							</span>
							<span class="text-[10px] opacity-70 font-bold">{showFatsBreakdown ? '−' : '+'}</span>
						</button>
						{#if showFatsBreakdown}
							<div class="space-y-2 pt-2 pb-1.5 border-t border-[var(--bubble-container-border)] mt-1">
								<div class="flex items-center justify-between text-xs">
									<div class="flex items-center gap-1">
										<span class="text-[var(--color-on-surface-variant)]">Saturated fat</span>
										{#if estimatedNutrientKeys.has('saturatedFat')}
											<span class="ia-estimate-badge">~ AI</span>
										{/if}
									</div>
									<div class="flex items-center gap-1">
										<input
											type="text"
											inputmode="decimal"
											bind:value={saturatedFatInput}
											oninput={() => clearEstimated('saturatedFat')}
											placeholder="—"
											class="manage-settings-input text-right w-20 text-xs py-0.5"
											class:is-estimated={estimatedNutrientKeys.has('saturatedFat')}
										/>
										<span class="unit-text text-[11px]">g</span>
									</div>
								</div>
								<div class="flex items-center justify-between text-xs">
									<div class="flex items-center gap-1">
										<span class="text-[var(--color-on-surface-variant)]">Monounsaturated fat</span>
										{#if estimatedNutrientKeys.has('monounsaturatedFat')}
											<span class="ia-estimate-badge">~ AI</span>
										{/if}
									</div>
									<div class="flex items-center gap-1">
										<input
											type="text"
											inputmode="decimal"
											bind:value={monounsaturatedFatInput}
											oninput={() => clearEstimated('monounsaturatedFat')}
											placeholder="—"
											class="manage-settings-input text-right w-20 text-xs py-0.5"
											class:is-estimated={estimatedNutrientKeys.has('monounsaturatedFat')}
										/>
										<span class="unit-text text-[11px]">g</span>
									</div>
								</div>
								<div class="flex items-center justify-between text-xs">
									<div class="flex items-center gap-1">
										<span class="text-[var(--color-on-surface-variant)]">Polyunsaturated fat</span>
										{#if estimatedNutrientKeys.has('polyunsaturatedFat')}
											<span class="ia-estimate-badge">~ AI</span>
										{/if}
									</div>
									<div class="flex items-center gap-1">
										<input
											type="text"
											inputmode="decimal"
											bind:value={polyunsaturatedFatInput}
											oninput={() => clearEstimated('polyunsaturatedFat')}
											placeholder="—"
											class="manage-settings-input text-right w-20 text-xs py-0.5"
											class:is-estimated={estimatedNutrientKeys.has('polyunsaturatedFat')}
										/>
										<span class="unit-text text-[11px]">g</span>
									</div>
								</div>
								<div class="flex items-center justify-between text-xs">
									<div class="flex items-center gap-1">
										<span class="text-[var(--color-on-surface-variant)]">Trans fat</span>
										{#if estimatedNutrientKeys.has('transFat')}
											<span class="ia-estimate-badge">~ AI</span>
										{/if}
									</div>
									<div class="flex items-center gap-1">
										<input
											type="text"
											inputmode="decimal"
											bind:value={transFatInput}
											oninput={() => clearEstimated('transFat')}
											placeholder="—"
											class="manage-settings-input text-right w-20 text-xs py-0.5"
											class:is-estimated={estimatedNutrientKeys.has('transFat')}
										/>
										<span class="unit-text text-[11px]">g</span>
									</div>
								</div>
							</div>
						{/if}
					</div>
					<label class="manage-settings-row nutrition-nutrient-row">
						<div class="flex items-center gap-1.5">
							<span class="nutrient-name text-sky-500">Carbs</span>
							{#if estimatedNutrientKeys.has('carbs')}
								<span class="ia-estimate-badge" title="Estimated by AI">~ AI</span>
							{/if}
						</div>
						<div class="flex items-center gap-1 justify-end">
							<input
								type="text"
								inputmode="decimal"
								bind:value={carbsInput}
								oninput={() => clearEstimated('carbs')}
								placeholder="—"
								class="manage-settings-input text-right w-24"
								class:is-estimated={estimatedNutrientKeys.has('carbs')}
							/>
							<span class="unit-text">g</span>
						</div>
					</label>
				</section>
			</div>

			<!-- Optional Micronutrients -->
			<div>
				<button
					type="button"
					class="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold rounded-lg hover:bg-neutral-500/10 transition-colors"
					style="color: var(--color-on-surface-variant)"
					onclick={() => (showMicros = !showMicros)}
					aria-expanded={showMicros}
				>
					<span class="flex items-center gap-1.5">
						<svg class="w-3.5 h-3.5 transition-transform duration-200" style="transform: rotate({showMicros ? '90' : '0'}deg)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="9 18 15 12 9 6"></polyline>
						</svg>
						<span>Optional micronutrients (fiber, sugar, sodium)</span>
					</span>
					<span class="text-[11px] font-normal opacity-70">
						{showMicros ? '−' : '+'}
					</span>
				</button>

				{#if showMicros}
					<section class="manage-settings-surface mt-1.5">
						<label class="manage-settings-row nutrition-nutrient-row">
							<div class="flex items-center gap-1.5">
								<span class="nutrient-name">Fiber</span>
								{#if estimatedNutrientKeys.has('fiber')}
									<span class="ia-estimate-badge" title="Estimated by AI from ingredients">~ AI</span>
								{/if}
							</div>
							<div class="flex items-center gap-1 justify-end">
								<input
									type="text"
									inputmode="decimal"
									bind:value={fiberInput}
									oninput={() => clearEstimated('fiber')}
									placeholder="—"
									class="manage-settings-input text-right w-24"
									class:is-estimated={estimatedNutrientKeys.has('fiber')}
								/>
								<span class="unit-text">g</span>
							</div>
						</label>
						<label class="manage-settings-row nutrition-nutrient-row">
							<div class="flex items-center gap-1.5">
								<span class="nutrient-name">Sugar</span>
								{#if estimatedNutrientKeys.has('sugar')}
									<span class="ia-estimate-badge" title="Estimated by AI from ingredients">~ AI</span>
								{/if}
							</div>
							<div class="flex items-center gap-1 justify-end">
								<input
									type="text"
									inputmode="decimal"
									bind:value={sugarInput}
									oninput={() => clearEstimated('sugar')}
									placeholder="—"
									class="manage-settings-input text-right w-24"
									class:is-estimated={estimatedNutrientKeys.has('sugar')}
								/>
								<span class="unit-text">g</span>
							</div>
						</label>
						<label class="manage-settings-row nutrition-nutrient-row">
							<div class="flex items-center gap-1.5">
								<span class="nutrient-name">Sodium</span>
								{#if estimatedNutrientKeys.has('sodiumMg')}
									<span class="ia-estimate-badge" title="Estimated by AI from ingredients">~ AI</span>
								{/if}
							</div>
							<div class="flex items-center gap-1 justify-end">
								<input
									type="text"
									inputmode="decimal"
									bind:value={sodiumMgInput}
									oninput={() => clearEstimated('sodiumMg')}
									placeholder="—"
									class="manage-settings-input text-right w-24"
									class:is-estimated={estimatedNutrientKeys.has('sodiumMg')}
								/>
								<span class="unit-text">mg</span>
							</div>
						</label>
					</section>
				{/if}
			</div>

			<!-- Essential Vitamins & Minerals -->
			<div>
				<button
					type="button"
					class="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold rounded-lg hover:bg-neutral-500/10 transition-colors"
					style="color: var(--color-on-surface-variant)"
					onclick={() => (showVitaminsAndMinerals = !showVitaminsAndMinerals)}
					aria-expanded={showVitaminsAndMinerals}
				>
					<span class="flex items-center gap-1.5">
						<svg class="w-3.5 h-3.5 transition-transform duration-200" style="transform: rotate({showVitaminsAndMinerals ? '90' : '0'}deg)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="9 18 15 12 9 6"></polyline>
						</svg>
						<span>Essential Vitamins & Minerals</span>
					</span>
					<span class="text-[11px] font-normal opacity-70">
						{showVitaminsAndMinerals ? '−' : '+'}
					</span>
				</button>

				{#if showVitaminsAndMinerals}
					<div class="space-y-2 mt-1.5">
						<section class="manage-settings-surface">
							<div class="px-3 pt-2 text-[11px] font-bold uppercase tracking-wider text-emerald-500">
								Key Minerals
							</div>
							<label class="manage-settings-row nutrition-nutrient-row">
								<div class="flex items-center gap-1.5">
									<span class="nutrient-name">Potassium (K)</span>
									{#if estimatedNutrientKeys.has('potassiumMg')}
										<span class="ia-estimate-badge" title="Estimated by AI from ingredients">~ AI</span>
									{/if}
								</div>
								<div class="flex items-center gap-1 justify-end">
									<input
										type="text"
										inputmode="decimal"
										bind:value={potassiumMgInput}
										oninput={() => clearEstimated('potassiumMg')}
										placeholder="—"
										class="manage-settings-input text-right w-24"
										class:is-estimated={estimatedNutrientKeys.has('potassiumMg')}
									/>
									<span class="unit-text">mg</span>
								</div>
							</label>
							<label class="manage-settings-row nutrition-nutrient-row">
								<div class="flex items-center gap-1.5">
									<span class="nutrient-name">Calcium (Ca)</span>
									{#if estimatedNutrientKeys.has('calciumMg')}
										<span class="ia-estimate-badge" title="Estimated by AI from ingredients">~ AI</span>
									{/if}
								</div>
								<div class="flex items-center gap-1 justify-end">
									<input
										type="text"
										inputmode="decimal"
										bind:value={calciumMgInput}
										oninput={() => clearEstimated('calciumMg')}
										placeholder="—"
										class="manage-settings-input text-right w-24"
										class:is-estimated={estimatedNutrientKeys.has('calciumMg')}
									/>
									<span class="unit-text">mg</span>
								</div>
							</label>
							<label class="manage-settings-row nutrition-nutrient-row">
								<div class="flex items-center gap-1.5">
									<span class="nutrient-name">Magnesium (Mg)</span>
									{#if estimatedNutrientKeys.has('magnesiumMg')}
										<span class="ia-estimate-badge" title="Estimated by AI from ingredients">~ AI</span>
									{/if}
								</div>
								<div class="flex items-center gap-1 justify-end">
									<input
										type="text"
										inputmode="decimal"
										bind:value={magnesiumMgInput}
										oninput={() => clearEstimated('magnesiumMg')}
										placeholder="—"
										class="manage-settings-input text-right w-24"
										class:is-estimated={estimatedNutrientKeys.has('magnesiumMg')}
									/>
									<span class="unit-text">mg</span>
								</div>
							</label>
							<label class="manage-settings-row nutrition-nutrient-row">
								<div class="flex items-center gap-1.5">
									<span class="nutrient-name">Iron (Fe)</span>
									{#if estimatedNutrientKeys.has('ironMg')}
										<span class="ia-estimate-badge" title="Estimated by AI from ingredients">~ AI</span>
									{/if}
								</div>
								<div class="flex items-center gap-1 justify-end">
									<input
										type="text"
										inputmode="decimal"
										bind:value={ironMgInput}
										oninput={() => clearEstimated('ironMg')}
										placeholder="—"
										class="manage-settings-input text-right w-24"
										class:is-estimated={estimatedNutrientKeys.has('ironMg')}
									/>
									<span class="unit-text">mg</span>
								</div>
							</label>
						</section>

						<section class="manage-settings-surface">
							<div class="px-3 pt-2 text-[11px] font-bold uppercase tracking-wider text-amber-500">
								Key Vitamins
							</div>
							<label class="manage-settings-row nutrition-nutrient-row">
								<div class="flex items-center gap-1.5">
									<span class="nutrient-name">Vitamin C</span>
									{#if estimatedNutrientKeys.has('vitaminCMg')}
										<span class="ia-estimate-badge" title="Estimated by AI from ingredients">~ AI</span>
									{/if}
								</div>
								<div class="flex items-center gap-1 justify-end">
									<input
										type="text"
										inputmode="decimal"
										bind:value={vitaminCMgInput}
										oninput={() => clearEstimated('vitaminCMg')}
										placeholder="—"
										class="manage-settings-input text-right w-24"
										class:is-estimated={estimatedNutrientKeys.has('vitaminCMg')}
									/>
									<span class="unit-text">mg</span>
								</div>
							</label>
							<label class="manage-settings-row nutrition-nutrient-row">
								<div class="flex items-center gap-1.5">
									<span class="nutrient-name">Vitamin D</span>
									{#if estimatedNutrientKeys.has('vitaminDIu')}
										<span class="ia-estimate-badge" title="Estimated by AI from ingredients">~ AI</span>
									{/if}
								</div>
								<div class="flex items-center gap-1 justify-end">
									<input
										type="text"
										inputmode="decimal"
										bind:value={vitaminDIuInput}
										oninput={() => clearEstimated('vitaminDIu')}
										placeholder="—"
										class="manage-settings-input text-right w-24"
										class:is-estimated={estimatedNutrientKeys.has('vitaminDIu')}
									/>
									<span class="unit-text">IU</span>
								</div>
							</label>
							<label class="manage-settings-row nutrition-nutrient-row">
								<div class="flex items-center gap-1.5">
									<span class="nutrient-name">Vitamin B12</span>
									{#if estimatedNutrientKeys.has('vitaminB12Mcg')}
										<span class="ia-estimate-badge" title="Estimated by AI from ingredients">~ AI</span>
									{/if}
								</div>
								<div class="flex items-center gap-1 justify-end">
									<input
										type="text"
										inputmode="decimal"
										bind:value={vitaminB12McgInput}
										oninput={() => clearEstimated('vitaminB12Mcg')}
										placeholder="—"
										class="manage-settings-input text-right w-24"
										class:is-estimated={estimatedNutrientKeys.has('vitaminB12Mcg')}
									/>
									<span class="unit-text">mcg</span>
								</div>
							</label>
							<label class="manage-settings-row nutrition-nutrient-row">
								<div class="flex items-center gap-1.5">
									<span class="nutrient-name">Vitamin A</span>
									{#if estimatedNutrientKeys.has('vitaminAMcg')}
										<span class="ia-estimate-badge" title="Estimated by AI from ingredients">~ AI</span>
									{/if}
								</div>
								<div class="flex items-center gap-1 justify-end">
									<input
										type="text"
										inputmode="decimal"
										bind:value={vitaminAMcgInput}
										oninput={() => clearEstimated('vitaminAMcg')}
										placeholder="—"
										class="manage-settings-input text-right w-24"
										class:is-estimated={estimatedNutrientKeys.has('vitaminAMcg')}
									/>
									<span class="unit-text">mcg</span>
								</div>
							</label>
							<label class="manage-settings-row nutrition-nutrient-row">
								<div class="flex items-center gap-1.5">
									<span class="nutrient-name">Vitamin B6</span>
									{#if estimatedNutrientKeys.has('vitaminB6Mg')}
										<span class="ia-estimate-badge" title="Estimated by AI from ingredients">~ AI</span>
									{/if}
								</div>
								<div class="flex items-center gap-1 justify-end">
									<input
										type="text"
										inputmode="decimal"
										bind:value={vitaminB6MgInput}
										oninput={() => clearEstimated('vitaminB6Mg')}
										placeholder="—"
										class="manage-settings-input text-right w-24"
										class:is-estimated={estimatedNutrientKeys.has('vitaminB6Mg')}
									/>
									<span class="unit-text">mg</span>
								</div>
							</label>
						</section>
					</div>
				{/if}
			</div>
		</div>
	{/snippet}

	{#snippet footer()}
		<button type="button" class="manage-secondary" onclick={onclose}>
			{t.nutrition_cancel}
		</button>
		<button
			type="button"
			class="manage-primary !bg-[var(--theme-accent)]"
			onclick={handleSave}
			disabled={analyzingPhoto}
		>
			Save & Apply
		</button>
	{/snippet}
</ManageSheetShell>

<style>
	.photo-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		border-radius: 14px;
		border: 1px dashed var(--bubble-container-border);
		background: var(--color-surface);
		overflow: hidden;
		transition: all 0.15s ease;
		min-height: 104px;
	}
	.photo-card.has-photo {
		border-style: solid;
		border-color: var(--bubble-container-border);
		padding: 4px;
	}
	.photo-empty-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		width: 100%;
		height: 100%;
		padding: 12px 8px;
		background: transparent;
		border: none;
		color: var(--color-on-surface-variant);
		cursor: pointer;
		text-align: center;
	}
	.photo-empty-btn:hover {
		color: var(--color-on-surface);
	}
	.photo-delete-btn {
		position: absolute;
		top: 4px;
		right: 4px;
		width: 22px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.65);
		color: white;
		border: none;
		font-size: 11px;
		cursor: pointer;
		backdrop-filter: blur(4px);
	}
	.photo-change-btn {
		position: absolute;
		bottom: 4px;
		left: 50%;
		transform: translateX(-50%);
		padding: 2px 8px;
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.65);
		color: white;
		border: none;
		font-size: 10px;
		font-weight: 600;
		cursor: pointer;
		backdrop-filter: blur(4px);
	}
	.photo-card-label {
		display: block;
		text-align: center;
		font-size: 11px;
		font-weight: 600;
		color: var(--color-on-surface-variant);
		padding: 4px 0 2px;
	}
	.ai-analyze-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 10px 14px;
		border-radius: 12px;
		background: linear-gradient(135deg, #DC2626 0%, #EA580C 100%);
		color: #FFFFFF;
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
		border: none;
		box-shadow: 0 2px 6px rgba(220, 38, 38, 0.25);
		transition: all 0.15s ease;
	}
	.ai-analyze-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
		box-shadow: none;
	}
	.ai-analyze-btn:not(:disabled):active {
		transform: scale(0.98);
	}
	.ia-estimate-badge {
		display: inline-flex;
		align-items: center;
		padding: 1px 5px;
		border-radius: 9999px;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.02em;
		background: color-mix(in srgb, #8B5CF6 18%, transparent);
		color: #A78BFA;
		border: 1px solid color-mix(in srgb, #8B5CF6 32%, transparent);
	}
	:global(.light) .ia-estimate-badge {
		background: #EDE9FE;
		color: #6D28D9;
		border-color: #DDD6FE;
	}
	.is-estimated {
		border-color: color-mix(in srgb, #8B5CF6 45%, transparent) !important;
	}
	.manage-section-title {
		display: block;
		margin: 4px 2px 7px;
		color: var(--color-on-surface-variant);
		font-size: 11px;
		font-weight: 650;
		letter-spacing: .08em;
		text-transform: uppercase;
	}
	.nutrition-edit-field {
		display: grid;
		grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr);
		align-items: center;
		gap: 8px;
	}
	.nutrition-portion-field {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.portion-unit-select {
		height: 34px;
		padding: 0 6px;
		border-radius: 8px;
		border: 1px solid var(--bubble-container-border);
		background: var(--color-surface);
		color: var(--color-on-surface);
		font-size: 14px;
		font-weight: 600;
	}
	.mode-toggle-group {
		display: flex;
		gap: 4px;
		padding: 2px;
		border-radius: 999px;
		background: var(--color-surface-container-high, rgba(120, 120, 128, 0.12));
	}
	.mode-pill {
		padding: 3px 8px;
		border-radius: 999px;
		border: none;
		background: transparent;
		color: var(--color-on-surface-variant);
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.mode-pill.active {
		background: var(--color-surface, #fff);
		color: var(--theme-accent);
		box-shadow: 0 1px 3px rgba(0,0,0,0.1);
	}
	.nutrition-nutrient-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.nutrient-name {
		font-size: 14px;
		font-weight: 600;
		color: var(--color-on-surface);
	}
	.active-type-btn {
		background: #DC2626;
		color: #ffffff;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
	}
	.inactive-type-btn {
		background: transparent;
		color: var(--color-on-surface-variant);
	}
	.inactive-type-btn:hover {
		color: var(--color-on-surface);
	}
	.unit-text {
		width: 28px;
		font-size: 12px;
		color: var(--color-on-surface-variant);
	}
</style>
