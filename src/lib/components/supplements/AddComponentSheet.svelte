<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import BarcodeScanner from '#lib/components/BarcodeScanner.svelte';
	import AiFoodEstimatorSheet from './AiFoodEstimatorSheet.svelte';
	import { t, currentLang, nutrition_nutrients_per_100 } from '#lib/i18n.svelte';
	import { getNutritionCategoryIcon } from '#lib/nutritionCategoryIcons';
	import { nextNutritionUseCount, nutritionBasisSuffix, parseOptionalNutritionNumber } from '#lib/nutritionUtils';
	import ManageSheetShell from './ManageSheetShell.svelte';
	import NutritionFoodRow from './NutritionFoodRow.svelte';
	import NutritionMacroStrip from './NutritionMacroStrip.svelte';
	import ProductNutritionEditModal, { type UpdatedProductData } from './ProductNutritionEditModal.svelte';
	import {
		type EssentialMicros,
		ESSENTIAL_MICROS_META,
		FAT_TYPES_META,
		computeRdaPercent,
		formatMicroValue
	} from '#lib/micronutrients';

	type Component = {
		productBarcode: string | null;
		genericFoodId: string | null;
		customName: string | null;
		displayName: string;
		imageUrl: string | null;
		amount: number;
		unit: 'g' | 'ml' | 'piece' | 'portion';
		gramsPerPiece: number | null;
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

	type GenericCounterpart = {
		id: string;
		name: string;
		cookingState: 'raw' | 'cooked';
		kcalPer100: number;
		proteinPer100: number | null;
		fatPer100: number | null;
		carbsPer100: number | null;
		sugarPer100: number | null;
		fiberPer100: number | null;
		saltPer100: number | null;
		defaultPieceWeight: number | null;
		defaultUnit: 'g' | 'ml' | 'piece' | 'portion';
		micros?: EssentialMicros | null;
	};

	type GenericResult = {
		type: 'generic';
		id: string;
		category: string;
		name: string;
		cookingState?: 'raw' | 'cooked' | null;
		counterpartId?: string | null;
		counterpart?: GenericCounterpart | null;
		kcalPer100: number;
		proteinPer100: number | null;
		fatPer100: number | null;
		carbsPer100: number | null;
		sugarPer100: number | null;
		fiberPer100: number | null;
		saltPer100: number | null;
		defaultPieceWeight: number | null;
		defaultUnit: 'g' | 'ml' | 'piece' | 'portion';
		micros?: EssentialMicros | null;
	};
	type ProductResult = {
		type: 'product';
		barcode: string;
		name: string;
		brand: string | null;
		imageUrl: string | null;
		nutriscoreGrade: string | null;
		servingQuantity: number | null;
		servingSize?: string | null;
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

	type Favorite = {
		id: string;
		displayName: string;
		imageUrl: string | null;
		productBarcode: string | null;
		genericFoodId: string | null;
		category?: string | null;
		customKcalPer100: number | null;
		customProteinPer100: number | null;
		customFatPer100: number | null;
		customCarbsPer100: number | null;
		customSugarPer100: number | null;
		customFiberPer100: number | null;
		customSaltPer100: number | null;
		micros?: EssentialMicros | null;
		defaultAmount: number;
		defaultUnit: 'g' | 'ml' | 'piece' | 'portion';
		defaultGramsPerPiece: number | null;
		useCount?: number;
		lastUsedAt?: number | null;
	};

	type MealFavoriteComponent = {
		productBarcode: string | null;
		genericFoodId: string | null;
		customName: string | null;
		displayName: string;
		imageUrl: string | null;
		amount: number;
		unit: 'g' | 'ml' | 'piece' | 'portion';
		gramsPerPiece: number | null;
		kcalPer100: number | null;
		proteinPer100: number | null;
		fatPer100: number | null;
		carbsPer100: number | null;
		sugarPer100: number | null;
		fiberPer100: number | null;
		saltPer100: number | null;
		micros?: EssentialMicros | null;
	};
	type MealFavorite = {
		id: string;
		displayName: string;
		defaultMealName: string | null;
		imageUrl: string | null;
		caffeineDrinkId?: string | null;
		useCount?: number;
		lastUsedAt?: number | null;
		components: MealFavoriteComponent[];
	};

	type RecentFood = {
		id: string;
		productBarcode: string | null;
		genericFoodId: string | null;
		customName: string | null;
		displayName: string;
		imageUrl: string | null;
		amount: number;
		unit: 'g' | 'ml' | 'piece' | 'portion';
		gramsPerPiece: number | null;
		category?: string | null;
		kcalPer100: number | null;
		proteinPer100: number | null;
		fatPer100: number | null;
		carbsPer100: number | null;
		sugarPer100: number | null;
		fiberPer100: number | null;
		saltPer100: number | null;
		kcal: number;
		micros?: EssentialMicros | null;
		lastUsedDate: string;
		lastUsedTime: string;
	};

	let { initial = null, suggestedAmount = null, suggestedUnit = null, favoriteMode = false, foodRegisterMode = false, onclose, onadd, onaddbatch, onpickmeal }: {
		initial?: Component | null;
		// Beim Zuordnen einer Rezept-Zutat: Menge/Einheit aus dem Zutatentext vorbefüllen.
		suggestedAmount?: number | null;
		suggestedUnit?: 'g' | 'ml' | 'piece' | 'portion' | null;
		favoriteMode?: boolean;
		foodRegisterMode?: boolean;
		onclose: () => void;
		onadd: (c: Component) => void;
		onaddbatch?: (components: Component[]) => void;
		onpickmeal?: (payload: { components: Component[]; defaultMealName: string | null; favoriteName: string; imageUrl: string | null; caffeineDrinkId: string | null }) => void;
	} = $props();

	// View: 'picker' (browse/search) | 'amount' (set amount for selected)
	// svelte-ignore state_referenced_locally
	let view = $state<'picker' | 'amount' | 'custom'>(initial ? 'amount' : 'picker');
	// svelte-ignore state_referenced_locally
	let selected = $state<Component | null>(initial ? { ...initial } : null);
	// Kategorie des ausgewählten generischen Lebensmittels (für das Vorschau-Icon).
	// Nur gesetzt, wenn die Auswahl ein generic ist – sonst greift der Buchstaben-Fallback.
	let selectedCategory = $state<string | null>(null);
	let activeGenericVariantA = $state<GenericResult | null>(null);
	let activeGenericVariantB = $state<GenericCounterpart | null>(null);
	let currentCookingState = $state<'cooked' | 'raw' | null>(null);

	// Picker state
	let query = $state('');
	// Zweistufige Suche: lokal (Generics + Cache) schnell, OFF (Online) langsam + abbrechbar.
	let localTimer: ReturnType<typeof setTimeout> | null = null;
	let offTimer: ReturnType<typeof setTimeout> | null = null;
	let localAbort: AbortController | null = null;
	let offAbort: AbortController | null = null;
	let searching = $state(false);
	let genericResults = $state<GenericResult[]>([]);
	let localProducts = $state<ProductResult[]>([]);
	let offProducts = $state<ProductResult[]>([]);
	// Lokale Treffer haben Vorrang; OFF füllt nur fehlende Barcodes auf.
	const productResults = $derived.by(() => {
		const seen = new Set<string>();
		const out: ProductResult[] = [];
		for (const p of [...localProducts, ...offProducts]) {
			if (seen.has(p.barcode)) continue;
			seen.add(p.barcode);
			out.push(p);
		}
		return out.slice(0, 20);
	});
	let favorites = $state<Favorite[]>([]);
	let mealFavorites = $state<MealFavorite[]>([]);
	let recentFoods = $state<RecentFood[]>([]);
	let pickerTab = $state<'recent' | 'search' | 'favorites'>('recent');
	let loadingRecent = $state(false);
	let showAllFavorites = $state(false);
	let scannerOpen = $state(false);
	let loadingBarcode = $state(false);

	// Product nutrition edit & photo modal
	let productEditModalOpen = $state(false);
	let productEditBarcode = $state<string | null>(null);
	let productEditAutoPhoto = $state(false);
	let productEditInitialFoodType = $state<'ultraprocessed' | 'natural'>('ultraprocessed');
	let productEditInitialData = $state<{
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
	}>({ name: '' });

	function openProductNutritionEdit(autoPhoto = false, fallbackBarcode?: string, initialFoodType: 'ultraprocessed' | 'natural' = 'ultraprocessed') {
		const bcode = fallbackBarcode ?? selected?.productBarcode ?? null;
		productEditBarcode = bcode;
		productEditAutoPhoto = autoPhoto;
		productEditInitialFoodType = initialFoodType;
		productEditInitialData = {
			name: selected?.displayName || '',
			brand: null,
			servingQuantity: selected?.gramsPerPiece ?? null,
			servingSize: selected?.gramsPerPiece ? `${selected.gramsPerPiece} g` : null,
			kcalPer100: selected?.kcalPer100 ?? null,
			proteinPer100: selected?.proteinPer100 ?? null,
			fatPer100: selected?.fatPer100 ?? null,
			carbsPer100: selected?.carbsPer100 ?? null,
			sugarPer100: selected?.sugarPer100 ?? null,
			fiberPer100: selected?.fiberPer100 ?? null,
			saltPer100: selected?.saltPer100 ?? null,
			micros: selected?.micros ?? null,
			ingredientsText: selected?.ingredientsText ?? null
		};
		productEditModalOpen = true;
	}

	async function handleProductNutritionSaved(data: UpdatedProductData) {
		productEditModalOpen = false;
		const bcode = productEditBarcode;

		if (selected) {
			selected = {
				...selected,
				displayName: data.name,
				productBarcode: bcode ?? selected.productBarcode,
				gramsPerPiece: data.servingQuantity ?? selected.gramsPerPiece,
				kcalPer100: data.kcalPer100,
				proteinPer100: data.proteinPer100,
				fatPer100: data.fatPer100,
				carbsPer100: data.carbsPer100,
				sugarPer100: data.sugarPer100,
				fiberPer100: data.fiberPer100,
				saltPer100: data.saltPer100,
				micros: data.micros,
				ingredientsText: data.ingredientsText
			};
		} else if (bcode) {
			selected = {
				productBarcode: bcode,
				genericFoodId: null,
				customName: null,
				displayName: data.name,
				imageUrl: null,
				amount: suggestedAmount ?? 1,
				unit: suggestedUnit ?? 'portion',
				gramsPerPiece: data.servingQuantity ?? 100,
				kcalPer100: data.kcalPer100,
				proteinPer100: data.proteinPer100,
				fatPer100: data.fatPer100,
				carbsPer100: data.carbsPer100,
				sugarPer100: data.sugarPer100,
				fiberPer100: data.fiberPer100,
				saltPer100: data.saltPer100,
				micros: data.micros,
				ingredientsText: data.ingredientsText
			};
			selectedCategory = null;
			pushSubView('amount');
		}

		if (bcode) {
			try {
				await fetch(`/api/nutrition/product/${encodeURIComponent(bcode)}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						name: data.name,
						brand: data.brand,
						servingQuantity: data.servingQuantity,
						servingSize: data.servingSize,
						kcalPer100: data.kcalPer100,
						proteinPer100: data.proteinPer100,
						fatPer100: data.fatPer100,
						carbsPer100: data.carbsPer100,
						sugarPer100: data.sugarPer100,
						fiberPer100: data.fiberPer100,
						saltPer100: data.saltPer100,
						micros: data.micros,
						ingredientsText: data.ingredientsText
					})
				});
			} catch (e) {
				console.error('[AddComponentSheet] Failed to persist product to barcodeCache:', e);
			}
		}
	}

	// Multi-select for recent foods
	let selectedRecentIds = $state<Set<string>>(new Set());

	function toggleRecentSelection(id: string) {
		const next = new Set(selectedRecentIds);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		selectedRecentIds = next;
	}

	function clearRecentSelection() {
		selectedRecentIds = new Set();
	}

	const selectedRecentFoods = $derived(
		recentFoods.filter((r) => selectedRecentIds.has(r.id))
	);

	const selectedRecentTotals = $derived.by(() => {
		const count = selectedRecentFoods.length;
		const kcal = Math.round(selectedRecentFoods.reduce((sum, r) => sum + (r.kcal || 0), 0));
		return { count, kcal };
	});

	export function handleBack(): boolean {
		if (productEditModalOpen) {
			productEditModalOpen = false;
			return true;
		}
		if (scannerOpen) {
			scannerOpen = false;
			return true;
		}
		if (aiSheetOpen) {
			aiSheetOpen = false;
			return true;
		}
		if (view === 'amount' || view === 'custom') {
			if (!initial) {
				view = 'picker';
				selected = null;
				return true;
			}
		}
		return false;
	}

	function pushSubView(targetView: 'amount' | 'custom') {
		view = targetView;
	}

	function openCustomEntry() {
		customName = '';
		customKcal = '';
		customProtein = '';
		customFat = '';
		customCarbs = '';
		customSugar = '';
		customFiber = '';
		customSalt = '';
		customSodiumMg = '';
		customGramsPerPiece = '';
		customPotassiumMg = '';
		customCalciumMg = '';
		customMagnesiumMg = '';
		customIronMg = '';
		customVitaminCMg = '';
		customVitaminDIu = '';
		customVitaminB12Mcg = '';
		customVitaminAMcg = '';
		customVitaminB6Mg = '';
		customShowVitaminsAndMinerals = false;
		pushSubView('custom');
	}

	function handleSheetClose() {
		if (view === 'amount' || view === 'custom') {
			if (!initial) {
				view = 'picker';
				selected = null;
				return;
			}
		}
		onclose();
	}

	function addSelectedRecentBatch() {
		if (selectedRecentFoods.length === 0) return;
		const comps: Component[] = selectedRecentFoods.map((r) => ({
			productBarcode: r.productBarcode,
			genericFoodId: r.genericFoodId,
			customName: r.customName,
			displayName: r.displayName,
			imageUrl: r.imageUrl,
			amount: r.amount,
			unit: r.unit,
			gramsPerPiece: r.gramsPerPiece,
			kcalPer100: r.kcalPer100,
			proteinPer100: r.proteinPer100,
			fatPer100: r.fatPer100,
			carbsPer100: r.carbsPer100,
			sugarPer100: r.sugarPer100,
			fiberPer100: r.fiberPer100,
			saltPer100: r.saltPer100,
			micros: r.micros ?? null
		}));

		if (onaddbatch) {
			onaddbatch(comps);
		} else {
			for (const c of comps) {
				onadd(c);
			}
		}
		clearRecentSelection();
	}

	$effect(() => {
		if (query.trim() && pickerTab !== 'search') {
			pickerTab = 'search';
		}
	});

	const sortedFavorites = $derived(
		[...favorites].sort((a, b) => {
			const ua = a.useCount ?? 0;
			const ub = b.useCount ?? 0;
			if (ub !== ua) return ub - ua;
			return (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0);
		})
	);

	const matchingFavorites = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return [];
		return sortedFavorites.filter((f) => f.displayName.toLowerCase().includes(q));
	});

	const visibleFavorites = $derived(
		showAllFavorites ? sortedFavorites : sortedFavorites.slice(0, 6)
	);

	// Gericht-Favoriten ("Gerichte") – nur relevant, wenn das Sheet sie einfügen kann (onpickmeal).
	const sortedMealFavorites = $derived(
		[...mealFavorites].sort((a, b) => {
			const ua = a.useCount ?? 0;
			const ub = b.useCount ?? 0;
			if (ub !== ua) return ub - ua;
			return (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0);
		})
	);
	const matchingMealFavorites = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return sortedMealFavorites;
		return sortedMealFavorites.filter((f) => f.displayName.toLowerCase().includes(q));
	});

	// Custom form
	let customName = $state('');
	let customKcal = $state('');
	let customProtein = $state('');
	let customFat = $state('');
	let customCarbs = $state('');
	let customSugar = $state('');
	let customFiber = $state('');
	let customSalt = $state('');
	let customSodiumMg = $state('');
	let customShowMicros = $state(false);
	// Essential Vitamins & Minerals in Custom Form
	let customPotassiumMg = $state('');
	let customCalciumMg = $state('');
	let customMagnesiumMg = $state('');
	let customIronMg = $state('');
	let customVitaminCMg = $state('');
	let customVitaminDIu = $state('');
	let customVitaminB12Mcg = $state('');
	let customVitaminAMcg = $state('');
	let customVitaminB6Mg = $state('');
	let customShowVitaminsAndMinerals = $state(false);
	let aiSheetOpen = $state(false);
	// svelte-ignore state_referenced_locally
	let customAmount = $state(String(suggestedAmount ?? 100));
	// svelte-ignore state_referenced_locally
	let customUnit = $state<'g' | 'ml' | 'piece' | 'portion'>(suggestedUnit ?? 'g');
	let customGramsPerPiece = $state('');
	// svelte-ignore state_referenced_locally
	let customSaveFavorite = $state(favoriteMode);

	// Sheet folgt dem visualViewport, damit es bei iOS-Tastatur und iOS-Auto-Scroll
	// immer korrekt am unteren Rand des sichtbaren Bereichs sitzt:
	// - max-height = visualViewport.height (Sheet bleibt in der Höhe oberhalb der Tastatur)
	// - bottom    = innerHeight − vv.height − vv.offsetTop (anchort am sichtbaren Ende,
	//                kompensiert iOS-Window-Scroll bei Input-Fokus)
	let maxHeight = $state(typeof window !== 'undefined' ? window.innerHeight : 800);
	let bottomOffset = $state(0);
	// Tastatur offen = ein Eingabefeld im Sheet hat Fokus. Zuverlässiger als Viewport-Mathematik.
	// Offen → kein Safe-Area-Polster unten (Sheet sitzt direkt über der Tastatur).
	// Zu   → Safe-Area-Polster für den Home-Indicator.

	onMount(() => {
		void loadFavorites();
		void loadRecent();
		if (onpickmeal) void loadMealFavorites();
		if (foodRegisterMode && !initial) {
			scannerOpen = true;
		}

		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		const vv = window.visualViewport;
		const update = () => {
			if (vv) {
				maxHeight = vv.height;
				bottomOffset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
			} else {
				maxHeight = window.innerHeight;
				bottomOffset = 0;
			}
		};
		update();
		vv?.addEventListener('resize', update);
		vv?.addEventListener('scroll', update);
		return () => {
			document.body.style.overflow = prevOverflow;
			vv?.removeEventListener('resize', update);
			vv?.removeEventListener('scroll', update);
		};
	});

	function dismissKeyboard() {
		if (document.activeElement instanceof HTMLInputElement) {
			document.activeElement.blur();
		}
	}

	async function loadFavorites() {
		try {
			const res = await fetch('/api/nutrition/favorites');
			if (res.ok) {
				const d = await res.json();
				favorites = d.favorites ?? [];
			}
		} catch { /* noop */ }
	}

	async function loadMealFavorites() {
		try {
			const res = await fetch('/api/nutrition/meal-favorites');
			if (res.ok) {
				const d = await res.json();
				mealFavorites = d.mealFavorites ?? [];
			}
		} catch { /* noop */ }
	}

	async function loadRecent() {
		if (favoriteMode) return;
		loadingRecent = true;
		try {
			const res = await fetch('/api/nutrition/recent');
			if (res.ok) {
				const d = await res.json();
				recentFoods = d.recent ?? [];
				if (recentFoods.length === 0 && !query.trim()) {
					pickerTab = 'search';
				}
			}
		} catch { /* noop */ }
		finally {
			loadingRecent = false;
		}
	}

	function selectRecent(r: RecentFood) {
		activeGenericVariantA = null;
		activeGenericVariantB = null;
		currentCookingState = null;
		selected = {
			productBarcode: r.productBarcode,
			genericFoodId: r.genericFoodId,
			customName: r.customName,
			displayName: r.displayName,
			imageUrl: r.imageUrl,
			amount: r.amount,
			unit: r.unit,
			gramsPerPiece: r.gramsPerPiece,
			kcalPer100: r.kcalPer100,
			proteinPer100: r.proteinPer100,
			fatPer100: r.fatPer100,
			carbsPer100: r.carbsPer100,
			sugarPer100: r.sugarPer100,
			fiberPer100: r.fiberPer100,
			saltPer100: r.saltPer100,
			micros: r.micros ?? null
		};
		selectedCategory = r.category ?? null;
		customGramsPerPiece = r.gramsPerPiece ? String(r.gramsPerPiece) : '';
		pushSubView('amount');
	}

	function pickMeal(f: MealFavorite) {
		// useCount hochzählen (Fehler ignorieren, UX nicht blockieren) – wie im bisherigen Picker.
		void fetch(`/api/nutrition/meal-favorites/${f.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ useCount: (f.useCount ?? 0) + 1 })
		});
		onpickmeal?.({
			components: f.components.map((c) => ({
				productBarcode: c.productBarcode,
				genericFoodId: c.genericFoodId,
				customName: c.customName,
				displayName: c.displayName,
				imageUrl: c.imageUrl,
				amount: c.amount,
				unit: c.unit,
				gramsPerPiece: c.gramsPerPiece,
				kcalPer100: c.kcalPer100,
				proteinPer100: c.proteinPer100,
				fatPer100: c.fatPer100,
				carbsPer100: c.carbsPer100,
				sugarPer100: c.sugarPer100,
				fiberPer100: c.fiberPer100,
				saltPer100: c.saltPer100
			})),
			defaultMealName: f.defaultMealName,
			favoriteName: f.displayName,
			imageUrl: f.imageUrl,
			caffeineDrinkId: f.caffeineDrinkId ?? null
		});
	}

	function mealKcal(f: MealFavorite): number {
		return Math.round(f.components.reduce((s, c) => {
			const grams = c.unit === 'piece' ? c.amount * (c.gramsPerPiece ?? 0) : c.amount;
			return s + ((c.kcalPer100 ?? 0) * grams) / 100;
		}, 0));
	}

	function resetSearch() {
		if (localTimer) clearTimeout(localTimer);
		if (offTimer) clearTimeout(offTimer);
		localAbort?.abort();
		offAbort?.abort();
		genericResults = [];
		localProducts = [];
		offProducts = [];
		searching = false;
	}

	function doSearch(q: string) {
		const trimmed = q.trim();
		// Jede neue Eingabe bricht laufende Requests ab und leert alte Treffer sofort,
		// damit nie themenfremde Reste stehen bleiben.
		resetSearch();

		// Barcode (nur Ziffern, 8–14): direkter Lookup statt Textsuche
		if (/^\d{8,14}$/.test(trimmed)) {
			offTimer = setTimeout(() => { void onScan(trimmed); }, 200);
			return;
		}
		// Mindestlänge: ab 2 Zeichen suchen
		if (trimmed.length < 2) return;

		// Stufe 1 — lokal (Generics + Cache), schnell
		localTimer = setTimeout(async () => {
			const ac = new AbortController();
			localAbort = ac;
			try {
				const res = await fetch(
					`/api/nutrition/search?q=${encodeURIComponent(trimmed)}&lang=${currentLang()}&source=local`,
					{ signal: ac.signal }
				);
				if (!res.ok) return;
				const d = await res.json();
				if (query.trim() !== trimmed) return; // Race-Guard: nur aktuelle Eingabe übernehmen
				genericResults = d.generic ?? [];
				localProducts = d.products ?? [];
			} catch { /* abgebrochen oder Fehler */ }
		}, 150);

		// Stufe 2 — OFF (Online-Produkte), langsam + abbrechbar
		searching = true;
		offTimer = setTimeout(async () => {
			const ac = new AbortController();
			offAbort = ac;
			try {
				const res = await fetch(
					`/api/nutrition/search?q=${encodeURIComponent(trimmed)}&lang=${currentLang()}&source=off`,
					{ signal: ac.signal }
				);
				if (!res.ok) return;
				const d = await res.json();
				if (query.trim() !== trimmed) return; // Race-Guard
				offProducts = d.products ?? [];
			} catch { /* abgebrochen oder Fehler */ }
			finally { if (query.trim() === trimmed) searching = false; }
		}, 500);
	}

	$effect(() => {
		doSearch(query);
	});

	function applyGenericFood(
		food: GenericResult | GenericCounterpart,
		category?: string | null
	) {
		selected = {
			productBarcode: null,
			genericFoodId: food.id,
			customName: null,
			displayName: food.name,
			imageUrl: null,
			amount: selected?.amount ?? (suggestedAmount ?? (food.defaultUnit === 'piece' ? 1 : 100)),
			unit: selected?.unit ?? (suggestedUnit ?? food.defaultUnit),
			gramsPerPiece: food.defaultPieceWeight,
			kcalPer100: food.kcalPer100,
			proteinPer100: food.proteinPer100,
			fatPer100: food.fatPer100,
			carbsPer100: food.carbsPer100,
			sugarPer100: food.sugarPer100,
			fiberPer100: food.fiberPer100,
			saltPer100: food.saltPer100,
			micros: food.micros ?? null
		};
		if (category !== undefined) {
			selectedCategory = category;
		}
	}

	function selectGeneric(g: GenericResult) {
		activeGenericVariantA = g;
		activeGenericVariantB = g.counterpart ?? null;

		let target: GenericResult | GenericCounterpart = g;
		if (g.counterpart) {
			if (g.cookingState === 'raw' && g.counterpart.cookingState === 'cooked') {
				target = g.counterpart;
				currentCookingState = 'cooked';
			} else if (g.cookingState === 'cooked') {
				target = g;
				currentCookingState = 'cooked';
			} else {
				currentCookingState = g.cookingState ?? null;
			}
		} else {
			currentCookingState = g.cookingState ?? null;
		}

		applyGenericFood(target, g.category);
		pushSubView('amount');
	}

	function toggleCookingState(targetState: 'cooked' | 'raw') {
		if (currentCookingState === targetState) return;
		if (!activeGenericVariantA || !activeGenericVariantB) return;

		const target =
			activeGenericVariantA.cookingState === targetState
				? activeGenericVariantA
				: activeGenericVariantB.cookingState === targetState
					? activeGenericVariantB
					: null;

		if (target) {
			currentCookingState = targetState;
			applyGenericFood(target);
		}
	}

	function selectProduct(p: ProductResult) {
		activeGenericVariantA = null;
		activeGenericVariantB = null;
		currentCookingState = null;
		const hasPortion = p.servingQuantity != null && p.servingQuantity > 0;
		selected = {
			productBarcode: p.barcode,
			genericFoodId: null,
			customName: null,
			displayName: p.brand && !p.name.toLowerCase().includes(p.brand.toLowerCase()) ? `${p.brand} ${p.name}` : p.name,
			imageUrl: p.imageUrl,
			amount: suggestedAmount ?? 1,
			unit: suggestedUnit ?? 'portion',
			gramsPerPiece: hasPortion ? p.servingQuantity : null,
			kcalPer100: p.kcalPer100,
			proteinPer100: p.proteinPer100,
			fatPer100: p.fatPer100,
			carbsPer100: p.carbsPer100,
			sugarPer100: p.sugarPer100,
			fiberPer100: p.fiberPer100,
			saltPer100: p.saltPer100,
			micros: p.micros ?? null,
			ingredientsText: p.ingredientsText ?? null
		};
		selectedCategory = null;
		pushSubView('amount');
	}

	function selectFavorite(f: Favorite) {
		activeGenericVariantA = null;
		activeGenericVariantB = null;
		currentCookingState = null;
		// Wenn favorit ein generic ist, müssen wir das laden ODER die customWerte verwenden.
		// Wir nutzen die in fav gespeicherten Snapshots wenn vorhanden, ansonsten markieren wir Ref auf generic.
		// Vereinfacht: nimm customKcal etc. als per100 wenn keiner gesetzt, müssen wir generic nachladen (für jetzt: nimm 0)
		selected = {
			productBarcode: f.productBarcode,
			genericFoodId: f.genericFoodId,
			customName: null,
			displayName: f.displayName,
			imageUrl: f.imageUrl,
			amount: f.defaultAmount,
			unit: f.defaultUnit,
			gramsPerPiece: f.defaultGramsPerPiece,
			kcalPer100: f.customKcalPer100,
			proteinPer100: f.customProteinPer100,
			fatPer100: f.customFatPer100,
			carbsPer100: f.customCarbsPer100,
			sugarPer100: f.customSugarPer100,
			fiberPer100: f.customFiberPer100,
			saltPer100: f.customSaltPer100,
			micros: f.micros ?? null
		};
		selectedCategory = f.genericFoodId ? (f.category ?? null) : null;
		// Wenn Favorit auf Produkt/Generic verweist und keine eigenen per100-Werte hat → nachladen
		if (selected.kcalPer100 == null) {
			if (f.productBarcode) {
				void fetchProductData(f.productBarcode);
			} else if (f.genericFoodId) {
				void fetchGenericData(f.genericFoodId);
			}
		}
		pushSubView('amount');
		// useCount erhöhen
		void fetch(`/api/nutrition/favorites/${f.id}`, {
			method: 'PATCH', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ useCount: nextNutritionUseCount(f.useCount) })
		});
	}

	async function fetchProductData(barcode: string) {
		try {
			const res = await fetch(`/api/nutrition/product/${barcode}`);
			if (!res.ok) return;
			const d = await res.json();
			const p = d.product;
			if (!p || !selected) return;
			selected = {
				...selected,
				imageUrl: selected.imageUrl ?? p.imageUrl ?? null,
				kcalPer100: selected.kcalPer100 ?? p.kcalPer100,
				proteinPer100: selected.proteinPer100 ?? p.proteinPer100,
				fatPer100: selected.fatPer100 ?? p.fatPer100,
				carbsPer100: selected.carbsPer100 ?? p.carbsPer100,
				sugarPer100: selected.sugarPer100 ?? p.sugarPer100,
				fiberPer100: selected.fiberPer100 ?? p.fiberPer100,
				saltPer100: selected.saltPer100 ?? p.saltPer100,
				micros: selected.micros ?? p.micros,
				ingredientsText: selected.ingredientsText ?? p.ingredientsText
			};
		} catch { /* noop */ }
	}

	async function fetchGenericData(id: string) {
		try {
			const res = await fetch(`/api/nutrition/search?q=${encodeURIComponent(id)}&lang=${currentLang()}&source=local`);
			if (!res.ok) return;
			const d = await res.json();
			const g = (d.generic ?? []).find((x: GenericResult) => x.id === id);
			if (!g || !selected) return;
			selected = {
				...selected,
				kcalPer100: selected.kcalPer100 ?? g.kcalPer100,
				proteinPer100: selected.proteinPer100 ?? g.proteinPer100,
				fatPer100: selected.fatPer100 ?? g.fatPer100,
				carbsPer100: selected.carbsPer100 ?? g.carbsPer100,
				sugarPer100: selected.sugarPer100 ?? g.sugarPer100,
				fiberPer100: selected.fiberPer100 ?? g.fiberPer100,
				saltPer100: selected.saltPer100 ?? g.saltPer100,
				micros: selected.micros ?? g.micros
			};
		} catch { /* noop */ }
	}

	async function onScan(code: string) {
		scannerOpen = false;
		loadingBarcode = true;
		try {
			const res = await fetch(`/api/nutrition/product/${encodeURIComponent(code)}`);
			if (!res.ok) return;
			const d = await res.json();
			const p = d.product;
			if (p) {
				const hasPortion = p.servingQuantity != null && p.servingQuantity > 0;
				selected = {
					productBarcode: p.barcode,
					genericFoodId: null,
					customName: null,
					displayName: p.brand && !p.name.toLowerCase().includes(p.brand.toLowerCase()) ? `${p.brand} ${p.name}` : p.name,
					imageUrl: p.imageUrl,
					amount: suggestedAmount ?? 1,
					unit: suggestedUnit ?? 'portion',
					gramsPerPiece: hasPortion ? p.servingQuantity : null,
					kcalPer100: p.kcalPer100,
					proteinPer100: p.proteinPer100,
					fatPer100: p.fatPer100,
					carbsPer100: p.carbsPer100,
					sugarPer100: p.sugarPer100,
					fiberPer100: p.fiberPer100,
					saltPer100: p.saltPer100,
					micros: p.micros ?? null,
					ingredientsText: p.ingredientsText ?? null
				};
				selectedCategory = null;
				pushSubView('amount');
			} else {
				if (typeof window !== 'undefined' && window.confirm(`Product (${code}) was not found in the open database. Would you like to record its nutrition facts with a photo or manually?`)) {
					openProductNutritionEdit(false, code);
				}
			}
		} finally {
			loadingBarcode = false;
		}
	}

	async function submitCustom() {
		const kcal = parseOptionalNutritionNumber(customKcal);
		if (kcal == null || kcal < 0) return;

		const name = customName.trim() || t.nutrition_custom_default_name;
		const sodium = parseOptionalNutritionNumber(customSodiumMg);
		const salt = sodium != null && sodium > 0
			? Math.round((sodium / 400) * 100) / 100
			: (parseOptionalNutritionNumber(customSalt) ?? 0);

		const parsedGrams = parseOptionalNutritionNumber(customGramsPerPiece);
		const servingGrams = parsedGrams != null && parsedGrams > 0 ? parsedGrams : 100;
		const scale100 = 100 / servingGrams;

		const protein = parseOptionalNutritionNumber(customProtein) ?? 0;
		const fat = parseOptionalNutritionNumber(customFat) ?? 0;
		const carbs = parseOptionalNutritionNumber(customCarbs) ?? 0;
		const sugar = parseOptionalNutritionNumber(customSugar) ?? 0;
		const fiber = parseOptionalNutritionNumber(customFiber) ?? 0;

		const pot = parseOptionalNutritionNumber(customPotassiumMg);
		const cal = parseOptionalNutritionNumber(customCalciumMg);
		const mag = parseOptionalNutritionNumber(customMagnesiumMg);
		const fe = parseOptionalNutritionNumber(customIronMg);
		const vc = parseOptionalNutritionNumber(customVitaminCMg);
		const vd = parseOptionalNutritionNumber(customVitaminDIu);
		const vb12 = parseOptionalNutritionNumber(customVitaminB12Mcg);
		const va = parseOptionalNutritionNumber(customVitaminAMcg);
		const vb6 = parseOptionalNutritionNumber(customVitaminB6Mg);

		const micros: EssentialMicros = {};
		if (pot != null && pot > 0) micros.potassiumMg = Math.round(pot * scale100 * 10) / 10;
		if (cal != null && cal > 0) micros.calciumMg = Math.round(cal * scale100 * 10) / 10;
		if (mag != null && mag > 0) micros.magnesiumMg = Math.round(mag * scale100 * 10) / 10;
		if (fe != null && fe > 0) micros.ironMg = Math.round(fe * scale100 * 10) / 10;
		if (sodium != null && sodium > 0) micros.sodiumMg = Math.round(sodium * scale100);
		if (vc != null && vc > 0) micros.vitaminCMg = Math.round(vc * scale100 * 10) / 10;
		if (vd != null && vd > 0) micros.vitaminDIu = Math.round(vd * scale100);
		if (vb12 != null && vb12 > 0) micros.vitaminB12Mcg = Math.round(vb12 * scale100 * 10) / 10;
		if (va != null && va > 0) micros.vitaminAMcg = Math.round(va * scale100);
		if (vb6 != null && vb6 > 0) micros.vitaminB6Mg = Math.round(vb6 * scale100 * 10) / 10;

		const hasMicros = Object.values(micros).some((v) => v != null && v > 0);

		// Direct portion values scaled to 100g basis
		const component: Component = {
			productBarcode: null,
			genericFoodId: null,
			customName: name,
			displayName: name,
			imageUrl: null,
			amount: 1,
			unit: 'portion',
			gramsPerPiece: servingGrams,
			kcalPer100: kcal * scale100,
			proteinPer100: protein * scale100,
			fatPer100: fat * scale100,
			carbsPer100: carbs * scale100,
			sugarPer100: sugar * scale100,
			fiberPer100: fiber * scale100,
			saltPer100: salt * scale100,
			micros: hasMicros ? micros : null
		};
		selected = component;
		if ((customSaveFavorite || favoriteMode) && !(await saveAsFavorite())) return;
		onadd(component);
	}

	function effectiveGrams(c: Component): number {
		if (c.unit === 'piece' || c.unit === 'portion') return c.amount * (c.gramsPerPiece ?? 0);
		return c.amount;
	}
	function compKcal(c: Component): number {
		return ((c.kcalPer100 ?? 0) * effectiveGrams(c)) / 100;
	}
	function compMacro(c: Component, per100: number | null): number | null {
		if (per100 == null) return null;
		return (per100 * effectiveGrams(c)) / 100;
	}

	let showFoodMicros = $state(true);

	const selectedFats = $derived.by(() => {
		if (!selected) return [];
		const factor = effectiveGrams(selected) / 100;
		const m = selected.micros;

		return FAT_TYPES_META.map((meta) => {
			const raw = m ? m[meta.key] : null;
			const hasValue = typeof raw === 'number' && !isNaN(raw) && raw >= 0;
			const grams = hasValue ? Math.round((raw as number) * factor * 10) / 10 : null;
			return {
				key: meta.key,
				label: meta.label,
				shortLabel: meta.shortLabel,
				color: meta.color,
				grams,
				hasValue
			};
		});
	});

	const selectedMicrosList = $derived.by(() => {
		if (!selected) return [];
		const factor = effectiveGrams(selected) / 100;
		const m = selected.micros;

		return ESSENTIAL_MICROS_META.map((meta) => {
			const raw = m ? m[meta.key] : null;
			const hasValue = typeof raw === 'number' && !isNaN(raw) && (raw as number) > 0;
			if (hasValue && raw != null) {
				const val = (raw as number) * factor;
				const rda = computeRdaPercent(val, meta.defaultRda);
				return {
					key: meta.key,
					label: meta.label,
					shortLabel: meta.shortLabel,
					valueFormatted: formatMicroValue(val, meta.unit),
					rawVal: val,
					rdaPercent: rda,
					unit: meta.unit,
					color: meta.color,
					category: meta.category,
					hasValue: true
				};
			}
			return {
				key: meta.key,
				label: meta.label,
				shortLabel: meta.shortLabel,
				valueFormatted: '—',
				rawVal: null,
				rdaPercent: 0,
				unit: meta.unit,
				color: meta.color,
				category: meta.category,
				hasValue: false
			};
		});
	});

	const selectedMinerals = $derived(selectedMicrosList.filter((m) => m.category === 'mineral'));
	const selectedVitamins = $derived(selectedMicrosList.filter((m) => m.category === 'vitamin'));
	const recordedMicrosCount = $derived(selectedMicrosList.filter((m) => m.hasValue).length);
	const hasMissingMicros = $derived(selectedMicrosList.some((m) => !m.hasValue));

	async function confirm() {
		if (!selected) return;
		if (selected.unit === 'portion' && (!selected.gramsPerPiece || selected.gramsPerPiece <= 0)) {
			selected.gramsPerPiece = 100;
		}
		if (selected.productBarcode && selected.gramsPerPiece && selected.gramsPerPiece > 0) {
			void fetch(`/api/nutrition/product/${encodeURIComponent(selected.productBarcode)}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					servingQuantity: selected.gramsPerPiece,
					servingSize: `${selected.gramsPerPiece} g`
				})
			});
		}
		if (favoriteMode && !(await saveAsFavorite())) return;
		onadd(selected);
	}

	let savingFavorite = $state(false);
	let savedFavoriteId = $state<string | null>(null);

	function alreadyFavorite(): boolean {
		if (!selected) return false;
		if (savedFavoriteId) return true;
		if (selected.productBarcode) return favorites.some((f) => f.productBarcode === selected!.productBarcode);
		if (selected.genericFoodId) return favorites.some((f) => f.genericFoodId === selected!.genericFoodId);
		return favorites.some((f) => f.displayName === selected!.displayName);
	}

	async function saveAsFavorite(): Promise<boolean> {
		if (!selected || savingFavorite) return false;
		if (alreadyFavorite()) return true;
		savingFavorite = true;
		let saved = false;
		try {
			const res = await fetch('/api/nutrition/favorites', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					displayName: selected.displayName,
					imageUrl: selected.imageUrl,
					productBarcode: selected.productBarcode,
					genericFoodId: selected.genericFoodId,
					customKcalPer100: selected.kcalPer100,
					customProteinPer100: selected.proteinPer100,
					customFatPer100: selected.fatPer100,
					customCarbsPer100: selected.carbsPer100,
					customSugarPer100: selected.sugarPer100,
					customFiberPer100: selected.fiberPer100,
					customSaltPer100: selected.saltPer100,
					micros: selected.micros,
					defaultAmount: selected.amount,
					defaultUnit: selected.unit,
					defaultGramsPerPiece: selected.gramsPerPiece
				})
			});
			if (res.ok) {
				saved = true;
				const d = await res.json();
				savedFavoriteId = d.id ?? null;
				await loadFavorites();
			}
		} finally {
			savingFavorite = false;
		}
		return saved;
	}
</script>

<!-- Kategorie-Icon für generische Lebensmittel (gleicher Stroke-Stil wie die Listen-Icons). -->
{#snippet catIcon(category: string | null | undefined, px: number)}
	{@const ic = getNutritionCategoryIcon(category)}
	<svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke={ic.color}
	     stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
		{@html ic.svgContent}
	</svg>
{/snippet}

<ManageSheetShell
	accent="#DC2626"
	title={foodRegisterMode ? 'Register Food' : favoriteMode ? t.nutrition_new_ingredient : view === 'amount' ? t.nutrition_amount : view === 'custom' ? t.nutrition_custom_entry : t.nutrition_add_title}
	subtitle={view === 'picker' ? (foodRegisterMode ? 'Scan a barcode or search for a food' : t.nutrition_picker_subtitle) : null}
	fullscreen={true}
	onclose={handleSheetClose}
	zIndex={65}
	bottom={`${bottomOffset}px`}
	maxHeight={`calc(${maxHeight}px - env(safe-area-inset-top, 0px) - 1.5rem)`}
>
	{#snippet headerActions()}
		{#if !favoriteMode && view === 'picker' && (favorites.length > 0 || mealFavorites.length > 0)}
			<button type="button" onclick={() => { onclose(); goto('/tracker/nutrition/favorites'); }} class="nutrition-picker-header-action" aria-label={t.nutrition_favorites_manage}>
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
				<span>{t.nutrition_favorites_label}</span>
			</button>
		{/if}
	{/snippet}
	{#snippet body()}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="manage-stack nutrition-picker-workspace" onscroll={dismissKeyboard} ontouchmove={dismissKeyboard}>
			{#if view === 'picker'}
				{#if !favoriteMode}
					<div class="nutrition-picker-tabs">
						<button
							type="button"
							class="nutrition-picker-tab"
							class:active={pickerTab === 'recent'}
							onclick={() => { pickerTab = 'recent'; }}
						>
							{t.nutrition_tab_recent}
							{#if recentFoods.length > 0}
								<span class="nutrition-tab-count">({recentFoods.length})</span>
							{/if}
						</button>
						<button
							type="button"
							class="nutrition-picker-tab"
							class:active={pickerTab === 'search'}
							onclick={() => { pickerTab = 'search'; }}
						>
							{t.nutrition_tab_search}
						</button>
						<button
							type="button"
							class="nutrition-picker-tab"
							class:active={pickerTab === 'favorites'}
							onclick={() => { pickerTab = 'favorites'; }}
						>
							{t.nutrition_tab_favorites}
							{#if (favorites.length + mealFavorites.length) > 0}
								<span class="nutrition-tab-count">({favorites.length + mealFavorites.length})</span>
							{/if}
						</button>
						<button
							type="button"
							class="nutrition-picker-tab nutrition-picker-tab-ai"
							onclick={() => (aiSheetOpen = true)}
							title={t.ai_nutrition_title}
						>
							{t.ai_nutrition_button}
						</button>
					</div>
				{/if}

				{#if loadingBarcode || searching || (pickerTab === 'recent' && loadingRecent)}
					<div class="nutrition-search-status">
						<span></span>{loadingBarcode ? t.nutrition_loading_product : t.nutrition_searching}
					</div>
				{/if}

				{#if pickerTab === 'recent'}
					{#if !loadingRecent && recentFoods.length === 0}
						<p class="nutrition-empty-state">{t.nutrition_no_recent_foods}</p>
					{:else if recentFoods.length > 0}
						<div>
							<div class="nutrition-recent-actions-bar">
								<button
									type="button"
									class="nutrition-recent-select-all"
									onclick={() => {
										if (selectedRecentIds.size === recentFoods.length) {
											clearRecentSelection();
										} else {
											selectedRecentIds = new Set(recentFoods.map((r) => r.id));
										}
									}}
								>
									{selectedRecentIds.size === recentFoods.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
								</button>
								{#if selectedRecentTotals.count > 0}
									<span class="nutrition-recent-selected-badge">
										{selectedRecentTotals.count} seleccionados ({selectedRecentTotals.kcal} kcal)
									</span>
								{/if}
							</div>
							<section class="manage-settings-surface nutrition-result-list">
								{#each recentFoods as r (r.id)}
									{@const portionLabel = r.unit === 'portion'
										? `${r.amount} ${r.amount === 1 ? t.nutrition_unit_portion : t.nutrition_unit_portions}${r.gramsPerPiece ? ` (${Math.round(r.amount * r.gramsPerPiece)} g)` : ''}`
										: r.unit === 'piece'
										? `${r.amount} ${t.nutrition_unit_short_piece}${r.gramsPerPiece ? ` (${Math.round(r.amount * r.gramsPerPiece)} g)` : ''}`
										: `${r.amount} ${r.unit}`}
									{@const isChecked = selectedRecentIds.has(r.id)}
									<div class="nutrition-recent-item-row" class:is-checked={isChecked}>
										<button
											type="button"
											class="nutrition-recent-checkbox"
											class:checked={isChecked}
											onclick={(e) => {
												e.stopPropagation();
												toggleRecentSelection(r.id);
											}}
											aria-label="Seleccionar {r.displayName}"
										>
											{#if isChecked}
												<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
													<polyline points="20 6 9 17 4 12" />
												</svg>
											{/if}
										</button>
										<div class="nutrition-recent-row-content">
											{#if r.category && !r.imageUrl}
												<NutritionFoodRow
													title={r.displayName}
													meta={portionLabel}
													trailing={`${Math.round(r.kcal)} kcal`}
													onactivate={() => selectRecent(r)}
												>
													{#snippet leading()}{@render catIcon(r.category, 27)}{/snippet}
												</NutritionFoodRow>
											{:else}
												<NutritionFoodRow
													title={r.displayName}
													meta={portionLabel}
													trailing={`${Math.round(r.kcal)} kcal`}
													imageUrl={r.imageUrl}
													onactivate={() => selectRecent(r)}
												/>
											{/if}
										</div>
									</div>
								{/each}
							</section>
						</div>
					{/if}

				{:else if pickerTab === 'favorites'}
					{#if matchingMealFavorites.length > 0}
						<div>
							<span class="manage-section-title">{t.nutrition_meal_favorites_section}</span>
							<section class="manage-settings-surface nutrition-result-list">
								{#each matchingMealFavorites as f (f.id)}
									<NutritionFoodRow title={f.displayName} meta={`${f.components.length} ${t.nutrition_ingredients}`} trailing={`${mealKcal(f)} kcal`} imageUrl={f.imageUrl} onactivate={() => pickMeal(f)} />
								{/each}
							</section>
						</div>
					{/if}

					{@const listedFavorites = query.trim() ? matchingFavorites : visibleFavorites}
					{#if listedFavorites.length > 0}
						<div>
							<span class="manage-section-title">{query.trim() ? t.nutrition_favorites_label : t.nutrition_recently_used}</span>
							<section class="manage-settings-surface nutrition-result-list">
								{#each listedFavorites as f (f.id)}
									{#if f.genericFoodId && f.category && !f.imageUrl}
										<NutritionFoodRow title={f.displayName} meta={t.nutrition_favorite_label} trailing={`${f.defaultAmount}${f.defaultUnit === 'piece' ? ` ${t.nutrition_unit_short_piece}` : f.defaultUnit}`} onactivate={() => selectFavorite(f)}>
											{#snippet leading()}{@render catIcon(f.category, 27)}{/snippet}
										</NutritionFoodRow>
									{:else}
										<NutritionFoodRow title={f.displayName} meta={t.nutrition_favorite_label} trailing={`${f.defaultAmount}${f.defaultUnit === 'piece' ? ` ${t.nutrition_unit_short_piece}` : f.defaultUnit}`} imageUrl={f.imageUrl} onactivate={() => selectFavorite(f)} />
									{/if}
								{/each}
							</section>
							{#if !query.trim() && sortedFavorites.length > 6}
								<button type="button" onclick={() => (showAllFavorites = !showAllFavorites)} class="nutrition-show-all">{showAllFavorites ? t.nutrition_show_less : t.nutrition_show_all_favorites}</button>
							{/if}
						</div>
					{/if}

					{#if favorites.length === 0 && mealFavorites.length === 0}
						<p class="nutrition-empty-state">{t.nutrition_favorites_tip}</p>
					{/if}

				{:else}
					{#if query.trim() && genericResults.length > 0}
						<div>
							<div class="flex items-center justify-between pb-1.5 px-0.5">
								<span class="manage-section-title">{t.nutrition_basic_foods}</span>
								<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full" style="background: rgba(220, 38, 38, 0.12); color: #DC2626; border: 1px solid rgba(220, 38, 38, 0.25);">
									{t.nutrition_generic_badge}
								</span>
							</div>
							<section class="manage-settings-surface nutrition-result-list">
								{#each genericResults as g (g.id)}
									<NutritionFoodRow title={g.name} trailing={`${Math.round(g.kcalPer100)} kcal / 100 ${g.defaultUnit === 'ml' ? 'ml' : 'g'}`} onactivate={() => selectGeneric(g)}>
										{#snippet leading()}{@render catIcon(g.category, 27)}{/snippet}
									</NutritionFoodRow>
								{/each}
							</section>
						</div>
					{/if}

					{#if query.trim() && productResults.length > 0}
						<div>
							<span class="manage-section-title">{t.nutrition_products_section}</span>
							<section class="manage-settings-surface nutrition-result-list">
								{#each productResults as p (p.barcode)}
									<NutritionFoodRow
										title={p.brand && !p.name.toLowerCase().includes(p.brand.toLowerCase()) ? `${p.brand} ${p.name}` : p.name}
										meta={p.nutriscoreGrade ? `Nutri-Score ${p.nutriscoreGrade.toUpperCase()}` : null}
										trailing={p.kcalPer100 != null ? `${Math.round(p.kcalPer100)} kcal / 100 g` : t.nutrition_no_kcal_data}
										imageUrl={p.imageUrl}
										onactivate={() => selectProduct(p)}
									/>
								{/each}
							</section>
						</div>
					{/if}

					{#if !query.trim()}
						<p class="nutrition-empty-state">{t.nutrition_picker_subtitle}</p>
					{:else if !searching && genericResults.length === 0 && productResults.length === 0}
						<p class="nutrition-empty-state">{t.nutrition_nothing_found}</p>
					{/if}
				{/if}

			{:else if view === 'custom'}
				<div>
					<span class="manage-section-title">{t.nutrition_custom_entry}</span>
					<section class="manage-settings-surface">
						<label class="manage-settings-row nutrition-custom-row">
							<span class="manage-settings-label">{t.nutrition_name}</span>
							<input
								type="text"
								bind:value={customName}
								placeholder={t.nutrition_custom_optional_name}
								class="manage-settings-input"
							/>
						</label>
						<label class="manage-settings-row nutrition-custom-row">
							<span class="manage-settings-label">{t.nutrition_energy} *</span>
							<span class="nutrition-number-with-unit">
								<input type="text" inputmode="decimal" bind:value={customKcal} placeholder="0" />
								<small>kcal</small>
							</span>
						</label>
						<label class="manage-settings-row nutrition-custom-row">
							<span class="manage-settings-label">{t.nutrition_grams_per_portion}</span>
							<span class="nutrition-number-with-unit">
								<input type="text" inputmode="decimal" bind:value={customGramsPerPiece} placeholder="100" />
								<small>g</small>
							</span>
						</label>
					</section>
				</div>

				<div>
					<span class="manage-section-title">{t.nutrition_macro_distribution}</span>
					<section class="manage-settings-surface">
						<div class="manage-settings-row nutrition-custom-grid">
							<label>
								<span style="color: #A78BFA">{t.nutrition_protein}</span>
								<div class="flex items-baseline gap-1">
									<input type="text" inputmode="decimal" bind:value={customProtein} placeholder="0" />
									<small class="text-xs" style="color: var(--color-on-surface-variant)">g</small>
								</div>
							</label>
							<label>
								<span style="color: #FB923C">{t.nutrition_fat}</span>
								<div class="flex items-baseline gap-1">
									<input type="text" inputmode="decimal" bind:value={customFat} placeholder="0" />
									<small class="text-xs" style="color: var(--color-on-surface-variant)">g</small>
								</div>
							</label>
							<label>
								<span style="color: #60A5FA">{t.nutrition_carbs}</span>
								<div class="flex items-baseline gap-1">
									<input type="text" inputmode="decimal" bind:value={customCarbs} placeholder="0" />
									<small class="text-xs" style="color: var(--color-on-surface-variant)">g</small>
								</div>
							</label>
						</div>
					</section>
				</div>

				<!-- Collapsible Micronutrients section -->
				<div>
					<button
						type="button"
						class="w-full flex items-center justify-between py-1 px-1 text-xs font-semibold active:opacity-70 transition-opacity"
						style="color: var(--color-on-surface-variant)"
						onclick={() => (customShowMicros = !customShowMicros)}
						aria-expanded={customShowMicros}
					>
						<span class="flex items-center gap-1.5">
							<svg class="w-3.5 h-3.5 transition-transform duration-200" style="transform: rotate({customShowMicros ? '90' : '0'}deg)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="9 18 15 12 9 6"></polyline>
							</svg>
							<span>{t.nutrition_micros_optional}</span>
						</span>
						<span class="text-[11px] font-normal opacity-70">
							{customShowMicros ? '−' : '+'}
						</span>
					</button>

					{#if customShowMicros}
						<section class="manage-settings-surface mt-1.5">
							<div class="manage-settings-row nutrition-custom-grid">
								<label>
									<span>{t.nutrition_fiber}</span>
									<div class="flex items-baseline gap-1">
										<input type="text" inputmode="decimal" bind:value={customFiber} placeholder="0" />
										<small class="text-xs" style="color: var(--color-on-surface-variant)">g</small>
									</div>
								</label>
								<label>
									<span>{t.nutrition_sugar}</span>
									<div class="flex items-baseline gap-1">
										<input type="text" inputmode="decimal" bind:value={customSugar} placeholder="0" />
										<small class="text-xs" style="color: var(--color-on-surface-variant)">g</small>
									</div>
								</label>
								<label>
									<span>{t.nutrition_sodium_mg}</span>
									<div class="flex items-baseline gap-1">
										<input type="text" inputmode="decimal" bind:value={customSodiumMg} placeholder="0" />
										<small class="text-xs" style="color: var(--color-on-surface-variant)">mg</small>
									</div>
								</label>
							</div>
						</section>
					{/if}
				</div>

				<!-- Collapsible Vitamins & Minerals section -->
				<div>
					<button
						type="button"
						class="w-full flex items-center justify-between py-1 px-1 text-xs font-semibold active:opacity-70 transition-opacity"
						style="color: var(--color-on-surface-variant)"
						onclick={() => (customShowVitaminsAndMinerals = !customShowVitaminsAndMinerals)}
						aria-expanded={customShowVitaminsAndMinerals}
					>
						<span class="flex items-center gap-1.5">
							<svg class="w-3.5 h-3.5 transition-transform duration-200" style="transform: rotate({customShowVitaminsAndMinerals ? '90' : '0'}deg)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="9 18 15 12 9 6"></polyline>
							</svg>
							<span>+ Vitamins & Minerals</span>
						</span>
						<span class="text-[11px] font-normal opacity-70">
							{customShowVitaminsAndMinerals ? '−' : '+'}
						</span>
					</button>

					{#if customShowVitaminsAndMinerals}
						<div class="space-y-2 mt-1.5">
							<section class="manage-settings-surface">
								<div class="px-3 pt-2 text-[10px] font-bold uppercase tracking-wider text-emerald-500">
									Key Minerals
								</div>
								<div class="manage-settings-row nutrition-custom-grid">
									<label>
										<span>Potassium</span>
										<div class="flex items-baseline gap-1">
											<input type="text" inputmode="decimal" bind:value={customPotassiumMg} placeholder="0" />
											<small class="text-xs" style="color: var(--color-on-surface-variant)">mg</small>
										</div>
									</label>
									<label>
										<span>Calcium</span>
										<div class="flex items-baseline gap-1">
											<input type="text" inputmode="decimal" bind:value={customCalciumMg} placeholder="0" />
											<small class="text-xs" style="color: var(--color-on-surface-variant)">mg</small>
										</div>
									</label>
									<label>
										<span>Magnesium</span>
										<div class="flex items-baseline gap-1">
											<input type="text" inputmode="decimal" bind:value={customMagnesiumMg} placeholder="0" />
											<small class="text-xs" style="color: var(--color-on-surface-variant)">mg</small>
										</div>
									</label>
									<label>
										<span>Iron</span>
										<div class="flex items-baseline gap-1">
											<input type="text" inputmode="decimal" bind:value={customIronMg} placeholder="0" />
											<small class="text-xs" style="color: var(--color-on-surface-variant)">mg</small>
										</div>
									</label>
								</div>
							</section>

							<section class="manage-settings-surface">
								<div class="px-3 pt-2 text-[10px] font-bold uppercase tracking-wider text-amber-500">
									Key Vitamins
								</div>
								<div class="manage-settings-row nutrition-custom-grid">
									<label>
										<span>Vit C</span>
										<div class="flex items-baseline gap-1">
											<input type="text" inputmode="decimal" bind:value={customVitaminCMg} placeholder="0" />
											<small class="text-xs" style="color: var(--color-on-surface-variant)">mg</small>
										</div>
									</label>
									<label>
										<span>Vit D</span>
										<div class="flex items-baseline gap-1">
											<input type="text" inputmode="decimal" bind:value={customVitaminDIu} placeholder="0" />
											<small class="text-xs" style="color: var(--color-on-surface-variant)">IU</small>
										</div>
									</label>
									<label>
										<span>Vit B12</span>
										<div class="flex items-baseline gap-1">
											<input type="text" inputmode="decimal" bind:value={customVitaminB12Mcg} placeholder="0" />
											<small class="text-xs" style="color: var(--color-on-surface-variant)">mcg</small>
										</div>
									</label>
									<label>
										<span>Vit A</span>
										<div class="flex items-baseline gap-1">
											<input type="text" inputmode="decimal" bind:value={customVitaminAMcg} placeholder="0" />
											<small class="text-xs" style="color: var(--color-on-surface-variant)">mcg</small>
										</div>
									</label>
									<label>
										<span>Vit B6</span>
										<div class="flex items-baseline gap-1">
											<input type="text" inputmode="decimal" bind:value={customVitaminB6Mg} placeholder="0" />
											<small class="text-xs" style="color: var(--color-on-surface-variant)">mg</small>
										</div>
									</label>
								</div>
							</section>
						</div>
					{/if}
				</div>

				{#if !favoriteMode}
					<div>
						<section class="manage-settings-surface">
							<button type="button" class="manage-settings-row nutrition-favorite-toggle" aria-pressed={customSaveFavorite} onclick={() => (customSaveFavorite = !customSaveFavorite)}>
								<span class="manage-settings-label">{t.nutrition_save_as_favorite_short}</span>
								<svg width="18" height="18" viewBox="0 0 24 24" fill={customSaveFavorite ? '#FB923C' : 'none'} stroke={customSaveFavorite ? '#FB923C' : 'var(--color-on-surface-variant)'} stroke-width="2" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
							</button>
						</section>
					</div>
				{/if}

			{:else if view === 'amount' && selected}
				{@const isFav = alreadyFavorite()}
				<section class="manage-settings-surface nutrition-amount-surface">
					<div class="nutrition-selected-head">
						{#if selected.imageUrl}<img src={selected.imageUrl} alt="" />{:else if selectedCategory}<span>{@render catIcon(selectedCategory, 31)}</span>{:else}<span>{selected.displayName.slice(0, 1).toUpperCase()}</span>{/if}
						<div><strong>{selected.displayName}</strong><small>{selected.kcalPer100 != null ? `${Math.round(selected.kcalPer100)} kcal / 100 ${nutritionBasisSuffix(selected.unit)}` : t.nutrition_no_kcal_data}</small></div>
						<button type="button" onclick={saveAsFavorite} disabled={savingFavorite || isFav} aria-label={isFav ? t.nutrition_favorite_saved : t.nutrition_save_as_favorite}>
							<svg width="20" height="20" viewBox="0 0 24 24" fill={isFav ? '#FB923C' : 'none'} stroke={isFav ? '#FB923C' : 'var(--color-on-surface-variant)'} stroke-width="2" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
						</button>
					</div>
					{#if selected.productBarcode}
						{#if selected.kcalPer100 == null || selected.kcalPer100 === 0}
							<div class="nutrition-missing-warning">
								<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="12" cy="12" r="10"/>
									<line x1="12" y1="8" x2="12" y2="12"/>
									<line x1="12" y1="16" x2="12.01" y2="16"/>
								</svg>
								<span>This product has no calories or macros recorded yet. You can scan its nutrition facts label with a photo or enter them manually.</span>
							</div>
						{/if}
						<div class="nutrition-product-actions">
							<button type="button" class="nutrition-action-button" onclick={() => openProductNutritionEdit(true)}>
								<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
								<span>Photo to label</span>
							</button>
							<button type="button" class="nutrition-action-button" onclick={() => openProductNutritionEdit(false)}>
								<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
								<span>Edit macros</span>
							</button>
						</div>
					{/if}
					{#if activeGenericVariantA && activeGenericVariantB && currentCookingState}
						<div class="nutrition-cooking-toggle-row">
							<button
								type="button"
								class="nutrition-cooking-pill"
								class:active={currentCookingState === 'cooked'}
								onclick={() => toggleCookingState('cooked')}
							>
								<span class="dot"></span>
								{t.nutrition_cooked}
							</button>
							<button
								type="button"
								class="nutrition-cooking-pill"
								class:active={currentCookingState === 'raw'}
								onclick={() => toggleCookingState('raw')}
							>
								<span class="dot"></span>
								{t.nutrition_raw}
							</button>
						</div>
					{/if}
					<div class="manage-settings-row nutrition-amount-row">
						<span class="manage-settings-label">{t.nutrition_amount}</span>
						<input type="number" inputmode="decimal" bind:value={selected.amount} min="0" step="any" />
						<select bind:value={selected.unit}>
							<option value="portion">{t.nutrition_unit_portion}{selected.gramsPerPiece && selected.gramsPerPiece > 0 ? ` (${selected.gramsPerPiece}g)` : ''}</option>
							<option value="g">g</option>
							<option value="ml">ml</option>
							<option value="piece">{t.nutrition_unit_piece}</option>
						</select>
						<strong>= {Math.round(compKcal(selected))} kcal</strong>
					</div>
					{#if selected.unit === 'portion'}
						<label class="manage-settings-row nutrition-custom-row"><span class="manage-settings-label">{t.nutrition_grams_per_portion}</span><span class="nutrition-number-with-unit"><input type="number" inputmode="decimal" bind:value={selected.gramsPerPiece} min="0" step="any" placeholder="30" /><small>g</small></span></label>
					{:else if selected.unit === 'piece'}
						<label class="manage-settings-row nutrition-custom-row"><span class="manage-settings-label">{t.nutrition_grams_per_piece}</span><span class="nutrition-number-with-unit"><input type="number" inputmode="decimal" bind:value={selected.gramsPerPiece} min="0" step="any" /><small>g</small></span></label>
					{/if}
					{#if selected.kcalPer100 != null || selected.proteinPer100 != null || selected.fatPer100 != null || selected.carbsPer100 != null}
						<div class="nutrition-amount-macros">
							<NutritionMacroStrip items={[
								{ label: t.nutrition_protein, value: compMacro(selected, selected.proteinPer100) },
								{ label: t.nutrition_fat, value: compMacro(selected, selected.fatPer100) },
								{ label: t.nutrition_carbs, value: compMacro(selected, selected.carbsPer100) },
								{ label: t.nutrition_fiber, value: compMacro(selected, selected.fiberPer100) }
							]} />

							<div class="nutrition-fats-substrip">
								<span class="fats-substrip-title">Fats breakdown:</span>
								<div class="fats-substrip-pills">
									{#each selectedFats as f}
										<span class="fat-pill" class:empty={!f.hasValue} style="--pill-color: {f.color}">
											<span class="fat-pill-label">{f.shortLabel}</span>
											{#if f.hasValue}
												<strong class="fat-pill-val">{f.grams}g</strong>
											{:else}
												<span class="fat-pill-val-empty">—</span>
											{/if}
										</span>
									{/each}
								</div>
							</div>

							<div class="nutrition-food-micros-accordion">
								<button
									type="button"
									class="food-micros-toggle-btn"
									onclick={() => (showFoodMicros = !showFoodMicros)}
									aria-expanded={showFoodMicros}
								>
									<div class="flex items-center gap-1.5">
										<svg class="w-3.5 h-3.5 transition-transform duration-200" style="transform: rotate({showFoodMicros ? '90' : '0'}deg)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
											<polyline points="9 18 15 12 9 6"></polyline>
										</svg>
										<span class="font-semibold text-xs text-[var(--color-on-surface)]">Food micronutrients</span>
										{#if recordedMicrosCount > 0}
											<span class="food-micros-count-badge">{recordedMicrosCount} / {selectedMicrosList.length}</span>
										{:else}
											<span class="food-micros-count-badge empty">No data</span>
										{/if}
									</div>
									<span class="text-xs font-bold opacity-70">{showFoodMicros ? '−' : '+'}</span>
								</button>

								{#if showFoodMicros}
									<div class="food-micros-content">
										<!-- Group Minerals -->
										<div class="food-micros-group">
											<div class="food-micros-group-title">
												<span class="dot mineral-dot"></span>
												<span>Key Minerals</span>
											</div>
											<div class="food-micros-grid">
												{#each selectedMinerals as micro}
													<div class="food-micro-card" class:empty={!micro.hasValue}>
														<div class="food-micro-header">
															<span class="food-micro-name" style="color: {micro.color}">
																<span class="food-micro-symbol">{micro.shortLabel}</span>
																<span class="food-micro-label-text">{micro.label}</span>
															</span>
															{#if micro.hasValue && micro.rdaPercent > 0}
																<span class="food-micro-rda">{micro.rdaPercent}% DV</span>
															{/if}
														</div>
														<div class="food-micro-value" class:empty={!micro.hasValue}>
															{micro.valueFormatted}
														</div>
													</div>
												{/each}
											</div>
										</div>

										<!-- Group Vitamins -->
										<div class="food-micros-group mt-3">
											<div class="food-micros-group-title">
												<span class="dot vitamin-dot"></span>
												<span>Key Vitamins</span>
											</div>
											<div class="food-micros-grid">
												{#each selectedVitamins as micro}
													<div class="food-micro-card" class:empty={!micro.hasValue}>
														<div class="food-micro-header">
															<span class="food-micro-name" style="color: {micro.color}">
																<span class="food-micro-symbol">{micro.shortLabel}</span>
																<span class="food-micro-label-text">{micro.label}</span>
															</span>
															{#if micro.hasValue && micro.rdaPercent > 0}
																<span class="food-micro-rda">{micro.rdaPercent}% DV</span>
															{/if}
														</div>
														<div class="food-micro-value" class:empty={!micro.hasValue}>
															{micro.valueFormatted}
														</div>
													</div>
												{/each}
											</div>
										</div>

										{#if hasMissingMicros}
											<button
												type="button"
												class="food-micros-estimate-cta"
												onclick={() => openProductNutritionEdit(false, undefined, 'natural')}
											>
												<svg class="w-4 h-4 shrink-0 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
													<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
												</svg>
												<span>✨ Estimate / Complete with AI (natural 1-ingredient foods)</span>
											</button>
										{/if}
									</div>
								{/if}
							</div>
						</div>
					{/if}
				</section>
			{/if}
		</div>
	{/snippet}
	{#snippet footer()}
		{#if view === 'picker'}
			{#if pickerTab === 'recent' && selectedRecentTotals.count > 0}
				<div class="nutrition-batch-footer">
					<button type="button" onclick={clearRecentSelection} class="manage-secondary">
						{t.nutrition_cancel}
					</button>
					<button
						type="button"
						onclick={addSelectedRecentBatch}
						class="manage-primary nutrition-batch-add-btn"
					>
						+ Add selected ({selectedRecentTotals.count}) · {selectedRecentTotals.kcal} kcal
					</button>
				</div>
			{:else}
				<div class="nutrition-picker-footer">
					<button type="button" class="nutrition-custom-entry-action" onclick={openCustomEntry}>+ {t.nutrition_custom_entry}</button>
					<input type="text" bind:value={query} placeholder={t.nutrition_search_placeholder} enterkeyhint="search" class="manage-input" />
					<div class="nutrition-picker-footer-buttons">
						<button type="button" onclick={handleSheetClose} class="manage-secondary">{t.nutrition_cancel}</button>
						<button type="button" onclick={() => (scannerOpen = true)} class="manage-primary">{t.nutrition_scan}</button>
					</div>
				</div>
			{/if}
		{:else if view === 'custom'}
			<button type="button" onclick={handleSheetClose} class="manage-secondary">{t.nutrition_back}</button>
			<button type="button" onclick={() => void submitCustom()} disabled={parseOptionalNutritionNumber(customKcal) == null} class="manage-primary disabled:opacity-40">{foodRegisterMode ? 'Register food' : favoriteMode ? t.nutrition_save : t.nutrition_apply}</button>
		{:else}
			<button type="button" onclick={handleSheetClose} class="manage-secondary">{t.nutrition_back}</button>
			<button type="button" onclick={() => void confirm()} disabled={selected && (selected.unit === 'portion' || selected.unit === 'piece') && (!selected.gramsPerPiece || selected.gramsPerPiece <= 0)} class="manage-primary disabled:opacity-40">{foodRegisterMode ? 'Register food' : favoriteMode ? t.nutrition_save : t.nutrition_apply}</button>
		{/if}
	{/snippet}
</ManageSheetShell>

{#if scannerOpen}
	<BarcodeScanner rawMode onFound={onScan} onClose={() => (scannerOpen = false)} />
{/if}

{#if aiSheetOpen}
	<AiFoodEstimatorSheet
		zIndex={80}
		onclose={() => (aiSheetOpen = false)}
		onaddcomponents={(newComps) => {
			for (const c of newComps) {
				onadd(c);
			}
			aiSheetOpen = false;
			onclose();
		}}
	/>
{/if}

{#if productEditModalOpen}
	<ProductNutritionEditModal
		barcode={productEditBarcode}
		initialData={productEditInitialData}
		autoTakePhoto={productEditAutoPhoto}
		initialFoodType={productEditInitialFoodType}
		onclose={() => (productEditModalOpen = false)}
		onsave={handleProductNutritionSaved}
	/>
{/if}

<style>
	.nutrition-picker-tabs {
		display: flex;
		gap: 4px;
		padding: 3px;
		border-radius: 12px;
		background: var(--color-surface-container);
		border: 1px solid var(--bubble-container-border);
		margin-bottom: 8px;
	}

	.nutrition-picker-tab {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		height: 32px;
		border-radius: 9px;
		font-size: 12px;
		font-weight: 600;
		color: var(--color-on-surface-variant);
		background: transparent;
		transition: all 140ms ease;
		touch-action: manipulation;
		cursor: pointer;
	}

	.nutrition-picker-tab.active {
		background: #FB923C;
		color: #FFFFFF;
	}

	.nutrition-picker-tab-ai {
		background: color-mix(in srgb, #FB923C 12%, transparent);
		color: #FB923C;
		font-weight: 700;
	}
	.nutrition-picker-tab-ai:active {
		background: color-mix(in srgb, #FB923C 25%, transparent);
	}

	.nutrition-tab-count {
		font-size: 10px;
		opacity: 0.85;
		font-variant-numeric: tabular-nums;
	}

	.nutrition-picker-header-action { display: flex; min-height: 40px; align-items: center; justify-content: center; gap: 5px; padding-inline: 8px; border-radius: 12px; color: var(--color-on-surface-variant); font-size: 11px; font-weight: 650; }
	.nutrition-picker-workspace { overscroll-behavior: contain; }
	.nutrition-search-status { display: flex; min-height: 34px; align-items: center; justify-content: center; gap: 7px; color: var(--color-on-surface-variant); font-size: 11px; }
	.nutrition-search-status span { width: 13px; height: 13px; border: 2px solid color-mix(in srgb, #FB923C 35%, transparent); border-top-color: #FB923C; border-radius: 999px; animation: nutrition-spin .8s linear infinite; }
	.nutrition-result-list :global(.nutrition-food-row + .nutrition-food-row) { border-top: 1px solid var(--bubble-container-border); }
	.nutrition-show-all { width: 100%; min-height: 38px; margin-top: 3px; color: #FB923C; font-size: 11px; font-weight: 650; }
	.nutrition-empty-state { padding: 24px 12px; color: var(--color-on-surface-variant); font-size: 12px; line-height: 1.45; text-align: center; }
	.nutrition-batch-footer {
		display: grid;
		grid-template-columns: minmax(0, 0.7fr) minmax(0, 1.3fr);
		gap: 8px;
		width: 100%;
		grid-column: 1 / -1;
	}
	.nutrition-batch-add-btn {
		background: #DC2626 !important;
		color: #ffffff !important;
		font-weight: 700;
	}
	.nutrition-recent-actions-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 2px 4px 6px;
	}
	.nutrition-recent-select-all {
		font-size: 11px;
		font-weight: 600;
		color: #DC2626;
		background: transparent;
		cursor: pointer;
		touch-action: manipulation;
	}
	.nutrition-recent-selected-badge {
		font-size: 11px;
		font-weight: 500;
		color: var(--color-on-surface-variant);
	}
	.nutrition-recent-item-row {
		display: flex;
		align-items: center;
		padding-left: 12px;
		transition: background-color 0.15s ease;
	}
	.nutrition-recent-item-row.is-checked {
		background: color-mix(in srgb, #DC2626 6%, transparent);
	}
	.nutrition-result-list :global(.nutrition-recent-item-row + .nutrition-recent-item-row) {
		border-top: 1px solid var(--bubble-container-border);
	}
	.nutrition-recent-checkbox {
		width: 22px;
		height: 22px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		border: 1.5px solid var(--bubble-container-border);
		background: var(--color-surface);
		color: #ffffff;
		cursor: pointer;
		touch-action: manipulation;
		transition: all 0.15s ease;
	}
	.nutrition-recent-checkbox.checked {
		background: #DC2626;
		border-color: #DC2626;
	}
	.nutrition-recent-row-content {
		flex: 1;
		min-width: 0;
	}

	.nutrition-picker-footer { display: grid; grid-column: 1 / -1; gap: 7px; }
	.nutrition-custom-entry-action { min-height: 34px; border-radius: 10px; color: #FB923C; font-size: 12px; font-weight: 650; }
	.nutrition-custom-entry-action:active { background: color-mix(in srgb, #FB923C 8%, transparent); }
	.nutrition-picker-footer-buttons { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); gap: 8px; }
	.nutrition-custom-row { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); align-items: center; gap: 12px; }
	.nutrition-number-with-unit { display: flex; min-width: 0; align-items: center; justify-content: flex-end; gap: 5px; }
	.nutrition-number-with-unit input { width: 100%; min-width: 0; height: 36px; border: 0; outline: 0; background: transparent; color: #FB923C; font-size: 16px; font-weight: 650; font-variant-numeric: tabular-nums; text-align: right; }
	.nutrition-number-with-unit input::placeholder, .nutrition-custom-grid input::placeholder { color: var(--color-on-surface-variant); opacity: .55; }
	.nutrition-number-with-unit small { flex: none; color: #FB923C; font-size: 12px; font-weight: 600; }
	.nutrition-custom-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; padding-block: 7px; }
	.nutrition-custom-grid label { display: grid; min-width: 0; gap: 2px; }
	.nutrition-custom-grid span { overflow: hidden; color: var(--color-on-surface-variant); font-size: 10px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
	.nutrition-custom-grid input { width: 100%; min-width: 0; height: 28px; border: 0; outline: 0; background: transparent; color: #FB923C; font-size: 16px; font-weight: 650; font-variant-numeric: tabular-nums; }
	.nutrition-favorite-toggle { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 12px; text-align: left; }
	.nutrition-cooking-toggle-row {
		display: flex;
		gap: 6px;
		padding: 6px 10px 8px;
		border-bottom: 1px solid var(--bubble-container-border);
	}
	.nutrition-cooking-pill {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 6px 10px;
		font-size: 12px;
		font-weight: 600;
		border-radius: 8px;
		border: 1px solid var(--bubble-container-border);
		background: transparent;
		color: var(--color-on-surface-variant);
		transition: all 0.15s ease;
		cursor: pointer;
	}
	.nutrition-cooking-pill .dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: currentColor;
		opacity: 0.4;
	}
	.nutrition-cooking-pill.active {
		background: #DC2626;
		color: #ffffff;
		border-color: #DC2626;
	}
	.nutrition-cooking-pill.active .dot {
		background: #ffffff;
		opacity: 1;
	}

	.nutrition-selected-head { display: flex; min-height: 58px; align-items: center; gap: 10px; padding: 8px 10px; }
	.nutrition-selected-head > img, .nutrition-selected-head > span { display: flex; width: 40px; height: 40px; flex: none; align-items: center; justify-content: center; border-radius: 10px; object-fit: cover; background: color-mix(in srgb, #FB923C 8%, transparent); color: #FB923C; font-size: 13px; font-weight: 700; }
	.nutrition-selected-head > div { display: grid; min-width: 0; flex: 1; gap: 2px; }
	.nutrition-selected-head strong, .nutrition-selected-head small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.nutrition-selected-head strong { color: var(--color-on-surface); font-size: 14px; }
	.nutrition-selected-head small { color: var(--color-on-surface-variant); font-size: 11px; font-weight: 500; }
	.nutrition-selected-head button { display: flex; width: 40px; height: 40px; flex: none; align-items: center; justify-content: center; }
	.nutrition-missing-warning {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		margin: 6px 10px;
		border-radius: 10px;
		background: color-mix(in srgb, #DC2626 12%, transparent);
		border: 1px solid color-mix(in srgb, #DC2626 30%, transparent);
		color: #DC2626;
		font-size: 11px;
		font-weight: 550;
		line-height: 1.35;
	}
	.nutrition-product-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		padding: 6px 10px 10px;
		border-bottom: 1px solid var(--bubble-container-border);
	}
	.nutrition-action-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 8px 10px;
		border-radius: 10px;
		border: 1px solid var(--bubble-container-border);
		background: var(--color-surface);
		color: var(--color-on-surface);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
		text-align: center;
	}
	.nutrition-action-button:active {
		background: color-mix(in srgb, var(--theme-accent) 12%, transparent);
		border-color: var(--theme-accent);
		color: var(--theme-accent);
	}
	.nutrition-amount-row { display: grid; grid-template-columns: auto minmax(48px, 1fr) auto minmax(82px, auto); align-items: center; gap: 7px; }
	.nutrition-amount-row input, .nutrition-amount-row select { min-width: 0; height: 36px; border: 0; outline: 0; background: transparent; color: var(--color-on-surface); font-size: 16px; font-variant-numeric: tabular-nums; }
	.nutrition-amount-row input { width: 100%; text-align: right; }
	.nutrition-amount-row select { color: #FB923C; font-weight: 650; }
	.nutrition-amount-row strong { color: #FB923C; font-size: 14px; font-weight: 650; font-variant-numeric: tabular-nums; text-align: right; }
	.nutrition-amount-macros { padding: 10px; border-top: 1px solid var(--bubble-container-border); }
	.nutrition-fats-substrip {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
		padding: 7px 10px;
		margin-top: 8px;
		border-radius: 10px;
		background: color-mix(in srgb, var(--color-surface-container) 70%, transparent);
		border: 1px dashed var(--bubble-container-border);
		font-size: 11px;
	}
	.fats-substrip-title {
		font-size: 11px;
		font-weight: 650;
		color: var(--color-on-surface-variant);
		margin-right: 2px;
	}
	.fats-substrip-pills {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
	}
	.fat-pill {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 7px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--pill-color) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--pill-color) 25%, transparent);
		color: var(--color-on-surface);
		font-size: 11px;
	}
	.fat-pill.empty {
		background: color-mix(in srgb, var(--color-on-surface) 4%, transparent);
		border-color: color-mix(in srgb, var(--color-on-surface) 12%, transparent);
		opacity: 0.75;
	}
	.fat-pill-label {
		color: var(--pill-color);
		font-weight: 600;
	}
	.fat-pill-val {
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.fat-pill-val-empty {
		color: var(--color-on-surface-variant);
		font-weight: 500;
		opacity: 0.7;
	}
	.nutrition-food-micros-accordion {
		margin-top: 8px;
		border-radius: 12px;
		background: var(--color-surface-container);
		border: 1px solid var(--bubble-container-border);
		overflow: hidden;
	}
	.food-micros-toggle-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 9px 12px;
		background: transparent;
		border: none;
		cursor: pointer;
		color: var(--color-on-surface-variant);
		transition: background-color 0.15s ease;
	}
	.food-micros-toggle-btn:hover {
		background: color-mix(in srgb, var(--color-on-surface) 5%, transparent);
	}
	.food-micros-count-badge {
		padding: 1px 6px;
		border-radius: 999px;
		font-size: 10px;
		font-weight: 700;
		background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
		color: var(--theme-accent);
	}
	.food-micros-count-badge.empty {
		background: color-mix(in srgb, var(--color-on-surface) 8%, transparent);
		color: var(--color-on-surface-variant);
	}
	.food-micros-content {
		padding: 8px 10px 10px;
		border-top: 1px solid var(--bubble-container-border);
	}
	.food-micros-group-title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-on-surface-variant);
		margin-bottom: 6px;
	}
	.food-micros-group-title .dot {
		width: 6px;
		height: 6px;
		border-radius: 999px;
	}
	.food-micros-group-title .mineral-dot {
		background: #38BDF8;
	}
	.food-micros-group-title .vitamin-dot {
		background: #F59E0B;
	}
	.food-micros-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 6px;
	}
	.food-micro-card {
		padding: 6px 8px;
		border-radius: 8px;
		background: var(--color-surface);
		border: 1px solid var(--bubble-container-border);
	}
	.food-micro-card.empty {
		opacity: 0.65;
		border-style: dashed;
	}
	.food-micro-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 4px;
		margin-bottom: 2px;
	}
	.food-micro-name {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 10.5px;
		font-weight: 700;
		min-width: 0;
		overflow: hidden;
	}
	.food-micro-symbol {
		font-size: 9.5px;
		font-weight: 800;
		padding: 1px 4px;
		border-radius: 4px;
		background: color-mix(in srgb, currentColor 14%, transparent);
		flex-shrink: 0;
	}
	.food-micro-label-text {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.food-micro-rda {
		font-size: 9.5px;
		font-weight: 600;
		color: var(--color-on-surface-variant);
		opacity: 0.85;
		white-space: nowrap;
		flex-shrink: 0;
	}
	.food-micro-value {
		font-size: 12px;
		font-weight: 700;
		color: var(--color-on-surface);
		font-variant-numeric: tabular-nums;
	}
	.food-micro-value.empty {
		color: var(--color-on-surface-variant);
		font-weight: 500;
		opacity: 0.7;
	}
	.food-micros-estimate-cta {
		width: 100%;
		margin-top: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 8px 10px;
		border-radius: 9px;
		background: color-mix(in srgb, #DC2626 10%, transparent);
		border: 1px dashed color-mix(in srgb, #DC2626 40%, transparent);
		color: #EF4444;
		font-size: 11px;
		font-weight: 650;
		cursor: pointer;
		transition: all 0.15s ease;
		text-align: center;
	}
	.food-micros-estimate-cta:hover {
		background: color-mix(in srgb, #DC2626 18%, transparent);
		border-style: solid;
	}
	@keyframes nutrition-spin { to { transform: rotate(360deg); } }
	@media (prefers-reduced-motion: reduce) { .nutrition-search-status span { animation: none; } }
</style>
