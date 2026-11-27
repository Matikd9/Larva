<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import TrackerHeader from '#lib/components/supplements/TrackerHeader.svelte';
	import TrackerDateNav from '#lib/components/supplements/TrackerDateNav.svelte';
	import { measureHeight } from '#lib/measureHeight';
	import HamburgerMenu from '#lib/components/HamburgerMenu.svelte';
	import AppBottomNav from '#lib/components/AppBottomNav.svelte';
	import MealEditSheet from '#lib/components/supplements/MealEditSheet.svelte';
	import NutritionGoalSheet from '#lib/components/supplements/NutritionGoalSheet.svelte';
	import NutritionMacroStrip from '#lib/components/supplements/NutritionMacroStrip.svelte';
	import AddComponentSheet from '#lib/components/supplements/AddComponentSheet.svelte';
	import DailyLogSection from '#lib/components/supplements/DailyLogSection.svelte';
	import AppPrompts from '#lib/components/AppPrompts.svelte';
	import ManageSheetShell from '#lib/components/supplements/ManageSheetShell.svelte';
	import { toLocalDateKey } from '#lib/dates';
	import { userSettings } from '#lib/userSettings.svelte';
	import { t, currentLang, nutrition_kcal_over, nutrition_kcal_remaining, nutrition_of_goal } from '#lib/i18n.svelte';
	import {
		type EssentialMicros,
		MINERALS_META,
		VITAMINS_META,
		addMicros,
		scaleMicros,
		computeRdaPercent,
		formatMicroValue
	} from '#lib/micronutrients';
	import { effectiveGrams } from '#lib/nutritionUtils';

	type Component = {
		id: string;
		sortOrder: number;
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
		kcal: number;
		protein: number;
		fat: number;
		carbs: number;
		sugar: number;
		fiber: number;
		salt: number;
		micros?: EssentialMicros | null;
	};
	type Meal = { id: string; name: string; date: string; time: string; components: Component[]; imageUrl?: string | null; favoriteName?: string | null };

	let { data } = $props();

	let menuOpen = $state(false);
	let dailyLog = $state<ReturnType<typeof DailyLogSection> | null>(null);
	let installPrompt = $state<any>(null);
	let headerHeight = $state(0);
	let dateStr = $state(
		(() => {
			const param = page.url.searchParams.get('date');
			return param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : toLocalDateKey(new Date());
		})()
	);
	let meals = $state<Meal[]>([]);
	let goalKcal = $state<number | null>(null);
	let goalProtein = $state<number | null>(null);
	let goalFat = $state<number | null>(null);
	let goalCarbs = $state<number | null>(null);
	let goalFiber = $state<number | null>(null);
	let customMicrosGoals = $state<EssentialMicros>({});
	let loading = $state(true);
	let editSheetOpen = $state(false);
	let editingMeal = $state<Meal | null>(null);
	let goalSheetOpen = $state(false);
	let showMicronutrients = $state(false);

	function getMicroRda(key: keyof EssentialMicros, defaultRda: number): number {
		const custom = customMicrosGoals[key];
		return typeof custom === 'number' && custom > 0 ? custom : defaultRda;
	}

	// Recomputed when the app returns to the foreground: an installed PWA can stay open past midnight.
	let todayStr = $state(toLocalDateKey(new Date()));
	const isToday = $derived(dateStr === todayStr);

	function shiftDate(days: number) {
		const d = new Date(dateStr + 'T00:00:00');
		d.setDate(d.getDate() + days);
		dateStr = toLocalDateKey(d);
	}

	function formatDate(s: string): string {
		const d = new Date(s + 'T00:00:00');
		if (s === todayStr) return t.nutrition_today;
		const yest = new Date(); yest.setDate(yest.getDate() - 1);
		if (s === toLocalDateKey(yest)) return t.nutrition_yesterday;
		return d.toLocaleDateString(currentLang(), { weekday: 'short', day: 'numeric', month: 'long' });
	}

	let loadError = $state(false);
	let loadToken = 0;

	async function load() {
		// Only the newest request may write state; a slow answer for another day is dropped.
		const token = ++loadToken;
		loading = true;
		try {
			const [mealsRes, goalsRes] = await Promise.all([
				fetch(`/api/nutrition/meals?date=${dateStr}`),
				fetch('/api/nutrition/goals')
			]);
			if (!mealsRes.ok) throw new Error(`meals ${mealsRes.status}`);
			const d = await mealsRes.json();
			if (token !== loadToken) return;
			meals = d.meals ?? [];
			loadError = false;
			syncDaySubdivisions();
			if (goalsRes.ok) {
				const d = await goalsRes.json();
				if (token !== loadToken) return;
				goalKcal = d.goals?.dailyKcal ?? null;
				goalProtein = d.goals?.dailyProtein ?? null;
				goalFat = d.goals?.dailyFat ?? null;
				goalCarbs = d.goals?.dailyCarbs ?? null;
				goalFiber = d.goals?.dailyFiber ?? null;
				customMicrosGoals = d.goals?.customMicros ?? {};
			}
		} catch {
			// An empty day here would look like lost data and invite logging it twice.
			if (token === loadToken) {
				meals = [];
				loadError = true;
			}
		} finally {
			if (token === loadToken) loading = false;
		}
	}

	onMount(() => {
		const onVisible = () => {
			if (document.visibilityState !== 'visible') return;
			const now = toLocalDateKey(new Date());
			if (now === todayStr) return;
			if (dateStr === todayStr) dateStr = now; // someone looking at "today" keeps looking at today
			todayStr = now;
		};
		document.addEventListener('visibilitychange', onVisible);
		const params = new URLSearchParams(window.location.search);
		if (params.get('new') === '1') {
			openNewMeal();
			const url = new URL(window.location.href);
			url.searchParams.delete('new');
			history.replaceState(history.state, '', url.pathname + url.search);
		}
		return () => document.removeEventListener('visibilitychange', onVisible);
	});

	$effect(() => {
		// Reload when date changes
		void dateStr;
		load();
	});

	const totals = $derived.by(() => {
		const t = { kcal: 0, protein: 0, fat: 0, carbs: 0, sugar: 0, fiber: 0, salt: 0 };
		let micros: EssentialMicros = {};
		for (const m of meals) {
			for (const c of m.components) {
				t.kcal += c.kcal ?? 0;
				t.protein += c.protein ?? 0;
				t.fat += c.fat ?? 0;
				t.carbs += c.carbs ?? 0;
				t.sugar += c.sugar ?? 0;
				t.fiber += c.fiber ?? 0;
				t.salt += c.salt ?? 0;
				if (c.micros) {
					// The API returns micros per 100 g; the day total needs the logged amount.
					micros = addMicros(micros, scaleMicros(c.micros, effectiveGrams(c.amount, c.unit, c.gramsPerPiece) / 100));
				}
			}
		}
		const sodiumFromSalt = Math.round(t.salt * 400);
		if ((micros.sodiumMg ?? 0) < sodiumFromSalt) {
			micros.sodiumMg = sodiumFromSalt;
		}
		return { ...t, micros };
	});

	function fmtKcal(v: number): string { return Math.round(v).toLocaleString(currentLang()); }
	function fmtG(v: number): string { return v < 10 ? v.toFixed(1) : Math.round(v).toString(); }

	type MealBlockKey = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

	const mealBlocks = $derived<Array<{ key: MealBlockKey; title: string; icon: string }>>([
		{ key: 'breakfast', title: t.nutrition_meal_breakfast, icon: '🍳' },
		{ key: 'lunch', title: t.nutrition_meal_lunch, icon: '🥗' },
		{ key: 'dinner', title: t.nutrition_meal_dinner, icon: '🍲' },
		{ key: 'snacks', title: t.nutrition_meal_snacks, icon: '🍎' }
	]);

	function getMealBlock(meal: Pick<Meal, 'name' | 'time'>): MealBlockKey {
		const n = (meal.name || '').toLowerCase().trim();
		if (n.includes('frühstück') || n.includes('breakfast') || n.includes('desayuno')) return 'breakfast';
		if (n.includes('mittag') || n.includes('lunch') || n.includes('almuerzo') || n.includes('comida')) return 'lunch';
		if (n.includes('abend') || n.includes('dinner') || n.includes('cena')) return 'dinner';
		if (n.includes('snack') || n.includes('vesper') || n.includes('merienda')) return 'snacks';
		// Recipe titles and custom names say nothing about the block: place them by the time they were eaten.
		const byTime = defaultMealName(meal.time || '12:00');
		return byTime === t.nutrition_meal_breakfast ? 'breakfast' : byTime === t.nutrition_meal_lunch ? 'lunch' : byTime === t.nutrition_meal_dinner ? 'dinner' : 'snacks';
	}

	function getBlockTotals(blockMeals: Meal[]) {
		let kcal = 0;
		let protein = 0;
		let fat = 0;
		let carbs = 0;
		for (const m of blockMeals) {
			for (const c of m.components) {
				kcal += c.kcal ?? 0;
				protein += c.protein ?? 0;
				fat += c.fat ?? 0;
				carbs += c.carbs ?? 0;
			}
		}
		return { kcal, protein, fat, carbs };
	}

	let copyingBlock = $state<string | null>(null);
	let copiedBlock = $state<string | null>(null);

	async function copyFromYesterday(blockKey: MealBlockKey, blockTitle: string) {
		if (copyingBlock) return;
		copyingBlock = blockKey;
		try {
			const curDate = new Date(dateStr + 'T00:00:00');
			curDate.setDate(curDate.getDate() - 1);
			const yesterdayStr = toLocalDateKey(curDate);

			const res = await fetch(`/api/nutrition/meals?date=${yesterdayStr}`);
			if (!res.ok) {
				alert(t.nutrition_no_yesterday_meal);
				return;
			}
			const d = await res.json();
			const yesterdayMeals: Meal[] = d.meals ?? [];
			const matchingMeals = yesterdayMeals.filter((m) => getMealBlock(m) === blockKey);

			const componentsToCopy: Component[] = [];
			for (const m of matchingMeals) {
				for (const c of m.components) {
					componentsToCopy.push(c);
				}
			}

			if (componentsToCopy.length === 0) {
				alert(t.nutrition_no_yesterday_meal);
				return;
			}

			const payloadComponents = componentsToCopy.map((c) => ({
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
				saltPer100: c.saltPer100,
				micros: c.micros
			}));

			const todayMeal = meals.find((m) => getMealBlock(m) === blockKey);
			let saveRes: Response;
			if (todayMeal) {
				const existingCleanComps = todayMeal.components.map((c) => ({
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
					saltPer100: c.saltPer100,
					micros: c.micros
				}));
				saveRes = await fetch(`/api/nutrition/meals/${todayMeal.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						components: [...existingCleanComps, ...payloadComponents]
					})
				});
			} else {
				const now = new Date();
				const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
				saveRes = await fetch('/api/nutrition/meals', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						name: blockTitle,
						date: dateStr,
						time,
						components: payloadComponents
					})
				});
			}
			if (!saveRes.ok) throw new Error(`save ${saveRes.status}`);

			copiedBlock = blockKey;
			setTimeout(() => {
				if (copiedBlock === blockKey) copiedBlock = null;
			}, 2000);
			await load();
		} catch (e) {
			console.error(e);
			alert(t.nutrition_save_error);
		} finally {
			copyingBlock = null;
		}
	}

	function openMealForBlock(blockKey: MealBlockKey, blockTitle: string) {
		const existing = meals.find((m) => getMealBlock(m) === blockKey);
		if (existing) {
			openEditMeal(existing);
			return;
		}
		const now = new Date();
		const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
		editingMeal = {
			id: '',
			name: blockTitle,
			date: dateStr,
			time,
			components: []
		};
		editSheetOpen = true;
	}

	function defaultMealName(time: string): string {
		const [h, m] = time.split(':').map(Number);
		const minutes = h * 60 + (m || 0);
		if (minutes < 4 * 60) return t.nutrition_meal_snacks;
		if (minutes <= 10 * 60 + 30) return t.nutrition_meal_breakfast;
		if (minutes <= 14 * 60 + 30) return t.nutrition_meal_lunch;
		if (minutes <= 17 * 60 + 30) return t.nutrition_meal_snacks;
		if (minutes <= 22 * 60) return t.nutrition_meal_dinner;
		return t.nutrition_meal_snacks;
	}

	type CustomDaySubdivision = {
		id: string;
		number: number;
		name: string;
	};

	let customDaySubdivisions = $state<CustomDaySubdivision[]>([]);
	const SUBDIVISIONS_KEY_PREFIX = 'nutrition_day_subdivisions_';

	function syncDaySubdivisions() {
		if (typeof localStorage === 'undefined') return;
		const storageKey = SUBDIVISIONS_KEY_PREFIX + dateStr;
		let list: CustomDaySubdivision[] = [];
		try {
			const raw = localStorage.getItem(storageKey);
			if (raw) {
				const parsed = JSON.parse(raw);
				if (Array.isArray(parsed) && parsed.length > 0) {
					list = parsed;
				}
			}
		} catch { /* noop */ }

		// Check existing meals on this date to ensure any meal has a matching subdivision
		if (meals.length > 0) {
			const existingNames = new Set(list.map((s) => s.name.trim().toLowerCase()));
			for (const m of meals) {
				const mName = (m.name || '').trim();
				if (mName && !existingNames.has(mName.toLowerCase())) {
					const nextNum = list.length > 0 ? Math.max(...list.map((s) => s.number)) + 1 : 1;
					list.push({
						id: 'sub_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
						number: nextNum,
						name: mName
					});
					existingNames.add(mName.toLowerCase());
				}
			}
		}

		if (list.length === 0) {
			list = [{ id: 'sub_1', number: 1, name: 'Meal 1' }];
		}

		customDaySubdivisions = list;
		try {
			localStorage.setItem(storageKey, JSON.stringify(list));
		} catch { /* noop */ }
	}

	function saveDaySubdivisions() {
		if (typeof localStorage === 'undefined') return;
		try {
			localStorage.setItem(SUBDIVISIONS_KEY_PREFIX + dateStr, JSON.stringify(customDaySubdivisions));
		} catch { /* noop */ }
	}

	const nextSubdivisionNumber = $derived(
		customDaySubdivisions.length > 0
			? Math.max(...customDaySubdivisions.map((s) => s.number)) + 1
			: 1
	);

	function addNewSubdivision() {
		const nextNum = nextSubdivisionNumber;
		const newSub: CustomDaySubdivision = {
			id: 'sub_' + Date.now(),
			number: nextNum,
			name: `Meal ${nextNum}`
		};
		customDaySubdivisions = [...customDaySubdivisions, newSub];
		saveDaySubdivisions();
	}

	let renamingSub = $state<CustomDaySubdivision | null>(null);
	let renameValue = $state('');

	function startRenameSubdivision(sub: CustomDaySubdivision) {
		renamingSub = sub;
		renameValue = sub.name;
	}

	async function confirmRename() {
		if (!renamingSub) return;
		const trimmed = renameValue.trim();
		const oldName = renamingSub.name;
		const newName = trimmed || `Meal ${renamingSub.number}`;

		if (oldName !== newName) {
			customDaySubdivisions = customDaySubdivisions.map((s) =>
				s.id === renamingSub!.id ? { ...s, name: newName } : s
			);
			saveDaySubdivisions();

			// Update any meals in the DB that carried the old name
			const matchingMeals = meals.filter((m) => m.name === oldName);
			for (const m of matchingMeals) {
				try {
					await fetch(`/api/nutrition/meals/${m.id}`, {
						method: 'PATCH',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ name: newName })
					});
				} catch { /* noop */ }
			}
			await load();
		}
		renamingSub = null;
	}

	function getSubdivisionMeals(sub: CustomDaySubdivision): Meal[] {
		const direct = meals.filter((m) => m.name.trim().toLowerCase() === sub.name.trim().toLowerCase());
		if (direct.length > 0) return direct;

		// Fallback for first subdivision if there are meals with other generic names
		if (customDaySubdivisions.length === 1) {
			return meals;
		}

		return [];
	}

	function getSubdivisionTotals(subMeals: Meal[]) {
		let kcal = 0, protein = 0, fat = 0, carbs = 0;
		for (const m of subMeals) {
			for (const c of m.components) {
				kcal += c.kcal ?? 0;
				protein += c.protein ?? 0;
				fat += c.fat ?? 0;
				carbs += c.carbs ?? 0;
			}
		}
		return { kcal, protein, fat, carbs };
	}

	async function deleteMealWithoutConfirm(id: string) {
		const res = await fetch(`/api/nutrition/meals/${id}`, { method: 'DELETE' });
		return res.ok;
	}

	async function deleteSubdivision(sub: CustomDaySubdivision) {
		if (customDaySubdivisions.length <= 1) return;

		const matchingMeals = getSubdivisionMeals(sub);
		const totalFoods = matchingMeals.reduce((sum, m) => sum + m.components.length, 0);

		if (totalFoods > 0) {
			const confirmed = window.confirm(
				`Delete "${sub.name}" and the ${totalFoods} food item(s) logged in it?`
			);
			if (!confirmed) return;
		}

		for (const m of matchingMeals) {
			if (m.id) {
				await deleteMealWithoutConfirm(m.id);
			}
		}

		customDaySubdivisions = customDaySubdivisions.filter((s) => s.id !== sub.id);
		saveDaySubdivisions();
		await load();
	}

	function openMealForSubdivision(sub: CustomDaySubdivision) {
		const matchingMeals = getSubdivisionMeals(sub);
		if (matchingMeals.length > 0) {
			openEditMeal(matchingMeals[0]);
			return;
		}
		const now = new Date();
		const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
		editingMeal = {
			id: '',
			name: sub.name,
			date: dateStr,
			time,
			components: []
		};
		editSheetOpen = true;
	}

	function openNewMeal() {
		const now = new Date();
		const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
		let mealName = defaultMealName(time);
		if (!userSettings.nutritionMealSubdivisionsEnabled && customDaySubdivisions.length > 0) {
			const emptySub = customDaySubdivisions.find((s) => getSubdivisionMeals(s).length === 0);
			mealName = emptySub ? emptySub.name : customDaySubdivisions[customDaySubdivisions.length - 1].name;
		}
		editingMeal = {
			id: '',
			name: mealName,
			date: dateStr,
			time,
			components: []
		};
		editSheetOpen = true;
	}

	function openEditMeal(m: Meal) {
		editingMeal = m;
		editSheetOpen = true;
	}

	async function deleteMeal(id: string) {
		if (!confirm(t.nutrition_confirm_delete)) return false;
		const res = await fetch(`/api/nutrition/meals/${id}`, { method: 'DELETE' });
		if (res.ok) await load();
		return res.ok;
	}

	function percentKcal(): number {
		if (!goalKcal) return 0;
		return Math.min(100, (totals.kcal / goalKcal) * 100);
	}

	let showDailyFatsBreakdown = $state(false);

	const dailyFats = $derived.by(() => {
		const m = totals.micros;
		const items: Array<{ key: string; label: string; shortLabel: string; grams: number; color: string }> = [];
		if (m.saturatedFat != null && m.saturatedFat > 0) {
			items.push({ key: 'saturatedFat', label: 'Saturated Fat', shortLabel: 'Sat.', grams: Math.round(m.saturatedFat * 10) / 10, color: '#F59E0B' });
		}
		if (m.monounsaturatedFat != null && m.monounsaturatedFat > 0) {
			items.push({ key: 'monounsaturatedFat', label: 'Monounsaturated Fat', shortLabel: 'Mono.', grams: Math.round(m.monounsaturatedFat * 10) / 10, color: '#38BDF8' });
		}
		if (m.polyunsaturatedFat != null && m.polyunsaturatedFat > 0) {
			items.push({ key: 'polyunsaturatedFat', label: 'Polyunsaturated Fat', shortLabel: 'Poly.', grams: Math.round(m.polyunsaturatedFat * 10) / 10, color: '#10B981' });
		}
		if (m.transFat != null && m.transFat > 0) {
			items.push({ key: 'transFat', label: 'Trans Fat', shortLabel: 'Trans', grams: Math.round(m.transFat * 10) / 10, color: '#EF4444' });
		}
		return items;
	});

	const macroItems = $derived([
		{ label: t.nutrition_protein, value: totals.protein, goal: goalProtein, goalType: 'min' as const },
		{ label: t.nutrition_fat, value: totals.fat, goal: goalFat, goalType: 'max' as const },
		{ label: t.nutrition_carbs, value: totals.carbs, goal: goalCarbs, goalType: 'max' as const },
		{ label: t.nutrition_fiber, value: totals.fiber, goal: goalFiber, goalType: 'min' as const }
	]);

	const kcalStatus = $derived.by(() => {
		if (!goalKcal) return null;
		const delta = Math.round(Math.abs(goalKcal - totals.kcal)).toLocaleString(currentLang());
		return totals.kcal > goalKcal ? nutrition_kcal_over(delta) : nutrition_kcal_remaining(delta);
	});

	let registerFoodOpen = $state(false);
	let registeredFood = $state<any | null>(null);
	let postRegisterSheetOpen = $state(false);

	const availableSubdivisionNames = $derived.by(() => {
		if (userSettings.nutritionMealSubdivisionsEnabled) {
			return mealBlocks.map((b) => b.title);
		}
		return customDaySubdivisions.map((s) => s.name);
	});

	function fabClick() {
		registerFoodOpen = true;
	}

	function handleFoodRegistered(comp: any) {
		registerFoodOpen = false;
		registeredFood = comp;
		postRegisterSheetOpen = true;
	}

	async function addRegisteredComponentToSubdivision(targetSubName: string) {
		if (!registeredFood) return;
		const comp = registeredFood;
		const payloadComp = {
			productBarcode: comp.productBarcode ?? null,
			genericFoodId: comp.genericFoodId ?? null,
			customName: comp.customName ?? null,
			displayName: comp.displayName,
			imageUrl: comp.imageUrl ?? null,
			amount: comp.amount || 1,
			unit: comp.unit || 'portion',
			gramsPerPiece: comp.gramsPerPiece ?? 100,
			kcalPer100: comp.kcalPer100 ?? null,
			proteinPer100: comp.proteinPer100 ?? null,
			fatPer100: comp.fatPer100 ?? null,
			carbsPer100: comp.carbsPer100 ?? null,
			sugarPer100: comp.sugarPer100 ?? null,
			fiberPer100: comp.fiberPer100 ?? null,
			saltPer100: comp.saltPer100 ?? null,
			micros: comp.micros ?? null
		};

		const existingMeal = meals.find((m) => m.name.trim().toLowerCase() === targetSubName.trim().toLowerCase());
		let saved: Promise<Response>;
		if (existingMeal) {
			const cleanExisting = existingMeal.components.map((c) => ({
				productBarcode: c.productBarcode ?? null,
				genericFoodId: c.genericFoodId ?? null,
				customName: c.customName ?? null,
				displayName: c.displayName,
				imageUrl: c.imageUrl ?? null,
				amount: c.amount,
				unit: c.unit,
				gramsPerPiece: c.gramsPerPiece ?? null,
				kcalPer100: c.kcalPer100 ?? null,
				proteinPer100: c.proteinPer100 ?? null,
				fatPer100: c.fatPer100 ?? null,
				carbsPer100: c.carbsPer100 ?? null,
				sugarPer100: c.sugarPer100 ?? null,
				fiberPer100: c.fiberPer100 ?? null,
				saltPer100: c.saltPer100 ?? null,
				micros: c.micros ?? null
			}));
			saved = fetch(`/api/nutrition/meals/${existingMeal.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					components: [...cleanExisting, payloadComp]
				})
			});
		} else {
			const now = new Date();
			const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
			saved = fetch('/api/nutrition/meals', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: targetSubName,
					date: dateStr,
					time,
					components: [payloadComp]
				})
			});
		}
		// On failure the sheet stays open so the food is not lost.
		if (!(await saved.then((res) => res.ok, () => false))) {
			alert(t.nutrition_save_error);
			return;
		}
		postRegisterSheetOpen = false;
		registeredFood = null;
		await load();
	}
