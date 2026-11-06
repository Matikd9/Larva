<script lang="ts">
	import { t } from '#lib/i18n.svelte';
	import { goto } from '$app/navigation';
	import { userSettings } from '#lib/userSettings.svelte';
	import ManageSheetShell from './ManageSheetShell.svelte';
	import { type EssentialMicros, scaleMicros } from '#lib/micronutrients';

	type AiCalculatedItem = {
		id: string;
		displayName: string;
		amount: number;
		unit: 'g' | 'ml';
		kcal: number;
		protein: number;
		fat: number;
		saturatedFat?: number | null;
		monounsaturatedFat?: number | null;
		polyunsaturatedFat?: number | null;
		transFat?: number | null;
		carbs: number;
		fiber: number;
		sugar: number;
		salt: number;
		sodiumMg: number;
		micros?: EssentialMicros | null;
	};

	let {
		onclose,
		onaddcomponents,
		zIndex = 80
	}: {
		onclose: () => void;
		onaddcomponents: (components: Array<{
			productBarcode: null;
			genericFoodId: null;
			customName: string;
			displayName: string;
			imageUrl: null;
			amount: number;
			unit: 'g' | 'ml';
			gramsPerPiece: null;
			kcalPer100: number;
			proteinPer100: number;
			fatPer100: number;
			carbsPer100: number;
			sugarPer100: number;
			fiberPer100: number;
			saltPer100: number;
			micros?: EssentialMicros | null;
		}>) => void;
		zIndex?: number;
	} = $props();

	let text = $state('');
	let imageBase64 = $state<string | null>(null);
	let imageMimeType = $state<string>('image/jpeg');
	let imageInput = $state<HTMLInputElement | null>(null);
	let compressingImage = $state(false);
	let calculating = $state(false);
	let errorMessage = $state<string | null>(null);
	let isNoApiKey = $state(false);
	let items = $state<AiCalculatedItem[]>([]);
	let currentAbortController = $state<AbortController | null>(null);

	const quickExamples = [
		'160g steak and 250g mashed potatoes',
		'2 scrambled eggs with toast and coffee with milk',
		'1 cup oatmeal with 200ml milk and 1 banana',
		'Chicken salad with avocado, lettuce, and tomato'
	];

	function pickExample(ex: string) {
		text = ex;
		errorMessage = null;
		isNoApiKey = false;
	}

	async function handleImageSelect(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		compressingImage = true;
		errorMessage = null;
		try {
			// Resilient image loading using URL.createObjectURL + HTMLImageElement (rock solid on iOS camera & HEIC)
			const { base64, mimeType } = await new Promise<{ base64: string; mimeType: string }>((resolve, reject) => {
				const url = URL.createObjectURL(file);
				const img = new Image();
				img.onload = () => {
					URL.revokeObjectURL(url);
					try {
						const nw = img.naturalWidth || img.width;
						const nh = img.naturalHeight || img.height;
						const scale = Math.min(1, 1000 / Math.max(nw, nh));
						const width = Math.max(1, Math.round(nw * scale));
						const height = Math.max(1, Math.round(nh * scale));
						const canvas = document.createElement('canvas');
						canvas.width = width;
						canvas.height = height;
						const ctx = canvas.getContext('2d');
						if (!ctx) return reject(new Error('No canvas context'));
						ctx.drawImage(img, 0, 0, width, height);
						let quality = 0.75;
						let dataUrl = canvas.toDataURL('image/jpeg', quality);
						if (dataUrl.length > 450_000) {
							quality = 0.60;
							dataUrl = canvas.toDataURL('image/jpeg', quality);
						}
						if (dataUrl.length > 450_000) {
							const smallCanvas = document.createElement('canvas');
							smallCanvas.width = Math.max(1, Math.round(width * 0.75));
							smallCanvas.height = Math.max(1, Math.round(height * 0.75));
							const sCtx = smallCanvas.getContext('2d');
							if (sCtx) {
								sCtx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
								dataUrl = smallCanvas.toDataURL('image/jpeg', 0.60);
							}
						}
						resolve({
							base64: dataUrl.split(',')[1] || dataUrl,
							mimeType: 'image/jpeg'
						});
					} catch (err) {
						reject(err);
					}
				};
				img.onerror = () => {
					URL.revokeObjectURL(url);
					reject(new Error('Image decode error'));
				};
				img.src = url;
			});
			imageBase64 = base64;
			imageMimeType = mimeType;
		} catch (err) {
			console.error('Error procesando imagen con HTMLImageElement fallback to FileReader:', err);
			const reader = new FileReader();
			reader.onload = () => {
				const res = reader.result as string;
				imageBase64 = res.split(',')[1] || res;
				imageMimeType = file.type || 'image/jpeg';
			};
			reader.readAsDataURL(file);
		} finally {
			compressingImage = false;
		}
	}

	function removeImage() {
		imageBase64 = null;
		if (imageInput) imageInput.value = '';
	}

	function handleClose() {
		if (currentAbortController) {
			currentAbortController.abort();
			currentAbortController = null;
		}
		onclose();
	}

	async function runEstimate() {
		const trimmed = text.trim();
		if ((!trimmed && !imageBase64) || calculating || compressingImage) return;
		calculating = true;
		errorMessage = null;
		isNoApiKey = false;

		const controller = new AbortController();
		currentAbortController = controller;
		const timeoutId = setTimeout(() => {
			controller.abort();
		}, 25000);

		try {
			const currentProvider = userSettings.aiNutritionProvider || 'gemini';
			const apiKey = (currentProvider === 'gemini' ? userSettings.aiGeminiApiKey : userSettings.aiOpenaiApiKey) || '';
			const model = (currentProvider === 'gemini' ? userSettings.aiGeminiModel : userSettings.aiOpenaiModel) || (currentProvider === 'gemini' ? 'gemini-flash-lite-latest' : 'gpt-4o-mini');

			const res = await fetch('/api/nutrition/ai-estimate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				signal: controller.signal,
				body: JSON.stringify({
					text: trimmed,
					imageBase64: imageBase64 ?? undefined,
					imageMimeType: imageBase64 ? imageMimeType : undefined,
					provider: currentProvider,
					apiKey,
					model
				})
			});

			const data = await res.json();
			if (!res.ok) {
				if (data.error === 'NO_API_KEY') {
					isNoApiKey = true;
					errorMessage = t.ai_nutrition_no_api_key;
				} else {
					errorMessage = data.message || 'Error processing with AI.';
				}
				return;
			}

			items = (data.items ?? []).map((it: AiCalculatedItem) => ({ ...it }));
			if (items.length === 0) {
				errorMessage = 'No foods detected in the photo or description.';
			}
		} catch (e: any) {
			console.error(e);
			if (e?.name === 'AbortError') {
				errorMessage = 'Request timed out after 25s. Please try again.';
			} else {
				errorMessage = 'Server connection error.';
			}
		} finally {
			clearTimeout(timeoutId);
			currentAbortController = null;
			calculating = false;
		}
	}

	function removeItem(id: string) {
		items = items.filter((it) => it.id !== id);
	}

	const totals = $derived.by(() => {
		let kcal = 0;
		let protein = 0;
		let fat = 0;
		let carbs = 0;
		for (const it of items) {
			kcal += it.kcal;
			protein += it.protein;
			fat += it.fat;
			carbs += it.carbs;
		}
		return {
			kcal: Math.round(kcal),
			protein: Math.round(protein * 10) / 10,
			fat: Math.round(fat * 10) / 10,
			carbs: Math.round(carbs * 10) / 10
		};
	});

	function confirmAndAdd() {
		if (items.length === 0) return;
		const payload = items.map((it) => {
			const grams = it.amount > 0 ? it.amount : 100;
			return {
				productBarcode: null,
				genericFoodId: null,
				customName: it.displayName,
				displayName: it.displayName,
				imageUrl: null,
				amount: grams,
				unit: it.unit,
				gramsPerPiece: null,
				kcalPer100: Math.round((it.kcal / grams) * 100),
				proteinPer100: Math.round(((it.protein / grams) * 100) * 10) / 10,
				fatPer100: Math.round(((it.fat / grams) * 100) * 10) / 10,
				carbsPer100: Math.round(((it.carbs / grams) * 100) * 10) / 10,
				sugarPer100: Math.round(((it.sugar / grams) * 100) * 10) / 10,
				fiberPer100: Math.round(((it.fiber / grams) * 100) * 10) / 10,
				saltPer100: Math.round(((it.salt / grams) * 100) * 10) / 10,
				micros: it.micros ? scaleMicros(it.micros, 100 / grams) : null
			};
		});

		onaddcomponents(payload);
		handleClose();
	}