</script>

<div class="tracker-workspace with-date"
	style:--tracker-header-height={headerHeight > 0 ? `${headerHeight}px` : undefined}>
	<div use:measureHeight={(height) => headerHeight = height} class="tracker-header-overlay">
		<TrackerHeader title={t.nutrition_label} onMenuOpen={() => (menuOpen = true)} activeSection="home">
			{#snippet actions()}
				<button
					onclick={() => goto('/tracker/nutrition/favorites')}
					class="h-9 flex-shrink-0 px-1 flex items-center justify-center text-xs font-semibold active:opacity-60 transition-opacity"
					style="color: var(--color-on-surface-variant)"
					aria-label={t.nutrition_favorites_manage}
				>
					{t.nutrition_favorites_label}
				</button>
			{/snippet}
		</TrackerHeader>
		<TrackerDateNav onPrevious={() => shiftDate(-1)} onNext={() => shiftDate(1)}
			previousLabel={t.nutrition_prev_day} nextLabel={t.nutrition_next_day} nextDisabled={isToday}>
				<div style="position: relative; display: inline-block">
					<span class="text-sm font-semibold select-none" style="color: var(--color-on-surface); pointer-events: none">{formatDate(dateStr)}</span>
					<input type="date" bind:value={dateStr} max={todayStr}
					       style="position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0.001; cursor: pointer; border: none; padding: 0; background: transparent"
					       aria-label={t.nutrition_pick_date} />
				</div>
				{#if !isToday}
					<button onclick={() => (dateStr = todayStr)} class="block mx-auto text-xs leading-none underline mt-0.5" style="color: #FB923C">
						{t.nutrition_jump_today}
					</button>
				{/if}
		</TrackerDateNav>
	</div>

	<main class="absolute inset-0 overflow-y-auto px-4 pb-32" style="padding-top: var(--tracker-header-height); overscroll-behavior: none;">

		<AppPrompts bind:installPrompt />

		{#if userSettings.greetingEnabled && isToday && data?.user}
			{@const hour = new Date().getHours()}
			<p class="pt-3 pb-1 text-xl font-light leading-tight" style="color: var(--color-on-surface)">
				{hour < 12 ? t.greeting_morning : hour < 18 ? t.greeting_day : hour < 22 ? t.greeting_evening : t.greeting_night}, {data.user.username}
			</p>
		{/if}

		<!-- Tagesbilanz -->
		<section class="nutrition-summary">
			<div class="nutrition-summary-head">
				<div class="min-w-0">
					<div class="nutrition-kcal-value">
						{fmtKcal(totals.kcal)} <span>kcal</span>
					</div>
					{#if goalKcal}
						<p class="nutrition-goal-copy">{nutrition_of_goal(`${fmtKcal(goalKcal)} kcal`)}</p>
					{:else}
						<p class="nutrition-goal-copy">{t.nutrition_no_goal_set}</p>
					{/if}
				</div>
				<div class="nutrition-summary-actions">
					{#if kcalStatus}<span class="nutrition-kcal-status" data-over={totals.kcal > (goalKcal ?? 0)}>{kcalStatus}</span>{/if}
					<button onclick={() => (goalSheetOpen = true)}>{t.nutrition_goals_button}</button>
				</div>
			</div>
			{#if goalKcal}
				<div class="nutrition-kcal-track">
					<div style="width: {percentKcal()}%; background-color: {totals.kcal > goalKcal ? 'var(--color-error)' : '#FB923C'}"></div>
				</div>
			{/if}
			{#if !goalKcal && !goalProtein && !goalFat && !goalCarbs && !goalFiber}
				<button onclick={() => (goalSheetOpen = true)}
				        class="nutrition-empty-goal-action">
					+ {t.nutrition_set_goal_cta}
				</button>
			{:else}
				<NutritionMacroStrip items={macroItems} />
			{/if}

			{#if dailyFats.length > 0}
				<div class="nutrition-daily-fats-wrap">
					<button
						type="button"
						class="nutrition-daily-fats-toggle"
						onclick={() => (showDailyFatsBreakdown = !showDailyFatsBreakdown)}
						aria-expanded={showDailyFatsBreakdown}
					>
						<span class="flex items-center gap-1.5 font-medium">
							<svg class="w-3 h-3 transition-transform duration-200" style="transform: rotate({showDailyFatsBreakdown ? '90' : '0'}deg)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="9 18 15 12 9 6"></polyline>
							</svg>
							<span>Daily fats:</span>
						</span>
						<div class="flex items-center gap-2">
							{#each dailyFats as f}
								<span class="text-[11px] font-semibold" style="color: {f.color}">
									{f.shortLabel} {fmtG(f.grams)}g
								</span>
							{/each}
						</div>
					</button>

					{#if showDailyFatsBreakdown}
						<div class="nutrition-daily-fats-grid">
							{#each dailyFats as f}
								<div class="nutrition-daily-fat-item">
									<span class="fat-name" style="color: {f.color}">{f.label}</span>
									<strong class="fat-val">{fmtG(f.grams)} g</strong>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Collapsible Micronutrients Section -->
			<div class="nutrition-micros-section">
				<button
					type="button"
					class="nutrition-micros-toggle"
					onclick={() => (showMicronutrients = !showMicronutrients)}
					aria-expanded={showMicronutrients}
				>
					<span class="flex items-center gap-1.5 font-medium">
						<svg class="w-3.5 h-3.5 transition-transform duration-200" style="transform: rotate({showMicronutrients ? '90' : '0'}deg)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="9 18 15 12 9 6"></polyline>
						</svg>
						<span>{t.nutrition_micronutrients}</span>
					</span>
					<span class="text-[11px] opacity-75 font-normal">
						{showMicronutrients ? t.nutrition_micronutrients_hide : t.nutrition_micronutrients_show}
					</span>
				</button>
				{#if showMicronutrients}
					<div class="nutrition-micros-content">
						<!-- Resumen rápido de fibra, azúcar y sal -->
						<div class="nutrition-micros-grid">
							<div class="nutrition-micro-chip">
								<span class="nutrition-micro-name">{t.nutrition_fiber}</span>
								<span class="nutrition-micro-val">{fmtG(totals.fiber)} <small>g</small></span>
							</div>
							<div class="nutrition-micro-chip">
								<span class="nutrition-micro-name">{t.nutrition_sugar}</span>
								<span class="nutrition-micro-val">{fmtG(totals.sugar)} <small>g</small></span>
							</div>
							<div class="nutrition-micro-chip">
								<span class="nutrition-micro-name">{t.nutrition_salt}</span>
								<span class="nutrition-micro-val">{fmtG(totals.salt)} <small>g</small></span>
							</div>
							<div class="nutrition-micro-chip">
								<span class="nutrition-micro-name">{t.nutrition_sodium}</span>
								<span class="nutrition-micro-val">{Math.round((totals.micros.sodiumMg ?? (totals.salt * 400)))} <small>mg</small></span>
							</div>
						</div>

						<!-- Key Minerals & Electrolytes -->
						<div class="nutrition-micro-group">
							<div class="nutrition-micro-group-title">
								<span class="group-dot" style="background-color: #10B981"></span>
								<span>Key Minerals & Electrolytes</span>
							</div>
							<div class="nutrition-micro-list">
								{#each MINERALS_META as meta (meta.key)}
									{@const val = totals.micros[meta.key] ?? 0}
									{@const rda = getMicroRda(meta.key, meta.defaultRda)}
									{@const pct = computeRdaPercent(val, rda)}
									{@const isOverLimit = meta.isMaxLimit && val > rda}
									<div class="nutrition-micro-row">
										<div class="nutrition-micro-row-top">
											<div class="flex items-center gap-1.5 min-w-0">
												<span class="nutrition-micro-badge" style="color: {meta.color}; background-color: color-mix(in srgb, {meta.color} 15%, transparent)">
													{meta.shortLabel}
												</span>
												<span class="nutrition-micro-label truncate">{meta.label}</span>
											</div>
											<div class="flex items-center gap-1.5 shrink-0 text-right">
												<span class="nutrition-micro-numbers">
													<strong>{formatMicroValue(val, meta.unit)}</strong>
													<small>/ {formatMicroValue(rda, meta.unit)}</small>
												</span>
												<span
													class="nutrition-micro-pct-badge"
													class:over={isOverLimit}
													class:complete={pct >= 100 && !meta.isMaxLimit}
													style="--micro-accent: {meta.color}"
												>
													{pct}%
												</span>
											</div>
										</div>
										<div class="nutrition-micro-bar-track">
											<div
												class="nutrition-micro-bar-fill"
												class:over={isOverLimit}
												style="width: {Math.min(100, pct)}%; background-color: {isOverLimit ? 'var(--color-error, #EF4444)' : meta.color}"
											></div>
										</div>
									</div>
								{/each}
							</div>
						</div>

						<!-- Essential Vitamins -->
						<div class="nutrition-micro-group">
							<div class="nutrition-micro-group-title">
								<span class="group-dot" style="background-color: #FB923C"></span>
								<span>Essential Vitamins</span>
							</div>
							<div class="nutrition-micro-list">
								{#each VITAMINS_META as meta (meta.key)}
									{@const val = totals.micros[meta.key] ?? 0}
									{@const rda = getMicroRda(meta.key, meta.defaultRda)}
									{@const pct = computeRdaPercent(val, rda)}
									<div class="nutrition-micro-row">
										<div class="nutrition-micro-row-top">
											<div class="flex items-center gap-1.5 min-w-0">
												<span class="nutrition-micro-badge" style="color: {meta.color}; background-color: color-mix(in srgb, {meta.color} 15%, transparent)">
													{meta.shortLabel}
												</span>
												<span class="nutrition-micro-label truncate">{meta.label}</span>
											</div>
											<div class="flex items-center gap-1.5 shrink-0 text-right">
												<span class="nutrition-micro-numbers">
													<strong>{formatMicroValue(val, meta.unit)}</strong>
													<small>/ {formatMicroValue(rda, meta.unit)}</small>
												</span>
												<span
													class="nutrition-micro-pct-badge"
													class:complete={pct >= 100}
													style="--micro-accent: {meta.color}"
												>
													{pct}%
												</span>
											</div>
										</div>
										<div class="nutrition-micro-bar-track">
											<div
												class="nutrition-micro-bar-fill"
												style="width: {Math.min(100, pct)}%; background-color: {meta.color}"
											></div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					</div>
				{/if}
			</div>
		</section>

		<!-- Mahlzeiten (Subdivisiones por comida o Modo Simplificado) -->
		{#if loading}
			<div class="flex justify-center py-12">
				<div class="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
				     style="border-color: var(--color-primary); border-top-color: transparent"></div>
			</div>
		{:else if loadError}
			<div class="flex flex-col items-center gap-3 py-12 text-center" role="alert">
				<p class="text-sm" style="color: var(--color-on-surface-variant)">{t.nutrition_load_error}</p>
				<button type="button" onclick={load} class="text-sm font-semibold underline" style="color: #FB923C">{t.offline_retry}</button>
			</div>
		{:else if userSettings.nutritionMealSubdivisionsEnabled}
			<div class="space-y-3.5 pb-6" aria-label={t.nutrition_meals_section}>
				{#each mealBlocks as block (block.key)}
					{@const blockMeals = meals.filter((m) => getMealBlock(m) === block.key)}
					{@const bTotals = getBlockTotals(blockMeals)}
					<section class="nutrition-meal-block" aria-label={block.title}>
						<div class="nutrition-block-header">
							<div class="nutrition-block-title-row">
								<div class="flex items-center gap-2 min-w-0">
									<span class="nutrition-block-icon">{block.icon}</span>
									<h2 class="nutrition-block-title">{block.title}</h2>
								</div>
								<div class="flex items-center gap-2 shrink-0">
									<span class="nutrition-block-kcal tabular-nums">{fmtKcal(bTotals.kcal)} kcal</span>
									<button
										type="button"
										class="nutrition-block-copy-btn"
										onclick={() => copyFromYesterday(block.key, block.title)}
										disabled={copyingBlock === block.key}
										title={t.nutrition_copy_from_yesterday}
										aria-label="{t.nutrition_copy_from_yesterday} ({block.title})"
									>
										{#if copyingBlock === block.key}
											<span class="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></span>
										{:else if copiedBlock === block.key}
											<span class="text-[11px] font-bold" style="color: #10B981">✓ {t.nutrition_copied_from_yesterday}</span>
										{:else}
											<svg class="w-3.5 h-3.5 inline mr-1 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
												<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
											</svg>
											<span>{t.nutrition_copy_from_yesterday}</span>
										{/if}
									</button>
								</div>
							</div>
							<div class="nutrition-block-macros">
								{t.nutrition_protein.charAt(0)} {fmtG(bTotals.protein)} g · {t.nutrition_fat.charAt(0)} {fmtG(bTotals.fat)} g · {t.nutrition_carbs.charAt(0)} {fmtG(bTotals.carbs)} g
							</div>
						</div>

						{#if blockMeals.length > 0}
							<div class="nutrition-block-entries">
								{#each blockMeals as m (m.id)}
									{@const mealKcal = m.components.reduce((s, c) => s + (c.kcal ?? 0), 0)}
									{@const mealP = m.components.reduce((s, c) => s + (c.protein ?? 0), 0)}
									{@const mealF = m.components.reduce((s, c) => s + (c.fat ?? 0), 0)}
									{@const mealC = m.components.reduce((s, c) => s + (c.carbs ?? 0), 0)}
									{@const singleImg = !m.favoriteName && m.components.length === 1 ? m.components[0].imageUrl : null}
									<button type="button" class="nutrition-meal-entry" onclick={() => openEditMeal(m)}>
										<span class="nutrition-meal-time">{m.time}</span>
										<span class="nutrition-meal-content">
											{#if m.name !== block.title || blockMeals.length > 1}
												<span class="nutrition-meal-heading">
													<span>{m.name}</span>
													<strong>{fmtKcal(mealKcal)} kcal</strong>
												</span>
												<span class="nutrition-meal-macros">
													{t.nutrition_protein.charAt(0)} {fmtG(mealP)} g · {t.nutrition_fat.charAt(0)} {fmtG(mealF)} g · {t.nutrition_carbs.charAt(0)} {fmtG(mealC)} g
												</span>
											{/if}
											{#if m.favoriteName}
												<span class="nutrition-meal-favorite">
													{#if m.imageUrl}
														<img src={m.imageUrl} alt="" />
												{/if}
													<span>{m.favoriteName}</span>
												</span>
											{/if}
											{#if singleImg}
												<span class="nutrition-component-row nutrition-component-row-image">
													<img src={singleImg} alt="" />
													<span>
														{m.components[0].displayName}
														{#if m.components[0].unit === 'portion'}
															{@const totalGrams = Math.round(m.components[0].amount * (m.components[0].gramsPerPiece ?? 0))}
															{@const showGrams = totalGrams > 0 && !(m.components[0].customName && m.components[0].gramsPerPiece === 100)}
															<small>· {m.components[0].amount} {m.components[0].amount === 1 ? t.nutrition_unit_portion : t.nutrition_unit_portions}{showGrams ? ` (${totalGrams} g)` : ''}</small>
														{:else if m.components[0].unit === 'piece'}
															<small>· {m.components[0].amount} {t.nutrition_unit_short_piece}</small>
														{:else}
															<small>· {m.components[0].amount} {m.components[0].unit}</small>
														{/if}
													</span>
													<strong>{fmtKcal(m.components[0].kcal)} kcal</strong>
												</span>
											{:else if m.components.length > 0}
												<span class="nutrition-component-list">
													{#each m.components as c (c.id)}
														<span class="nutrition-component-row">
															<span>
																{c.displayName}
																{#if c.unit === 'portion'}
																	{@const totalGrams = Math.round(c.amount * (c.gramsPerPiece ?? 0))}
																	{@const showGrams = totalGrams > 0 && !(c.customName && c.gramsPerPiece === 100)}
																	<small>· {c.amount} {c.amount === 1 ? t.nutrition_unit_portion : t.nutrition_unit_portions}{showGrams ? ` (${totalGrams} g)` : ''}</small>
																{:else if c.unit === 'piece'}
																	<small>· {c.amount} {t.nutrition_unit_short_piece}</small>
																{:else}
																	<small>· {c.amount} {c.unit}</small>
																{/if}
															</span>
															<strong>{fmtKcal(c.kcal)} kcal</strong>
														</span>
													{/each}
												</span>
											{/if}
										</span>
									</button>
								{/each}
							</div>
						{:else}
							<div class="nutrition-block-empty">
								<p>{t.nutrition_meal_empty}</p>
							</div>
						{/if}

						<button
							type="button"
							class="nutrition-block-add-btn"
							onclick={() => openMealForBlock(block.key, block.title)}
						>
							+ {t.nutrition_add_meal}
						</button>
					</section>
				{/each}
			</div>
		{:else}
			<!-- Custom dynamic subdivisions mode -->
			<div class="space-y-3.5 pb-6" aria-label={t.nutrition_meals_section}>
				{#each customDaySubdivisions as sub (sub.id)}
					{@const subMeals = getSubdivisionMeals(sub)}
					{@const subTotals = getSubdivisionTotals(subMeals)}
					<section class="nutrition-meal-block" aria-label={sub.name}>
						<div class="nutrition-block-header">
							<div class="nutrition-block-title-row">
								<div class="flex items-center gap-2 min-w-0">
									<span class="nutrition-block-icon">🍽️</span>
									<button
										type="button"
										class="nutrition-block-title-btn"
										onclick={() => startRenameSubdivision(sub)}
										title="Toca para renombrar"
										aria-label="Renombrar {sub.name}"
									>
										<h2 class="nutrition-block-title">{sub.name}</h2>
										<svg class="w-3.5 h-3.5 opacity-40 hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<path d="M12 20h9"></path>
											<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
										</svg>
									</button>
								</div>
								<div class="flex items-center gap-2 shrink-0">
									<span class="nutrition-block-kcal tabular-nums">{fmtKcal(subTotals.kcal)} kcal</span>
									{#if customDaySubdivisions.length > 1}
										<button
											type="button"
											class="nutrition-subdivision-delete-btn"
											onclick={() => deleteSubdivision(sub)}
											title="Delete subdivision"
											aria-label="Delete {sub.name}"
										>
											<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
												<polyline points="3 6 5 6 21 6"></polyline>
												<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
												<line x1="10" y1="11" x2="10" y2="17"></line>
												<line x1="14" y1="11" x2="14" y2="17"></line>
											</svg>
										</button>
									{/if}
								</div>
							</div>
							<div class="nutrition-block-macros">
								{t.nutrition_protein.charAt(0)} {fmtG(subTotals.protein)} g · {t.nutrition_fat.charAt(0)} {fmtG(subTotals.fat)} g · {t.nutrition_carbs.charAt(0)} {fmtG(subTotals.carbs)} g
							</div>
						</div>

						{#if subMeals.length > 0}
							<div class="nutrition-block-entries">
								{#each subMeals as m (m.id)}
									{@const mealKcal = m.components.reduce((s, c) => s + (c.kcal ?? 0), 0)}
									{@const mealP = m.components.reduce((s, c) => s + (c.protein ?? 0), 0)}
									{@const mealF = m.components.reduce((s, c) => s + (c.fat ?? 0), 0)}
									{@const mealC = m.components.reduce((s, c) => s + (c.carbs ?? 0), 0)}
									{@const singleImg = !m.favoriteName && m.components.length === 1 ? m.components[0].imageUrl : null}
									<button type="button" class="nutrition-meal-entry" onclick={() => openEditMeal(m)}>
										<span class="nutrition-meal-time">{m.time}</span>
										<span class="nutrition-meal-content">
											{#if m.name !== sub.name || subMeals.length > 1}
												<span class="nutrition-meal-heading">
													<span>{m.name}</span>
													<strong>{fmtKcal(mealKcal)} kcal</strong>
												</span>
												<span class="nutrition-meal-macros">
													{t.nutrition_protein.charAt(0)} {fmtG(mealP)} g · {t.nutrition_fat.charAt(0)} {fmtG(mealF)} g · {t.nutrition_carbs.charAt(0)} {fmtG(mealC)} g
												</span>
											{/if}
											{#if m.favoriteName}
												<span class="nutrition-meal-favorite">
													{#if m.imageUrl}
														<img src={m.imageUrl} alt="" />
													{/if}
													<span>{m.favoriteName}</span>
												</span>
											{/if}
											{#if singleImg}
												<span class="nutrition-component-row nutrition-component-row-image">
													<img src={singleImg} alt="" />
													<span>
														{m.components[0].displayName}
														{#if m.components[0].unit === 'portion'}
															{@const totalGrams = Math.round(m.components[0].amount * (m.components[0].gramsPerPiece ?? 0))}
															{@const showGrams = totalGrams > 0 && !(m.components[0].customName && m.components[0].gramsPerPiece === 100)}
															<small>· {m.components[0].amount} {m.components[0].amount === 1 ? t.nutrition_unit_portion : t.nutrition_unit_portions}{showGrams ? ` (${totalGrams} g)` : ''}</small>
														{:else if m.components[0].unit === 'piece'}
															<small>· {m.components[0].amount} {t.nutrition_unit_short_piece}</small>
														{:else}
															<small>· {m.components[0].amount} {m.components[0].unit}</small>
														{/if}
													</span>
													<strong>{fmtKcal(m.components[0].kcal)} kcal</strong>
												</span>
											{:else if m.components.length > 0}
												<span class="nutrition-component-list">
													{#each m.components as c (c.id)}
														<span class="nutrition-component-row">
															<span>
																{c.displayName}
																{#if c.unit === 'portion'}
																	{@const totalGrams = Math.round(c.amount * (c.gramsPerPiece ?? 0))}
																	{@const showGrams = totalGrams > 0 && !(c.customName && c.gramsPerPiece === 100)}
																	<small>· {c.amount} {c.amount === 1 ? t.nutrition_unit_portion : t.nutrition_unit_portions}{showGrams ? ` (${totalGrams} g)` : ''}</small>
																{:else if c.unit === 'piece'}
																	<small>· {c.amount} {t.nutrition_unit_short_piece}</small>
																{:else}
																	<small>· {c.amount} {c.unit}</small>
																{/if}
															</span>
															<strong>{fmtKcal(c.kcal)} kcal</strong>
														</span>
													{/each}
												</span>
											{/if}
										</span>
									</button>
								{/each}
							</div>
						{:else}
							<div class="nutrition-block-empty">
								<p>{t.nutrition_meal_empty}</p>
							</div>
						{/if}

						<button
							type="button"
							class="nutrition-block-add-btn"
							onclick={() => openMealForSubdivision(sub)}
						>
							+ {t.nutrition_add_meal}
						</button>
					</section>
				{/each}

				<div class="pt-1 pb-4">
					<button
						type="button"
						class="nutrition-add-subdivision-action-btn"
						onclick={addNewSubdivision}
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<line x1="12" y1="5" x2="12" y2="19"></line>
							<line x1="5" y1="12" x2="19" y2="12"></line>
						</svg>
						<span>+ Add subdivision (Meal {nextSubdivisionNumber})</span>
					</button>
				</div>
			</div>
		{/if}

		<DailyLogSection bind:this={dailyLog} date={dateStr} userId={data?.user?.id ?? null}
			nutritionTotalKcal={totals.kcal} nutritionGoalKcal={goalKcal} onaddmeal={fabClick} />
	</main>
</div>

<HamburgerMenu bind:open={menuOpen} user={data?.user ?? null} {installPrompt} />

<AppBottomNav activeTab="home" onFabTap={() => dailyLog?.openQuickLog()} fabLabel={t.add} />

{#if renamingSub}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onclick={() => (renamingSub = null)}>
		<div class="w-full max-w-sm rounded-2xl p-5 shadow-2xl border" style="background: var(--modal-bg, #1a1516); border-color: var(--bubble-container-border, rgba(255,255,255,0.1))" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-base font-bold text-white mb-1">Rename subdivision</h3>
			<p class="text-xs mb-3" style="color: var(--color-on-surface-variant)">Give this meal a descriptive name</p>
			<input
				type="text"
				bind:value={renameValue}
				placeholder="e.g. Meal {renamingSub.number} or Pre-workout"
				class="w-full h-11 px-3.5 rounded-xl text-sm border outline-none font-medium mb-4"
				style="background: var(--color-surface-container, rgba(255,255,255,0.06)); border-color: var(--bubble-container-border, rgba(255,255,255,0.12)); color: var(--color-on-surface, #ffffff);"
				onkeydown={(e) => { if (e.key === 'Enter') void confirmRename(); else if (e.key === 'Escape') renamingSub = null; }}
			/>
			<div class="flex items-center justify-end gap-2.5">
				<button
					type="button"
					class="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
					style="color: var(--color-on-surface-variant)"
					onclick={() => (renamingSub = null)}
				>
					{t.nutrition_cancel}
				</button>
				<button
					type="button"
					class="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition-transform cursor-pointer"
					style="background: #E50914"
					onclick={() => void confirmRename()}
				>
					{t.nutrition_save}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if editSheetOpen && editingMeal}
	<MealEditSheet
		meal={editingMeal}
		ondelete={editingMeal.id ? async () => { if (editingMeal && await deleteMeal(editingMeal.id)) { editSheetOpen = false; editingMeal = null; } } : null}
		onclose={() => { editSheetOpen = false; editingMeal = null; }}
		onsaved={() => { editSheetOpen = false; editingMeal = null; void load(); }}
	/>
{/if}

<style>
	.nutrition-summary,
	.nutrition-meal-block {
		overflow: hidden;
		border: 1px solid var(--bubble-container-border);
		border-radius: 20px;
		background: var(--bubble-container-bg);
	}

	.nutrition-block-header {
		padding: 12px 14px 10px;
		border-bottom: 1px solid var(--bubble-container-border);
		background: color-mix(in srgb, var(--color-surface-container) 45%, transparent);
	}

	.nutrition-block-title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.nutrition-block-icon {
		font-size: 18px;
		line-height: 1;
	}

	.nutrition-block-title {
		font-size: 15px;
		font-weight: 700;
		color: var(--color-on-surface);
		margin: 0;
	}

	.nutrition-block-title-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: transparent;
		text-align: left;
		cursor: pointer;
		padding: 0;
		border: 0;
	}
	.nutrition-block-title-btn:hover .nutrition-block-title {
		text-decoration: underline;
		text-decoration-style: dotted;
	}

	.nutrition-subdivision-delete-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: 8px;
		color: var(--color-on-surface-variant);
		transition: all 0.15s ease;
		background: transparent;
		cursor: pointer;
	}
	.nutrition-subdivision-delete-btn:hover {
		color: #EF233C;
		background: rgba(239, 35, 60, 0.12);
	}

	.nutrition-add-subdivision-action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		min-height: 48px;
		border-radius: 16px;
		border: 1.5px dashed var(--bubble-container-border);
		background: var(--bubble-container-bg);
		color: #EF233C;
		font-size: 13px;
		font-weight: 700;
		transition: all 0.15s ease;
		cursor: pointer;
	}
	.nutrition-add-subdivision-action-btn:hover,
	.nutrition-add-subdivision-action-btn:active {
		border-color: #EF233C;
		background: rgba(239, 35, 60, 0.08);
	}

	.nutrition-block-kcal {
		font-size: 14px;
		font-weight: 700;
		color: var(--color-primary, #EF233C);
	}

	.nutrition-block-macros {
		margin-top: 4px;
		font-size: 11px;
		color: var(--color-on-surface-variant);
		font-variant-numeric: tabular-nums;
		line-height: 1.2;
	}

	.nutrition-block-copy-btn {
		display: inline-flex;
		align-items: center;
		padding: 4px 8px;
		border-radius: 8px;
		border: 1px solid var(--bubble-container-border);
		background: var(--color-surface-container);
		color: var(--color-on-surface-variant);
		font-size: 11px;
		font-weight: 550;
		line-height: 1;
		transition: all 140ms ease;
		white-space: nowrap;
		cursor: pointer;
	}

	.nutrition-block-copy-btn:active:not(:disabled) {
		background: color-mix(in srgb, #FB923C 15%, transparent);
		color: #FB923C;
	}

	.nutrition-block-copy-btn:disabled {
		opacity: 0.6;
	}

	.nutrition-block-entries {
		display: flex;
		flex-direction: column;
	}

	.nutrition-block-empty {
		padding: 16px 14px;
		text-align: center;
	}

	.nutrition-block-empty p {
		font-size: 12px;
		color: var(--color-on-surface-variant);
		opacity: 0.7;
		margin: 0;
	}

	.nutrition-block-add-btn {
		width: 100%;
		padding: 10px;
		border-top: 1px solid var(--bubble-container-border);
		background: transparent;
		color: #FB923C;
		font-size: 12px;
		font-weight: 650;
		text-align: center;
		transition: background-color 140ms ease;
		cursor: pointer;
	}

	.nutrition-block-add-btn:active {
		background: color-mix(in srgb, #FB923C 8%, transparent);
	}

	.nutrition-summary { margin-bottom: 14px; padding: 14px 15px 15px; }

	.nutrition-summary-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 11px;
	}

	.nutrition-kcal-value {
		color: var(--color-on-surface);
		font-size: 26px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.025em;
		line-height: 1;
	}

	.nutrition-kcal-value span { color: var(--color-on-surface-variant); font-size: 14px; font-weight: 500; letter-spacing: 0; }
	.nutrition-goal-copy { margin-top: 5px; color: var(--color-on-surface-variant); font-size: 11px; line-height: 1.2; }

	.nutrition-summary-actions { display: grid; justify-items: end; gap: 5px; }
	.nutrition-summary-actions button { min-height: 32px; padding-inline: 10px; border-radius: 10px; color: #FB923C; font-size: 12px; font-weight: 650; }
	.nutrition-summary-actions button:active { background: color-mix(in srgb, #FB923C 9%, transparent); }
	.nutrition-kcal-status { max-width: 145px; overflow: hidden; color: #FB923C; font-size: 10px; font-weight: 600; line-height: 1.15; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
	.nutrition-kcal-status[data-over='true'] { color: var(--color-error); }

	.nutrition-kcal-track { height: 3px; margin-bottom: 13px; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, var(--color-on-surface) 9%, transparent); }
	.nutrition-kcal-track div { height: 100%; border-radius: inherit; transition: width 180ms cubic-bezier(0.2, 0.8, 0.2, 1); }

	.nutrition-empty-goal-action { width: 100%; min-height: 40px; border-radius: 10px; background: var(--bubble-interactive-bg); color: #FB923C; font-size: 13px; font-weight: 650; }

	.nutrition-micros-section {
		margin-top: 12px;
		padding-top: 10px;
		border-top: 1px solid color-mix(in srgb, var(--bubble-container-border) 60%, transparent);
	}
	.nutrition-daily-fats-wrap {
		margin-top: 6px;
		border-radius: 10px;
		background: color-mix(in srgb, var(--color-surface-container) 70%, transparent);
		border: 1px dashed var(--bubble-container-border);
		overflow: hidden;
	}
	.nutrition-daily-fats-toggle {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 10px;
		background: transparent;
		border: none;
		cursor: pointer;
		font-size: 11px;
		color: var(--color-on-surface-variant);
	}
	.nutrition-daily-fats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
		gap: 6px;
		padding: 6px 10px 8px;
		border-top: 1px solid var(--bubble-container-border);
	}
	.nutrition-daily-fat-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 5px 8px;
		border-radius: 8px;
		background: var(--color-surface);
		border: 1px solid var(--bubble-container-border);
	}
	.nutrition-daily-fat-item .fat-name {
		font-size: 10.5px;
		font-weight: 650;
	}
	.nutrition-daily-fat-item .fat-val {
		font-size: 12px;
		font-weight: 700;
		color: var(--color-on-surface);
	}

	.nutrition-micros-toggle {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 12px;
		color: var(--color-on-surface-variant);
		background: transparent;
		cursor: pointer;
		padding: 2px 0;
		transition: color 140ms ease;
	}

	.nutrition-micros-toggle:active {
		color: #FB923C;
	}

	.nutrition-micros-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
		margin-top: 10px;
	}

	.nutrition-micro-chip {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px 10px;
		border-radius: 12px;
		background: color-mix(in srgb, var(--color-surface-container) 60%, transparent);
		border: 1px solid var(--bubble-container-border);
	}

	.nutrition-micro-name {
		font-size: 10px;
		font-weight: 550;
		color: var(--color-on-surface-variant);
	}

	.nutrition-micro-val {
		font-size: 14px;
		font-weight: 700;
		color: var(--color-on-surface);
		font-variant-numeric: tabular-nums;
	}

	.nutrition-micro-val small {
		font-size: 10px;
		font-weight: 500;
		color: var(--color-on-surface-variant);
	}

	.nutrition-micros-content {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-top: 10px;
	}

	.nutrition-micro-group {
		border-radius: 14px;
		background: color-mix(in srgb, var(--color-surface-container) 45%, transparent);
		border: 1px solid var(--bubble-container-border);
		padding: 10px 12px;
	}

	.nutrition-micro-group-title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-on-surface);
		margin-bottom: 8px;
	}

	.group-dot {
		width: 6px;
		height: 6px;
		border-radius: 999px;
	}

	.nutrition-micro-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.nutrition-micro-row {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding-bottom: 6px;
		border-bottom: 1px solid color-mix(in srgb, var(--bubble-container-border) 40%, transparent);
	}

	.nutrition-micro-row:last-child {
		padding-bottom: 0;
		border-bottom: none;
	}

	.nutrition-micro-row-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.nutrition-micro-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 2px 5px;
		border-radius: 6px;
		font-size: 10px;
		font-weight: 700;
		font-family: monospace;
		line-height: 1;
		min-width: 22px;
	}

	.nutrition-micro-label {
		font-size: 12px;
		font-weight: 550;
		color: var(--color-on-surface);
	}

	.nutrition-micro-numbers {
		font-size: 11px;
		color: var(--color-on-surface);
		font-variant-numeric: tabular-nums;
	}

	.nutrition-micro-numbers strong {
		font-weight: 650;
	}

	.nutrition-micro-numbers small {
		font-size: 10px;
		color: var(--color-on-surface-variant);
		opacity: 0.8;
	}

	.nutrition-micro-pct-badge {
		display: inline-block;
		font-size: 10px;
		font-weight: 700;
		padding: 2px 5px;
		border-radius: 6px;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		background: color-mix(in srgb, var(--micro-accent, #9CA3AF) 15%, transparent);
		color: var(--micro-accent, #9CA3AF);
		min-width: 32px;
		text-align: center;
	}

	.nutrition-micro-pct-badge.complete {
		background: color-mix(in srgb, #10B981 18%, transparent);
		color: #10B981;
	}

	.nutrition-micro-pct-badge.over {
		background: color-mix(in srgb, var(--color-error, #EF4444) 18%, transparent);
		color: var(--color-error, #EF4444);
	}

	.nutrition-micro-bar-track {
		width: 100%;
		height: 4px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-surface-container-highest, #E5E7EB) 30%, transparent);
		overflow: hidden;
	}

	.nutrition-micro-bar-fill {
		height: 100%;
		border-radius: 999px;
		transition: width 240ms ease;
	}

	.nutrition-meal-entry { display: grid; grid-template-columns: 48px minmax(0, 1fr); min-height: 64px; padding: 12px 12px 12px 11px; text-align: left; touch-action: manipulation; }
	.nutrition-meal-entry + .nutrition-meal-entry { border-top: 1px solid var(--bubble-container-border); }
	.nutrition-meal-entry:active { background: color-mix(in srgb, #FB923C 5%, transparent); }

	.nutrition-meal-time { padding-top: 2px; color: var(--color-on-surface-variant); font-size: 11px; font-variant-numeric: tabular-nums; }
	.nutrition-meal-content { display: grid; min-width: 0; gap: 4px; }
	.nutrition-meal-heading { display: flex; min-width: 0; align-items: baseline; gap: 8px; }
	.nutrition-meal-heading > span { overflow: hidden; min-width: 0; flex: 1; color: var(--color-on-surface); font-size: 14px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
	.nutrition-meal-heading strong { flex: none; color: #FB923C; font-size: 13px; font-weight: 650; font-variant-numeric: tabular-nums; }
	.nutrition-meal-macros { color: var(--color-on-surface-variant); font-size: 10px; font-variant-numeric: tabular-nums; line-height: 1.2; }

	.nutrition-meal-favorite { display: flex; min-width: 0; align-items: center; gap: 7px; margin-top: 3px; color: var(--color-on-surface); font-size: 12px; font-weight: 600; }
	.nutrition-meal-favorite img { width: 24px; height: 24px; flex: none; border-radius: 7px; object-fit: cover; }
	.nutrition-meal-favorite span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

	.nutrition-component-list { display: grid; gap: 3px; margin-top: 3px; }
	.nutrition-component-row { display: flex; min-width: 0; align-items: baseline; gap: 8px; color: var(--color-on-surface-variant); font-size: 11px; line-height: 1.2; }
	.nutrition-component-row > span { overflow: hidden; min-width: 0; flex: 1; text-overflow: ellipsis; white-space: nowrap; }
	.nutrition-component-row small { opacity: 0.62; font-size: inherit; }
	.nutrition-component-row strong { flex: none; font-weight: 500; font-variant-numeric: tabular-nums; }
	.nutrition-component-row-image { align-items: center; margin-top: 4px; }
	.nutrition-component-row-image img { width: 26px; height: 26px; flex: none; border-radius: 7px; object-fit: cover; }

	@media (max-width: 360px) {
		.nutrition-summary { padding-inline: 13px; }
		.nutrition-kcal-value { font-size: 24px; }
		.nutrition-kcal-status { max-width: 116px; }
		.nutrition-meal-entry { grid-template-columns: 43px minmax(0, 1fr); padding-inline: 10px; }
	}

	@media (prefers-reduced-motion: reduce) {
		.nutrition-kcal-track div { transition: none; }
	}
</style>

{#if goalSheetOpen}
	<NutritionGoalSheet
		initialKcal={goalKcal}
		initialProtein={goalProtein}
		initialFat={goalFat}
		initialCarbs={goalCarbs}
		initialFiber={goalFiber}
		onclose={() => (goalSheetOpen = false)}
		onsaved={() => { goalSheetOpen = false; void load(); }}
	/>
{/if}

{#if registerFoodOpen}
	<AddComponentSheet
		foodRegisterMode={true}
		onclose={() => (registerFoodOpen = false)}
		onadd={handleFoodRegistered}
	/>
{/if}

{#if postRegisterSheetOpen && registeredFood}
	<ManageSheetShell
		accent="#10B981"
		title="Food Registered!"
		subtitle="Saved to your product catalog"
		onclose={() => { postRegisterSheetOpen = false; registeredFood = null; }}
		zIndex={85}
		maxHeight="85dvh"
	>
		{#snippet body()}
			<div class="space-y-4">
				<div class="p-3.5 rounded-2xl bg-[var(--color-surface-container)] border border-[var(--bubble-container-border)]">
					<div class="flex items-start gap-3">
						{#if registeredFood.imageUrl}
							<img src={registeredFood.imageUrl} alt="" class="w-12 h-12 rounded-xl object-cover shrink-0" />
						{:else}
							<div class="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center text-xl shrink-0 font-bold">
								✓
							</div>
						{/if}
						<div class="min-w-0 flex-1">
							<h3 class="font-bold text-sm text-[var(--color-on-surface)] truncate">{registeredFood.displayName}</h3>
							{#if registeredFood.productBarcode}
								<p class="text-xs text-[var(--color-on-surface-variant)]">Barcode: {registeredFood.productBarcode}</p>
							{/if}
							{#if registeredFood.kcalPer100 != null}
								{@const servingGrams = registeredFood.gramsPerPiece || 100}
								{@const servingKcal = Math.round((registeredFood.kcalPer100 * servingGrams) / 100)}
								<p class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
									{servingKcal} kcal <span class="font-normal opacity-70">per serving ({servingGrams}g)</span>
								</p>
							{/if}
						</div>
					</div>
				</div>

				<div class="p-3 text-xs rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
					✓ This food is now saved in your database. When you scan its barcode or search for it again, its nutrition data will load automatically.
				</div>

				<div>
					<span class="block text-xs font-bold uppercase tracking-wider text-[var(--color-on-surface-variant)] mb-2">
						Would you like to add it to a meal today?
					</span>
					<div class="space-y-1.5">
						{#each availableSubdivisionNames as subName}
							<button
								type="button"
								class="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--color-surface-container)] hover:bg-[var(--color-surface-container-high)] border border-[var(--bubble-container-border)] transition-colors text-left"
								onclick={() => addRegisteredComponentToSubdivision(subName)}
							>
								<div class="flex items-center gap-2.5">
									<span class="text-base">🍽️</span>
									<span class="font-semibold text-xs text-[var(--color-on-surface)]">{subName}</span>
								</div>
								<span class="text-xs font-bold text-emerald-500 flex items-center gap-1">
									+ Add
								</span>
							</button>
						{/each}
					</div>
				</div>
			</div>
		{/snippet}

		{#snippet footer()}
			<button
				type="button"
				class="manage-primary !bg-emerald-600 w-full"
				onclick={() => { postRegisterSheetOpen = false; registeredFood = null; }}
			>
				Done (save only)
			</button>
		{/snippet}
	</ManageSheetShell>
{/if}