</script>

<ManageSheetShell
	accent="#FB923C"
	title={t.ai_nutrition_title}
	subtitle="Automatically estimate macros and fats distribution"
	onclose={handleClose}
	{zIndex}
	maxHeight="92dvh"
>
	{#snippet headerActions()}
		<button type="button" onclick={handleClose} class="manage-sheet-close" aria-label={t.nutrition_cancel}>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<line x1="18" y1="6" x2="6" y2="18" />
				<line x1="6" y1="6" x2="18" y2="18" />
			</svg>
		</button>
	{/snippet}

	{#snippet body()}
		<div class="space-y-4">
			<!-- Hidden file input for camera/gallery photo -->
			<input
				type="file"
				accept="image/*"
				bind:this={imageInput}
				onchange={handleImageSelect}
				style="display:none;"
			/>

			<!-- Photo preview or capture button -->
			{#if imageBase64}
				<div class="relative w-full rounded-2xl overflow-hidden border border-[var(--bubble-container-border)] bg-black/10 flex items-center justify-center">
					<img src="data:{imageMimeType};base64,{imageBase64}" alt="Food upload preview" class="w-full h-44 object-cover" />
					<button
						type="button"
						onclick={removeImage}
						class="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center font-bold text-xs active:scale-95 transition-transform"
						aria-label="Remove photo"
					>
						✕
					</button>
				</div>
			{:else}
				<button
					type="button"
					onclick={() => imageInput?.click()}
					disabled={compressingImage || calculating}
					class="w-full py-2.5 px-3 rounded-2xl border border-dashed border-[var(--bubble-container-border)] text-xs font-semibold flex items-center justify-center gap-2 transition-all active:opacity-70"
					style="color: var(--color-on-surface-variant); background: var(--color-surface-container);"
				>
					{#if compressingImage}
						<span class="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
						<span>Processing photo…</span>
					{:else}
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
							<circle cx="12" cy="13" r="4"></circle>
						</svg>
						<span>Upload photo or take with camera</span>
					{/if}
				</button>
			{/if}

			<!-- Textarea input -->
			<div class="space-y-2">
				<textarea
					bind:value={text}
					rows="3"
					placeholder={imageBase64 ? 'Optional additional notes (e.g. ate half, no oil...)' : t.ai_nutrition_placeholder}
					class="w-full px-3.5 py-2.5 rounded-2xl text-sm border outline-none resize-none transition-colors"
					style="background: var(--color-surface-container); border-color: var(--bubble-container-border); color: var(--color-on-surface);"
				></textarea>

				<!-- Quick suggestion pills -->
				<div class="flex flex-wrap gap-1.5">
					{#each quickExamples as ex}
						<button
							type="button"
							onclick={() => pickExample(ex)}
							class="text-[11px] px-2.5 py-1 rounded-full border border-[var(--bubble-container-border)] bg-[var(--color-surface-container)]/50 active:opacity-60 transition-opacity text-left"
							style="color: var(--color-on-surface-variant)"
						>
							{ex}
						</button>
					{/each}
				</div>

				{#if errorMessage}
					<div class="p-3 rounded-xl border text-xs flex flex-col gap-1.5" style="border-color: var(--color-error); background: color-mix(in srgb, var(--color-error) 10%, transparent); color: var(--color-on-surface)">
						<div class="flex items-center gap-1.5 font-semibold" style="color: var(--color-error)">
							<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
							<span>{errorMessage}</span>
						</div>
						{#if isNoApiKey}
							<button
								type="button"
								onclick={() => { onclose(); goto('/einstellungen#ai'); }}
								class="self-start text-[11px] font-bold underline mt-1"
								style="color: #FB923C"
							>
								Configure API Key in Settings →
							</button>
						{/if}
					</div>
				{/if}

				<button
					type="button"
					onclick={runEstimate}
					disabled={(!text.trim() && !imageBase64) || calculating || compressingImage}
					class="w-full h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-40 transition-opacity"
					style="background: #FB923C; color: #111;"
				>
					{#if calculating}
						<span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
						<span>{t.ai_nutrition_calculating}</span>
					{:else}
						<span>{t.ai_nutrition_calc_button}</span>
					{/if}
				</button>
			</div>

			<!-- Preview items section -->
			{#if items.length > 0}
				<div class="space-y-2.5 pt-2 border-t border-[var(--bubble-container-border)]">
					<div class="flex items-center justify-between text-xs font-semibold px-0.5" style="color: var(--color-on-surface)">
						<span>{t.ai_nutrition_preview_title} ({items.length})</span>
						<span class="tabular-nums" style="color: #FB923C">{totals.kcal} kcal</span>
					</div>

					<div class="space-y-2">
						{#each items as it (it.id)}
							<div class="p-3 rounded-2xl border border-[var(--bubble-container-border)] bg-[var(--color-surface-container)]/60 flex flex-col gap-2">
								<div class="flex items-center justify-between gap-2">
									<input
										type="text"
										bind:value={it.displayName}
										class="font-semibold text-sm bg-transparent border-0 outline-none flex-1 min-w-0"
										style="color: var(--color-on-surface)"
									/>
									<button
										type="button"
										onclick={() => removeItem(it.id)}
										class="p-1 rounded-lg text-xs opacity-60 active:opacity-100 transition-opacity"
										style="color: var(--color-error)"
										aria-label={t.nutrition_remove}
									>
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
									</button>
								</div>

								<div class="flex items-center gap-2 text-xs">
									<span class="flex items-center gap-1 font-mono tabular-nums px-2 py-0.5 rounded-lg bg-[var(--color-surface-container)] border border-[var(--bubble-container-border)]">
										<input
											type="number"
											bind:value={it.amount}
											class="w-12 bg-transparent border-0 outline-none text-right font-semibold"
											style="color: var(--color-on-surface)"
										/>
										<span style="color: var(--color-on-surface-variant)">{it.unit}</span>
									</span>
									<span class="font-bold tabular-nums ml-auto" style="color: #FB923C">{it.kcal} kcal</span>
								</div>

								<!-- Macro chips -->
								<div class="flex items-center gap-1.5 text-[10px] tabular-nums font-semibold">
									<span class="px-2 py-0.5 rounded-md" style="background: color-mix(in srgb, #A78BFA 18%, transparent); color: #A78BFA">
										P: {it.protein}g
									</span>
									<span class="px-2 py-0.5 rounded-md" style="background: color-mix(in srgb, #FB923C 18%, transparent); color: #FB923C">
										F: {it.fat}g
									</span>
									<span class="px-2 py-0.5 rounded-md" style="background: color-mix(in srgb, #60A5FA 18%, transparent); color: #60A5FA">
										C: {it.carbs}g
									</span>
									{#if it.fiber > 0}
										<span class="px-1.5 py-0.5 rounded-md opacity-80" style="background: var(--color-surface-container); color: var(--color-on-surface-variant)">
											Fib: {it.fiber}g
										</span>
									{/if}
								</div>

								<!-- Fat breakdown chips -->
								{#if it.saturatedFat != null || it.monounsaturatedFat != null || it.polyunsaturatedFat != null || it.transFat != null}
									<div class="flex flex-wrap items-center gap-1.5 text-[10px] tabular-nums font-medium opacity-90">
										{#if it.saturatedFat != null}
											<span class="px-1.5 py-0.5 rounded" style="background: rgba(245, 158, 11, 0.12); color: #F59E0B">
												Sat: {it.saturatedFat}g
											</span>
										{/if}
										{#if it.monounsaturatedFat != null}
											<span class="px-1.5 py-0.5 rounded" style="background: rgba(56, 189, 248, 0.12); color: #38BDF8">
												Mono: {it.monounsaturatedFat}g
											</span>
										{/if}
										{#if it.polyunsaturatedFat != null}
											<span class="px-1.5 py-0.5 rounded" style="background: rgba(16, 185, 129, 0.12); color: #10B981">
												Poly: {it.polyunsaturatedFat}g
											</span>
										{/if}
										{#if it.transFat != null && it.transFat > 0}
											<span class="px-1.5 py-0.5 rounded" style="background: rgba(239, 68, 68, 0.12); color: #EF4444">
												Trans: {it.transFat}g
											</span>
										{/if}
									</div>
								{/if}
							</div>
						{/each}
					</div>

					<!-- Total summary banner & add button -->
					<div class="p-3 rounded-2xl border border-[var(--bubble-container-border)] bg-[var(--color-surface-container)] space-y-2 mt-3">
						<div class="flex justify-between text-xs font-bold" style="color: var(--color-on-surface)">
							<span>Estimated total</span>
							<span style="color: #FB923C">{totals.kcal} kcal</span>
						</div>
						<div class="flex justify-between text-[11px] tabular-nums" style="color: var(--color-on-surface-variant)">
							<span style="color: #A78BFA; font-weight: 600">P: {totals.protein}g</span>
							<span style="color: #FB923C; font-weight: 600">F: {totals.fat}g</span>
							<span style="color: #60A5FA; font-weight: 600">C: {totals.carbs}g</span>
						</div>
					</div>

					<button
						type="button"
						onclick={confirmAndAdd}
						class="w-full h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:opacity-80 transition-opacity"
						style="background: #10B981; color: #fff;"
					>
						+ {t.ai_nutrition_add_all} ({items.length})
					</button>
				</div>
			{/if}
		</div>
	{/snippet}
</ManageSheetShell>

<style>
	.manage-sheet-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 999px;
		color: var(--color-on-surface-variant);
		transition: background-color 140ms ease;
	}
	.manage-sheet-close:active {
		background: var(--color-surface-container);
	}
</style>
